import { redirect } from "next/navigation";
import { getContainer } from "@/server/container";
import { getPenaltyView } from "@/app-services/penalty-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { SurvivalTracker } from "@/ui/components/penalty/SurvivalTracker";

export default async function PenaltyPage() {
  const view = await getPenaltyView(getContainer());
  if (!view) redirect("/dashboard");

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div
        className={`relative z-10 max-w-2xl mx-auto space-y-6 ${
          view.systemSilent ? "grayscale opacity-70" : ""
        }`}
      >
        <div>
          <p className="font-mono text-xs text-danger/70 tracking-widest mb-1">
            ◈ PENALTY ZONE
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            {view.reawakening ? "Reawakening Test" : view.variant.setting}
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            Day {view.daysStuck + 1} · {view.percent}% complete
          </p>
        </div>

        <SystemPanel glowColor="danger">
          <p className="p-4 font-mono text-sm text-slate-300 leading-relaxed">
            {view.systemSilent
              ? "[ ... ]"
              : view.reawakening
                ? "The System has detected a dormant Hunter. A Reawakening Test is available."
                : view.variant.openingLine}
          </p>
        </SystemPanel>

        <SystemPanel
          header={view.reawakening ? "REAWAKENING TEST" : "SURVIVAL QUEST"}
        >
          <div className="p-4">
            <SurvivalTracker
              day={view.day}
              canEscape={view.canEscape}
              runDone={view.progress.runKm}
              runTarget={view.targets.runKm}
              requirements={[
                {
                  key: "pushups",
                  label: "Push-ups",
                  done: view.progress.pushups,
                  target: view.targets.pushups,
                },
                {
                  key: "situps",
                  label: "Sit-ups",
                  done: view.progress.situps,
                  target: view.targets.situps,
                },
                {
                  key: "squats",
                  label: "Squats",
                  done: view.progress.squats,
                  target: view.targets.squats,
                },
              ]}
            />
          </div>
        </SystemPanel>
      </div>
    </div>
  );
}
