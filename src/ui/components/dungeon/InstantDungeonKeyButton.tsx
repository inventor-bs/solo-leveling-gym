"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buyInstantDungeonKeyAction } from "@/server/actions/store.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * Charges for the key, then navigates to the gate.
 *
 * The purchase and the session are deliberately two steps: the dungeon
 * screen starts its own session from the URL, so opening one here as well
 * would create two sessions for one key.
 */
export function InstantDungeonKeyButton({
  programDayId,
  programDayName,
  cost,
}: {
  programDayId: string;
  programDayName: string;
  cost: number;
}) {
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      {error && <ActionErrorNotice error={error} />}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await buyInstantDungeonKeyAction({ programDayId });
            if (result.ok) router.push(`/dungeon?programDayId=${programDayId}`);
            else setError(result.error);
          })
        }
        className="w-full bg-gold/10 border border-gold/40 text-gold font-mono text-sm
          tracking-widest py-3 rounded hover:bg-gold/20 disabled:opacity-30 transition-colors"
      >
        {pending
          ? "..."
          : `▸ TRAIN OFF-SCHEDULE — ${programDayName} (${cost} G)`}
      </button>
    </div>
  );
}
