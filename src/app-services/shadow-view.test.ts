import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { getShadowArmyView } from "./shadow-view";

let container: Container;

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
