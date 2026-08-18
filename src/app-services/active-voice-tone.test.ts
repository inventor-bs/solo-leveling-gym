import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { VOICE_OF_THE_RULER_UNLOCK_KEY } from "@/core/system-voice/tone";
import { resolveVoiceTone } from "./active-voice-tone";

async function emptyContainer(): Promise<Container> {
  return buildContainer({
    db: await makeTestDb(),
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
}

async function containerWithHunter(): Promise<Container> {
  const container = await emptyContainer();
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  return container;
}

describe("resolveVoiceTone", () => {
  it("is Cold when nothing has ever been chosen", async () => {
    const container = await containerWithHunter();
    expect(await resolveVoiceTone(container)).toBeNull();
  });

  it("returns the stored tone once it is both chosen and owned", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ voiceTone: "ancient" });
    expect(await resolveVoiceTone(container)).toBe("ancient");
  });

  it("REGRESSION: falls back to Cold when the unlock row is gone, even with a valid tone stored", async () => {
    // The easiest branch to forget, and the one that matters: the column is
    // not the source of truth about ownership — store_unlock is. A row
    // removed by a clean-up or a rollback must return the voice to Cold on
    // the next read, not keep exercising a right that no longer exists.
    const container = await containerWithHunter();
    await container.hunters.update({ voiceTone: "merciless" });
    expect(await resolveVoiceTone(container)).toBeNull();
  });

  it("falls back to Cold on a junk value in the column, without throwing", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ voiceTone: "sarcastic" });
    expect(await resolveVoiceTone(container)).toBeNull();
  });

  it("REGRESSION: treats the string 'cold' as junk, because Cold is null and never an id", async () => {
    const container = await containerWithHunter();
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ voiceTone: "cold" });
    expect(await resolveVoiceTone(container)).toBeNull();
  });

  it("is Cold when there is no hunter at all", async () => {
    expect(await resolveVoiceTone(await emptyContainer())).toBeNull();
  });
});
