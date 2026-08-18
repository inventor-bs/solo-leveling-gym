/**
 * Which voice the System speaks in.
 *
 * Three ids, not four. The default voice — Cold — is the `null` state of
 * this type and of the column that stores it, for two reasons that both
 * cost real bugs if ignored: the running database already holds NULL and
 * already speaks Cold, so a second spelling of that state would have to be
 * handled at every comparison forever; and Cold is the one voice that
 * cannot be bought, so a catalog row for it would carry no price and need
 * explaining wherever the catalog is iterated.
 *
 * A tone is a lookup key and never an operand. It selects which strings are
 * read and nothing else — it enters no calculation, changes no severity,
 * and changes no number the System is allowed to say.
 */
export type VoiceToneId = "mocking" | "ancient" | "merciless";

export type VoiceToneDef = {
  readonly id: VoiceToneId;
  readonly name: string;
  readonly description: string;
  /**
   * One line in this voice, reporting the same fact as every other sample.
   * Shown in the Store so 4,000 gold is an informed decision, and used as
   * the written standard for every template variant in this voice.
   */
  readonly sample: string;
};

export const VOICE_TONE_CATALOG: readonly VoiceToneDef[] = [
  {
    id: "mocking",
    name: "Mocking",
    description:
      "Contemptuous and challenging. Treats what you did as the least you could have done.",
    sample:
      "A personal record. Predictable, eventually. Do it again before you start believing it means something.",
  },
  {
    id: "ancient",
    name: "Ancient",
    description:
      "Formal and ceremonial, an old power addressing a subject it has already judged.",
    sample:
      "Hunter. Thy strength hath grown by a measure none shall dispute. Rest not upon it — the Gate awaits thy return.",
  },
  {
    id: "merciless",
    name: "Merciless",
    description:
      "Maximum brevity. Fragments over sentences. Nothing softened, nothing qualified.",
    sample:
      "New maximum. Noted. The next one will not come from standing still.",
  },
];

export function isVoiceToneId(value: string): value is VoiceToneId {
  return VOICE_TONE_CATALOG.some((tone) => tone.id === value);
}

/**
 * The default voice, described for the Store's preview only. It is not a
 * catalog row: it cannot be bought, cannot be lost, and needs no unlock.
 */
export const COLD_VOICE = {
  name: "Cold",
  description: "The System as it has always spoken. Free, and never for sale.",
  sample:
    "Hunter. Bench Press: 82.5 kg. A new record. Do not let this be the last time.",
} as const;

/**
 * One row unlocks all three tones at once. There is no per-tone key: only
 * one voice is ever alive at a time, so selling three of them for one slot
 * would be selling two things that are always idle.
 */
export const VOICE_OF_THE_RULER_UNLOCK_KEY = "voice:ruler";
