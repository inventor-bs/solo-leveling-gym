import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getStoreView } from "@/app-services/store-view";
import {
  buyUnlockAction,
  buyChallengeAction,
  buyHourglassAction,
  buyShadowFeedAction,
} from "@/server/actions/store.actions";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { LockedFeature } from "@/ui/components/primitives/LockedFeature";
import { BuyButton } from "@/ui/components/store/BuyButton";

export default async function StorePage() {
  await redirectOwnerIfPenalised();
  const view = await getStoreView(getContainer());

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
            Nothing here buys progress. Everything here buys a harder session.
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
                <BuyButton
                  label="BUY"
                  disabled={!challenge.available}
                  onBuy={() =>
                    buyChallengeAction({
                      type: challenge.type,
                      ...(challenge.nextFloor !== null
                        ? { floor: challenge.nextFloor }
                        : {}),
                    })
                  }
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
                    onBuy={() => buyUnlockAction({ key: item.key })}
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
                    onBuy={() => buyHourglassAction()}
                  />
                ) : (
                  view.feedableShadows.map((shadow) => (
                    <BuyButton
                      key={shadow.id}
                      label={`FEED ${shadow.name.toUpperCase()}`}
                      disabled={!item.available}
                      onBuy={() => buyShadowFeedAction({ shadowId: shadow.id })}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </SystemPanel>
      </div>
    </div>
  );
}
