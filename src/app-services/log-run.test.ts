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
});
