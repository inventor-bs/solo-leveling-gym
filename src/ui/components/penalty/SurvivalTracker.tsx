"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logQuestProgressAction } from "@/server/actions/quest.actions";
import { escapePenaltyAction } from "@/server/actions/penalty.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

type Requirement = {
  key: "pushups" | "situps" | "squats";
  label: string;
  done: number;
  target: number;
};

export function SurvivalTracker({
  day,
  requirements,
  runDone,
  runTarget,
  canEscape,
}: {
  day: string;
  requirements: Requirement[];
  runDone: number;
  runTarget: number;
  canEscape: boolean;
}) {
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add(key: Requirement["key"], amount: number) {
    setError(null);
    startTransition(async () => {
      const result = await logQuestProgressAction({ day, [key]: amount });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function escape() {
    setError(null);
    startTransition(async () => {
      const result = await escapePenaltyAction();
      if (result.ok) router.push("/dashboard");
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {requirements.map((r) => {
        const pct = Math.min(Math.round((r.done / r.target) * 100), 100);
        const met = r.done >= r.target;
        return (
          <div key={r.key} className="space-y-1">
            <div className="flex justify-between font-mono text-xs">
              <span className={met ? "text-success" : "text-slate-300"}>
                {met ? "✓ " : "◈ "}
                {r.label}
              </span>
              <span className="text-danger/70">
                {r.done} / {r.target}
              </span>
            </div>
            <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
              <div
                className="h-full bg-danger/70 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => add(r.key, n)}
                  disabled={pending || met}
                  className="flex-1 bg-danger/10 border border-danger/40 text-danger
                    font-mono text-xs rounded py-1 hover:bg-danger/20 disabled:opacity-30"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="space-y-1 pt-2 border-t border-danger/20">
        <div className="flex justify-between font-mono text-xs">
          <span
            className={runDone >= runTarget ? "text-success" : "text-slate-300"}
          >
            {runDone >= runTarget ? "✓ " : "◈ "}Run
          </span>
          <span className="text-danger/70">
            {runDone.toFixed(1)} / {runTarget} km
          </span>
        </div>
        <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
          <div
            className="h-full bg-danger/70 rounded-full"
            style={{
              width: `${Math.min(Math.round((runDone / runTarget) * 100), 100)}%`,
            }}
          />
        </div>
      </div>

      <button
        onClick={escape}
        disabled={pending || !canEscape}
        className="w-full bg-danger/10 border border-danger/40 text-danger font-mono
          text-sm tracking-widest py-3 rounded hover:bg-danger/20 disabled:opacity-30"
      >
        ESCAPE THE PENALTY ZONE
      </button>

      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
