import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { TITLE_CATALOG } from "@/core/title/catalog";
import { equipTitle } from "./equip-title";
import { equippedTitleId } from "./equipped-title";

let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-07T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
  await container.titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );
});

async function hunter() {
  const row = await container.hunters.get();
  if (!row) throw new Error("test setup: hunter missing");
  return row;
}

describe("equipTitle", () => {
  it("REGRESSION: refuses a title that has not been earned yet", async () => {
    // Every title in this app is earned by training. Equipping one that was
    // never earned would be the one thing the whole design forbids.
    const result = await equipTitle(container, "unyielding");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("title-not-earned");
    expect((await hunter()).title).toBeNull();
  });

  it("refuses an id that is not a title at all", async () => {
    const result = await equipTitle(container, "wolfs-nemesis");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("title-not-found");
  });

  it("equips an earned title", async () => {
    await container.titles.earn("unyielding", 100);
    const result = await equipTitle(container, "unyielding");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.equipped).toBe("unyielding");
    expect((await hunter()).title).toBe("unyielding");
  });

  it("REGRESSION: equipping a second title replaces the first — only one is worn", async () => {
    await container.titles.earn("unyielding", 100);
    await container.titles.earn("monarch-of-dawn", 100);
    await equipTitle(container, "unyielding");
    await equipTitle(container, "monarch-of-dawn");
    expect((await hunter()).title).toBe("monarch-of-dawn");
  });

  it("unequips when given null", async () => {
    await container.titles.earn("unyielding", 100);
    await equipTitle(container, "unyielding");
    const result = await equipTitle(container, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.equipped).toBeNull();
    expect((await hunter()).title).toBeNull();
  });
});

describe("equippedTitleId", () => {
  it("is null when nothing is worn", async () => {
    expect(await equippedTitleId(container, await hunter())).toBeNull();
  });

  it("is the worn title once it is earned and equipped", async () => {
    await container.titles.earn("unyielding", 100);
    await equipTitle(container, "unyielding");
    expect(await equippedTitleId(container, await hunter())).toBe("unyielding");
  });

  it("REGRESSION: a stored value that is not a real title grants nothing", async () => {
    // hunter.title is plain nullable text; a hand-edited row must not be
    // able to hand out a buff.
    await container.hunters.update({ title: "wolfs-nemesis" });
    expect(await equippedTitleId(container, await hunter())).toBeNull();
  });

  it("REGRESSION: a real title stored without ever being earned grants nothing", async () => {
    await container.hunters.update({ title: "unyielding" });
    expect(await equippedTitleId(container, await hunter())).toBeNull();
  });
});
