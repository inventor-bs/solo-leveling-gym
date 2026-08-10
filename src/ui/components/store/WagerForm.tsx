"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeWagerAction } from "@/server/actions/store.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * Stakes gold on the week that is starting. The cap shown is the same one
 * placeWager enforces; the server checks it again regardless, because a
 * number arriving from a browser is never the authority on anything.
 */
export function WagerForm({ maxStake }: { maxStake: number }) {
  const [stake, setStake] = useState(Math.min(100, maxStake));
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      {error && <ActionErrorNotice error={error} />}
      <p className="font-mono text-xs text-slate-500">
        Clear 4 dungeons, log 2 runs and complete 7 Daily Quests this week to
        take back three times your stake. Up to {maxStake} G.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={maxStake}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="w-28 bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white font-mono text-sm"
        />
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await placeWagerAction({ stakeGold: stake });
              if (result.ok) router.refresh();
              else setError(result.error);
            })
          }
          className="flex-1 bg-gold/10 border border-gold/40 text-gold font-mono text-xs
            tracking-widest py-2 rounded hover:bg-gold/20 disabled:opacity-30"
        >
          {pending ? "..." : "PLACE WAGER"}
        </button>
      </div>
    </div>
  );
}
