import { describe, it, expect } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { WagerRepo } from "./wager.repo";

async function repo() {
  return new WagerRepo(await makeTestDb());
}

describe("WagerRepo", () => {
  it("has no wager for a week nothing was staked on", async () => {
    const wagers = await repo();
    expect(await wagers.byWeek("2026-08-03")).toBeNull();
  });

  it("places a wager as active with its stake and instant", async () => {
    const wagers = await repo();
    await wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 250,
      placedAt: 1_000,
    });
    const row = await wagers.byWeek("2026-08-03");
    expect(row?.stakeGold).toBe(250);
    expect(row?.status).toBe("active");
    expect(row?.placedAt).toBe(1_000);
    expect(row?.resolvedAt).toBeNull();
  });

  it("resolves a wager exactly once, stamping the verdict and the instant", async () => {
    const wagers = await repo();
    await wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 250,
      placedAt: 1_000,
    });
    await wagers.resolve("2026-08-03", "won", 2_000);
    const row = await wagers.byWeek("2026-08-03");
    expect(row?.status).toBe("won");
    expect(row?.resolvedAt).toBe(2_000);
  });

  it("leaves an already-resolved wager alone on a second resolve", async () => {
    const wagers = await repo();
    await wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 250,
      placedAt: 1_000,
    });
    await wagers.resolve("2026-08-03", "won", 2_000);
    await wagers.resolve("2026-08-03", "lost", 3_000);
    const row = await wagers.byWeek("2026-08-03");
    expect(row?.status).toBe("won");
    expect(row?.resolvedAt).toBe(2_000);
  });

  it("lists only unresolved wagers from weeks that have already ended", async () => {
    const wagers = await repo();
    await wagers.place({
      weekStart: "2026-07-27",
      stakeGold: 100,
      placedAt: 1,
    });
    await wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 2,
    });
    await wagers.place({
      weekStart: "2026-08-10",
      stakeGold: 300,
      placedAt: 3,
    });
    await wagers.resolve("2026-07-27", "lost", 4);

    const pending = await wagers.activeBefore("2026-08-10");
    expect(pending.map((w) => w.weekStart)).toEqual(["2026-08-03"]);
  });
});
