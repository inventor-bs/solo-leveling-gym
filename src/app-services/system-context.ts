import {
  addDays,
  isoWeekdayOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { rankForLevel } from "@/core/hunter/progression";
import type { LiftDelta, SystemContext } from "@/core/system-voice/types";
import type { Container } from "@/server/container";
import { getQuestView } from "./quest-view";
import { getPenaltyView } from "./penalty-view";
import { getShadowArmyView } from "./shadow-view";
import { getNarrativeView } from "./narrative-view";
import { getLiftTrends } from "./lift-trends";

const RECENT_WINDOW_DAYS = 7;
const HISTORY_WINDOW_DAYS = 30;
/** How many lifts the voice is allowed to name in one direction. */
const TREND_NAMES = 3;
/** How many of its own recent messages the voice is shown, so it can avoid repeating itself. */
const MESSAGE_HISTORY = 5;

/**
 * The one place the System's picture of the hunter is assembled.
 *
 * Both consumers eat this same object: the template engine reads its fields
 * directly, and the prompt builder serializes it into the FACTS block the
 * moderation gate later checks generated numbers against. Two different
 * context shapes would mean the gate could reject a number the model was
 * legitimately given.
 *
 * Lift trends are the expensive part — one query per exercise with history,
 * the same pass the Status page already runs. It is paid here rather than
 * approximated, because "which lift has fallen" is the observation the voice
 * exists to make, and a cheaper answer would be a guess.
 */
export async function buildSystemContext(
  container: Container,
): Promise<SystemContext | null> {
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const weekday = isoWeekdayOf(today);
  const program = await container.programs.byWeekday(weekday);

  const questView = await getQuestView(container);
  const quest = questView.ok ? questView.value : null;
  const penaltyView = await getPenaltyView(container);
  const shadowView = await getShadowArmyView(container);
  const narrativeView = await getNarrativeView(container);

  const weekAgo = addDays(today, -(RECENT_WINDOW_DAYS - 1));
  const monthAgo = addDays(today, -(HISTORY_WINDOW_DAYS - 1));

  const sessionDays = await container.training.completedSessionDaysBetween(
    weekAgo,
    today,
  );
  const outcomes = await container.quests.recentOutcomes(HISTORY_WINDOW_DAYS);
  // `between` returns every episode up to `to`, including ones that opened
  // before the window and are still open, so the start day is filtered here.
  const penalties = await container.penalties.between(monthAgo, today);

  const trends = await getLiftTrends(container);
  const toDelta = (t: (typeof trends)[number]): LiftDelta => ({
    name: t.name,
    deltaKg: t.deltaKg ?? 0,
  });
  const liftsUp = trends
    .filter((t) => t.deltaKg !== null && t.deltaKg > 0)
    .sort((a, b) => (b.deltaKg ?? 0) - (a.deltaKg ?? 0))
    .slice(0, TREND_NAMES)
    .map(toDelta);
  const liftsDown = trends
    .filter((t) => t.deltaKg !== null && t.deltaKg < 0)
    .sort((a, b) => (a.deltaKg ?? 0) - (b.deltaKg ?? 0))
    .slice(0, TREND_NAMES)
    .map(toDelta);

  return {
    hunterName: hunter.name,
    level: hunter.level,
    rank: rankForLevel(hunter.level),
    title: hunter.title,
    className: hunter.className,
    streakDays: quest?.streak ?? 0,
    fatigue: hunter.fatigue,
    reasonForHunting: hunter.reasonForHunting,

    todayProgramName: program?.programDay.name ?? null,
    todayMainLift:
      program?.exercises.find((e) => e.exercise.isMainLift)?.exercise.name ??
      null,
    isRestDay: weekday === 7,
    dailyQuestDone: quest?.complete ?? false,

    sessionsLast7d: sessionDays.length,
    missedDays30d: outcomes.filter((o) => !o.completed).length,
    penaltyCount30d: penalties.filter(
      (p) => (p.startedDay as TrainingDay) >= monthAgo,
    ).length,

    liftsUp,
    liftsDown,
    // Nothing tracks a "PR that happened just now" outside the write path
    // that produced it, so the briefing never claims one.
    recentPr: null,

    penaltyActive: penaltyView !== null,
    penaltySilent: penaltyView?.systemSilent ?? false,

    weakestShadow: shadowView.weakest,
    armyRank: shadowView.armyRank,

    arcStage: narrativeView.arcStage,
    unlockedFragments: narrativeView.fragments.map((f) => f.id),

    lastMessages: await container.systemMessages.recentBodies(MESSAGE_HISTORY),
  };
}
