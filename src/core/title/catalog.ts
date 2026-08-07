/**
 * A title is a small passive buff, earned only by training and worn one at
 * a time. Nothing here is purchasable, and nothing here can be granted —
 * every id in this catalog has a condition that reads real training data.
 */
export type TitleId = "unyielding" | "monarch-of-dawn" | "one-who-returned";

export type TitleDef = {
  readonly id: TitleId;
  readonly name: string;
  /** Shown next to a title the hunter has not earned yet. */
  readonly condition: string;
  /** Shown next to a title the hunter can wear. */
  readonly buff: string;
};

/** Consecutive completed Daily Quest days that earn Unyielding. */
export const UNYIELDING_STREAK_DAYS = 30;
/** Completed sessions started before the morning cutoff that earn Monarch of Dawn. */
export const MONARCH_MORNING_SESSIONS = 10;
/** Local hour a session must start before to count as a morning session. */
export const MORNING_BEFORE_HOUR = 7;
/** Penalty Zone escapes that earn One Who Returned. */
export const RETURNED_PENALTY_EXITS = 5;

export const TITLE_CATALOG: readonly TitleDef[] = [
  {
    id: "unyielding",
    name: "Unyielding",
    condition: "Hold a 30-day Daily Quest streak",
    buff: "-20% of the EXP lost when the Penalty Zone opens",
  },
  {
    id: "monarch-of-dawn",
    name: "Monarch of Dawn",
    condition: "Complete 10 sessions started before 07:00",
    buff: "+15% gold from sessions started before 07:00",
  },
  {
    id: "one-who-returned",
    name: "One Who Returned",
    condition: "Escape the Penalty Zone 5 times",
    buff: "+10% EXP on the first session after each escape",
  },
] as const;

export function titleById(id: string): TitleDef | null {
  return TITLE_CATALOG.find((t) => t.id === id) ?? null;
}

/**
 * The runtime guard for hunter.title, which is a plain nullable text column.
 * Every buff lookup goes through this so a stale or hand-edited value can
 * never be treated as a real title.
 */
export function isTitleId(value: string): value is TitleId {
  return titleById(value) !== null;
}
