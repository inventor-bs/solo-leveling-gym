import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getSkillsView } from "@/app-services/skills-view";
import { buyRuneStoneAction } from "@/server/actions/skill.actions";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { LockedFeature } from "@/ui/components/primitives/LockedFeature";
import { BuyButton } from "@/ui/components/store/BuyButton";
import { SkillCard } from "@/ui/components/skills/SkillCard";
import type { SkillBranch } from "@/core/skill/catalog";

const BRANCH_LABEL: Record<SkillBranch, string> = {
  body: "BODY",
  shadow: "SHADOW",
  sovereign: "SOVEREIGN",
};

export default async function SkillsPage() {
  await redirectOwnerIfPenalised();
  const view = await getSkillsView(getContainer());

  if (view.skills.length === 0) {
    return (
      <LockedFeature
        title="SKILLS"
        unlocksAt="No Hunter has been registered yet."
      />
    );
  }

  const slotFull = view.slotsUsed >= view.slotCapacity;
  const branches: SkillBranch[] = ["body", "shadow", "sovereign"];

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — SKILLS
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Ability
          </h1>
          <p className="font-mono text-xs text-gold mt-1">
            {view.apAvailable} AP available ({view.apSpent} / {view.apEarned}{" "}
            spent)
          </p>
          <p className="font-mono text-xs text-slate-500 mt-1">
            {view.slotsUsed} / {view.slotCapacity} slots equipped
          </p>
        </div>

        <SystemPanel header="SKILL SLOTS">
          <div className="p-4 space-y-2">
            <p className="font-mono text-xs text-slate-500">
              Gold buys the container, never the power inside it.
            </p>
            <BuyButton
              label={`BUY RUNE STONE (${view.slotCapacity} / 8 slots)`}
              disabled={view.slotCapacity >= 8}
              onBuy={buyRuneStoneAction}
            />
          </div>
        </SystemPanel>

        {branches.map((branch) => (
          <SystemPanel key={branch} header={BRANCH_LABEL[branch]}>
            <div className="p-4">
              {view.skills
                .filter((s) => s.branch === branch)
                .map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    apAvailable={view.apAvailable}
                    slotFull={slotFull}
                    bankedSessions={view.bankedSessions}
                    pendingCredits={view.pendingCredits}
                  />
                ))}
            </div>
          </SystemPanel>
        ))}
      </div>
    </div>
  );
}
