import {
  VOICE_OF_THE_RULER_UNLOCK_KEY,
  isVoiceToneId,
  type VoiceToneId,
} from "@/core/system-voice/tone";
import type { Container } from "@/server/container";

/**
 * Which voice the System is speaking in right now, or null for Cold.
 *
 * The single place this question is answered. Every caller — the pool
 * generator, the read-time template path, and the Store's view — asks here
 * rather than reading the column, so there is exactly one definition of
 * "active" and the Store can never show a voice the System is not using.
 *
 * A stored value is trusted only when BOTH hold: it names a real tone, and
 * the unlock that grants the right to choose one still exists. Failing
 * either is not an error — it is Cold, silently, on the next read.
 */
export async function resolveVoiceTone(
  container: Container,
): Promise<VoiceToneId | null> {
  const hunter = await container.hunters.get();
  const stored = hunter?.voiceTone ?? null;
  if (stored === null || !isVoiceToneId(stored)) return null;

  const owned = await container.store.isUnlocked(VOICE_OF_THE_RULER_UNLOCK_KEY);
  return owned ? stored : null;
}
