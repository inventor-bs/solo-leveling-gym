"use client";

import { useState, useTransition } from "react";
import { equipTitleAction } from "@/server/actions/title.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";
import type { TitleViewEntry } from "@/app-services/status-view";

export function TitleShelf({ titles }: { titles: TitleViewEntry[] }) {
  const [equippedId, setEquippedId] = useState<string | null>(
    titles.find((t) => t.equipped)?.id ?? null,
  );
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  function equip(id: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await equipTitleAction({ titleId: id });
      if (result.ok) setEquippedId(result.value.equipped);
      else setError(result.error);
    });
  }

  return (
    <div className="p-4 space-y-3">
      {titles.map((title) => {
        const isEquipped = equippedId === title.id;
        return (
          <div
            key={title.id}
            className={`rounded border p-3 ${
              title.earned
                ? isEquipped
                  ? "border-gold/50 bg-gold/5"
                  : "border-system-blue/30 bg-shadow-dark"
                : "border-slate-800 bg-shadow-dark opacity-40"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-cinzel text-sm font-bold text-white">
                  {title.name}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {title.earned ? title.buff : title.condition}
                </p>
              </div>
              {title.earned && (
                <button
                  onClick={() => equip(isEquipped ? null : title.id)}
                  disabled={pending}
                  className="font-mono text-xs tracking-widest border rounded px-3 py-1
                    border-system-blue/40 text-system-blue hover:bg-system-blue/10
                    disabled:opacity-40"
                >
                  {isEquipped ? "REMOVE" : "EQUIP"}
                </button>
              )}
              {!title.earned && (
                <span className="font-mono text-xs text-slate-600">LOCKED</span>
              )}
            </div>
          </div>
        );
      })}
      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
