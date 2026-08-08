import { getContainer } from "@/server/container";
import { getNarrativeView } from "@/app-services/narrative-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { FragmentCard } from "@/ui/components/narrative/FragmentCard";

const STAGE_LABEL: Record<string, string> = {
  dormant: "NO RECORDS RECOVERED",
  anomaly: "ANOMALOUS ENTRIES",
  inquiry: "UNDER INQUIRY",
  revelation: "DISCLOSURE IN PROGRESS",
  closed: "EVALUATION CLOSED",
};

export default async function ArchivePage() {
  const view = await getNarrativeView(getContainer());

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-monarch-purple/70 tracking-widest mb-1">
            ◈ SYSTEM — ARCHIVE
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Archive
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            {STAGE_LABEL[view.arcStage] ?? STAGE_LABEL.dormant} ·{" "}
            {view.fragments.length} recovered · {view.sealedCount} sealed
          </p>
        </div>

        {view.fragments.length === 0 && (
          <SystemPanel>
            <p className="p-4 font-mono text-sm text-slate-400 leading-relaxed">
              [ No records have surfaced. This unit is operating within
              specification. ]
            </p>
          </SystemPanel>
        )}

        {view.fragments.map((f) => (
          <FragmentCard
            key={f.id}
            ordinal={f.ordinal}
            title={f.title}
            body={f.body}
            unlockedDay={f.unlockedDay}
          />
        ))}

        {view.sealedCount > 0 && (
          <SystemPanel header="SEALED">
            <p className="p-4 font-mono text-sm text-slate-500">
              {view.sealedCount} record{view.sealedCount === 1 ? "" : "s"}{" "}
              remain sealed. Access is not granted by request.
            </p>
          </SystemPanel>
        )}
      </div>
    </div>
  );
}
