import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { ShadowRepo } from "./shadow.repo";

let db: Db;
let shadows: ShadowRepo;

beforeEach(async () => {
  db = await makeTestDb();
  shadows = new ShadowRepo(db);
});

describe("ShadowRepo", () => {
  it("is empty before seeding", async () => {
    expect(await shadows.all()).toEqual([]);
  });

  it("seeds every row exactly as given, including nulls", async () => {
    await shadows.seed([
      { id: "igris", name: "Igris", muscle: "chest", extractedAt: 100 },
      { id: "bellion", name: "Bellion", muscle: null, extractedAt: null },
    ]);
    const all = await shadows.all();
    expect(all).toHaveLength(2);
    const igris = all.find((s) => s.id === "igris");
    expect(igris?.extractedAt).toBe(100);
    expect(igris?.exp).toBe(0);
    const bellion = all.find((s) => s.id === "bellion");
    expect(bellion?.muscle).toBeNull();
    expect(bellion?.extractedAt).toBeNull();
  });

  it("is idempotent — seeding twice does not duplicate or throw", async () => {
    const rows = [
      { id: "igris", name: "Igris", muscle: "chest" as const, extractedAt: 1 },
    ];
    await shadows.seed(rows);
    await shadows.seed(rows);
    expect(await shadows.all()).toHaveLength(1);
  });

  it("byId returns null for an unknown id", async () => {
    expect(await shadows.byId("nope")).toBeNull();
  });

  it("addExp accumulates and stamps the last trained day", async () => {
    await shadows.seed([
      { id: "igris", name: "Igris", muscle: "chest", extractedAt: 1 },
    ]);
    await shadows.addExp("igris", 500, "2026-08-06");
    await shadows.addExp("igris", 250, "2026-08-07");
    const igris = await shadows.byId("igris");
    expect(igris?.exp).toBe(750);
    expect(igris?.lastTrainedDay).toBe("2026-08-07");
  });

  it("extract sets extractedAt only if it is not already set", async () => {
    await shadows.seed([
      { id: "tank", name: "Tank", muscle: "back", extractedAt: null },
    ]);
    await shadows.extract("tank", 500);
    await shadows.extract("tank", 999); // must not overwrite the original moment
    const tank = await shadows.byId("tank");
    expect(tank?.extractedAt).toBe(500);
  });
});

describe("ShadowRepo.equipSkin", () => {
  it("writes and clears the equipped skin without touching exp", async () => {
    await shadows.seed([
      { id: "igris", name: "Igris", muscle: "chest", extractedAt: 0 },
    ]);
    await shadows.addExp("igris", 500, "2026-08-14");

    await shadows.equipSkin("igris", "void");
    expect((await shadows.byId("igris"))?.equippedSkinId).toBe("void");
    expect((await shadows.byId("igris"))?.exp).toBe(500);

    await shadows.equipSkin("igris", null);
    expect((await shadows.byId("igris"))?.equippedSkinId).toBeNull();
    expect((await shadows.byId("igris"))?.exp).toBe(500);
  });

  it("touches only the shadow it names", async () => {
    await shadows.seed([
      { id: "igris", name: "Igris", muscle: "chest", extractedAt: 0 },
      { id: "tank", name: "Tank", muscle: "back", extractedAt: 0 },
    ]);
    await shadows.equipSkin("igris", "ember");
    expect((await shadows.byId("tank"))?.equippedSkinId).toBeNull();
  });
});
