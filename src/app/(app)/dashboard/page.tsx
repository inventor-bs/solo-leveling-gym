import Link from "next/link";
import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { rankForLevel } from "@/core/hunter/progression";
import { toTrainingDay, isoWeekdayOf } from "@/core/shared/training-day";
import { getQuestView } from "@/app-services/quest-view";
import { getNarrativeView } from "@/app-services/narrative-view";
import { getSystemMessage } from "@/app-services/system-voice-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { RunLogForm } from "@/ui/components/dungeon/RunLogForm";
import { FragmentCard } from "@/ui/components/narrative/FragmentCard";

export default async function DashboardPage() {
  await redirectOwnerIfPenalised();
  const container = getContainer();
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const weekday = isoWeekdayOf(today);
  const program = await container.programs.byWeekday(weekday);
  const isRunDay = weekday === 2 || weekday === 4;
  const isRestDay = weekday === 7;

  const questView = await getQuestView(container);
  const quest = questView.ok ? questView.value : null;
  const narrativeView = await getNarrativeView(container);

  const message = await getSystemMessage(container, "briefing");

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

        {message && (
          <SystemPanel
            glowColor={
              message.severity === "critical"
                ? "danger"
                : message.severity === "warning"
                  ? "gold"
                  : "blue"
            }
          >
            <p className="p-4 font-mono text-sm text-slate-300 leading-relaxed">
              {message.body === "" ? "[ ... ]" : message.body}
            </p>
          </SystemPanel>
        )}

        {/* The arc surfaces on the HUD only on the day it advances. After
            that the record lives on the Archive page and the HUD moves on —
            a permanent story panel would compete with today's training. */}
        {narrativeView.unlockedToday && (
          <div className="space-y-2">
            <p className="font-mono text-xs text-monarch-purple/70 tracking-widest">
              ◈ ANOMALOUS RECORD RECOVERED
            </p>
            <FragmentCard
              ordinal={narrativeView.unlockedToday.ordinal}
              title={narrativeView.unlockedToday.title}
              body={narrativeView.unlockedToday.body}
              unlockedDay={narrativeView.unlockedToday.unlockedDay}
            />
          </div>
        )}

        {quest && (
          <SystemPanel header="DAILY QUEST">
            <div className="p-4 space-y-3">
              <div className="flex justify-between font-mono text-sm">
                <span
                  className={quest.complete ? "text-success" : "text-slate-300"}
                >
                  {quest.complete ? "✓ Cleared" : "Incomplete"}
                </span>
                <span className="text-system-blue/60">{quest.percent}%</span>
              </div>
              <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
                  style={{ width: `${quest.percent}%` }}
                />
              </div>
              {quest.streak > 0 && (
                <p className="font-mono text-xs text-warning">
                  🔥 {quest.streak} day streak
                </p>
              )}
              <Link
                href="/quests"
                className="block text-center bg-system-blue/10 border border-system-blue/40 text-system-blue
                  font-mono text-sm tracking-widest py-2 rounded hover:bg-system-blue/20 transition-colors"
              >
                ▸ OPEN QUEST LOG
              </Link>
            </div>
          </SystemPanel>
        )}

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
