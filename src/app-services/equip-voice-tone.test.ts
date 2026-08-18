import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { VOICE_OF_THE_RULER_UNLOCK_KEY } from "@/core/system-voice/tone";
import { equipVoiceTone } from "./equip-voice-tone";

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

describe("equipVoiceTone", () => {
  it("equips a tone once the bundle has been bought", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);

    const result = await equipVoiceTone(container, "ancient");
    expect(result).toEqual({ ok: true, value: { voiceTone: "ancient" } });
    expect((await container.hunters.get())?.voiceTone).toBe("ancient");
  });

  it("one purchase unlocks all three, so switching between them is free and unlimited", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ gold: 4_000 });

    for (const tone of ["mocking", "ancient", "merciless", "mocking"]) {
      expect((await equipVoiceTone(container, tone)).ok).toBe(true);
    }
    expect((await container.hunters.get())?.voiceTone).toBe("mocking");
    expect((await container.hunters.get())?.gold).toBe(4_000);
  });

  it("refuses a tone that has not been bought, and writes nothing", async () => {
    const container = await containerWithHunter();
    const result = await equipVoiceTone(container, "mocking");
    expect(result).toEqual({ ok: false, error: { type: "tone-not-owned" } });
    expect((await container.hunters.get())?.voiceTone).toBeNull();
  });

  it("refuses an id that is not in the catalog", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    expect(await equipVoiceTone(container, "sarcastic")).toEqual({
      ok: false,
      error: { type: "unknown-tone" },
    });
  });

  it("REGRESSION: refuses the string 'cold', which is not an id in any state", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    expect(await equipVoiceTone(container, "cold")).toEqual({
      ok: false,
      error: { type: "unknown-tone" },
    });
  });

  it("REGRESSION: returning to Cold always works, even having bought nothing", async () => {
    // Cold is the default state, not a privilege. Refusing it would strand
    // anyone whose unlock row was ever removed.
    const container = await containerWithHunter();
    const result = await equipVoiceTone(container, null);
    expect(result).toEqual({ ok: true, value: { voiceTone: null } });
    expect((await container.hunters.get())?.voiceTone).toBeNull();
  });

  it("clears a previously chosen tone back to Cold", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await equipVoiceTone(container, "merciless");

    expect(await equipVoiceTone(container, null)).toEqual({
      ok: true,
      value: { voiceTone: null },
    });
    expect((await container.hunters.get())?.voiceTone).toBeNull();
  });

  it("refuses when there is no hunter", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-14T05:00:00Z"),
    });
    expect(await equipVoiceTone(container, null)).toEqual({
      ok: false,
      error: { type: "hunter-not-found" },
    });
  });

  it("touches nothing else on the hunter row", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({
      title: "unyielding",
      titleFrame: "system",
      gold: 900,
      exp: 1_200,
    });

    await equipVoiceTone(container, "mocking");

    const row = await container.hunters.get();
    expect(row?.title).toBe("unyielding");
    expect(row?.titleFrame).toBe("system");
    expect(row?.gold).toBe(900);
    expect(row?.exp).toBe(1_200);
  });
});
