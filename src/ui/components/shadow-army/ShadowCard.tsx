import type { ShadowViewEntry } from "@/app-services/shadow-view";
import { SKIN_STYLE } from "./skin-styles";
import { ShadowSkinSelector } from "./ShadowSkinSelector";

export type ShadowCardSkin = {
  equippedSkinId: string | null;
  ownedSkins: { id: string; name: string }[];
};

export function ShadowCard({
  shadow,
  skin,
}: {
  shadow: ShadowViewEntry;
  /** Null for a shadow with no cosmetic state to show. */
  skin: ShadowCardSkin | null;
}) {
  if (!shadow.extracted) {
    return (
      <div className="rounded-lg border border-slate-800 bg-shadow-dark p-4 text-center opacity-40">
        <div className="text-2xl mb-1">?</div>
        <p className="font-mono text-xs text-slate-500">{shadow.name}</p>
        <p className="font-mono text-xs text-slate-600">Not yet extracted</p>
      </div>
    );
  }

  // Weakening wins over any skin: it is an honest report about training that
  // did not happen, and a bought decoration must never paint over it. The
  // selector below still renders — weakening is computed at read time and
  // can end tomorrow, so it does not revoke what was bought.
  const skinStyle =
    !shadow.weakened && skin?.equippedSkinId
      ? (SKIN_STYLE[skin.equippedSkinId] ?? null)
      : null;

  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        shadow.weakened
          ? "border-danger/40 bg-danger/5 grayscale"
          : (skinStyle ?? "border-system-blue/30 bg-shadow-dark")
      }`}
    >
      <div className="text-2xl mb-1">◈</div>
      <p className="font-cinzel text-sm text-white font-bold">{shadow.name}</p>
      {shadow.grade !== null && (
        <p className="font-mono text-xs text-system-blue/70">{shadow.grade}</p>
      )}
      {shadow.weakened && (
        <p className="font-mono text-xs text-danger mt-1">
          {shadow.daysSinceTrained} days without training
        </p>
      )}
      {skin && (
        <ShadowSkinSelector
          shadowId={shadow.id}
          equippedSkinId={skin.equippedSkinId}
          ownedSkins={skin.ownedSkins}
        />
      )}
    </div>
  );
}
