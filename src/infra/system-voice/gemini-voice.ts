import { z } from "zod";
import {
  VoiceGenerationError,
  type SystemVoicePort,
  type VoiceDraft,
  type VoiceRequest,
} from "@/ports/system-voice.port";

/**
 * One constant, deliberately. Provider model names move; every failure mode
 * of getting this wrong ends at the template fallback, so a stale value
 * costs the day's generated voice and nothing else.
 */
export const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * A ceiling, not a target. This runs inside the daily reset, and a request
 * with no limit would hold the cron open indefinitely.
 */
export const GEMINI_TIMEOUT_MS = 3000;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** The response envelope, narrowed to the one field that carries text. */
const envelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })).min(1),
        }),
      }),
    )
    .min(1),
});

/**
 * The contract the model is told to follow. This is the first of the gates
 * standing between generated text and the screen, and it lives here rather
 * than in the domain because parsing untrusted transport payloads is an
 * adapter's job — and because keeping it here leaves core dependency-free.
 */
const draftSchema = z.object({
  body: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string().nullable().optional(),
});

/**
 * Returns null when no key is configured, which is the normal state in
 * local development, in CI, and on any deploy where the key has not been
 * set. Callers treat null as "there is no provider today" and use the
 * template, so an unset key is a supported configuration rather than an
 * outage.
 */
export function createGeminiVoice(
  apiKey: string | undefined,
): SystemVoicePort | null {
  if (!apiKey) return null;

  return {
    async generate(request: VoiceRequest): Promise<VoiceDraft> {
      let payload: unknown;
      try {
        const response = await fetch(
          `${ENDPOINT}/${GEMINI_MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: request.systemPrompt }],
              },
              contents: [
                { role: "user", parts: [{ text: request.userPrompt }] },
              ],
              generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 256,
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          },
        );
        if (!response.ok) {
          // The status only. The key travels via a header, never the URL,
          // so there is nothing here that could leak it into a log line.
          throw new VoiceGenerationError(
            `Voice provider returned status ${response.status}`,
          );
        }
        payload = await response.json();
      } catch (cause) {
        if (cause instanceof VoiceGenerationError) throw cause;
        throw new VoiceGenerationError("Voice provider request failed", cause);
      }

      const envelope = envelopeSchema.safeParse(payload);
      if (!envelope.success) {
        throw new VoiceGenerationError(
          "Voice provider returned an unknown shape",
        );
      }

      // Non-null assertions are safe here: the schema's .min(1) on both
      // arrays already proved index 0 exists; noUncheckedIndexedAccess
      // just can't see that guarantee through the Zod type.
      const text = envelope.data.candidates[0]!.content.parts[0]!.text;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new VoiceGenerationError(
          "Voice provider did not return JSON",
          cause,
        );
      }

      const draft = draftSchema.safeParse(parsed);
      if (!draft.success) {
        throw new VoiceGenerationError(
          "Voice provider broke the output contract",
        );
      }

      return {
        body: draft.data.body,
        severity: draft.data.severity,
        title: draft.data.title ?? null,
      };
    },
  };
}
