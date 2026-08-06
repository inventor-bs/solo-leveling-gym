import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer } from "@/server/container";
import { logRun } from "./log-run";

async function testContainer() {
  const db = await makeTestDb();
  let n = 0;
  return buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-05T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
}

async function testContainerWithKaisel() {
  const container = await testContainer();
  await container.shadows.seed([
    { id: "kaisel", name: "Kaisel", muscle: "cardio", extractedAt: null },
  ]);
  return container;
}

describe("logRun", () => {
  it("persists a run and returns a RunLogged event", async () => {
    const container = await testContainer();
    const result = await logRun(container, {
      day: "2026-08-05",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "RunLogged",
      distanceKm: 5,
      durationSec: 1800,
    });
  });

  it("REGRESSION: retrying the same clientActionId doesn't log twice", async () => {
    const container = await testContainer();
    await logRun(container, {
      day: "2026-08-05",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "same",
    });
    // Retrying with different values must still return the FIRST result —
    // that's what proves it wasn't logged a second time.
    const result = await logRun(container, {
      day: "2026-08-05",
      distanceKm: 99,
      durationSec: 1,
      clientActionId: "same",
    });
    expect(result.ok && result.value.events[0]).toEqual({
      type: "RunLogged",
      distanceKm: 5,
      durationSec: 1800,
    });
  });

  it("extracts Kaisel on the first run ever logged", async () => {
    const container = await testContainerWithKaisel();
    const before = await container.shadows.byId("kaisel");
    expect(before?.extractedAt).toBeNull();

    const result = await logRun(container, {
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "a",
    });

    const after = await container.shadows.byId("kaisel");
    expect(after?.extractedAt).not.toBeNull();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.events.some(
          (e) => e.type === "ShadowArisen" && e.shadowId === "kaisel",
        ),
      ).toBe(true);
    }
  });

  it("REGRESSION: does not extract Kaisel a second time on a later run", async () => {
    const container = await testContainerWithKaisel();
    await logRun(container, {
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "a",
    });
    const result = await logRun(container, {
      day: "2026-08-07",
      distanceKm: 3,
      durationSec: 1000,
      clientActionId: "b",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "ShadowArisen")).toBe(
        false,
      );
    }
  });

  it("adds distance-based EXP to Kaisel and stamps the trained day", async () => {
    const container = await testContainerWithKaisel();
    await logRun(container, {
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "a",
    });
    const kaisel = await container.shadows.byId("kaisel");
    expect(kaisel?.exp).toBeGreaterThan(0);
    expect(kaisel?.lastTrainedDay).toBe("2026-08-06");
  });

  it("REGRESSION: does nothing when the shadow roster hasn't been seeded", async () => {
    const container = await testContainer(); // no shadows.seed call at all
    const result = await logRun(container, {
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1800,
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "ShadowArisen")).toBe(
        false,
      );
    }
  });
});
