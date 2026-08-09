import {
  addDays,
  isoWeekdayOf,
  startOfIsoWeek,
  toTrainingDay,
} from "@/core/shared/training-day";
import {
  UNLOCK_CATALOG,
  meetsRequirement,
  type UnlockDef,
} from "@/core/economy/unlocks";
import { CHALLENGE_TYPES, type ChallengeType } from "@/core/economy/challenges";
import {
  HOURGLASS_MAX_PER_WEEK,
  HOURGLASS_OF_GRACE_COST,
  INSTANT_DUNGEON_KEY_COST,
  SHADOW_FEED_COST,
} from "@/core/economy/pricing";
import { maxStake } from "@/core/economy/wager";
import type { Container } from "@/server/container";
import { challengeCost } from "./buy-challenge";
import { getShadowArmyView } from "./shadow-view";

export type StoreItemView = {
  key: string;
  name: string;
  note: string;
  cost: number;
  requirementLabel: string;
  requirementMet: boolean;
  unlocked: boolean;
  affordable: boolean;
  /** Buyable right now: not owned, requirement met, gold in hand. */
  available: boolean;
};

export type StoreChallengeView = {
  type: ChallengeType;
  name: string;
  description: string;
  cost: number;
  /** Only Demon Castle sets this; the floor a purchase would open. */
  nextFloor: number | null;
  affordable: boolean;
  available: boolean;
};

export type StoreMitigationView = {
  key: "hourglass" | "shadow-feed";
  name: string;
  description: string;
  cost: number;
  affordable: boolean;
  available: boolean;
};

export type StoreView = {
  gold: number;
  level: number;
  unlocks: StoreItemView[];
  challenges: StoreChallengeView[];
  pendingChallenge: { type: ChallengeType; floor: number | null } | null;
  highestFloorCleared: number;
  mitigation: StoreMitigationView[];
  feedableShadows: { id: string; name: string }[];
  instantDungeonKeyCost: number;
  wager: {
    available: boolean;
    maxStake: number;
    /** The stake already placed on this week, or null. */
    placedStake: number | null;
  };
};

function requirementLabel(def: UnlockDef): string {
  switch (def.requirement.kind) {
    case "none":
      return "No requirement";
    case "level":
      return `Level ${def.requirement.minLevel}`;
    case "army-rank":
      return `Army Rank ${def.requirement.minGrade}`;
  }
}

const CHALLENGE_COPY: Record<
  ChallengeType,
  { name: string; description: string }
> = {
  "red-gate": {
    name: "Red Gate",
    description:
      "Reach 1.5x your recent average volume today for quadruple gold and EXP, and a guaranteed epic drop.",
  },
  "boss-raid": {
    name: "Boss Raid",
    description:
      "Break at least one record today, and every record this session pays double.",
  },
  "demon-castle": {
    name: "Demon Castle Floor",
    description:
      "Each floor asks for 10% more volume than the last. Clear it to open the next.",
  },
};

/**
 * Everything the Store page renders, assembled in one pass.
 *
 * Nothing here decides anything: each `available` flag mirrors a rule the
 * matching app-service enforces for real. The page is a view of those rules,
 * never a second copy of them — a button that is wrongly enabled produces a
 * readable error rather than an unguarded purchase.
 */
export async function getStoreView(
  container: Container,
): Promise<StoreView | null> {
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const army = await getShadowArmyView(container);
  const unlockedKeys = new Set(await container.store.unlockedKeys());

  const unlocks: StoreItemView[] = UNLOCK_CATALOG.map((def) => {
    const unlocked = unlockedKeys.has(def.key);
    const requirementMet = meetsRequirement(def.requirement, {
      level: hunter.level,
      armyRank: army.armyRank,
    });
    const affordable = hunter.gold >= def.cost;
    return {
      key: def.key,
      name: def.name,
      note: def.note,
      cost: def.cost,
      requirementLabel: requirementLabel(def),
      requirementMet,
      unlocked,
      affordable,
      available: !unlocked && requirementMet && affordable,
    };
  });

  const pendingRow = await container.store.pendingChallenge();
  const highestFloorCleared = await container.store.highestFloorCleared();
  const pendingChallenge =
    pendingRow === null
      ? null
      : {
          type: pendingRow.type as ChallengeType,
          floor: pendingRow.floor,
        };

  const challenges: StoreChallengeView[] = CHALLENGE_TYPES.map((type) => {
    const cost = challengeCost(type);
    const affordable = hunter.gold >= cost;
    return {
      type,
      name: CHALLENGE_COPY[type].name,
      description: CHALLENGE_COPY[type].description,
      cost,
      nextFloor: type === "demon-castle" ? highestFloorCleared + 1 : null,
      affordable,
      available: pendingChallenge === null && affordable,
    };
  });

  const weekStart = startOfIsoWeek(today);
  const gracesThisWeek = await container.mitigation.gracesBetween(
    weekStart,
    addDays(weekStart, 6),
  );
  const hourglassAvailable =
    gracesThisWeek.length < HOURGLASS_MAX_PER_WEEK &&
    hunter.gold >= HOURGLASS_OF_GRACE_COST;

  const feedableShadows = army.shadows
    .filter((s) => s.extracted)
    .map((s) => ({ id: s.id, name: s.name }));

  const mitigation: StoreMitigationView[] = [
    {
      key: "hourglass",
      name: "Hourglass of Grace",
      description:
        "Today's Daily Quest is judged at 04:00 tomorrow instead of midnight. Once a week.",
      cost: HOURGLASS_OF_GRACE_COST,
      affordable: hunter.gold >= HOURGLASS_OF_GRACE_COST,
      available: hourglassAvailable,
    },
    {
      key: "shadow-feed",
      name: "Shadow Feed",
      description:
        "One shadow waits three more days before it begins to weaken.",
      cost: SHADOW_FEED_COST,
      affordable: hunter.gold >= SHADOW_FEED_COST,
      available: hunter.gold >= SHADOW_FEED_COST && feedableShadows.length > 0,
    },
  ];

  const thisWeeksWager = await container.wagers.byWeek(weekStart);

  return {
    gold: hunter.gold,
    level: hunter.level,
    unlocks,
    challenges,
    pendingChallenge,
    highestFloorCleared,
    mitigation,
    feedableShadows,
    instantDungeonKeyCost: INSTANT_DUNGEON_KEY_COST,
    wager: {
      available:
        isoWeekdayOf(today) === 1 &&
        thisWeeksWager === null &&
        maxStake(hunter.gold) > 0,
      maxStake: maxStake(hunter.gold),
      placedStake: thisWeeksWager?.stakeGold ?? null,
    },
  };
}
