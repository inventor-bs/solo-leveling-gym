import { ok, err, type Result } from "@/core/shared/result";
import type { VoiceDraft } from "@/ports/system-voice.port";
import type { VoiceSeverity } from "./types";

export const MAX_SENTENCES = 3;
export const MAX_WORDS = 45;
export const MAX_BODY_CHARS = 240;

export type ModerationRejection =
  | { type: "empty" }
  | { type: "markup" }
  | { type: "too-long" }
  | { type: "voice-rule" }
  | { type: "forbidden-text" }
  | { type: "hallucinated-number"; value: number };

export type ModeratedMessage = {
  readonly body: string;
  readonly severity: VoiceSeverity;
  readonly title: string | null;
};

export type ModerationInput = {
  readonly draft: VoiceDraft;
  readonly allowedNumbers: readonly number[];
  readonly forbiddenText: readonly string[];
};

/** Markdown emphasis and heading markers, removed without comment. */
const MARKDOWN = /[*_`#>]/g;
/** Anything that looks like a tag. Its presence is treated as an attack. */
const MARKUP = /[<>]/;
/** Emoji and other pictographs. */
const PICTOGRAPH = /\p{Extended_Pictographic}/u;
/**
 * A leading "-" only counts as a negative sign when it is not itself
 * preceded by a digit — otherwise "10-15 reps" would misparse its second
 * endpoint as -15 instead of the range separator it actually is. Commas
 * are accepted as thousand separators so "1,000" is read as one number,
 * not silently split into "1" and "0".
 */
const NUMBER = /(?<!\d)-?\d+(?:,\d{3})*(?:\.\d+)?/g;

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Numbers, compared by value rather than by the characters used to write
 * them: a model that renders 82.5 as "82.50" said something true.
 */
function firstUnallowedNumber(
  text: string,
  allowed: readonly number[],
): number | null {
  for (const match of text.match(NUMBER) ?? []) {
    const value = Number(match.replace(/,/g, ""));
    if (Number.isNaN(value)) continue;
    if (!allowed.some((a) => Math.abs(a - value) < 1e-9)) return value;
  }
  return null;
}

/**
 * Everything between a provider's typed response and the screen.
 *
 * The draft has already been proven to have the right SHAPE by the adapter
 * that parsed it. Nothing yet proves the CONTENT is safe or true, and this
 * text goes straight into the UI, so it is treated as hostile input until
 * each of these passes:
 *
 *   markup      — a tag is a strong signal of injection, so it is refused
 *                 rather than cleaned, on both body and title; markdown
 *                 emphasis is merely stripped from either
 *   length      — cut at a sentence boundary, never mid-clause, then
 *                 refused if what is left is still over the limits
 *   voice rules — no emoji, at most one exclamation mark, on both body and
 *                 title; the body must also address the reader as Hunter
 *                 (the title carries no such address requirement)
 *   identity    — must not contain anything on the forbidden list
 *   numbers     — every numeral must exist in the context the model was
 *                 given. One fabricated figure is enough to make every
 *                 later sentence untrustworthy, so a single miss fails the
 *                 whole message.
 *
 * Any failure returns to the caller, which falls back to the template. That
 * is not a degraded mode; it is the base layer doing its job.
 */
export function moderateDraft(
  input: ModerationInput,
): Result<ModeratedMessage, ModerationRejection> {
  const raw = input.draft.body ?? "";
  if (MARKUP.test(raw)) return err({ type: "markup" });
  if (input.draft.title !== null && MARKUP.test(input.draft.title)) {
    return err({ type: "markup" });
  }

  const stripped = raw.replace(MARKDOWN, "").replace(/\s+/g, " ").trim();
  if (stripped.length === 0) return err({ type: "empty" });

  const body = sentencesOf(stripped).slice(0, MAX_SENTENCES).join(" ").trim();
  if (body.length === 0) return err({ type: "empty" });
  if (body.length > MAX_BODY_CHARS) return err({ type: "too-long" });
  if (body.split(/\s+/).length > MAX_WORDS) return err({ type: "too-long" });

  if (PICTOGRAPH.test(body)) return err({ type: "voice-rule" });
  if (body.split("!").length - 1 > 1) return err({ type: "voice-rule" });
  if (!body.includes("Hunter")) return err({ type: "voice-rule" });

  const title =
    input.draft.title === null
      ? null
      : input.draft.title.replace(MARKDOWN, "").trim();

  if (title !== null) {
    if (PICTOGRAPH.test(title)) return err({ type: "voice-rule" });
    if (title.split("!").length - 1 > 1) return err({ type: "voice-rule" });
  }

  const checked = title === null ? body : `${body} ${title}`;
  for (const forbidden of input.forbiddenText) {
    if (forbidden.length > 0 && checked.includes(forbidden)) {
      return err({ type: "forbidden-text" });
    }
  }

  const bad = firstUnallowedNumber(checked, input.allowedNumbers);
  if (bad !== null) return err({ type: "hallucinated-number", value: bad });

  return ok({ body, severity: input.draft.severity, title });
}
