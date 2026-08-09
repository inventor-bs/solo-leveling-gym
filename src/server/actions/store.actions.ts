"use server";

import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { buyUnlock, type BuyUnlockResult } from "@/app-services/buy-unlock";
import {
  buyChallenge,
  type BuyChallengeResult,
} from "@/app-services/buy-challenge";
import {
  buyInstantDungeonKey,
  type BuyInstantDungeonKeyResult,
} from "@/app-services/buy-instant-dungeon-key";
import {
  buyHourglassOfGrace,
  type BuyHourglassResult,
} from "@/app-services/buy-hourglass";
import {
  buyShadowFeed,
  type BuyShadowFeedResult,
} from "@/app-services/buy-shadow-feed";
import { placeWager, type PlaceWagerResult } from "@/app-services/place-wager";
import type { ActionResult } from "./action-result";

/**
 * Every action here returns its failure as data. A thrown domain error
 * reaches the browser as an opaque digest in a production build, which is
 * indistinguishable from the app being down at exactly the moment the
 * hunter is trying to spend gold.
 */

const unlockSchema = z.object({ key: z.string().min(1).max(64) });

export async function buyUnlockAction(
  input: unknown,
): Promise<ActionResult<BuyUnlockResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = unlockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await buyUnlock(getContainer(), parsed.data.key);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const challengeSchema = z.object({
  type: z.enum(["red-gate", "boss-raid", "demon-castle"]),
  floor: z.number().int().positive().optional(),
});

export async function buyChallengeAction(
  input: unknown,
): Promise<ActionResult<BuyChallengeResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await buyChallenge(getContainer(), parsed.data);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const instantKeySchema = z.object({ programDayId: z.string().min(1) });

export async function buyInstantDungeonKeyAction(
  input: unknown,
): Promise<ActionResult<BuyInstantDungeonKeyResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = instantKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await buyInstantDungeonKey(getContainer(), parsed.data);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

export async function buyHourglassAction(): Promise<
  ActionResult<BuyHourglassResult>
> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await buyHourglassOfGrace(getContainer());
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const shadowFeedSchema = z.object({ shadowId: z.string().min(1).max(64) });

export async function buyShadowFeedAction(
  input: unknown,
): Promise<ActionResult<BuyShadowFeedResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = shadowFeedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await buyShadowFeed(getContainer(), parsed.data.shadowId);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const wagerSchema = z.object({
  stakeGold: z.number().int().positive(),
});

export async function placeWagerAction(
  input: unknown,
): Promise<ActionResult<PlaceWagerResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = wagerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await placeWager(getContainer(), parsed.data.stakeGold);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}
