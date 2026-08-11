import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { getShadowArmyView } from "./shadow-view";

let container: Container;

/**
 * Builds a fresh, nine-shadow container pinned to `day` as "today".
 *
 * The other tests in this file share one module-level container via
 * `beforeEach`, fixed to a single clock day — fine for tests that don't
 * care what day "today" is. The Shadow Feed tests below need to control
 * that day themselves (feed expiry is relative to it), so they get their
 * own factory instead of overloading the shared fixture.
 */
async function containerWithShadows(day: string): Promise<Container> {
  const db = await makeTestDb();
  const built = buildContainer({
    db,
    clock: fixedClock(`${day}T02:00:00.000Z`),
    tzOffsetMinutes: 420,
  });
  await built.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 1 : null,
    })),
  );
  return built;
}

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-06T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 1 : null,
    })),
  );
});

describe("getShadowArmyView", () => {
  it("lists all nine shadows, with only Igris extracted on a fresh roster", async () => {
    const view = await getShadowArmyView(container);
    expect(view.shadows).toHaveLength(9);
    const igris = view.shadows.find((s) => s.id === "igris");
    expect(igris?.extracted).toBe(true);
    expect(igris?.grade).toBe("Normal");
    const tank = view.shadows.find((s) => s.id === "tank");
    expect(tank?.extracted).toBe(false);
    expect(tank?.grade).toBeNull();
  });

  it("Army Rank matches only the extracted shadows", async () => {
    const view = await getShadowArmyView(container);
    expect(view.armyRank).toBe("Normal"); // only Igris extracted, at Normal
  });

  it("reports days since trained, using weakened EXP for the grade", async () => {
    await container.shadows.addExp("igris", 20_000, "2026-07-01");
    const view = await getShadowArmyView(container);
    const igris = view.shadows.find((s) => s.id === "igris");
    expect(igris?.daysSinceTrained).toBeGreaterThan(30);
    expect(igris?.weakened).toBe(true);
    // Raw 20,000 is Knight grade, but weeks of neglect must have dropped it.
    expect(igris?.grade).not.toBe("Knight");
  });

  it("REGRESSION: names the weakest currently-extracted shadow, ignoring un-extracted ones", async () => {
    // 17 days before "today" clears WEAKEN_AFTER_DAYS, so this shadow has
    // actually decayed — a genuine weakest candidate, not just "trained a
    // while ago."
    await container.shadows.addExp("igris", 500, "2026-07-20");
    const view = await getShadowArmyView(container);
    expect(view.weakest?.name).toBe("Igris");
  });

  it("is null for weakest when nothing has been trained yet", async () => {
    const view = await getShadowArmyView(container);
    // Igris was extracted but never trained (no addExp call) — lastTrainedDay
    // is null, so there is no meaningful "days since trained" to report.
    expect(view.weakest).toBeNull();
  });

  it("REGRESSION: a shadow trained today is not reported as weakest", async () => {
    // Igris trained on the same training day the clock reports as "today" —
    // daysSinceTrained is 0, so effectiveExp equals exp and weakened is
    // false. It must not be surfaced as having weakened.
    await container.shadows.addExp("igris", 500, "2026-08-06");
    const view = await getShadowArmyView(container);
    const igris = view.shadows.find((s) => s.id === "igris");
    expect(igris?.daysSinceTrained).toBe(0);
    expect(igris?.weakened).toBe(false);
    expect(view.weakest).toBeNull();
  });

  it("Bellion has no grade even when extracted, per its no-ladder design", async () => {
    await container.shadows.extract("bellion", 1);
    const view = await getShadowArmyView(container);
    const bellion = view.shadows.find((s) => s.id === "bellion");
    expect(bellion?.extracted).toBe(true);
    expect(bellion?.grade).toBeNull();
  });
});

describe("getShadowArmyView — skills", () => {
  it("Iron Body extends the grace window before a shadow starts weakening", async () => {
    // Tank isn't extracted on a fresh roster, so extract it and give it exp
    // trained 8 days before "today" (the fixed clock in beforeEach is
    // 2026-08-06) — inside Iron Body's 10-day window, but past the default
    // 7-day one.
    await container.shadows.extract("tank", 1);
    await container.shadows.addExp("tank", 10_000, "2026-07-29");

    const before = await getShadowArmyView(container);
    const tank = before.shadows.find((s) => s.id === "tank")!;
    expect(tank.weakened).toBe(true); // default 7-day window: already weakening

    await container.skills.seed([{ id: "iron-body" }]);
    await container.skills.learn("iron-body", 100);
    await container.skills.equip("iron-body", 100);

    const after = await getShadowArmyView(container);
    const tankWithSkill = after.shadows.find((s) => s.id === "tank")!;
    expect(tankWithSkill.weakened).toBe(false); // 8 days is inside the extended 10-day window
  });

  it("Army Discipline switches Army Rank to the average of extracted shadows", async () => {
    // The default fixture only has Igris extracted, so weakest-link and
    // average agree trivially with one contributor. Extract a second shadow
    // at a different grade, trained "today" so neither is weakening, to make
    // the two modes actually diverge.
    await container.shadows.extract("tank", 1);
    await container.shadows.addExp("tank", 40_000, "2026-08-06");

    const before = await getShadowArmyView(container);
    expect(before.armyRank).toBe("Normal"); // weakest-link: gated by Igris

    await container.skills.seed([{ id: "army-discipline" }]);
    await container.skills.learn("army-discipline", 100);
    await container.skills.equip("army-discipline", 100);

    const after = await getShadowArmyView(container);
    expect(after.armyRank).not.toBe(before.armyRank);
  });
});

describe("getShadowArmyView — Shadow Feed", () => {
  it("holds a fed shadow at full strength past the weakening threshold", async () => {
    const container = await containerWithShadows("2026-08-15");
    await container.shadows.addExp("igris", 20_000, "2026-08-06");
    const before = await getShadowArmyView(container);
    const igrisBefore = before.shadows.find((s) => s.id === "igris");
    expect(igrisBefore?.weakened).toBe(true);

    await container.mitigation.feed("igris", "2026-08-18");
    const after = await getShadowArmyView(container);
    const igrisAfter = after.shadows.find((s) => s.id === "igris");
    expect(igrisAfter?.weakened).toBe(false);
    expect(igrisAfter?.effectiveExp).toBe(20_000);
    expect(igrisAfter?.fedUntilDay).toBe("2026-08-18");
  });

  it("stops helping once the feed has run out", async () => {
    const container = await containerWithShadows("2026-08-15");
    await container.shadows.addExp("igris", 20_000, "2026-08-06");
    await container.mitigation.feed("igris", "2026-08-13");
    const view = await getShadowArmyView(container);
    expect(view.shadows.find((s) => s.id === "igris")?.weakened).toBe(true);
  });

  it("leaves the stored EXP untouched no matter what the view reports", async () => {
    const container = await containerWithShadows("2026-08-15");
    await container.shadows.addExp("igris", 20_000, "2026-08-06");
    await container.mitigation.feed("igris", "2026-08-18");
    await getShadowArmyView(container);
    expect((await container.shadows.byId("igris"))?.exp).toBe(20_000);
  });
});
