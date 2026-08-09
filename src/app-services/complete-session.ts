import { ok, err, type Result } from "@/core/shared/result";
import {
  exp as makeExp,
  gold as makeGold,
  reps,
  kg,
  epoch,
} from "@/core/shared/units";
import {
  dungeonRankFor,
  goldForDungeonRank,
  expForDungeonRank,
  type DungeonRank,
} from "@/core/training/dungeon-rank";
import {
  sessionVolumeLoad,
  averageVolumeLoad,
  volumeByMuscle,
} from "@/core/training/volume";
import { applyExp, rankForLevel } from "@/core/hunter/progression";
import { fatigueAfterSession } from "@/core/hunter/fatigue";
import { shadowForMuscle } from "@/core/shadow/roster";
import { localHourOf } from "@/core/shared/training-day";
import {
  sessionGoldMultiplier,
  sessionExpMultiplier,
} from "@/core/title/buffs";
import { MORNING_BEFORE_HOUR } from "@/core/title/catalog";
import { detectPrs } from "@/core/training/pr";
import { goldForPrs, goldForLevelUps } from "@/core/economy/income";
import type { LoggedSet, MuscleGroup } from "@/core/training/types";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";
import type { TrainingDay } from "@/core/shared/training-day";
import type { Kg } from "@/core/shared/units";
import { awardEarnedTitles } from "./award-titles";
import { equippedTitleId } from "./equipped-title";

export type CompleteSessionResult = {
  rank: DungeonRank;
  goldAwarded: number;
  expAwarded: number;
  levelsGained: number;
  /** Gold paid for the PRs this session produced. */
  prGold: number;
  /** Gold paid for every level this session's EXP crossed. */
  levelUpGold: number;
  events: DomainEvent[];
};

export type CompleteSessionError =
  | { type: "session-not-found" }
  | { type: "session-already-completed" }
  | { type: "hunter-not-found" };

export type CompleteSessionInput = {
  sessionId: string;
  clientActionId: string;
};

export async function completeSession(
  container: Container,
  input: CompleteSessionInput,
): Promise<Result<CompleteSessionResult, CompleteSessionError>> {
  const cached = await container.idempotency.find<CompleteSessionResult>(
    input.clientActionId,
  );
  if (cached) return ok(cached);

  const session = await container.training.getSession(input.sessionId);
  if (!session) return err({ type: "session-not-found" });
  if (session.endedAt !== null) {
    return err({ type: "session-already-completed" });
  }

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  const rows = await container.training.getSetsForSession(input.sessionId);
  const sets: LoggedSet[] = rows.map((r) => ({
    exerciseId: r.exerciseId,
    setIndex: r.setIndex,
    reps: reps(r.reps),
    weight: kg(r.weight),
    completed: r.completed,
  }));
  const plannedVolume = sessionVolumeLoad(sets);

  const exerciseRows = await container.exercises.all();
  const catalog = new Map(
    exerciseRows.map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        muscle: e.muscle as MuscleGroup,
        kind: e.kind as "compound" | "isolation",
        isMainLift: e.isMainLift,
        incrementKg: kg(e.incrementKg),
      },
    ]),
  );
  const volumeByGroup = volumeByMuscle(sets, catalog);

  const recentVolumes = await container.training.getRecentSessionVolumes(
    8,
    input.sessionId,
  );
  const avgVolume = averageVolumeLoad(recentVolumes);

  const dungeonRank = dungeonRankFor(plannedVolume, avgVolume);

  // detectPrs is the one place that decides what a PR is. Its previous-best
  // map is built by asking the repo for each exercise's best e1RM EXCLUDING
  // this session, so a set logged minutes ago cannot be its own record.
  // Nothing here passes a modifier: PR detection is a measured number.
  const exerciseIdsInSession = [...new Set(sets.map((s) => s.exerciseId))];
  const previousBests = new Map<string, Kg>();
  for (const exerciseId of exerciseIdsInSession) {
    previousBests.set(
      exerciseId,
      await container.training.bestHistoricalE1rm(exerciseId, input.sessionId),
    );
  }
  const prs = detectPrs(sets, previousBests);
  const prGold = goldForPrs(prs.length);

  const equipped = await equippedTitleId(container, hunter);

  // Local hour, not UTC: a 06:30 session in Vietnam is stored at 23:30 UTC
  // the previous day. The cutoff is exclusive — 07:00 sharp is not morning.
  const startedInTheMorning =
    localHourOf(epoch(session.startedAt), container.tzOffsetMinutes) <
    MORNING_BEFORE_HOUR;

  // Asked BEFORE training.completeSession stamps endedAt a few lines below,
  // so "first session after the escape" means the one being logged right
  // now rather than counting this session as its own predecessor.
  const lastExitAt = await container.penalties.lastExitAt();
  const firstSessionAfterExit =
    lastExitAt !== null &&
    (await container.training.completedSessionCountSince(lastExitAt)) === 0;

  const rankGold = Math.round(
    goldForDungeonRank(dungeonRank) *
      sessionGoldMultiplier(equipped, startedInTheMorning),
  );
  const expAwarded = makeExp(
    Math.round(
      expForDungeonRank(dungeonRank) *
        sessionExpMultiplier(equipped, firstSessionAfterExit),
    ),
  );

  const now = container.clock.now();
  await container.training.completeSession(input.sessionId, now, dungeonRank);

  const progression = applyExp(hunter.level, makeExp(hunter.exp), expAwarded);
  const levelUpGold = goldForLevelUps(hunter.level, progression.level);
  const goldAwarded = rankGold + prGold + levelUpGold;
  const newFatigue = fatigueAfterSession(
    hunter.fatigue,
    plannedVolume,
    avgVolume,
  );

  const newRank =
    progression.levelsGained > 0
      ? rankForLevel(progression.level)
      : hunter.rank;

  await container.hunters.update({
    level: progression.level,
    exp: progression.exp,
    gold: hunter.gold + goldAwarded,
    rank: newRank,
    fatigue: newFatigue,
  });

  for (const [muscle, volume] of Object.entries(volumeByGroup) as [
    MuscleGroup,
    number,
  ][]) {
    if (volume <= 0 || muscle === "cardio") continue; // cardio only grows via log-run
    await container.shadows.addExp(
      shadowForMuscle(muscle),
      volume,
      session.day,
    );
  }

  const events: DomainEvent[] = [
    { type: "GoldGained", amount: makeGold(rankGold), source: "dungeon" },
    { type: "ExpGained", amount: expAwarded, source: "dungeon" },
    {
      type: "SessionCompleted",
      sessionId: input.sessionId,
      rank: dungeonRank,
      goldAwarded: makeGold(goldAwarded),
      expAwarded,
    },
  ];
  if (prGold > 0) {
    events.push({ type: "GoldGained", amount: makeGold(prGold), source: "pr" });
  }
  if (levelUpGold > 0) {
    events.push({
      type: "GoldGained",
      amount: makeGold(levelUpGold),
      source: "level-up",
    });
  }
  if (progression.levelsGained > 0) {
    events.push({ type: "LevelUp", from: hunter.level, to: progression.level });
  }

  if (hunter.rank !== "S" && newRank === "S") {
    const bellion = await container.shadows.byId("bellion");
    if (bellion && bellion.extractedAt === null) {
      await container.shadows.extract("bellion", now);
      events.push({
        type: "ShadowArisen",
        shadowId: "bellion",
        shadowName: "Bellion",
      });
    }
  }

  // After training.completeSession stamped endedAt, so this session counts
  // toward the morning-session total.
  events.push(...(await awardEarnedTitles(container)));

  const result: CompleteSessionResult = {
    rank: dungeonRank,
    goldAwarded,
    expAwarded,
    levelsGained: progression.levelsGained,
    prGold,
    levelUpGold,
    events,
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  await container.events.record(events, session.day as TrainingDay, now);
  return ok(result);
}
