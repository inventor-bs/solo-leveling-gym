import { SystemPanel } from "@/ui/components/primitives/SystemPanel";

export type FragmentCardProps = {
  ordinal: number;
  title: string;
  body: string;
  unlockedDay: string;
};

export function FragmentCard({
  ordinal,
  title,
  body,
  unlockedDay,
}: FragmentCardProps) {
  return (
    <SystemPanel glowColor="purple" header={`RECORD ${ordinal} — ${title}`}>
      <div className="p-4 space-y-2">
        <p className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {body}
        </p>
        <p className="font-mono text-xs text-slate-600">
          Recovered {unlockedDay}
        </p>
      </div>
    </SystemPanel>
  );
}
