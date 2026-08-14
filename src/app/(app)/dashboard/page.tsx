import Link from "next/link";
import type { ReactNode } from "react";
import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { rankForLevel } from "@/core/hunter/progression";
import { auraVisualTier } from "@/core/cosmetic/aura";
import { jobChangeEligible } from "@/core/skill/job-change";
import { toTrainingDay, isoWeekdayOf } from "@/core/shared/training-day";
import { INSTANT_DUNGEON_KEY_COST } from "@/core/economy/pricing";
import { normalizeDashboardOrder } from "@/core/cosmetic/dashboard-order";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  DEFAULT_DASHBOARD_ORDER,
} from "@/core/cosmetic/catalog";
import { getQuestView } from "@/app-services/quest-view";
import { getNarrativeView } from "@/app-services/narrative-view";
import { getSystemMessage } from "@/app-services/system-voice-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { AuraGlow } from "@/ui/components/primitives/AuraGlow";
import { InstantDungeonKeyButton } from "@/ui/components/dungeon/InstantDungeonKeyButton";
import { FragmentCard } from "@/ui/components/narrative/FragmentCard";
import { ReorderablePanels } from "@/ui/components/dashboard/ReorderablePanels";

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

  // Only offered on a day the schedule did NOT open a gate, and only when
  // the gold is already in hand — a button that always fails is noise.
  const offScheduleDay = (await container.programs.allDays())[0] ?? null;
  const canBuyKey =
    (isRunDay || isRestDay) &&
    offScheduleDay !== null &&
    hunter.gold >= INSTANT_DUNGEON_KEY_COST;

  const questView = await getQuestView(container);
  const quest = questView.ok ? questView.value : null;
  const narrativeView = await getNarrativeView(container);

  const message = await getSystemMessage(container, "briefing");

  const jobChangeAttempt = await container.skills.jobChangeAttempt();
  const showJobChangeBanner =
    jobChangeEligible(hunter.level, jobChangeAttempt) &&
    hunter.className === null;

  // Read directly rather than through getCosmeticView: this needs one
  // primary-key lookup and one array derived from the hunter row already in
  // hand, and the Dashboard is the hottest page in the app.
  const layoutUnlocked = await container.store.isUnlocked(
    DASHBOARD_LAYOUT_UNLOCK_KEY,
  );
  const panelOrder = normalizeDashboardOrder(
    hunter.dashboardOrder,
    DEFAULT_DASHBOARD_ORDER,
  );

  const panels: Record<string, ReactNode> = {};

  if (quest) {
    panels["daily-quest"] = (
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
    );
  }

  if (program && !isRestDay) {
    panels["todays-gate"] = (
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
    );
  }

  if (canBuyKey && offScheduleDay) {
    panels["instant-dungeon-key"] = (
      <SystemPanel header="INSTANT DUNGEON KEY">
        <div className="p-4 space-y-2">
          <p className="font-mono text-xs text-slate-500">
            No gate is scheduled today. One can be opened anyway.
          </p>
          <InstantDungeonKeyButton
            programDayId={offScheduleDay.id}
            programDayName={offScheduleDay.name}
            cost={INSTANT_DUNGEON_KEY_COST}
          />
        </div>
      </SystemPanel>
    );
  }

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
          <AuraGlow tier={auraVisualTier(hunter.auraLevel)}>
            <RankBadge rank={rankForLevel(hunter.level)} size="md" />
          </AuraGlow>
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

        {/* Sits below the System Voice message and the narrative reveal above
            it, since either can already be reporting a penalty, a PR, or a
            streak — this line never competes with those, only supplements
            them once a hunter is actually eligible and still unclassed. */}
        {showJobChangeBanner && (
          <p className="font-mono text-xs text-gold tracking-widest">
            ⚠ The Job Change Quest has appeared. Visit Status to view your
            progress.
          </p>
        )}

        {/* key on the stored order so a saved reorder re-seeds the client
            component's state after router.refresh() instead of leaving it
            showing the pre-save order. */}
        <ReorderablePanels
          key={panelOrder.join("|")}
          order={panelOrder}
          panels={panels}
          editable={layoutUnlocked}
        />

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
