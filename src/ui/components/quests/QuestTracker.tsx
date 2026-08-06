"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logQuestProgressAction } from "@/server/actions/quest.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

type Requirement = {
  key: "pushups" | "situps" | "squats";
  label: string;
  done: number;
  target: number;
};

export function QuestTracker({
  day,
  requirements,
  runDone,
  runTarget,
}: {
  day: string;
  requirements: Requirement[];
  runDone: number;
  runTarget: number;
}) {
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add(key: Requirement["key"], amount: number) {
    setError(null);
    startTransition(async () => {
      const result = await logQuestProgressAction({ day, [key]: amount });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
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
              <span className="text-system-blue/60">
                {r.done} / {r.target}
              </span>
            </div>
            <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => add(r.key, n)}
                  disabled={pending || met}
                  className="flex-1 bg-system-blue/10 border border-system-blue/40 text-system-blue
                    font-mono text-xs rounded py-1 hover:bg-system-blue/20 disabled:opacity-30"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="space-y-1 pt-2 border-t border-system-blue/10">
        <div className="flex justify-between font-mono text-xs">
          <span
            className={runDone >= runTarget ? "text-success" : "text-slate-300"}
          >
            {runDone >= runTarget ? "✓ " : "◈ "}Run
          </span>
          <span className="text-system-blue/60">
            {runDone.toFixed(1)} / {runTarget} km
          </span>
        </div>
        <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
            style={{
              width: `${Math.min(Math.round((runDone / runTarget) * 100), 100)}%`,
            }}
          />
        </div>
        <p className="font-mono text-xs text-slate-500 pt-1">
          Distance is read from your logged runs.{" "}
          <Link href="/dashboard" className="text-system-blue hover:underline">
            Log a run →
          </Link>
        </p>
      </div>

      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
