import { ok, err, type Result } from "@/core/shared/result";
import {
  VOICE_OF_THE_RULER_UNLOCK_KEY,
  isVoiceToneId,
  type VoiceToneId,
} from "@/core/system-voice/tone";
import type { Container } from "@/server/container";

export type EquipVoiceToneResult = { voiceTone: VoiceToneId | null };

export type EquipVoiceToneError =
  | { type: "hunter-not-found" }
  | { type: "unknown-tone" }
  | { type: "tone-not-owned" };

/**
 * Chooses which voice the System speaks in, or returns it to the default.
 *
 * Passing null is always allowed, including for a hunter who has bought
 * nothing: Cold is the state everyone starts in rather than a right that
 * has to be held. One unlock covers all three purchased tones, so switching
 * between them costs nothing and can happen as often as the hunter likes.
 */
export async function equipVoiceTone(
  container: Container,
  toneId: string | null,
): Promise<Result<EquipVoiceToneResult, EquipVoiceToneError>> {
  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  if (toneId === null) {
    await container.hunters.update({ voiceTone: null });
    return ok({ voiceTone: null });
  }

  if (!isVoiceToneId(toneId)) return err({ type: "unknown-tone" });

  const owned = await container.store.isUnlocked(VOICE_OF_THE_RULER_UNLOCK_KEY);
  if (!owned) return err({ type: "tone-not-owned" });

  await container.hunters.update({ voiceTone: toneId });
  return ok({ voiceTone: toneId });
}
