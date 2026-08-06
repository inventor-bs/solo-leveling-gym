import Link from "next/link";
import { getContainer } from "@/server/container";
import { rankForLevel } from "@/core/hunter/progression";
import { buildSystemMessage } from "@/core/system-voice/template-engine";
import { seededRng } from "@/infra/rng/seeded-rng";
import { toTrainingDay } from "@/core/shared/training-day";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { RunLogForm } from "@/ui/components/dungeon/RunLogForm";

function isoWeekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export default async function DashboardPage() {
  const container = getContainer();
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const weekday = isoWeekday(today);
  const program = await container.programs.byWeekday(weekday);
  const isRunDay = weekday === 2 || weekday === 4;
  const isRestDay = weekday === 7;

  const voiceSeed = weekday * 1000 + hunter.level;
  const message = buildSystemMessage(
    {
      hunterName: hunter.name,
      level: hunter.level,
      rank: rankForLevel(hunter.level),
      todayProgramName: program?.programDay.name ?? null,
      recentPr: null,
    },
    seededRng(voiceSeed),
  );

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
              ◈ SYSTEM — MAIN HUD
            </p>
            <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
              Welcome back,{" "}
              <span className="text-system-blue">{hunter.name}</span>
            </h1>
          </div>
          <RankBadge rank={rankForLevel(hunter.level)} size="md" />
        </div>

        <SystemPanel glowColor="blue">
          <p className="p-4 font-mono text-sm text-slate-300 leading-relaxed">
            {message.body}
          </p>
        </SystemPanel>

        {program && !isRestDay && (
          <SystemPanel
            header={`${program.programDay.name.toUpperCase()} — TODAY'S GATE`}
          >
            <div className="p-4 space-y-3">
              <ul className="space-y-1">
                {program.exercises.map(({ exercise, slot }) => (
                  <li
                    key={exercise.id}
                    className="font-mono text-sm text-slate-400"
                  >
                    {exercise.name} — {slot.targetSets} × {slot.repMin}-
                    {slot.repMax}
                  </li>
                ))}
              </ul>
              <Link
                href={`/dungeon?programDayId=${program.programDay.id}`}
                className="block text-center bg-system-blue/10 border border-system-blue/40 text-system-blue
                  font-mono text-sm tracking-widest py-3 rounded hover:bg-system-blue/20 transition-colors"
              >
                ▸ ENTER DUNGEON
              </Link>
            </div>
          </SystemPanel>
        )}

        {isRunDay && (
          <SystemPanel header="TODAY — ENDURANCE TRAINING">
            <div className="p-4">
              <RunLogForm day={today} />
            </div>
          </SystemPanel>
        )}

        {isRestDay && (
          <SystemPanel header="TODAY — REST">
            <p className="p-4 font-mono text-sm text-slate-400">
              No dungeon is scheduled. Recovery is part of the training.
            </p>
          </SystemPanel>
        )}
      </div>
    </div>
  );
}
