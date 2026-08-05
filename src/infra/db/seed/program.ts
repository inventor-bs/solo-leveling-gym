import type { Db } from "../client";
import { exercise, programDay, programDayExercise } from "../schema";

type ExerciseSeed = {
  id: string;
  name: string;
  muscle: string;
  kind: "compound" | "isolation";
  isMainLift: boolean;
  incrementKg: number;
};

type SlotSeed = {
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  repMin: number;
  repMax: number;
};

type ProgramDaySeed = {
  id: string;
  name: string;
  weekday: number;
  slots: SlotSeed[];
};

const EXERCISES: readonly ExerciseSeed[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    muscle: "chest",
    kind: "compound",
    isMainLift: true,
    incrementKg: 2.5,
  },
  {
    id: "barbell-row",
    name: "Barbell Row",
    muscle: "back",
    kind: "compound",
    isMainLift: true,
    incrementKg: 2.5,
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    muscle: "shoulders",
    kind: "compound",
    isMainLift: true,
    incrementKg: 2.5,
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    muscle: "back",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "db-curl",
    name: "DB Curl",
    muscle: "arms",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },
  {
    id: "triceps-pushdown",
    name: "Triceps Pushdown",
    muscle: "arms",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },

  {
    id: "back-squat",
    name: "Back Squat",
    muscle: "quads",
    kind: "compound",
    isMainLift: true,
    incrementKg: 5,
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    muscle: "posterior",
    kind: "compound",
    isMainLift: false,
    incrementKg: 5,
  },
  {
    id: "leg-press",
    name: "Leg Press",
    muscle: "quads",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 5,
  },
  {
    id: "leg-curl",
    name: "Leg Curl",
    muscle: "posterior",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "calf-raise",
    name: "Calf Raise",
    muscle: "quads",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "hanging-core-hold",
    name: "Hanging Core Hold",
    muscle: "core",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 0,
  },

  {
    id: "incline-db-press",
    name: "Incline DB Press",
    muscle: "chest",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    muscle: "back",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise",
    muscle: "shoulders",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },
  {
    id: "face-pull",
    name: "Face Pull",
    muscle: "shoulders",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },
  {
    id: "cable-fly",
    name: "Cable Fly",
    muscle: "chest",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl",
    muscle: "arms",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 1,
  },

  {
    id: "deadlift",
    name: "Deadlift",
    muscle: "posterior",
    kind: "compound",
    isMainLift: true,
    incrementKg: 5,
  },
  {
    id: "front-squat",
    name: "Front Squat",
    muscle: "quads",
    kind: "compound",
    isMainLift: false,
    incrementKg: 5,
  },
  {
    id: "bulgarian-split-squat",
    name: "Bulgarian Split Squat",
    muscle: "quads",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    muscle: "quads",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "seated-calf",
    name: "Seated Calf Raise",
    muscle: "quads",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 2.5,
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    muscle: "core",
    kind: "isolation",
    isMainLift: false,
    incrementKg: 0,
  },
] as const;

const PROGRAM_DAYS: readonly ProgramDaySeed[] = [
  {
    id: "upper-a",
    name: "Upper A",
    weekday: 1,
    slots: [
      {
        exerciseId: "bench-press",
        orderIndex: 0,
        targetSets: 4,
        repMin: 6,
        repMax: 8,
      },
      {
        exerciseId: "barbell-row",
        orderIndex: 1,
        targetSets: 4,
        repMin: 6,
        repMax: 8,
      },
      {
        exerciseId: "overhead-press",
        orderIndex: 2,
        targetSets: 3,
        repMin: 8,
        repMax: 10,
      },
      {
        exerciseId: "lat-pulldown",
        orderIndex: 3,
        targetSets: 3,
        repMin: 10,
        repMax: 12,
      },
      {
        exerciseId: "db-curl",
        orderIndex: 4,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
      {
        exerciseId: "triceps-pushdown",
        orderIndex: 5,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
    ],
  },
  {
    id: "lower-a",
    name: "Lower A",
    weekday: 3,
    slots: [
      {
        exerciseId: "back-squat",
        orderIndex: 0,
        targetSets: 4,
        repMin: 6,
        repMax: 8,
      },
      {
        exerciseId: "romanian-deadlift",
        orderIndex: 1,
        targetSets: 3,
        repMin: 8,
        repMax: 10,
      },
      {
        exerciseId: "leg-press",
        orderIndex: 2,
        targetSets: 3,
        repMin: 10,
        repMax: 12,
      },
      {
        exerciseId: "leg-curl",
        orderIndex: 3,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
      {
        exerciseId: "calf-raise",
        orderIndex: 4,
        targetSets: 4,
        repMin: 15,
        repMax: 20,
      },
      {
        exerciseId: "hanging-core-hold",
        orderIndex: 5,
        targetSets: 3,
        repMin: 1,
        repMax: 1,
      },
    ],
  },
  {
    id: "upper-b",
    name: "Upper B",
    weekday: 5,
    slots: [
      {
        exerciseId: "incline-db-press",
        orderIndex: 0,
        targetSets: 4,
        repMin: 10,
        repMax: 12,
      },
      {
        exerciseId: "seated-cable-row",
        orderIndex: 1,
        targetSets: 4,
        repMin: 10,
        repMax: 12,
      },
      {
        exerciseId: "lateral-raise",
        orderIndex: 2,
        targetSets: 3,
        repMin: 15,
        repMax: 20,
      },
      {
        exerciseId: "face-pull",
        orderIndex: 3,
        targetSets: 3,
        repMin: 15,
        repMax: 20,
      },
      {
        exerciseId: "cable-fly",
        orderIndex: 4,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
      {
        exerciseId: "hammer-curl",
        orderIndex: 5,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
    ],
  },
  {
    id: "lower-b",
    name: "Lower B",
    weekday: 6,
    slots: [
      {
        exerciseId: "deadlift",
        orderIndex: 0,
        targetSets: 3,
        repMin: 5,
        repMax: 6,
      },
      {
        exerciseId: "front-squat",
        orderIndex: 1,
        targetSets: 3,
        repMin: 8,
        repMax: 10,
      },
      {
        exerciseId: "bulgarian-split-squat",
        orderIndex: 2,
        targetSets: 3,
        repMin: 10,
        repMax: 12,
      },
      {
        exerciseId: "leg-extension",
        orderIndex: 3,
        targetSets: 3,
        repMin: 15,
        repMax: 20,
      },
      {
        exerciseId: "seated-calf",
        orderIndex: 4,
        targetSets: 4,
        repMin: 15,
        repMax: 20,
      },
      {
        exerciseId: "hanging-leg-raise",
        orderIndex: 5,
        targetSets: 3,
        repMin: 12,
        repMax: 15,
      },
    ],
  },
] as const;

/** Safe to call repeatedly — upserts by primary key / unique index. */
export async function seedProgram(db: Db): Promise<void> {
  for (const e of EXERCISES) {
    await db
      .insert(exercise)
      .values(e)
      .onConflictDoUpdate({ target: exercise.id, set: { ...e } });
  }

  for (const day of PROGRAM_DAYS) {
    await db
      .insert(programDay)
      .values({ id: day.id, name: day.name, weekday: day.weekday })
      .onConflictDoUpdate({
        target: programDay.id,
        set: { name: day.name, weekday: day.weekday },
      });

    for (const slot of day.slots) {
      await db
        .insert(programDayExercise)
        .values({ programDayId: day.id, ...slot })
        .onConflictDoUpdate({
          target: [
            programDayExercise.programDayId,
            programDayExercise.exerciseId,
          ],
          set: { ...slot },
        });
    }
  }
}
