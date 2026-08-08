import { toTrainingDay } from "@/core/shared/training-day";
import { buildSystemMessage } from "@/core/system-voice/template-engine";
import type {
  SystemMessage,
  VoiceMessageKind,
  VoiceSeverity,
  VoiceSource,
} from "@/core/system-voice/types";
import { seededRng } from "@/infra/rng/seeded-rng";
import type { Container } from "@/server/container";
import { buildSystemContext } from "./system-context";

/**
 * What The System says right now, from whichever source can answer.
 *
 * The pool is checked first because a pooled message was written hours ago
 * and costs one indexed lookup. When the slot is empty — no provider
 * configured, quota spent, breaker open, gate failed — the template answers
 * instead, from the same context, with no visible difference in speed.
 *
 * Silence is evaluated here rather than trusted from the pool. The pool is
 * generated at midnight, and a penalty can cross the silence threshold
 * later in the day; a message written before that must not survive it.
 */
export async function getSystemMessage(
  container: Container,
  kind: VoiceMessageKind,
): Promise<SystemMessage | null> {
  const context = await buildSystemContext(container);
  if (!context) return null;

  // A seed that changes with the day and the slot, so two panels on the
  // same day do not open with the identical line.
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const seed = [...`${today}:${kind}`].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    7,
  );
  const fallback = buildSystemMessage(context, seededRng(seed));

  if (context.penaltySilent) return fallback;

  const row = await container.systemMessages.byDayAndKind(today, kind);
  if (!row) return fallback;

  return {
    body: row.body,
    severity: row.severity as VoiceSeverity,
    source: row.source as VoiceSource,
  };
}
