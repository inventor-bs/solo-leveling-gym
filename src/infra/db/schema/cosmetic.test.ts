import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { HunterRepo } from "../repositories/hunter.repo";
import { ShadowRepo } from "../repositories/shadow.repo";
import { hunter } from "./hunter";
import { shadow } from "./shadow";

let db: Db;

beforeEach(async () => {
  db = await makeTestDb();
});

describe("cosmetic columns", () => {
  it("declares the three hunter columns and the one shadow column", () => {
    expect(Object.keys(hunter)).toEqual(
      expect.arrayContaining(["titleFrame", "dashboardOrder", "auraLevel"]),
    );
    expect(Object.keys(shadow)).toEqual(
      expect.arrayContaining(["equippedSkinId"]),
    );
  });

  it("gives a brand new hunter no frame, no stored order and no aura", async () => {
    const hunters = new HunterRepo(db);
    const created = await hunters.create({ name: "Jin-Woo", createdAt: 0 });
    expect(created.titleFrame).toBeNull();
    expect(created.dashboardOrder).toBeNull();
    expect(created.auraLevel).toBe(0);
  });

  it("writes every cosmetic column through the existing HunterPatch", async () => {
    const hunters = new HunterRepo(db);
    await hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await hunters.update({
      titleFrame: "sovereign",
      dashboardOrder: '["run-log"]',
      auraLevel: 3,
    });
    const row = await hunters.get();
    expect(row?.titleFrame).toBe("sovereign");
    expect(row?.dashboardOrder).toBe('["run-log"]');
    expect(row?.auraLevel).toBe(3);
  });

  it("seeds a shadow with no skin equipped", async () => {
    const shadows = new ShadowRepo(db);
    await shadows.seed([
      { id: "igris", name: "Igris", muscle: "chest", extractedAt: 0 },
    ]);
    expect((await shadows.byId("igris"))?.equippedSkinId).toBeNull();
  });
});
