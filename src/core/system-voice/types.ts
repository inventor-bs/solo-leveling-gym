export type SystemContext = {
  readonly hunterName: string;
  readonly level: number;
  readonly rank: string;
  /** null on a rest day or a running day — no lifting program scheduled. */
  readonly todayProgramName: string | null;
  /** True only on a true rest day. Distinguishes "no lifting today" from "rest" so the voice doesn't tell a Hunter to recover on a running day. */
  readonly isRestDay: boolean;
  /** Consecutive days of cleared Daily Quests. 0 means no active streak. */
  readonly streakDays: number;
  readonly dailyQuestDone: boolean;
  readonly recentPr: { exerciseName: string; newE1rmKg: number } | null;
};

export type SystemMessage = {
  readonly body: string;
  readonly source: "template";
};
