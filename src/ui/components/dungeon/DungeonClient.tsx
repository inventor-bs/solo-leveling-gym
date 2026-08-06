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

type PlannedExercise = {
  exerciseId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  suggestedWeight: number;
  suggestedReps: number;
};

type SetState = { reps: number; weight: number; completed: boolean };

/** Derived so the success payload stays in sync with the action itself. */
type ClearedResult = Extract<
  Awaited<ReturnType<typeof completeSessionAction>>,
  { ok: true }
>["value"];

function DungeonContent() {
  const params = useSearchParams();
  const router = useRouter();
  const programDayId = params.get("programDayId");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedExercise[]>([]);
  const [sets, setSets] = useState<Record<string, SetState[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ActionError | null>(null);
  const [result, setResult] = useState<ClearedResult | null>(null);

  useEffect(() => {
    if (!programDayId) return;
    startSessionAction({ programDayId }).then((res) => {
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
    });
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

  // A failure before the plan loaded leaves nothing to render but the reason.
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

export default function DungeonClient() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-sm text-slate-400">Loading...</div>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}
