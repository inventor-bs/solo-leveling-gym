import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getStatusView } from "@/app-services/status-view";
import { getCosmeticView } from "@/app-services/cosmetic-view";
import { JOB_CHANGE_RETRY_LEVEL } from "@/core/skill/job-change";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { AuraGlow } from "@/ui/components/primitives/AuraGlow";
import { StatRadar } from "@/ui/components/status/StatRadar";
import { LiftTrendTable } from "@/ui/components/status/LiftTrendTable";
import { TitleShelf } from "@/ui/components/status/TitleShelf";
import { TitleBadge } from "@/ui/components/status/TitleBadge";
import { TitleFrameSelector } from "@/ui/components/status/TitleFrameSelector";

const STAT_ROWS = [
  { key: "strength", label: "STR" },
  { key: "agility", label: "AGI" },
  { key: "vitality", label: "VIT" },
  { key: "intelligence", label: "INT" },
  { key: "perception", label: "PER" },
  { key: "luck", label: "LUK" },
] as const;

export default async function StatusPage() {
  await redirectOwnerIfPenalised();
  const container = getContainer();
  const view = await getStatusView(container);
  const cosmetic = await getCosmeticView(container);

  if (!view) {
    return (
      <div className="relative min-h-screen p-6 md:p-8">
        <div className="relative z-10 max-w-3xl mx-auto">
          <SystemPanel>
            <p className="p-4 font-mono text-sm text-slate-400">
              No Hunter has been registered yet.
            </p>
          </SystemPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
              ◈ SYSTEM — HUNTER STATUS
            </p>
            <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
              {view.name}
            </h1>
            <p className="font-mono text-xs text-slate-500 mt-1">
              Lv {view.level} · {view.exp}/{view.expToNext} EXP · {view.gold}{" "}
              gold
            </p>
          </div>
          <AuraGlow tier={cosmetic?.aura.visualTier ?? 0}>
            <RankBadge rank={view.rank} size="md" />
          </AuraGlow>
        </div>

        <SystemPanel header="STATS">
          <div className="p-4 grid gap-4 md:grid-cols-2">
            <StatRadar stats={view.stats} />
            <div className="space-y-1 font-mono text-sm self-center">
              {STAT_ROWS.map((row) => (
                <div key={row.key} className="flex justify-between">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="text-white">{view.stats[row.key]}</span>
                </div>
              ))}
              {view.penaltyActive && (
                <p className="pt-2 font-mono text-xs text-danger">
                  Penalty Zone active — every stat is reading 15% low.
                </p>
              )}
            </div>
          </div>
        </SystemPanel>

        <SystemPanel header="HUNTER RECORD">
          <div className="p-4 grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Class</span>
              <span className="text-white">{view.className ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Army Rank</span>
              <span className="text-white">{view.armyRank ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fatigue</span>
              <span
                className={
                  view.fatigueLevel === "critical"
                    ? "text-danger"
                    : view.fatigueLevel === "warning"
                      ? "text-warning"
                      : "text-white"
                }
              >
                {view.fatigue}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Title</span>
              <span className="text-white">
                <TitleBadge
                  name={view.titles.find((t) => t.equipped)?.name ?? null}
                  frameId={cosmetic?.equippedFrameId ?? null}
                />
              </span>
            </div>
          </div>
        </SystemPanel>

        {view.jobChange && (
          <SystemPanel header="JOB CHANGE QUEST">
            <div className="p-4 space-y-1">
              <p className="font-mono text-sm text-slate-300">
                {view.jobChange.consecutiveCleared} / {view.jobChange.target}{" "}
                consecutive dungeons cleared
              </p>
              {view.jobChange.failed && (
                <p className="font-mono text-xs text-warning">
                  Attempt failed — eligible again at level{" "}
                  {JOB_CHANGE_RETRY_LEVEL}.
                </p>
              )}
            </div>
          </SystemPanel>
        )}

        <SystemPanel header="LIFT RECORD">
          <LiftTrendTable lifts={view.lifts} />
        </SystemPanel>

        <SystemPanel header="TITLES">
          <TitleShelf titles={view.titles} />
          <TitleFrameSelector
            frames={(cosmetic?.frames ?? [])
              .filter((f) => f.owned)
              .map((f) => ({ id: f.frameId, name: f.name }))}
            equippedFrameId={cosmetic?.equippedFrameId ?? null}
          />
        </SystemPanel>
      </div>
    </div>
  );
}
