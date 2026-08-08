import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import type { Db } from "@/infra/db/client";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { enterPenalty } from "./enter-penalty";
import { getPenaltyView } from "./penalty-view";
import { exitPenalty } from "./exit-penalty";

/** Builds a container whose clock sits at 09:00 ICT on the given day. */
function containerAt(db: Db, iso: string): Container {
  return buildContainer({ db, clock: fixedClock(iso), tzOffsetMinutes: 420 });
}

let db: Db;
let container: Container;

beforeEach(async () => {
  db = await makeTestDb();
  container = containerAt(db, "2026-08-06T02:00:00.000Z"); // 09:00 ICT 2026-08-06
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

describe("getPenaltyView", () => {
  it("is null when no penalty is active", async () => {
    expect(await getPenaltyView(container)).toBeNull();
  });

  it("scales the survival targets to 1.5x on the first day", async () => {
    await enterPenalty(container, parseTrainingDay("2026-08-06"));
    const view = await getPenaltyView(container);

    expect(view?.daysStuck).toBe(0);
    expect(view?.targets).toEqual({
      pushups: 30,
      situps: 30,
      squats: 30,
      runKm: 1.5,
    });
    expect(view?.canEscape).toBe(false);
    expect(view?.systemSilent).toBe(false);
  });

  it("escalates with each day stuck", async () => {
    await enterPenalty(container, parseTrainingDay("2026-08-06"));
    const later = containerAt(db, "2026-08-09T02:00:00.000Z"); // 3 days on
    const view = await getPenaltyView(later);

    expect(view?.daysStuck).toBe(3);
    expect(view?.targets.pushups).toBe(36);
  });

  it("REGRESSION: goes silent on day seven instead of escalating further", async () => {
    await enterPenalty(container, parseTrainingDay("2026-08-06"));
    const later = containerAt(db, "2026-08-13T02:00:00.000Z"); // 7 days on
    const view = await getPenaltyView(later);

    expect(view?.daysStuck).toBe(7);
    expect(view?.systemSilent).toBe(true);
    // capped, not still climbing
    expect(view?.targets.pushups).toBe(40);
  });

  it("counts survival progress from the day's quest row and run log", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, { pushups: 30, situps: 30 });
    await container.training.createRun({
      id: "r1",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    const view = await getPenaltyView(container);
    expect(view?.progress.pushups).toBe(30);
    expect(view?.progress.runKm).toBe(1.5);
    expect(view?.canEscape).toBe(false); // squats still missing
  });

  it("allows escape once every survival requirement is met", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, {
      pushups: 30,
      situps: 30,
      squats: 30,
    });
    await container.training.createRun({
      id: "r1",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    expect((await getPenaltyView(container))?.canEscape).toBe(true);
  });

  it("REGRESSION: creates today's quest row itself, even if the daily-reset cron never ran", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    // Deliberately NOT calling ensureDailyQuest here — this simulates a
    // delayed or failed cron run, which the owner's only reachable page
    // must still recover from.

    const view = await getPenaltyView(container);

    expect(view).not.toBeNull();
    expect(await container.quests.byDay(today)).not.toBeNull();
  });

  it("REGRESSION: offers the Reawakening Test after fourteen dormant days", async () => {
    // Coming back to a wall of debt after a month is what makes people
    // delete the app. The base-difficulty test is the way back in.
    await enterPenalty(container, parseTrainingDay("2026-08-06"));
    const later = containerAt(db, "2026-08-25T02:00:00.000Z");
    const view = await getPenaltyView(later);

    expect(view?.reawakening).toBe(true);
    // base difficulty, not 2x
    expect(view?.targets.pushups).toBe(20);
  });
});

describe("exitPenalty", () => {
  it("reports no active penalty when there is none", async () => {
    const result = await exitPenalty(container);
    expect(result.ok).toBe(false);
  });

  it("refuses while the survival requirements are unmet", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);

    const result = await exitPenalty(container);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("survival-incomplete");
    expect(await container.penalties.active()).not.toBeNull();
  });

  it("closes the episode once the survival quest is cleared", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, {
      pushups: 30,
      situps: 30,
      squats: 30,
    });
    await container.training.createRun({
      id: "r1",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    const result = await exitPenalty(container);
    expect(result.ok).toBe(true);
    expect(await container.penalties.active()).toBeNull();
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "PenaltyCleared")).toBe(
        true,
      );
    }
  });

  it("REGRESSION: does not refund the EXP that was taken", async () => {
    // The EXP loss is permanent. Refunding it on exit would make the
    // penalty free and the whole mechanic theatre.
    await container.hunters.update({ exp: 1000 });
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, {
      pushups: 30,
      situps: 30,
      squats: 30,
    });
    await container.training.createRun({
      id: "r1",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    await exitPenalty(container);
    expect((await container.hunters.get())?.exp).toBe(900);
  });

  it("earns One Who Returned on the fifth escape", async () => {
    const { TITLE_CATALOG } = await import("@/core/title/catalog");
    await container.titles.seed(
      TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
    );
    // Four escapes already behind the hunter, closed directly.
    for (let i = 0; i < 4; i += 1) {
      await container.penalties.create({
        id: `old-${i}`,
        startedDay: "2026-07-01",
        startedAt: 10 + i,
        reason: "daily-quest-missed",
        variantId: 1,
        expLost: 5,
      });
      await container.penalties.close(`old-${i}`, 20 + i);
    }

    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, {
      pushups: 30,
      situps: 30,
      squats: 30,
    });
    await container.training.createRun({
      id: "r-escape",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    const result = await exitPenalty(container);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.events.some(
          (e) => e.type === "TitleEarned" && e.titleId === "one-who-returned",
        ),
      ).toBe(true);
    }
  });

  it("persists the PenaltyCleared event to the event log", async () => {
    const today = parseTrainingDay("2026-08-06");
    await enterPenalty(container, today);
    await ensureDailyQuest(container, today);
    await container.quests.addProgress(today, {
      pushups: 30,
      situps: 30,
      squats: 30,
    });
    await container.training.createRun({
      id: "r1",
      day: today,
      distanceKm: 1.5,
      durationSec: 500,
      loggedAt: 1,
    });

    const result = await exitPenalty(container);
    expect(result.ok).toBe(true);
    const rows = await container.events.between(today, today);
    expect(rows.some((r) => r.type === "PenaltyCleared")).toBe(true);
  });
});
