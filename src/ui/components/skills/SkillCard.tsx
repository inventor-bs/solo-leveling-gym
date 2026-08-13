import {
  learnSkillAction,
  equipSkillAction,
} from "@/server/actions/skill.actions";
import { BuyButton } from "@/ui/components/store/BuyButton";
import type { SkillEntry } from "@/app-services/skills-view";

export function SkillCard({
  skill,
  apAvailable,
  slotFull,
}: {
  skill: SkillEntry;
  apAvailable: number;
  slotFull: boolean;
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
    </div>
  );
}
