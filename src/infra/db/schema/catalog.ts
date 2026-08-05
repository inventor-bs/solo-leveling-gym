import {
  sqliteTable,
  text,
  real,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The exercise catalog. Static reference data — not user-generated.
 * muscle/kind mirror core/training/types.ts's MuscleGroup/ExerciseKind
 * as plain strings; the DB layer doesn't import core's branded types.
 */
export const exercise = sqliteTable("exercise", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  muscle: text("muscle").notNull(),
  kind: text("kind").notNull(),
  isMainLift: integer("is_main_lift", { mode: "boolean" })
    .notNull()
    .default(false),
  incrementKg: real("increment_kg").notNull(),
});

export type ExerciseRow = typeof exercise.$inferSelect;

/** One of the four lifting days: Upper A, Lower A, Upper B, Lower B. */
export const programDay = sqliteTable("program_day", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** ISO weekday, 1=Monday..7=Sunday. Used to find "today's" program day. */
  weekday: integer("weekday").notNull(),
});

export type ProgramDayRow = typeof programDay.$inferSelect;

/** Prescribes one exercise's set/rep scheme within a program day. */
export const programDayExercise = sqliteTable(
  "program_day_exercise",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programDayId: text("program_day_id")
      .notNull()
      .references(() => programDay.id),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercise.id),
    orderIndex: integer("order_index").notNull(),
    targetSets: integer("target_sets").notNull(),
    repMin: integer("rep_min").notNull(),
    repMax: integer("rep_max").notNull(),
  },
  (table) => ({
    dayExerciseIdx: uniqueIndex("program_day_exercise_unique_idx").on(
      table.programDayId,
      table.exerciseId,
    ),
  }),
);

export type ProgramDayExerciseRow = typeof programDayExercise.$inferSelect;
