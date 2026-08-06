import { eq, and, ne, isNotNull, desc } from "drizzle-orm";
import { kg, reps, type Kg } from "@/core/shared/units";
import {
  toExercisePerformance,
  type ExercisePerformance,
} from "@/core/training/overload";
import { bestE1rmForExercise } from "@/core/training/pr";
import { sessionVolumeLoad } from "@/core/training/volume";
import type { LoggedSet } from "@/core/training/types";
import type { Db } from "../client";
import {
  session,
  setLog,
  runLog,
  type SessionRow,
  type SetLogRow,
  type RunLogRow,
} from "../schema/training";

function toLoggedSet(row: SetLogRow): LoggedSet {
  return {
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    reps: reps(row.reps),
    weight: kg(row.weight),
    completed: row.completed,
  };
}

export class TrainingRepo {
  constructor(private readonly db: Db) {}

  async createSession(input: {
    id: string;
    day: string;
    programDayId: string;
    startedAt: number;
  }): Promise<SessionRow> {
    await this.db.insert(session).values(input);
    const created = await this.getSession(input.id);
    if (!created) {
      throw new Error(
        "TrainingRepo.createSession: failed to read back after insert",
      );
    }
    return created;
  }

  async getSession(id: string): Promise<SessionRow | null> {
    const rows = await this.db
      .select()
      .from(session)
      .where(eq(session.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async completeSession(
    id: string,
    endedAt: number,
    rank: string,
  ): Promise<void> {
    await this.db
      .update(session)
      .set({ endedAt, rank })
      .where(eq(session.id, id));
  }

  async upsertSetLog(input: {
    id: string;
    sessionId: string;
    exerciseId: string;
    setIndex: number;
    reps: number;
    weight: number;
    completed: boolean;
    isPr: boolean;
    loggedAt: number;
  }): Promise<SetLogRow> {
    await this.db
      .insert(setLog)
      .values(input)
      .onConflictDoUpdate({
        target: [setLog.sessionId, setLog.exerciseId, setLog.setIndex],
        set: {
          reps: input.reps,
          weight: input.weight,
          completed: input.completed,
          isPr: input.isPr,
          loggedAt: input.loggedAt,
        },
      });
    const rows = await this.db
      .select()
      .from(setLog)
      .where(
        and(
          eq(setLog.sessionId, input.sessionId),
          eq(setLog.exerciseId, input.exerciseId),
          eq(setLog.setIndex, input.setIndex),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(
        "TrainingRepo.upsertSetLog: failed to read back after upsert",
      );
    }
    return row;
  }

  async getSetsForSession(sessionId: string): Promise<SetLogRow[]> {
    return this.db.select().from(setLog).where(eq(setLog.sessionId, sessionId));
  }

  /**
   * Sessions with sets for this exercise, completed, most recent first.
   * N+1 by design: `limit` is small (2 for overload, up to ~8 for volume
   * averaging) and this is a single-user app — a join+GROUP BY would be
   * premature optimization for data that will never be large.
   */
  private async completedSessionIdsWithExercise(
    exerciseId: string,
    limit: number,
    excludeSessionId?: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ sessionId: setLog.sessionId, endedAt: session.endedAt })
      .from(setLog)
      .innerJoin(session, eq(session.id, setLog.sessionId))
      .where(
        and(
          eq(setLog.exerciseId, exerciseId),
          eq(setLog.completed, true),
          isNotNull(session.endedAt),
          excludeSessionId ? ne(session.id, excludeSessionId) : undefined,
        ),
      )
      .orderBy(desc(session.endedAt))
      .limit(limit);
    return rows.map((r) => r.sessionId);
  }

  async getExercisePerformanceHistory(
    exerciseId: string,
    limit: number,
    excludeSessionId?: string,
  ): Promise<ExercisePerformance[]> {
    const sessionIds = await this.completedSessionIdsWithExercise(
      exerciseId,
      limit,
      excludeSessionId,
    );
    const result: ExercisePerformance[] = [];
    for (const id of sessionIds) {
      const sets = await this.getSetsForSession(id);
      const perf = toExercisePerformance(sets.map(toLoggedSet), exerciseId);
      if (perf) result.push(perf);
    }
    return result;
  }

  async bestHistoricalE1rm(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<Kg> {
    const sessionIds = await this.completedSessionIdsWithExercise(
      exerciseId,
      // No practical cap — "best ever" needs full history. Fine at this scale.
      100_000,
      excludeSessionId,
    );
    let best = kg(0);
    for (const id of sessionIds) {
      const sets = await this.getSetsForSession(id);
      const e1rm = bestE1rmForExercise(sets.map(toLoggedSet), exerciseId);
      if (e1rm > best) best = e1rm;
    }
    return best;
  }

  async getRecentSessionVolumes(
    limit: number,
    excludeSessionId?: string,
  ): Promise<number[]> {
    const rows = await this.db
      .select()
      .from(session)
      .where(
        and(
          isNotNull(session.endedAt),
          excludeSessionId ? ne(session.id, excludeSessionId) : undefined,
        ),
      )
      .orderBy(desc(session.endedAt))
      .limit(limit);

    const volumes: number[] = [];
    for (const s of rows) {
      const sets = await this.getSetsForSession(s.id);
      volumes.push(sessionVolumeLoad(sets.map(toLoggedSet)));
    }
    return volumes;
  }

  async createRun(input: {
    id: string;
    day: string;
    distanceKm: number;
    durationSec: number;
    loggedAt: number;
  }): Promise<RunLogRow> {
    await this.db.insert(runLog).values(input);
    const rows = await this.db
      .select()
      .from(runLog)
      .where(eq(runLog.id, input.id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(
        "TrainingRepo.createRun: failed to read back after insert",
      );
    }
    return row;
  }

  /** Total distance logged on a calendar day, across however many runs. */
  async kmOnDay(day: string): Promise<number> {
    const rows = await this.db
      .select({ km: runLog.distanceKm })
      .from(runLog)
      .where(eq(runLog.day, day));
    return rows.reduce((sum, r) => sum + r.km, 0);
  }
}
