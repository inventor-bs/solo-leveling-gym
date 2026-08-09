import { describe, it, expect } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { StoreRepo } from "./store.repo";

async function repo() {
  return new StoreRepo(await makeTestDb());
}

describe("StoreRepo unlocks", () => {
  it("starts with nothing unlocked", async () => {
    const store = await repo();
    expect(await store.unlockedKeys()).toEqual([]);
    expect(await store.isUnlocked("program:ppl")).toBe(false);
  });

  it("records an unlock and reads it back", async () => {
    const store = await repo();
    await store.unlock("dungeon-type:amrap", 1_000);
    expect(await store.isUnlocked("dungeon-type:amrap")).toBe(true);
    expect(await store.unlockedKeys()).toEqual(["dungeon-type:amrap"]);
  });

  it("keeps the first unlockedAt when the same key is bought twice", async () => {
    const store = await repo();
    await store.unlock("program:531", 1_000);
    await store.unlock("program:531", 9_999);
    const keys = await store.unlockedKeys();
    expect(keys).toEqual(["program:531"]);
  });
});

describe("StoreRepo pending challenge", () => {
  it("holds no challenge to begin with", async () => {
    const store = await repo();
    expect(await store.pendingChallenge()).toBeNull();
  });

  it("stores one challenge and reads its type, floor and instant back", async () => {
    const store = await repo();
    await store.setPendingChallenge({
      type: "demon-castle",
      purchasedAt: 1_700,
      floor: 3,
    });
    const row = await store.pendingChallenge();
    expect(row?.type).toBe("demon-castle");
    expect(row?.floor).toBe(3);
    expect(row?.purchasedAt).toBe(1_700);
  });

  it("never holds two challenges — a second write replaces the first", async () => {
    const store = await repo();
    await store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: 1,
      floor: null,
    });
    await store.setPendingChallenge({
      type: "boss-raid",
      purchasedAt: 2,
      floor: null,
    });
    const row = await store.pendingChallenge();
    expect(row?.type).toBe("boss-raid");
  });

  it("clears the challenge once it resolves", async () => {
    const store = await repo();
    await store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: 1,
      floor: null,
    });
    await store.clearPendingChallenge();
    expect(await store.pendingChallenge()).toBeNull();
  });
});

describe("StoreRepo demon castle progress", () => {
  it("reports floor 0 before anything has been cleared", async () => {
    const store = await repo();
    expect(await store.highestFloorCleared()).toBe(0);
  });

  it("advances the highest floor and survives a re-read", async () => {
    const store = await repo();
    await store.setHighestFloorCleared(1);
    expect(await store.highestFloorCleared()).toBe(1);
    await store.setHighestFloorCleared(2);
    expect(await store.highestFloorCleared()).toBe(2);
  });
});
