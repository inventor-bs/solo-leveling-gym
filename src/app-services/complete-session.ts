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
import {
  EQUIPMENT_CATALOG,
  dropChance,
  equipmentExpMultiplier,
  equipmentFatigueGainMultiplier,
  isEquipmentGrade,
  isEquipmentSlot,
  isHigherGrade,
  rollGrade,
} from "@/core/economy/equipment";
import {
  EQUIPMENT_SLOTS,
  type EquipmentGrade,
  type EquipmentSlot,
} from "@/core/economy/pricing";
import { deriveStats, emptyStatInput } from "@/core/hunter/stats";
import { currentStreak } from "@/core/quest/streak";
import { QUEST_HISTORY_DAYS } from "./stat-input";
import {
  bossRaidGoldPerPr,
  demonCastleTargetVolume,
  isChallengeType,
  redGateRewardMultiplier,
  redGateTargetVolume,
  volumeTargetMet,
  type ChallengeType,
} from "@/core/economy/challenges";
import { toTrainingDay } from "@/core/shared/training-day";
import type { LoggedSet, MuscleGroup } from "@/core/training/types";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";
import type { TrainingDay } from "@/core/shared/training-day";
import type { Kg } from "@/core/shared/units";
import { awardEarnedTitles } from "./award-titles";
import { checkJobChangeProgress } from "./check-job-change";
import { equippedTitleId } from "./equipped-title";
import {
  bloodlustGoldMultiplier,
  shadowExpMultiplier,
  vitalStrikeBossMultiplier,
} from "@/core/skill/buffs";
import { bossSets, bossSetExp } from "@/core/training/boss-set";

export type ChallengeOutcome = {
  type: ChallengeType;
  floor: number | null;
  cleared: boolean;
};

export type EquipmentDrop = {
  slot: EquipmentSlot;
  name: string;
  grade: EquipmentGrade;
  replacedGrade: EquipmentGrade | null;
};

export type CompleteSessionResult = {
  rank: DungeonRank;
  goldAwarded: number;
  expAwarded: number;
  levelsGained: number;
  /** Gold paid for the PRs this session produced. */
  prGold: number;
  /** Gold paid for every level this session's EXP crossed. */
  levelUpGold: number;
  /** The bought challenge this session resolved, or null if none was pending. */
  challenge: ChallengeOutcome | null;
  drop: EquipmentDrop | null;
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

  // Resolve whatever challenge was bought, before any reward is computed —
  // the gold and EXP multipliers below depend on the verdict.
  //
  // A challenge is only honoured on the training day it was bought. Anything
  // older is expired here rather than left to rot: the gold is already gone,
  // and letting it sit would silently apply to some future session.
  const pending = await container.store.pendingChallenge();
  const challengeEvents: DomainEvent[] = [];
  let challenge: ChallengeOutcome | null = null;
  let redGateCleared = false;
  let bossRaidCleared = false;

  if (pending !== null && isChallengeType(pending.type)) {
    const purchasedDay = toTrainingDay(
      epoch(pending.purchasedAt),
      container.tzOffsetMinutes,
    );
    const sameDay = purchasedDay === session.day;

    if (!sameDay) {
      if (pending.type === "red-gate") {
        challengeEvents.push({ type: "RedGateFailed", day: purchasedDay });
      }
    } else if (pending.type === "red-gate") {
      redGateCleared = volumeTargetMet(
        plannedVolume,
        redGateTargetVolume(avgVolume),
        avgVolume,
      );
      challenge = { type: "red-gate", floor: null, cleared: redGateCleared };
      challengeEvents.push(
        redGateCleared
          ? { type: "RedGateCleared", day: session.day }
          : { type: "RedGateFailed", day: session.day },
      );
    } else if (pending.type === "boss-raid") {
      bossRaidCleared = prs.length >= 1;
      challenge = { type: "boss-raid", floor: null, cleared: bossRaidCleared };
      if (bossRaidCleared) {
        challengeEvents.push({
          type: "BossRaidCleared",
          day: session.day,
          prCount: prs.length,
        });
      }
    } else {
      const floor = pending.floor ?? 1;
      const cleared = volumeTargetMet(
        plannedVolume,
        demonCastleTargetVolume(avgVolume, floor),
        avgVolume,
      );
      challenge = { type: "demon-castle", floor, cleared };
      if (cleared) {
        await container.store.setHighestFloorCleared(floor);
        challengeEvents.push({ type: "DemonCastleFloorCleared", floor });
      }
    }

    // Consumed either way. Buying the target is the whole transaction;
    // missing it costs the gold and nothing more.
    await container.store.clearPendingChallenge();
  }

  const prGold = goldForPrs(prs.length, bossRaidGoldPerPr(bossRaidCleared));
  const challengeMultiplier = redGateRewardMultiplier(redGateCleared);

  const equipped = await equippedTitleId(container, hunter);
  const weaponGrade = await gradeInSlot(container, "weapon");
  const armorGrade = await gradeInSlot(container, "armor");

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

  const equippedSkills = new Set(await container.skills.equippedIds());

  const bossSetCount = bossSets(sets, catalog);
  const bossExp = bossSetExp(
    bossSetCount,
    vitalStrikeBossMultiplier(equippedSkills),
  );

  const rankGold = Math.round(
    goldForDungeonRank(dungeonRank) *
      sessionGoldMultiplier(equipped, startedInTheMorning) *
      bloodlustGoldMultiplier(equippedSkills, dungeonRank) *
      challengeMultiplier,
  );
  const expAwarded = makeExp(
    Math.round(
      expForDungeonRank(dungeonRank) *
        sessionExpMultiplier(equipped, firstSessionAfterExit) *
        equipmentExpMultiplier(weaponGrade, volumeByGroup.back) *
        challengeMultiplier,
    ) + bossExp,
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
    equipmentFatigueGainMultiplier(armorGrade),
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

  const legionMultiplier = shadowExpMultiplier(equippedSkills);

  for (const [muscle, volume] of Object.entries(volumeByGroup) as [
    MuscleGroup,
    number,
  ][]) {
    if (volume <= 0 || muscle === "cardio") continue; // cardio only grows via log-run
    await container.shadows.addExp(
      shadowForMuscle(muscle),
      Math.round(volume * legionMultiplier),
      session.day,
    );
  }

  const events: DomainEvent[] = [
    { type: "GoldGained", amount: makeGold(rankGold), source: "dungeon" },
    // Mirrors rankGold above: the "dungeon" event carries the base award
    // alone, not the full expAwarded, so that summing every ExpGained row
    // for a session (this one plus the "boss-set" one below) reproduces
    // expAwarded exactly instead of double-counting the BOSS-set bonus.
    {
      type: "ExpGained",
      amount: makeExp(expAwarded - bossExp),
      source: "dungeon",
    },
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
  if (bossExp > 0) {
    events.push({
      type: "ExpGained",
      amount: makeExp(bossExp),
      source: "boss-set",
    });
  }
  if (progression.levelsGained > 0) {
    events.push({ type: "LevelUp", from: hunter.level, to: progression.level });
  }
  events.push(...challengeEvents);

  const drop = await rollEquipmentDrop(
    container,
    dungeonRank,
    redGateCleared ? "epic" : null,
  );
  if (drop !== null) {
    events.push({ type: "EquipmentDropped", ...drop });
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

  // Persisted here, before checkJobChangeProgress runs, rather than in one
  // batch at the end of the function. checkJobChangeProgress persists its
  // own events internally (the same discipline awardEarnedTitles's caller
  // otherwise provides for it via this record call) — recording everything
  // gathered so far now, then folding checkJobChangeProgress's
  // already-persisted events into `events` afterward for the returned
  // result only, is what keeps this function from writing a row twice.
  await container.events.record(events, session.day as TrainingDay, now);

  events.push(
    ...(await checkJobChangeProgress(
      container,
      session.day,
      plannedVolume,
      avgVolume,
    )),
  );

  const result: CompleteSessionResult = {
    rank: dungeonRank,
    goldAwarded,
    expAwarded,
    levelsGained: progression.levelsGained,
    prGold,
    levelUpGold,
    challenge,
    drop,
    events,
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}

/**
 * Reads a slot's grade, refusing anything the catalog does not name.
 *
 * `equipment.grade` is a plain TEXT column, so a hand-edited or migrated
 * value could otherwise hand out a buff nobody ever rolled — the same
 * failure equippedTitleId already guards hunter.title against.
 */
async function gradeInSlot(
  container: Container,
  slot: string,
): Promise<EquipmentGrade | null> {
  const row = await container.equipment.bySlot(slot);
  if (row === null || !isEquipmentGrade(row.grade)) return null;
  return row.grade;
}

/**
 * LUCK, and only LUCK, for the drop roll below.
 *
 * deriveStats computes all six stats from a StatInput, and the full one
 * buildStatInput assembles costs roughly twenty DB round trips: e1RM
 * history, volume, a run query, and an N+1 loop over recent sessions' sets
 * — all to support five stats the drop roll never reads. LUCK depends only
 * on streakDays (hiddenQuestsFound is always zero; there are no Hidden
 * Quests to find yet), so this builds a StatInput from just that one cheap
 * read and leaves every other field at emptyStatInput's neutral default.
 * The other five stats deriveStats computes from it are garbage — that is
 * fine, since only .luck is read here. deriveStats itself is still the one
 * and only place the LUCK rule lives; this changes what is fed to it, not
 * how it is computed.
 */
export async function currentLuck(container: Container): Promise<number> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const outcomes = await container.quests.recentOutcomes(QUEST_HISTORY_DAYS);
  const streakDays = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    today,
  );
  return deriveStats({ ...emptyStatInput(), streakDays }).luck;
}

/**
 * Rolls the dungeon's loot, writes it if it is an upgrade, and reports it.
 *
 * The RNG is consumed in a fixed order — chance, then slot, then grade — so
 * a scripted port can drive the whole roll deterministically in tests.
 *
 * LUCK is DERIVED here rather than read from hunter.luck. That column
 * exists but nothing has ever written to it; reading it would have made the
 * bonus permanently zero, and a drop rate that is merely too low still
 * produces drops, so the bug would never have shown itself. currentLuck
 * above is the cheap path to deriveStats' one LUCK rule.
 *
 * `guaranteedGrade` is the cleared Red Gate's epic. It skips both the
 * chance roll and the grade roll, and it also narrows the slot choice to
 * the ones it would actually improve — "guaranteed" that lands on a
 * legendary slot and silently does nothing would not be guaranteed at all.
 * The ordinary roll deliberately does NOT narrow: it picks any slot and
 * walks away if the grade is no better, which is what keeps the drop rate
 * meaning what it says.
 */
async function rollEquipmentDrop(
  container: Container,
  rank: DungeonRank,
  guaranteedGrade: EquipmentGrade | null,
): Promise<EquipmentDrop | null> {
  const rows = await container.equipment.all();
  const held = new Map<EquipmentSlot, EquipmentGrade>();
  for (const row of rows) {
    if (isEquipmentSlot(row.slot) && isEquipmentGrade(row.grade)) {
      held.set(row.slot, row.grade);
    }
  }

  if (guaranteedGrade === null) {
    const luck = await currentLuck(container);
    if (container.rng.next() >= dropChance(rank, luck)) return null;
  }

  const empty = EQUIPMENT_SLOTS.filter((s) => !held.has(s));
  let slot: EquipmentSlot;
  if (empty.length > 0) {
    slot = empty[container.rng.int(0, empty.length)]!;
  } else if (guaranteedGrade !== null) {
    const upgradable = EQUIPMENT_SLOTS.filter((s) =>
      isHigherGrade(guaranteedGrade, held.get(s) ?? null),
    );
    if (upgradable.length === 0) return null;
    slot = upgradable[container.rng.int(0, upgradable.length)]!;
  } else {
    slot = EQUIPMENT_SLOTS[container.rng.int(0, EQUIPMENT_SLOTS.length)]!;
  }

  const grade = guaranteedGrade ?? rollGrade(container.rng.next());
  const replacedGrade = held.get(slot) ?? null;
  if (!isHigherGrade(grade, replacedGrade)) return null;

  await container.equipment.put(slot, grade, container.clock.now());
  return {
    slot,
    name: EQUIPMENT_CATALOG[slot].name,
    grade,
    replacedGrade,
  };
}
