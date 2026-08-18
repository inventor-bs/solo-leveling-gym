import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import { getSystemMessage } from "./system-voice-view";
import { VOICE_OF_THE_RULER_UNLOCK_KEY } from "@/core/system-voice/tone";

const TODAY = "2026-08-08";
let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-08T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

describe("getSystemMessage", () => {
  it("returns null when no hunter is registered", async () => {
    const empty = buildContainer({
      db: await makeTestDb(),
      clock: fixedClock("2026-08-08T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    expect(await getSystemMessage(empty, "briefing")).toBeNull();
  });

  it("serves the pooled message when the slot is filled", async () => {
    await container.systemMessages.insert({
      day: TODAY,
      kind: "briefing",
      body: "Hunter. Squat has fallen. Take it back.",
      severity: "warning",
      source: "gemini",
      createdAt: 1,
    });
    const msg = await getSystemMessage(container, "briefing");
    expect(msg).toEqual({
      body: "Hunter. Squat has fallen. Take it back.",
      severity: "warning",
      source: "gemini",
    });
  });

  it("REGRESSION: falls back to the template when the slot is empty", async () => {
    const msg = await getSystemMessage(container, "briefing");
    expect(msg?.source).toBe("template");
    expect(msg?.body).toContain("Hunter");
  });

  it("REGRESSION: never serves another day's message", async () => {
    await container.systemMessages.insert({
      day: "2026-08-07",
      kind: "briefing",
      body: "Hunter. Yesterday. Go.",
      severity: "info",
      source: "gemini",
      createdAt: 1,
    });
    expect((await getSystemMessage(container, "briefing"))?.source).toBe(
      "template",
    );
  });

  it("keeps the two kinds independent", async () => {
    await container.systemMessages.insert({
      day: TODAY,
      kind: "quest",
      body: "Hunter. The quest stands. Finish it.",
      severity: "warning",
      source: "gemini",
      createdAt: 1,
    });
    expect((await getSystemMessage(container, "quest"))?.source).toBe("gemini");
    expect((await getSystemMessage(container, "briefing"))?.source).toBe(
      "template",
    );
  });

  it("REGRESSION: stays silent even with a pooled message once the System has gone quiet", async () => {
    // The pool is generated at midnight, before the silence threshold may
    // have been crossed. Silence is decided at read time or not at all.
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-07-25",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });
    await container.systemMessages.insert({
      day: TODAY,
      kind: "briefing",
      body: "Hunter. Something. Anything.",
      severity: "info",
      source: "gemini",
      createdAt: 1,
    });
    const msg = await getSystemMessage(container, "briefing");
    expect(msg?.body).toBe("");
    expect(msg?.severity).toBe("critical");
  });
});

describe("getSystemMessage and the active tone", () => {
  async function ownTone(tone: string): Promise<void> {
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ voiceTone: tone });
  }

  it("builds the template message in the owned tone", async () => {
    // Compared against the Cold message from the same container rather than
    // matched against a fixed string: the seed depends only on the day and
    // the kind, so both calls take the same branch and the same opening
    // slot, and the only thing that can differ is the voice. Every tone
    // differs from Cold on every branch, so a body that comes back
    // unchanged means the tone never reached the engine.
    const cold = await getSystemMessage(container, "briefing");
    expect(cold?.source).toBe("template");

    await ownTone("ancient");
    const ancient = await getSystemMessage(container, "briefing");
    expect(ancient?.source).toBe("template");
    expect(ancient?.body).not.toBe(cold?.body);
    expect(ancient?.body.length).toBeGreaterThan(0);
  });

  it("REGRESSION: an unowned tone still reads as Cold", async () => {
    await container.hunters.update({ voiceTone: "ancient" });
    const msg = await getSystemMessage(container, "briefing");
    expect(msg?.body).not.toContain("Thy");
    expect(msg?.body).not.toContain("hath");
  });

  it("REGRESSION: switching tone does not rewrite a message already in the pool", async () => {
    // The day's briefing must not change under someone who has already read
    // it, and a tone change is not a reason to spend an LLM call.
    await container.systemMessages.insert({
      day: TODAY,
      kind: "briefing",
      body: "Hunter. Squat has fallen. Take it back.",
      severity: "warning",
      source: "gemini",
      createdAt: 1,
    });
    await ownTone("ancient");

    const msg = await getSystemMessage(container, "briefing");
    expect(msg).toEqual({
      body: "Hunter. Squat has fallen. Take it back.",
      severity: "warning",
      source: "gemini",
    });
  });

  it("REGRESSION: the tone never changes the severity of what is happening", async () => {
    await container.penalties.create({
      id: "p2",
      startedDay: TODAY,
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });
    const cold = await getSystemMessage(container, "briefing");
    await ownTone("mocking");
    const mocking = await getSystemMessage(container, "briefing");
    expect(mocking?.severity).toBe(cold?.severity);
  });
});
