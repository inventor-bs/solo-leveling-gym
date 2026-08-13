import {
  learnSkillAction,
  equipSkillAction,
  depositSessionAction,
  withdrawSessionAction,
} from "@/server/actions/skill.actions";
import { BuyButton } from "@/ui/components/store/BuyButton";
import { OverrideQuestForm } from "@/ui/components/skills/OverrideQuestForm";
import { SwapScheduleForm } from "@/ui/components/skills/SwapScheduleForm";
import type { SkillEntry } from "@/app-services/skills-view";

export function SkillCard({
  skill,
  apAvailable,
  slotFull,
  bankedSessions,
  pendingCredits,
}: {
  skill: SkillEntry;
  apAvailable: number;
  slotFull: boolean;
  bankedSessions: number;
  pendingCredits: number;
}) {
  return (
    <div className="space-y-1 border-b border-slate-800 pb-3 last:border-0">
      <div className="flex justify-between font-mono text-sm">
        <span
          className={
            skill.equipped
              ? "text-success"
              : skill.learned
                ? "text-slate-300"
                : "text-slate-500"
          }
        >
          {skill.equipped ? "◆ " : skill.learned ? "○ " : ""}
          {skill.name}
        </span>
        <span className="text-system-blue">{skill.apCost} AP</span>
      </div>
      <p className="font-mono text-xs text-slate-500">{skill.effect}</p>
      {!skill.learned && (
        <BuyButton
          label="LEARN"
          disabled={apAvailable < skill.apCost}
          onBuy={learnSkillAction.bind(null, { skillId: skill.id })}
        />
      )}
      {skill.learned && (
        <BuyButton
          label={skill.equipped ? "UNEQUIP" : "EQUIP"}
          disabled={!skill.equipped && slotFull}
          onBuy={equipSkillAction.bind(null, {
            skillId: skill.id,
            equip: !skill.equipped,
          })}
        />
      )}
      {skill.id === "rulers-authority" && skill.equipped && (
        <OverrideQuestForm />
      )}
      {skill.id === "shadow-exchange" && skill.equipped && <SwapScheduleForm />}
      {skill.id === "shadow-storage" && skill.equipped && (
        <div className="space-y-2 pt-1">
          <p className="font-mono text-xs text-slate-500">
            {bankedSessions} banked / {pendingCredits} pending credit
          </p>
          <BuyButton
            label="DEPOSIT SESSION"
            disabled={false}
            onBuy={depositSessionAction}
          />
          <BuyButton
            label="WITHDRAW CREDIT"
            disabled={bankedSessions === 0}
            onBuy={withdrawSessionAction}
          />
        </div>
      )}
    </div>
  );
}
