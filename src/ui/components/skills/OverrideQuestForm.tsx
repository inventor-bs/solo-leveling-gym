"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overrideQuestItemAction } from "@/server/actions/skill.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

const FIELDS = [
  { value: "pushups", label: "Push-ups" },
  { value: "situps", label: "Sit-ups" },
  { value: "squats", label: "Squats" },
  { value: "runKm", label: "Run (km)" },
] as const;

/** Ruler's Authority: replaces one of today's Daily Quest targets. */
export function OverrideQuestForm() {
  const [field, setField] = useState<string>("pushups");
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2 pt-1">
      {error && <ActionErrorNotice error={error} />}
      <div className="flex gap-2">
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs rounded px-2 py-2"
        >
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs rounded px-2 py-2 w-20"
        />
      </div>
      <button
        disabled={pending || value === ""}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await overrideQuestItemAction({
              field,
              value: Number(value),
            });
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="w-full bg-gold/10 border border-gold/40 text-gold font-mono text-xs
          tracking-widest py-2 rounded hover:bg-gold/20 disabled:opacity-30 transition-colors"
      >
        {pending ? "..." : "OVERRIDE TODAY'S TARGET"}
      </button>
    </div>
  );
}
