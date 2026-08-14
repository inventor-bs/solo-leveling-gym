import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getStoreView } from "@/app-services/store-view";
import { getCosmeticView } from "@/app-services/cosmetic-view";
import {
  buyUnlockAction,
  buyChallengeAction,
  buyHourglassAction,
  buyShadowFeedAction,
} from "@/server/actions/store.actions";
import {
  buyCosmeticAction,
  buyAuraAction,
} from "@/server/actions/cosmetic.actions";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { LockedFeature } from "@/ui/components/primitives/LockedFeature";
import { BuyButton } from "@/ui/components/store/BuyButton";

/** Index 0 is unused — tier 0 ("no aura yet") renders no suffix at all. */
const AURA_TIER_LABEL = ["", "I", "II", "III", "IV", "V"];

export default async function StorePage() {
  await redirectOwnerIfPenalised();
  const container = getContainer();
  const view = await getStoreView(container);
  const cosmetic = await getCosmeticView(container);

  if (!view) {
    return (
      <LockedFeature
        title="SYSTEM STORE"
        unlocksAt="No Hunter has been registered yet."
      />
    );
  }

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — STORE
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Exchange
          </h1>
          <p className="font-mono text-xs text-gold mt-1">
            {view.gold.toLocaleString()} G
          </p>
          <p className="font-mono text-xs text-slate-500 mt-1">
            Nothing here buys progress.
          </p>
        </div>

        <SystemPanel header="CHALLENGES">
          <div className="p-4 space-y-4">
            {view.pendingChallenge && (
              <p className="font-mono text-xs text-warning">
                {view.pendingChallenge.type} is open. Clear it today or lose it.
              </p>
            )}
            {view.challenges.map((challenge) => (
              <div key={challenge.type} className="space-y-1">
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-slate-300">
                    {challenge.name}
                    {challenge.nextFloor !== null &&
                      ` — floor ${challenge.nextFloor}`}
                  </span>
                  <span className="text-gold">{challenge.cost} G</span>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {challenge.description}
                </p>
                {/* .bind(null, ...) on a "use server" action produces a
                    serializable reference across the RSC boundary; a
                    closure that merely calls the action does not. */}
                <BuyButton
                  label="BUY"
                  disabled={!challenge.available}
                  onBuy={buyChallengeAction.bind(null, {
                    type: challenge.type,
                    ...(challenge.nextFloor !== null
                      ? { floor: challenge.nextFloor }
                      : {}),
                  })}
                />
              </div>
            ))}
          </div>
        </SystemPanel>

        <SystemPanel header="UNLOCKS">
          <div className="p-4 space-y-4">
            {view.unlocks.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between font-mono text-sm">
                  <span
                    className={
                      item.unlocked ? "text-success" : "text-slate-300"
                    }
                  >
                    {item.unlocked ? "✓ " : ""}
                    {item.name}
                  </span>
                  <span className="text-gold">{item.cost} G</span>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {item.unlocked ? item.note : item.requirementLabel}
                </p>
                {!item.unlocked && (
                  <BuyButton
                    label="UNLOCK"
                    disabled={!item.available}
                    onBuy={buyUnlockAction.bind(null, { key: item.key })}
                  />
                )}
              </div>
            ))}
          </div>
        </SystemPanel>

        <SystemPanel header="MITIGATION">
          <div className="p-4 space-y-4">
            {view.mitigation.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-gold">{item.cost} G</span>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {item.description}
                </p>
                {item.key === "hourglass" ? (
                  <BuyButton
                    label="BUY"
                    disabled={!item.available}
                    onBuy={buyHourglassAction}
                  />
                ) : (
                  view.feedableShadows.map((shadow) => (
                    <BuyButton
                      key={shadow.id}
                      label={`FEED ${shadow.name.toUpperCase()}`}
                      disabled={!item.available}
                      onBuy={buyShadowFeedAction.bind(null, {
                        shadowId: shadow.id,
                      })}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </SystemPanel>

        {cosmetic && (
          <SystemPanel header="COSMETIC">
            <div className="p-4 space-y-4">
              <p className="font-mono text-xs text-slate-500">
                Nothing in this section changes a number. It only changes what
                the System looks like.
              </p>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-sm">
                  <span
                    className={
                      cosmetic.dashboardLayout.owned
                        ? "text-success"
                        : "text-slate-300"
                    }
                  >
                    {cosmetic.dashboardLayout.owned ? "✓ " : ""}Dashboard Layout
                  </span>
                  <span className="text-gold">
                    {cosmetic.dashboardLayout.cost} G
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {cosmetic.dashboardLayout.owned
                    ? "Rearrange the Dashboard's action panels, as often as you like."
                    : "Unlocks drag-to-reorder for the Dashboard's action panels."}
                </p>
                {!cosmetic.dashboardLayout.owned && (
                  <BuyButton
                    label="UNLOCK"
                    disabled={!cosmetic.dashboardLayout.available}
                    onBuy={buyCosmeticAction.bind(null, {
                      kind: "dashboard-layout",
                    })}
                  />
                )}
              </div>

              {cosmetic.skins.map((skin) => (
                <div key={skin.skinId} className="space-y-1">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-300">
                      Shadow Skin — {skin.name}
                    </span>
                    <span className="text-gold">{skin.cost} G each</span>
                  </div>
                  <p className="font-mono text-xs text-slate-500">
                    {skin.description} Bought for one shadow at a time.
                  </p>
                  {skin.shadows.length === 0 && (
                    <p className="font-mono text-xs text-slate-600">
                      No shadow has been extracted yet.
                    </p>
                  )}
                  {/* One button per extracted shadow, the same shape the
                      MITIGATION section already uses for Shadow Feed. */}
                  {skin.shadows.map((s) =>
                    s.owned ? (
                      <p
                        key={s.shadowId}
                        className="font-mono text-xs text-success"
                      >
                        ✓ {s.shadowName}
                      </p>
                    ) : (
                      <BuyButton
                        key={s.shadowId}
                        label={`${skin.name.toUpperCase()} FOR ${s.shadowName.toUpperCase()}`}
                        disabled={!s.available}
                        onBuy={buyCosmeticAction.bind(null, {
                          kind: "shadow-skin",
                          skinId: skin.skinId,
                          shadowId: s.shadowId,
                        })}
                      />
                    ),
                  )}
                </div>
              ))}

              {cosmetic.frames.map((frame) => (
                <div key={frame.frameId} className="space-y-1">
                  <div className="flex justify-between font-mono text-sm">
                    <span
                      className={
                        frame.owned ? "text-success" : "text-slate-300"
                      }
                    >
                      {frame.owned ? "✓ " : ""}
                      {frame.name}
                    </span>
                    <span className="text-gold">{frame.cost} G</span>
                  </div>
                  <p className="font-mono text-xs text-slate-500">
                    {frame.description} Shows once a title is worn — buying one
                    first is fine.
                  </p>
                  {!frame.owned && (
                    <BuyButton
                      label="BUY"
                      disabled={!frame.available}
                      onBuy={buyCosmeticAction.bind(null, {
                        kind: "title-frame",
                        frameId: frame.frameId,
                      })}
                    />
                  )}
                </div>
              ))}

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-slate-300">
                    Aura of the Monarch
                    {cosmetic.aura.visualTier > 0 &&
                      ` ${AURA_TIER_LABEL[cosmetic.aura.visualTier]}`}
                  </span>
                  <span className="text-gold">
                    {cosmetic.aura.nextCost.toLocaleString()} G
                  </span>
                </div>
                {/* Said plainly BEFORE the purchase, not discovered after it:
                    past the cap the gold still leaves and the screen does
                    not change. */}
                <p className="font-mono text-xs text-slate-500">
                  {cosmetic.aura.saturated
                    ? "Intensity is already at its maximum. Buying more only spends gold."
                    : `Deepens the glow around your rank. Tier ${cosmetic.aura.visualTier} of ${cosmetic.aura.maxVisualTier}.`}
                </p>
                <BuyButton
                  label="EMPOWER"
                  disabled={!cosmetic.aura.affordable}
                  onBuy={buyAuraAction}
                />
              </div>
            </div>
          </SystemPanel>
        )}
      </div>
    </div>
  );
}
