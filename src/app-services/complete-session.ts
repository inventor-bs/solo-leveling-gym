import { ok, err, type Result } from "@/core/shared/result";
import {
  exp as makeExp,
  gold as makeGold,
  reps,
  kg,
} from "@/core/shared/units";
import {
  dungeonRankFor,
  goldForDungeonRank,
  expForDungeonRank,
  type DungeonRank,
} from "@/core/training/dungeon-rank";
import { sessionVolumeLoad, averageVolumeLoad } from "@/core/training/volume";
import { applyExp, rankForLevel } from "@/core/hunter/progression";
import { fatigueAfterSession } from "@/core/hunter/fatigue";
import type { LoggedSet } from "@/core/training/types";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

export type CompleteSessionResult = {
  rank: DungeonRank;
  goldAwarded: number;
  expAwarded: number;
  levelsGained: number;
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

  const recentVolumes = await container.training.getRecentSessionVolumes(
    8,
    input.sessionId,
  );
  const avgVolume = averageVolumeLoad(recentVolumes);

  const dungeonRank = dungeonRankFor(plannedVolume, avgVolume);
  const goldAwarded = goldForDungeonRank(dungeonRank);
  const expAwarded = expForDungeonRank(dungeonRank);

  const now = container.clock.now();
  await container.training.completeSession(input.sessionId, now, dungeonRank);

  const progression = applyExp(hunter.level, makeExp(hunter.exp), expAwarded);
  const newFatigue = fatigueAfterSession(
    hunter.fatigue,
    plannedVolume,
    avgVolume,
  );

  await container.hunters.update({
    level: progression.level,
    exp: progression.exp,
    gold: hunter.gold + goldAwarded,
    rank:
      progression.levelsGained > 0
        ? rankForLevel(progression.level)
        : hunter.rank,
    fatigue: newFatigue,
  });

  const events: DomainEvent[] = [
    { type: "GoldGained", amount: makeGold(goldAwarded), source: "dungeon" },
    { type: "ExpGained", amount: expAwarded, source: "dungeon" },
    {
      type: "SessionCompleted",
      sessionId: input.sessionId,
      rank: dungeonRank,
      goldAwarded: makeGold(goldAwarded),
      expAwarded,
    },
  ];
  if (progression.levelsGained > 0) {
    events.push({ type: "LevelUp", from: hunter.level, to: progression.level });
  }

  const result: CompleteSessionResult = {
    rank: dungeonRank,
    goldAwarded,
    expAwarded,
    levelsGained: progression.levelsGained,
    events,
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}
