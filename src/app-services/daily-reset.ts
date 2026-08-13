import type { DomainEvent } from "@/core/shared/events";
import {
  addDays,
  isoWeekdayOf,
  parseTrainingDay,
  startOfIsoWeek,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { epoch, gold as makeGold } from "@/core/shared/units";
import { isChallengeType } from "@/core/economy/challenges";
import { isPerfectWeek } from "@/core/economy/perfect-week";
import { PERFECT_WEEK_GOLD } from "@/core/economy/pricing";
import { effectiveScheduledWeekdays } from "@/core/skill/schedule-swap";
import { wagerPayout, wagerWon } from "@/core/economy/wager";
import { isQuestComplete } from "@/core/quest/daily-quest";
import { decayFatigue } from "@/core/hunter/fatigue";
import { fatigueDecayMultiplier } from "@/core/skill/buffs";
import type { QuestStatus } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";
import { checkJobChangeProgress } from "./check-job-change";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { ensureNarrativeUnlocks } from "./ensure-narrative";
import { enterPenalty } from "./enter-penalty";
import { generateVoicePool } from "./generate-voice-pool";
import { revealHiddenQuests } from "./reveal-hidden-quests";

export type DailyResetStatus =
  QuestStatus | "none" | "skipped-penalty-active" | "deferred-to-grace-window";

export type DailyResetSummary = {
  today: string;
  yesterday: string;
  yesterdayStatus: DailyResetStatus;
  issuedToday: boolean;
  penaltyOpened: boolean;
  challengesExpired: number;
  perfectWeekAwarded: boolean;
  wagersResolved: number;
  fragmentsUnlocked: number;
  hiddenQuestsRevealed: number;
  voiceMessagesGenerated: number;
  events: DomainEvent[];
};

/**
 * Whether `day`'s Daily Quest judgment is still deferred to the 04:00 grace
 * window — an Hourglass was bought for it, and the quest row is still
 * `active` because runGraceReset has not gotten to it yet.
 *
 * A day in this state must never be read as "not completed": the hunter may
 * have actually finished it, and the true answer will only exist once the
 * grace window judges it.
 */
async function isDayDeferred(
  container: Container,
  day: TrainingDay,
): Promise<boolean> {
  const grace = await container.mitigation.graceForDay(day);
  if (grace === null) return false;
  const quest = await container.quests.byDay(day);
  return quest !== null && quest.status === "active";
}

async function anyDeferredInRange(
  container: Container,
  from: TrainingDay,
  to: TrainingDay,
): Promise<boolean> {
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    if (await isDayDeferred(container, cursor)) return true;
  }
  return false;
}

/**
 * Perfect Week and wager resolution, the two checks that read a whole
 * week's worth of Daily Quest outcomes at once.
 *
 * Shared between the 00:00 reset and the 04:00 grace reset so a week that
 * is skipped here because one of its days is still deferred (see
 * isDayDeferred) gets a second chance once that day's grace window closes.
 * Neither check consumes anything by being skipped: Perfect Week's
 * idempotency guard is "was a PerfectWeek event already recorded for this
 * week", and a skipped wager is simply left `active` for `activeBefore` to
 * find again.
 */
export async function runWeeklyEconomyChecks(
  container: Container,
  today: TrainingDay,
): Promise<{
  perfectWeekAwarded: boolean;
  wagersResolved: number;
  events: DomainEvent[];
}> {
  const events: DomainEvent[] = [];
  const weekEvents: { day: TrainingDay; event: DomainEvent }[] = [];
  let perfectWeekAwarded = false;
  let wagersResolved = 0;

  // Judged on Monday, for the seven days that just ended.
  if (isoWeekdayOf(today) === 1) {
    const weekStart = addDays(startOfIsoWeek(today), -7);
    const weekEnd = addDays(startOfIsoWeek(today), -1);

    // The award event is stamped with the week it describes, not the day
    // it was computed on, so finding one here is the idempotency check: a
    // cron that fires twice on the same Monday pays exactly once.
    const alreadyPaid = (
      await container.events.between(weekStart, weekStart)
    ).some((e) => e.type === "PerfectWeek");

    const weekHasDeferredDay =
      !alreadyPaid && (await anyDeferredInRange(container, weekStart, weekEnd));

    if (!alreadyPaid && !weekHasDeferredDay) {
      const baseWeekdays = new Set(
        (await container.programs.allDays()).map((d) => d.weekday),
      );
      const swap = await container.skills.swapForWeek(weekStart);
      const scheduledDays: string[] = [];
      for (
        let cursor: TrainingDay = weekStart;
        cursor <= weekEnd;
        cursor = addDays(cursor, 1)
      ) {
        const scheduledWeekdays = effectiveScheduledWeekdays(
          baseWeekdays,
          swap,
          cursor,
        );
        if (scheduledWeekdays.has(isoWeekdayOf(cursor))) {
          scheduledDays.push(cursor);
        }
      }

      const trainedDays = await container.training.completedSessionDaysBetween(
        weekStart,
        weekEnd,
      );
      const questsInWeek = await container.quests.between(weekStart, weekEnd);
      const penaltiesStarted = (
        await container.penalties.between(weekStart, weekEnd)
      ).filter(
        (p) => p.startedDay >= weekStart && p.startedDay <= weekEnd,
      ).length;

      const perfect = isPerfectWeek({
        scheduledDays,
        trainedDays,
        questsIssued: questsInWeek.length,
        questsCompleted: questsInWeek.filter((q) => q.status === "completed")
          .length,
        penaltiesStarted,
      });

      if (perfect) {
        const hunter = await container.hunters.get();
        if (hunter) {
          await container.hunters.update({
            gold: hunter.gold + PERFECT_WEEK_GOLD,
          });
          perfectWeekAwarded = true;
          // Recorded immediately, right after the gold that pays for it —
          // not deferred to weekEvents below, which is only reached after
          // the wager loop runs. A crash between the gold update and this
          // record would otherwise leave nothing to stop a retry from
          // paying twice, since the idempotency check above looks for
          // exactly this event.
          const event: DomainEvent = {
            type: "PerfectWeek",
            weekStart,
            goldAwarded: makeGold(PERFECT_WEEK_GOLD),
          };
          await container.events.record(
            [event],
            weekStart,
            container.clock.now(),
          );
          events.push(event);
        }
      }
    }
  }

  // Every unresolved week that has already ended — not only last week.
  // A cron that never fired on some Monday would otherwise leave a staked
  // week unjudged for good, with the gold already gone.
  const thisWeekStart = startOfIsoWeek(today);
  for (const staked of await container.wagers.activeBefore(thisWeekStart)) {
    const weekStart = parseTrainingDay(staked.weekStart);
    const weekEnd = addDays(weekStart, 6);

    // Left active — activeBefore will find it again on a later run, once
    // the deferred day inside this wager's own week has a final status.
    if (await anyDeferredInRange(container, weekStart, weekEnd)) continue;

    const dungeonsCleared = (
      await container.training.completedSessionsBetween(weekStart, weekEnd)
    ).length;
    const runsLogged = (
      await container.training.runsBetween(weekStart, weekEnd)
    ).length;
    const dailyQuestsCompleted = (
      await container.quests.between(weekStart, weekEnd)
    ).filter((q) => q.status === "completed").length;

    const won = wagerWon({
      dungeonsCleared,
      runsLogged,
      dailyQuestsCompleted,
    });

    // resolve() only touches a row still marked active, so a cron that
    // retries cannot turn a recorded win into a loss or pay twice.
    await container.wagers.resolve(
      weekStart,
      won ? "won" : "lost",
      container.clock.now(),
    );
    wagersResolved += 1;

    if (won) {
      const payout = wagerPayout(staked.stakeGold);
      const hunter = await container.hunters.get();
      if (hunter) {
        await container.hunters.update({ gold: hunter.gold + payout });
      }
      weekEvents.push({
        day: weekStart,
        event: {
          type: "WagerWon",
          weekStart,
          stakeGold: makeGold(staked.stakeGold),
          payoutGold: makeGold(payout),
        },
      });
    } else {
      // Nothing further is taken. The stake left at placement, and that
      // is the whole of the loss.
      weekEvents.push({
        day: weekStart,
        event: {
          type: "WagerLost",
          weekStart,
          stakeGold: makeGold(staked.stakeGold),
        },
      });
    }
  }

  for (const { day, event } of weekEvents) {
    await container.events.record([event], day, container.clock.now());
    events.push(event);
  }

  return { perfectWeekAwarded, wagersResolved, events };
}

/**
 * Closes the book on yesterday, then opens today.
 *
 * Judging happens first so a quest can never be issued for a day whose
 * predecessor is still unresolved. Both halves are idempotent, because a
 * cron that retries must not punish twice.
 */
export async function runDailyReset(
  container: Container,
): Promise<DailyResetSummary> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const yesterday = addDays(today, -1);
  const events: DomainEvent[] = [];
  // Only events this function creates itself go here. A sub-call such as
  // enterPenalty persists its own events before returning them, so folding
  // its events into `events` (for the full picture returned to the caller)
  // must not also fold them into what gets persisted below — that would
  // write the same row twice.
  const eventsToPersist: DomainEvent[] = [];

  /**
   * Milestone work that must run on EVERY reset, including days the quest
   * is left unjudged because a penalty episode is open. The story is not a
   * reward and must not be withheld by the Penalty Zone.
   *
   * These sub-calls persist their own events, so their results are folded
   * into `events` for the caller's benefit but never into `eventsToPersist`
   * — that would write each row twice.
   */
  let fragmentsUnlocked = 0;
  let hiddenQuestsRevealed = 0;
  let voiceMessagesGenerated = 0;
  const runMilestones = async (): Promise<void> => {
    const narrativeEvents = await ensureNarrativeUnlocks(container);
    fragmentsUnlocked = narrativeEvents.length;
    events.push(...narrativeEvents);

    const hiddenEvents = await revealHiddenQuests(container);
    hiddenQuestsRevealed = hiddenEvents.filter(
      (e) => e.type === "HiddenQuestRevealed",
    ).length;
    events.push(...hiddenEvents);

    // A day with no session still needs its Job Change window checked: the
    // seven-day window can elapse with nothing logged, and yesterday's
    // Daily Quest judgment (already written above, before runMilestones
    // runs) can fail an attempt even though no dungeon was cleared. Zero
    // volume on both sides means volumeTargetMet always reads "not met",
    // so this call can only fail or leave the streak unchanged — never
    // advance it, since only a real session can do that.
    events.push(...(await checkJobChangeProgress(container, yesterday, 0, 0)));

    // Runs last, so the day's messages describe a context that already
    // reflects everything this reset changed.
    voiceMessagesGenerated = (await generateVoicePool(container)).stored;
  };

  /**
   * Economy work that must run on EVERY reset, including days the quest is
   * left unjudged because a penalty episode is open. Gold has already
   * changed hands for anything handled here, so skipping it would strand
   * rows the hunter already paid for.
   *
   * Like enterPenalty, this persists its own events and returns them; the
   * caller folds them into `events` only. Folding them into
   * `eventsToPersist` as well would write every row twice — and the
   * penalty-active path never reaches the eventsToPersist write at all.
   */
  let challengesExpired = 0;
  let perfectWeekAwarded = false;
  let wagersResolved = 0;
  const runEconomyUpkeep = async (): Promise<void> => {
    const upkeepEvents: DomainEvent[] = [];

    const pending = await container.store.pendingChallenge();
    if (pending !== null) {
      if (isChallengeType(pending.type)) {
        const purchasedDay = toTrainingDay(
          epoch(pending.purchasedAt),
          container.tzOffsetMinutes,
        );
        // Bought today and not yet attempted — the session is still to come.
        if (purchasedDay < today) {
          await container.store.clearPendingChallenge();
          challengesExpired += 1;
          if (pending.type === "red-gate") {
            upkeepEvents.push({ type: "RedGateFailed", day: purchasedDay });
          }
        }
      } else {
        // A pending_challenge row whose type isn't one of the real
        // ChallengeType values — never produced by buyChallenge, only by a
        // hand-edited row. buyChallenge's "already pending" guard only
        // checks that a row exists, not that it is valid, so a row like
        // this would otherwise block every future challenge purchase
        // forever. Cleared the same way an expired row is.
        await container.store.clearPendingChallenge();
      }
    }

    if (upkeepEvents.length > 0) {
      await container.events.record(upkeepEvents, today, container.clock.now());
      events.push(...upkeepEvents);
    }

    const weekly = await runWeeklyEconomyChecks(container, today);
    perfectWeekAwarded = weekly.perfectWeekAwarded;
    wagersResolved = weekly.wagersResolved;
    events.push(...weekly.events);
  };

  /**
   * Fatigue is the one stat meant to go down, and only rest earns that —
   * so, like the milestone and economy work above, this must run on EVERY
   * reset regardless of penalty state. A hunter stuck in the Penalty Zone
   * still rests overnight; the System does not get to suspend that.
   *
   * decayFatigue itself never touches storage beyond the single write
   * below — it only computes the new value from what's already there.
   *
   * Guarded by a marker event, the same idempotency pattern
   * runWeeklyEconomyChecks uses for Perfect Week: a cron that retries must
   * not punish twice, and repeated decay on the same day would otherwise
   * quietly erase fatigue far faster than resting ever earns.
   */
  const runFatigueDecay = async (): Promise<void> => {
    const alreadyDecayed = (await container.events.between(today, today)).some(
      (e) => e.type === "FatigueDecayed",
    );
    if (alreadyDecayed) return;

    const hunter = await container.hunters.get();
    if (!hunter) return;

    const trainedYesterday =
      (
        await container.training.completedSessionDaysBetween(
          yesterday,
          yesterday,
        )
      ).length > 0;

    const equippedSkills = new Set(await container.skills.equippedIds());
    const decayed = decayFatigue(hunter.fatigue, 1, !trainedYesterday);
    const multiplier = fatigueDecayMultiplier(equippedSkills);
    const bonus = Math.round((hunter.fatigue - decayed) * (multiplier - 1));
    await container.hunters.update({ fatigue: Math.max(0, decayed - bonus) });

    // Not folded into the caller-facing `events` array — this is a silent
    // internal bookkeeping marker, not something worth surfacing to the UI.
    await container.events.record(
      [{ type: "FatigueDecayed", day: today }],
      today,
      container.clock.now(),
    );
  };

  // No punishment stacks on a punishment. While an episode is open the quest
  // is left unjudged entirely, so the debt stays at exactly one Survival Quest
  // however long the hunter is stuck.
  const activePenalty = await container.penalties.active();
  if (activePenalty) {
    const alreadyIssued = (await container.quests.byDay(today)) !== null;
    await ensureDailyQuest(container, today);
    await runEconomyUpkeep();
    await runMilestones();
    await runFatigueDecay();
    return {
      today,
      yesterday,
      yesterdayStatus: "skipped-penalty-active",
      issuedToday: !alreadyIssued,
      penaltyOpened: false,
      challengesExpired,
      perfectWeekAwarded,
      wagersResolved,
      fragmentsUnlocked,
      hiddenQuestsRevealed,
      voiceMessagesGenerated,
      events,
    };
  }

  let yesterdayStatus: DailyResetStatus = "none";
  let penaltyOpened = false;
  const previous = await container.quests.byDay(yesterday);

  if (previous) {
    if (previous.status !== "active") {
      // Already judged on an earlier run — leave it exactly as it is.
      yesterdayStatus = previous.status as QuestStatus;
    } else if (await container.mitigation.graceForDay(yesterday)) {
      // An Hourglass was bought for that day. Judgment moves to the 04:00
      // cron, which finds this row still active and decides it then. The
      // quest status IS the "not yet judged" marker — a second flag would
      // only be free to drift out of step with it.
      yesterdayStatus = "deferred-to-grace-window";
    } else {
      const runKm = await container.training.kmOnDay(yesterday);
      const complete = isQuestComplete(
        {
          pushups: previous.targetPushups,
          situps: previous.targetSitups,
          squats: previous.targetSquats,
          runKm: previous.targetRunKm,
        },
        {
          pushups: previous.progressPushups,
          situps: previous.progressSitups,
          squats: previous.progressSquats,
          runKm,
        },
      );
      yesterdayStatus = complete ? "completed" : "missed";
      await container.quests.setStatus(
        yesterday,
        yesterdayStatus,
        container.clock.now(),
      );
      const judgmentEvent: DomainEvent = complete
        ? { type: "DailyQuestCompleted", day: yesterday, streak: 0 }
        : { type: "DailyQuestMissed", day: yesterday };
      events.push(judgmentEvent);
      eventsToPersist.push(judgmentEvent);

      if (!complete) {
        const opened = await enterPenalty(container, yesterday);
        if (opened.ok) {
          penaltyOpened = true;
          // enterPenalty already persisted its own events (see
          // enter-penalty.ts) — fold them into the returned list for the
          // caller, but not into eventsToPersist, or they'd be written twice.
          events.push(...opened.value.events);
        }
      }
    }
  }

  const alreadyIssued = (await container.quests.byDay(today)) !== null;
  await ensureDailyQuest(container, today);

  await container.events.record(
    eventsToPersist,
    yesterday,
    container.clock.now(),
  );

  await runEconomyUpkeep();
  await runMilestones();
  await runFatigueDecay();

  return {
    today,
    yesterday,
    yesterdayStatus,
    issuedToday: !alreadyIssued,
    penaltyOpened,
    challengesExpired,
    perfectWeekAwarded,
    wagersResolved,
    fragmentsUnlocked,
    hiddenQuestsRevealed,
    voiceMessagesGenerated,
    events,
  };
}
