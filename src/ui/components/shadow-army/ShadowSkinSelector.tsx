"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { equipShadowSkinAction } from "@/server/actions/cosmetic.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * Only trades skins the shadow already owns — buying happens in the Store.
 * A client component importing the action directly crosses no prop
 * boundary, so there is no closure to serialize here.
 */
export function ShadowSkinSelector({
  shadowId,
  equippedSkinId,
  ownedSkins,
}: {
  shadowId: string;
  equippedSkinId: string | null;
  ownedSkins: { id: string; name: string }[];
}) {
  const [equipped, setEquipped] = useState<string | null>(equippedSkinId);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (ownedSkins.length === 0) {
    return (
      <p className="mt-2 font-mono text-[10px] text-slate-600">No skin owned</p>
    );
  }

  function equip(skinId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await equipShadowSkinAction({ shadowId, skinId });
      if (result.ok) {
        setEquipped(result.value.equippedSkinId);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap justify-center gap-1">
        <button
          onClick={() => equip(null)}
          disabled={pending}
          className={`font-mono text-[10px] tracking-wider border rounded px-2 py-0.5 disabled:opacity-40 ${
            equipped === null
              ? "border-gold/50 text-gold"
              : "border-system-blue/30 text-system-blue hover:bg-system-blue/10"
          }`}
        >
          NONE
        </button>
        {ownedSkins.map((skin) => (
          <button
            key={skin.id}
            onClick={() => equip(skin.id)}
            disabled={pending}
            className={`font-mono text-[10px] tracking-wider border rounded px-2 py-0.5 disabled:opacity-40 ${
              equipped === skin.id
                ? "border-gold/50 text-gold"
                : "border-system-blue/30 text-system-blue hover:bg-system-blue/10"
            }`}
          >
            {skin.name.toUpperCase()}
          </button>
        ))}
      </div>
      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
