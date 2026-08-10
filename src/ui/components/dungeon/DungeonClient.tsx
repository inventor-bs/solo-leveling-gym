"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  startSessionAction,
  logSetAction,
  completeSessionAction,
} from "@/server/actions/training.actions";
import type { ActionError } from "@/server/actions/action-result";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

type DungeonType = "standard" | "amrap" | "emom" | "dropset";
type DungeonTypeUnlockId = "amrap" | "emom" | "dropset";

type PlannedExercise = {
  exerciseId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  suggestedWeight: number;
  suggestedReps: number;
  dungeonType: DungeonType;
  timeLimitSec: number | null;
};

/** The type's instruction, shown under the exercise name. Display only. */
const DUNGEON_TYPE_LABEL: Record<DungeonType, string | null> = {
  standard: null,
  emom: "EMOM — one set on the minute",
  amrap: "AMRAP — as many reps as the window allows",
  dropset: "DROP-SET — strip the weight down set by set",
};

/** Shown in the pre-session chamber-type picker's dropdown. */
const DUNGEON_TYPE_CHOICE_LABEL: Record<DungeonType, string> = {
  standard: "Standard",
  amrap: "AMRAP",
  emom: "EMOM",
  dropset: "Drop-set",
};

type SetState = { reps: number; weight: number; completed: boolean };

/** Derived so the success payload stays in sync with the action itself. */
type ClearedResult = Extract<
  Awaited<ReturnType<typeof completeSessionAction>>,
  { ok: true }
>["value"];

export type DungeonPreviewExercise = {
  exerciseId: string;
  name: string;
  muscle: string;
};

type DungeonContentProps = {
  exercises: DungeonPreviewExercise[];
  unlockedDungeonTypes: DungeonTypeUnlockId[];
};

function DungeonContent({
  exercises,
  unlockedDungeonTypes,
}: DungeonContentProps) {
  const params = useSearchParams();
  const router = useRouter();
  const programDayId = params.get("programDayId");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedExercise[]>([]);
  const [sets, setSets] = useState<Record<string, SetState[]>>({});
  // Skipped for the common case (nothing unlocked yet): the session opens
  // the moment the page loads, exactly as it always has. Only a hunter who
  // has actually bought a dungeon type sees the extra step below.
  const [loading, setLoading] = useState(unlockedDungeonTypes.length === 0);
  const [error, setError] = useState<ActionError | null>(null);
  const [result, setResult] = useState<ClearedResult | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, DungeonTypeUnlockId>
  >({});

  const beginSession = useCallback(
    async (chosenOverrides: Record<string, DungeonTypeUnlockId>) => {
      if (!programDayId) return;
      setLoading(true);
      setError(null);
      const res = await startSessionAction({
        programDayId,
        dungeonTypeOverrides:
          Object.keys(chosenOverrides).length > 0 ? chosenOverrides : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setSessionId(res.value.sessionId);
      setPlan(res.value.plan);
      setSets(
        Object.fromEntries(
          res.value.plan.map((p) => [
            p.exerciseId,
            Array.from({ length: p.targetSets }, () => ({
              reps: p.suggestedReps,
              weight: p.suggestedWeight,
              completed: false,
            })),
          ]),
        ),
      );
      setLoading(false);
    },
    [programDayId],
  );

  useEffect(() => {
    if (!programDayId) return;
    // Nothing unlocked — open the gate exactly as before, no extra step.
    // Otherwise the hunter picks a type first; beginSession runs on click.
    if (unlockedDungeonTypes.length > 0) return;
    beginSession({});
    // Only ever meant to fire once, on mount, for the auto-start path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programDayId]);

  const logOneSet = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!sessionId) return;
      const current = sets[exerciseId]?.[setIndex];
      if (!current) return;
      setError(null);
      const res = await logSetAction({
        sessionId,
        exerciseId,
        setIndex,
        reps: current.reps,
        weight: current.weight,
        completed: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSets((prev) => ({
        ...prev,
        [exerciseId]: (prev[exerciseId] ?? []).map((s, i) =>
          i === setIndex ? { ...s, completed: true } : s,
        ),
      }));
    },
    [sessionId, sets],
  );

  async function complete() {
    if (!sessionId) return;
    setError(null);
    const res = await completeSessionAction({ sessionId });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.value);
  }

  if (!programDayId) {
    return (
      <div className="p-8 font-mono text-sm text-slate-400">
        No dungeon selected. Return to the dashboard.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 font-mono text-sm text-slate-400">
        Opening the gate...
      </div>
    );
  }

  // At least one dungeon type is unlocked and no session has started yet —
  // ask which type each exercise should use before opening the gate. Reached
  // only once loading clears, so this never flashes in front of the spinner.
  if (sessionId === null && unlockedDungeonTypes.length > 0) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        {error && <ActionErrorNotice error={error} />}
        <SystemPanel header="CHAMBER SELECTION">
          <div className="p-4 space-y-3">
            <p className="font-mono text-xs text-slate-500">
              Choose how each exercise runs. Standard is the default.
            </p>
            {exercises.map((ex) => (
              <div
                key={ex.exerciseId}
                className="flex items-center justify-between gap-3 font-mono text-sm"
              >
                <span className="text-slate-300">{ex.name}</span>
                <select
                  value={overrides[ex.exerciseId] ?? "standard"}
                  onChange={(e) => {
                    const value = e.target.value as DungeonType;
                    setOverrides((prev) => {
                      const next = { ...prev };
                      if (value === "standard") {
                        delete next[ex.exerciseId];
                      } else {
                        next[ex.exerciseId] = value;
                      }
                      return next;
                    });
                  }}
                  className="bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white"
                >
                  <option value="standard">
                    {DUNGEON_TYPE_CHOICE_LABEL.standard}
                  </option>
                  {unlockedDungeonTypes.map((type) => (
                    <option key={type} value={type}>
                      {DUNGEON_TYPE_CHOICE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              onClick={() => beginSession(overrides)}
              className="w-full bg-system-blue/10 border border-system-blue/40 text-system-blue
                font-mono text-sm tracking-widest py-3 rounded hover:bg-system-blue/20 transition-colors"
            >
              ▸ ENTER DUNGEON
            </button>
          </div>
        </SystemPanel>
      </div>
    );
  }

  // A failure before the plan loaded leaves nothing to render but the reason.
  // Only reached for the plain auto-start flow — the picker above already
  // renders its own inline error and never falls through to here.
  if (error && plan.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <ActionErrorNotice error={error} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <SystemPanel header="DUNGEON CLEARED" className="max-w-md">
          <div className="p-6 space-y-2 text-center">
            <p className="font-cinzel text-2xl text-white">
              {result.rank}-RANK
            </p>
            <p className="font-mono text-sm text-gold">
              +{result.goldAwarded} Gold
            </p>
            <p className="font-mono text-sm text-system-blue">
              +{result.expAwarded} EXP
            </p>
            {result.levelsGained > 0 && (
              <p className="font-mono text-sm text-monarch-light animate-glow-pulse">
                LEVEL UP ×{result.levelsGained}
              </p>
            )}
            {result.prGold > 0 && (
              <p className="font-mono text-sm text-gold">
                +{result.prGold} Gold — record broken
              </p>
            )}
            {result.levelUpGold > 0 && (
              <p className="font-mono text-sm text-gold">
                +{result.levelUpGold} Gold — level reward
              </p>
            )}
            {result.challenge && (
              <p
                className={
                  result.challenge.cleared
                    ? "font-mono text-sm text-success"
                    : "font-mono text-sm text-danger"
                }
              >
                {result.challenge.cleared
                  ? `${result.challenge.type.toUpperCase()} CLEARED`
                  : `${result.challenge.type.toUpperCase()} FAILED`}
              </p>
            )}
            {result.drop && (
              <p className="font-mono text-sm text-monarch-light animate-glow-pulse">
                DROP — {result.drop.name} ({result.drop.grade})
              </p>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 bg-system-blue/10 border border-system-blue/40 text-system-blue
                font-mono text-sm tracking-widest px-6 py-2 rounded hover:bg-system-blue/20"
            >
              RETURN
            </button>
          </div>
        </SystemPanel>
      </div>
    );
  }

  const allSetsDone = plan.every((p) =>
    (sets[p.exerciseId] ?? []).every((s) => s.completed),
  );

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {error && <ActionErrorNotice error={error} />}

      {plan.map((exercise) => (
        <SystemPanel key={exercise.exerciseId} header={exercise.name}>
          <div className="p-4 space-y-2">
            {DUNGEON_TYPE_LABEL[exercise.dungeonType] && (
              <p className="font-mono text-xs text-monarch-light">
                {DUNGEON_TYPE_LABEL[exercise.dungeonType]}
                {exercise.timeLimitSec !== null &&
                  ` · ${Math.round(exercise.timeLimitSec / 60)} min`}
              </p>
            )}
            {(sets[exercise.exerciseId] ?? []).map((set, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 font-mono text-sm"
              >
                <span className="text-slate-500 w-16">Set {i + 1}</span>
                <input
                  type="number"
                  value={set.weight}
                  disabled={set.completed}
                  onChange={(e) =>
                    setSets((prev) => ({
                      ...prev,
                      [exercise.exerciseId]: (
                        prev[exercise.exerciseId] ?? []
                      ).map((s, si) =>
                        si === i ? { ...s, weight: Number(e.target.value) } : s,
                      ),
                    }))
                  }
                  className="w-20 bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white"
                />
                <span className="text-slate-500">kg ×</span>
                <input
                  type="number"
                  value={set.reps}
                  disabled={set.completed}
                  onChange={(e) =>
                    setSets((prev) => ({
                      ...prev,
                      [exercise.exerciseId]: (
                        prev[exercise.exerciseId] ?? []
                      ).map((s, si) =>
                        si === i ? { ...s, reps: Number(e.target.value) } : s,
                      ),
                    }))
                  }
                  className="w-16 bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white"
                />
                <button
                  onClick={() => logOneSet(exercise.exerciseId, i)}
                  disabled={set.completed}
                  className={
                    set.completed
                      ? "flex-1 text-success text-center"
                      : "flex-1 bg-system-blue/10 border border-system-blue/40 text-system-blue rounded py-1 hover:bg-system-blue/20"
                  }
                >
                  {set.completed ? "✓ CLEAR" : "CLEAR"}
                </button>
              </div>
            ))}
          </div>
        </SystemPanel>
      ))}

      <button
        onClick={complete}
        disabled={!allSetsDone}
        className="w-full bg-gold/10 border border-gold/40 text-gold font-mono text-sm
          tracking-widest py-3 rounded hover:bg-gold/20 disabled:opacity-30 transition-colors"
      >
        COMPLETE DUNGEON
      </button>
    </div>
  );
}

export default function DungeonClient({
  exercises,
  unlockedDungeonTypes,
}: DungeonContentProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-sm text-slate-400">Loading...</div>
      }
    >
      <DungeonContent
        exercises={exercises}
        unlockedDungeonTypes={unlockedDungeonTypes}
      />
    </Suspense>
  );
}
