import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { DASHBOARD_LAYOUT_UNLOCK_KEY } from "@/core/cosmetic/catalog";
import { saveDashboardOrder } from "./save-dashboard-order";

async function containerWithHunter(unlocked: boolean): Promise<Container> {
  const db = await makeTestDb();
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  if (unlocked) await container.store.unlock(DASHBOARD_LAYOUT_UNLOCK_KEY, 0);
  return container;
}

describe("saveDashboardOrder", () => {
  it("refuses when the layout has not been bought, and writes nothing", async () => {
    const container = await containerWithHunter(false);
    const result = await saveDashboardOrder(container, [
      "instant-dungeon-key",
      "daily-quest",
    ]);
    expect(result).toEqual({
      ok: false,
      error: { type: "cosmetic-not-owned" },
    });
    expect((await container.hunters.get())?.dashboardOrder).toBeNull();
  });

  it("stores a full reordering exactly as given", async () => {
    const container = await containerWithHunter(true);
    const order = ["instant-dungeon-key", "todays-gate", "daily-quest"];
    const result = await saveDashboardOrder(container, order);
    expect(result).toEqual({ ok: true, value: { order } });
    expect((await container.hunters.get())?.dashboardOrder).toBe(
      JSON.stringify(order),
    );
  });

  it("normalizes before storing, so a bad client can never persist junk", async () => {
    const container = await containerWithHunter(true);
    // "daily-quest" duplicated (keeps its first position) and "not-a-panel"
    // (unrecognized, dropped) exercise both normalization rules at once;
    // "todays-gate"/"instant-dungeon-key", omitted from the input, land
    // appended at the end in default order.
    const result = await saveDashboardOrder(container, [
      "daily-quest",
      "not-a-panel",
      "daily-quest",
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.order).toEqual([
      "daily-quest",
      "todays-gate",
      "instant-dungeon-key",
    ]);
    expect((await container.hunters.get())?.dashboardOrder).toBe(
      JSON.stringify(result.value.order),
    );
  });

  it("stores the default order when handed an empty array", async () => {
    const container = await containerWithHunter(true);
    const result = await saveDashboardOrder(container, []);
    expect(result.ok && result.value.order).toEqual([
      "daily-quest",
      "todays-gate",
      "instant-dungeon-key",
    ]);
  });

  it("refuses when there is no hunter", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-14T05:00:00Z"),
    });
    const result = await saveDashboardOrder(container, []);
    expect(result).toEqual({ ok: false, error: { type: "hunter-not-found" } });
  });
});
