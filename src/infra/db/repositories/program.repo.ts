import { eq, asc } from "drizzle-orm";
import type { Db } from "../client";
import {
  programDay,
  programDayExercise,
  exercise,
  type ProgramDayRow,
  type ProgramDayExerciseRow,
  type ExerciseRow,
} from "../schema/catalog";

export type ProgramDayWithExercises = {
  programDay: ProgramDayRow;
  exercises: { exercise: ExerciseRow; slot: ProgramDayExerciseRow }[];
};

export class ProgramRepo {
  constructor(private readonly db: Db) {}

  private async withExercises(
    day: ProgramDayRow,
  ): Promise<ProgramDayWithExercises> {
    const rows = await this.db
      .select({ slot: programDayExercise, exercise })
      .from(programDayExercise)
      .innerJoin(exercise, eq(exercise.id, programDayExercise.exerciseId))
      .where(eq(programDayExercise.programDayId, day.id))
      .orderBy(asc(programDayExercise.orderIndex));

    return { programDay: day, exercises: rows };
  }

  async byId(id: string): Promise<ProgramDayWithExercises | null> {
    const rows = await this.db
      .select()
      .from(programDay)
      .where(eq(programDay.id, id))
      .limit(1);
    const day = rows[0];
    return day ? this.withExercises(day) : null;
  }

  async byWeekday(weekday: number): Promise<ProgramDayWithExercises | null> {
    const rows = await this.db
      .select()
      .from(programDay)
      .where(eq(programDay.weekday, weekday))
      .limit(1);
    const day = rows[0];
    return day ? this.withExercises(day) : null;
  }

  /** The whole weekly lifting schedule, used to spot a skipped day. */
  async allDays(): Promise<ProgramDayRow[]> {
    return this.db.select().from(programDay).orderBy(asc(programDay.weekday));
  }
}
