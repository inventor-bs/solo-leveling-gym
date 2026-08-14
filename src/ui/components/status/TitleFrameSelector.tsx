"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { equipTitleFrameAction } from "@/server/actions/cosmetic.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

export function TitleFrameSelector({
  frames,
  equippedFrameId,
}: {
  /** Owned frames only — the Store is where they are bought. */
  frames: { id: string; name: string }[];
  equippedFrameId: string | null;
}) {
  const [equipped, setEquipped] = useState<string | null>(equippedFrameId);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (frames.length === 0) {
    return (
      <p className="px-4 pb-4 font-mono text-xs text-slate-600">
        No frame owned. The Store sells three.
      </p>
    );
  }

  function equip(frameId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await equipTitleFrameAction({ frameId });
      if (result.ok) {
        setEquipped(result.value.titleFrame);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="px-4 pb-4 space-y-2">
      <p className="font-mono text-xs text-slate-500">FRAME</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => equip(null)}
          disabled={pending}
          className={`font-mono text-xs tracking-widest border rounded px-3 py-1 disabled:opacity-40 ${
            equipped === null
              ? "border-gold/50 text-gold"
              : "border-system-blue/40 text-system-blue hover:bg-system-blue/10"
          }`}
        >
          NONE
        </button>
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => equip(frame.id)}
            disabled={pending}
            className={`font-mono text-xs tracking-widest border rounded px-3 py-1 disabled:opacity-40 ${
              equipped === frame.id
                ? "border-gold/50 text-gold"
                : "border-system-blue/40 text-system-blue hover:bg-system-blue/10"
            }`}
          >
            {frame.name.toUpperCase()}
          </button>
        ))}
      </div>
      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
