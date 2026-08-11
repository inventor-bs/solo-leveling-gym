import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  dailyQuest,
  type DailyQuestRow,
  type QuestStatus,
} from "../schema/quest";
import { questOverride, type QuestOverrideRow } from "../schema/quest-override";

export type QuestTargetField = "pushups" | "situps" | "squats" | "runKm";

export type CreateQuestInput = {
  id: string;
  day: string;
  rank: string;
  targetPushups: number;
  targetSitups: number;
  targetSquats: number;
  targetRunKm: number;
  createdAt: number;
};

export type ProgressDelta = {
  pushups?: number;
  situps?: number;
  squats?: number;
};

export class QuestRepo {
  constructor(private readonly db: Db) {}

  async byDay(day: string): Promise<DailyQuestRow | null> {
    const rows = await this.db
      .select()
      .from(dailyQuest)
      .where(eq(dailyQuest.day, day))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: CreateQuestInput): Promise<DailyQuestRow> {
    await this.db.insert(dailyQuest).values(input).onConflictDoNothing();
    const created = await this.byDay(input.day);
    if (!created) {
      throw new Error("QuestRepo.create: failed to read back after insert");
    }
    return created;
  }

  /**
   * Increments in SQL rather than read-modify-write: two taps landing at
   * once must not lose one of them.
   */
  async addProgress(day: string, delta: ProgressDelta): Promise<void> {
    const pushups = delta.pushups ?? 0;
    const situps = delta.situps ?? 0;
    const squats = delta.squats ?? 0;
    if (pushups === 0 && situps === 0 && squats === 0) return;

    await this.db
      .update(dailyQuest)
      .set({
        progressPushups: sql`${dailyQuest.progressPushups} + ${pushups}`,
        progressSitups: sql`${dailyQuest.progressSitups} + ${situps}`,
        progressSquats: sql`${dailyQuest.progressSquats} + ${squats}`,
      })
      .where(eq(dailyQuest.day, day));
  }

  /** Overwrites exactly one target field on today's row, leaving the rest untouched. */
  async setTarget(
    day: string,
    field: QuestTargetField,
    value: number,
  ): Promise<void> {
    switch (field) {
      case "pushups":
        await this.db
          .update(dailyQuest)
          .set({ targetPushups: value })
          .where(eq(dailyQuest.day, day));
        return;
      case "situps":
        await this.db
          .update(dailyQuest)
          .set({ targetSitups: value })
          .where(eq(dailyQuest.day, day));
        return;
      case "squats":
        await this.db
          .update(dailyQuest)
          .set({ targetSquats: value })
          .where(eq(dailyQuest.day, day));
        return;
      case "runKm":
        await this.db
          .update(dailyQuest)
          .set({ targetRunKm: value })
          .where(eq(dailyQuest.day, day));
        return;
    }
  }

  /** Null until this day's one allowed override has been recorded. */
  async overrideOnDay(day: string): Promise<QuestOverrideRow | null> {
    const rows = await this.db
      .select()
      .from(questOverride)
      .where(eq(questOverride.day, day))
      .limit(1);
    return rows[0] ?? null;
  }

  async recordOverride(
    day: string,
    field: string,
    previousValue: number,
    newValue: number,
    at: number,
  ): Promise<void> {
    await this.db
      .insert(questOverride)
      .values({ day, field, previousValue, newValue, appliedAt: at });
  }

  async setStatus(day: string, status: QuestStatus, at: number): Promise<void> {
    await this.db
      .update(dailyQuest)
      .set({ status, completedAt: at })
      .where(eq(dailyQuest.day, day));
  }

  /** Every quest issued inside [from, to], oldest first. */
  async between(from: string, to: string): Promise<DailyQuestRow[]> {
    return this.db
      .select()
      .from(dailyQuest)
      .where(and(gte(dailyQuest.day, from), lte(dailyQuest.day, to)))
      .orderBy(asc(dailyQuest.day));
  }

  /** Newest first. `completed` is the stored verdict, not a live recomputation. */
  async recentOutcomes(
    limitDays: number,
  ): Promise<{ day: string; completed: boolean }[]> {
    const rows = await this.db
      .select({ day: dailyQuest.day, status: dailyQuest.status })
      .from(dailyQuest)
      .orderBy(desc(dailyQuest.day))
      .limit(limitDays);
    return rows.map((r) => ({
      day: r.day,
      completed: r.status === "completed",
    }));
  }
}
