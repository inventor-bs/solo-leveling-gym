import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { enterPenalty } from "./enter-penalty";

let container: Container;
const day = parseTrainingDay("2026-08-05");

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-06T03:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

describe("enterPenalty", () => {
  it("fails cleanly with no hunter", async () => {
    const result = await enterPenalty(container, day);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("hunter-not-found");
  });

  it("removes 10 percent of EXP and records how much was taken", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ level: 4, exp: 500 });

    const result = await enterPenalty(container, day);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.expLost).toBe(50);

    const hunter = await container.hunters.get();
    expect(hunter?.exp).toBe(450);
  });

  it("REGRESSION: never lowers the level, even at zero EXP", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ level: 7, exp: 0 });

    await enterPenalty(container, day);

    const hunter = await container.hunters.get();
    expect(hunter?.level).toBe(7);
    expect(hunter?.exp).toBe(0);
  });

  it("REGRESSION: never writes a stat column, since stats are read-layer only", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ strength: 80, agility: 40 });

    await enterPenalty(container, day);

    const hunter = await container.hunters.get();
    expect(hunter?.strength).toBe(80);
    expect(hunter?.agility).toBe(40);
  });

  it("uses the first variant for a first offence and the second for the next", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    const first = await enterPenalty(container, day);
    expect(first.ok && first.value.penalty.variantId).toBe(1);

    if (first.ok) await container.penalties.close(first.value.penalty.id, 10);
    const second = await enterPenalty(
      container,
      parseTrainingDay("2026-08-09"),
    );
    expect(second.ok && second.value.penalty.variantId).toBe(2);
  });

  it("REGRESSION: refuses to stack a second penalty on an active one", async () => {
    // Stacking is what turns a bad week into a spiral nobody escapes.
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ exp: 1000 });
    await enterPenalty(container, day);

    const again = await enterPenalty(container, parseTrainingDay("2026-08-06"));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.type).toBe("penalty-already-active");

    // and the second attempt must not have taken more EXP
    const hunter = await container.hunters.get();
    expect(hunter?.exp).toBe(900);
  });

  it("emits a PenaltyStarted event carrying the variant and the loss", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ exp: 200 });
    const result = await enterPenalty(container, day);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const started = result.value.events.find(
        (e) => e.type === "PenaltyStarted",
      );
      expect(started).toMatchObject({ variantId: 1, expLost: 20 });
    }
  });
});
