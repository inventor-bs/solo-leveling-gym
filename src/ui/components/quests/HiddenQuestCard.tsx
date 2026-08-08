import { SystemPanel } from "@/ui/components/primitives/SystemPanel";

export type HiddenQuestCardProps = {
  name: string;
  revealLine: string;
  goldAwarded: number;
  revealedDay: string;
};

export function HiddenQuestCard({
  name,
  revealLine,
  goldAwarded,
  revealedDay,
}: HiddenQuestCardProps) {
  return (
    <SystemPanel glowColor="gold" header={`HIDDEN QUEST — ${name}`}>
      <div className="p-4 space-y-3">
        <p className="font-mono text-sm text-slate-300 leading-relaxed">
          {revealLine}
        </p>
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-success">✓ Complete</span>
          <span className="text-gold">+{goldAwarded} G</span>
        </div>
        <p className="font-mono text-xs text-slate-600">
          Revealed {revealedDay}
        </p>
      </div>
    </SystemPanel>
  );
}
