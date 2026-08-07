import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getShadowArmyView } from "@/app-services/shadow-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { ShadowCard } from "@/ui/components/shadow-army/ShadowCard";

export default async function ShadowArmyPage() {
  await redirectOwnerIfPenalised();
  const view = await getShadowArmyView(getContainer());

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — SHADOW ARMY
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Shadow Army
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            Army Rank: {view.armyRank ?? "—"}
          </p>
        </div>

        {view.weakest && (
          <SystemPanel glowColor="danger">
            <p className="p-4 font-mono text-sm text-slate-300">
              {view.weakest.name} has weakened. {view.weakest.daysSinceTrained}{" "}
              days without training.
            </p>
          </SystemPanel>
        )}

        <div className="grid grid-cols-3 gap-3">
          {view.shadows.map((shadow) => (
            <ShadowCard key={shadow.id} shadow={shadow} />
          ))}
        </div>
      </div>
    </div>
  );
}
