"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { swapWeeklyScheduleAction } from "@/server/actions/skill.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

/** Shadow Exchange: trades one of this week's scheduled weekdays for another. */
export function SwapScheduleForm() {
  const [weekdayFrom, setWeekdayFrom] = useState(1);
  const [weekdayTo, setWeekdayTo] = useState(2);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2 pt-1">
      {error && <ActionErrorNotice error={error} />}
      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
        <select
          value={weekdayFrom}
          onChange={(e) => setWeekdayFrom(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-2"
        >
          {WEEKDAYS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <span>→</span>
        <select
          value={weekdayTo}
          onChange={(e) => setWeekdayTo(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-2"
        >
          {WEEKDAYS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await swapWeeklyScheduleAction({
              weekdayFrom,
              weekdayTo,
            });
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="w-full bg-gold/10 border border-gold/40 text-gold font-mono text-xs
          tracking-widest py-2 rounded hover:bg-gold/20 disabled:opacity-30 transition-colors"
      >
        {pending ? "..." : "SWAP THIS WEEK"}
      </button>
    </div>
  );
}
