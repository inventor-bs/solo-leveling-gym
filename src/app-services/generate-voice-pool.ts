import { toTrainingDay } from "@/core/shared/training-day";
import { buildVoicePlan } from "@/core/system-voice/prompt";
import { moderateDraft } from "@/core/system-voice/moderation";
import {
  afterFailure,
  afterSuccess,
  canGenerate,
  type QuotaState,
} from "@/core/system-voice/quota";
import { VOICE_POOL_KINDS } from "@/core/system-voice/types";
import type { Container } from "@/server/container";
import { resolveVoiceTone } from "./active-voice-tone";
import { buildSystemContext } from "./system-context";

export type VoicePoolSummary = {
  attempted: number;
  stored: number;
  rejected: number;
  failed: number;
};

/** Which provider produced the day's messages. Stored on every row. */
const SOURCE = "gemini";

/**
 * Fills the day's message slots, once, at the reset.
 *
 * This is the only place in the app that calls a language model, and it is
 * deliberately nowhere near a request the hunter is waiting on. Generation
 * takes seconds; a hunter standing over a bar having just broken a record
 * does not want to watch a spinner decide what it meant. Every read either
 * finds a row here or builds a template message, and neither path waits on
 * anything.
 *
 * Never throws. A provider outage, a bad response, a message that fails the
 * gate — all of them leave a slot empty, and an empty slot is a complete
 * answer.
 */
export async function generateVoicePool(
  container: Container,
): Promise<VoicePoolSummary> {
  const summary: VoicePoolSummary = {
    attempted: 0,
    stored: 0,
    rejected: 0,
    failed: 0,
  };

  const voice = container.voice;
  if (!voice) return summary;

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);

  const context = await buildSystemContext(container);
  if (!context) return summary;

  // Resolved once per run, not per message: the voice cannot change
  // between two slots of the same reset.
  const tone = await resolveVoiceTone(container);

  let quota: QuotaState = await container.voiceQuota.forDay(today);

  for (const kind of VOICE_POOL_KINDS) {
    if (!canGenerate(quota)) break;
    // A filled slot is never refilled: the day's briefing must not change
    // under someone who has already read it.
    if (await container.systemMessages.byDayAndKind(today, kind)) continue;

    summary.attempted += 1;
    const plan = buildVoicePlan(kind, context, tone);

    try {
      const draft = await voice.generate(plan.request);
      quota = afterSuccess(quota);

      const moderated = moderateDraft({
        draft,
        allowedNumbers: plan.allowedNumbers,
        forbiddenText: plan.forbiddenText,
      });
      if (!moderated.ok) {
        summary.rejected += 1;
        continue;
      }

      await container.systemMessages.insert({
        day: today,
        kind,
        body: moderated.value.body,
        severity: moderated.value.severity,
        source: SOURCE,
        createdAt: now,
      });
      summary.stored += 1;
    } catch {
      // The error itself is deliberately not surfaced: it may carry provider
      // detail, and the only decision that depends on it is "count it".
      quota = afterFailure(quota);
      summary.failed += 1;
    }
  }

  await container.voiceQuota.save(today, quota);
  return summary;
}
