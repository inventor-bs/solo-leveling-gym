import { getContainer } from "@/server/container";
import { getChronicleView } from "@/app-services/chronicle-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { Heatmap } from "@/ui/components/chronicle/Heatmap";
import { EventTimeline } from "@/ui/components/chronicle/EventTimeline";

export default async function ChroniclePage() {
  const view = await getChronicleView(getContainer());

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — CHRONICLE
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Chronicle
          </h1>
        </div>

        <SystemPanel header="365 DAYS">
          <div className="p-4">
            <Heatmap cells={view.heatmap} />
          </div>
        </SystemPanel>

        <SystemPanel header="EVENT LOG">
          <div className="p-4">
            <EventTimeline entries={view.timeline} />
          </div>
        </SystemPanel>
      </div>
    </div>
  );
}
