export type SystemContext = {
  readonly hunterName: string;
  readonly level: number;
  readonly rank: string;
  /** null on a rest day or a running day — no lifting program scheduled. */
  readonly todayProgramName: string | null;
  readonly recentPr: { exerciseName: string; newE1rmKg: number } | null;
};

export type SystemMessage = {
  readonly body: string;
  readonly source: "template";
};
