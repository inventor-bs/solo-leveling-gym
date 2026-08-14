import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { titleFrameKey } from "@/core/cosmetic/catalog";
import { equipTitleFrame } from "./equip-title-frame";

async function containerWithHunter(): Promise<Container> {
  const db = await makeTestDb();
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  return container;
}

describe("equipTitleFrame", () => {
  it("equips a frame that has been bought", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(titleFrameKey("monarch"), 0);

    const result = await equipTitleFrame(container, "monarch");
    expect(result).toEqual({ ok: true, value: { titleFrame: "monarch" } });
    expect((await container.hunters.get())?.titleFrame).toBe("monarch");
  });

  it("is valid with NO title worn — the frame simply has nothing to draw around yet", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(titleFrameKey("system"), 0);
    expect((await container.hunters.get())?.title).toBeNull();

    const result = await equipTitleFrame(container, "system");
    expect(result).toEqual({ ok: true, value: { titleFrame: "system" } });
    expect((await container.hunters.get())?.titleFrame).toBe("system");
  });

  it("refuses a frame that has not been bought", async () => {
    const container = await containerWithHunter();
    const result = await equipTitleFrame(container, "sovereign");
    expect(result).toEqual({
      ok: false,
      error: { type: "cosmetic-not-owned" },
    });
    expect((await container.hunters.get())?.titleFrame).toBeNull();
  });

  it("refuses a frame id that is not in the catalog", async () => {
    const container = await containerWithHunter();
    const result = await equipTitleFrame(container, "bronze");
    expect(result).toEqual({ ok: false, error: { type: "unknown-cosmetic" } });
  });

  it("always allows taking the frame off", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(titleFrameKey("monarch"), 0);
    await equipTitleFrame(container, "monarch");

    const result = await equipTitleFrame(container, null);
    expect(result).toEqual({ ok: true, value: { titleFrame: null } });
    expect((await container.hunters.get())?.titleFrame).toBeNull();
  });

  it("refuses when there is no hunter", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-14T05:00:00Z"),
    });
    const result = await equipTitleFrame(container, null);
    expect(result).toEqual({ ok: false, error: { type: "hunter-not-found" } });
  });

  it("never touches the title itself", async () => {
    const container = await containerWithHunter();
    await container.hunters.update({ title: "unyielding" });
    await container.store.unlock(titleFrameKey("system"), 0);
    await equipTitleFrame(container, "system");
    expect((await container.hunters.get())?.title).toBe("unyielding");
  });
});
