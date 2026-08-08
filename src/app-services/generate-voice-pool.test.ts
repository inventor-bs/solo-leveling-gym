import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import {
  VoiceGenerationError,
  type SystemVoicePort,
  type VoiceDraft,
} from "@/ports/system-voice.port";
import { DAILY_REQUEST_LIMIT } from "@/core/system-voice/quota";
import { generateVoicePool } from "./generate-voice-pool";
import { runDailyReset } from "./daily-reset";

const NOW_ISO = "2026-08-08T02:00:00.000Z";
const TODAY = "2026-08-08";

function voiceReturning(draft: Partial<VoiceDraft>): SystemVoicePort {
  return {
    generate: async () => ({
      body: "Hunter. Continue.",
      severity: "info",
      title: null,
      ...draft,
    }),
  };
}

const alwaysFails: SystemVoicePort = {
  generate: async () => {
    throw new VoiceGenerationError("down");
  },
};

async function makeContainer(
  voice: SystemVoicePort | null,
): Promise<Container> {
  const db = await makeTestDb();
  await seedProgram(db);
  const container = buildContainer({
    db,
    clock: fixedClock(NOW_ISO),
    tzOffsetMinutes: 420,
    voice,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
  return container;
}

describe("generateVoicePool", () => {
  it("REGRESSION: is a no-op with no provider configured, and writes nothing", async () => {
    const container = await makeContainer(null);
    const summary = await generateVoicePool(container);
    expect(summary).toEqual({
      attempted: 0,
      stored: 0,
      rejected: 0,
      failed: 0,
    });
    expect(
      await container.systemMessages.byDayAndKind(TODAY, "briefing"),
    ).toBeNull();
  });

  it("REGRESSION: the daily reset still succeeds with no provider configured", async () => {
    const container = await makeContainer(null);
    const summary = await runDailyReset(container);
    expect(summary.voiceMessagesGenerated).toBe(0);
    expect(summary.today).toBe(TODAY);
  });

  it("fills every pool slot when the provider behaves", async () => {
    const container = await makeContainer(voiceReturning({}));
    const summary = await generateVoicePool(container);
    expect(summary.stored).toBe(2);
    expect(
      (await container.systemMessages.byDayAndKind(TODAY, "briefing"))?.source,
    ).toBe("gemini");
    expect(
      await container.systemMessages.byDayAndKind(TODAY, "quest"),
    ).not.toBeNull();
  });

  it("REGRESSION: stores nothing that failed the gate", async () => {
    const container = await makeContainer(
      voiceReturning({ body: "Hunter. Deadlift 999 kg. Continue." }),
    );
    const summary = await generateVoicePool(container);
    expect(summary.rejected).toBe(2);
    expect(summary.stored).toBe(0);
    expect(
      await container.systemMessages.byDayAndKind(TODAY, "briefing"),
    ).toBeNull();
  });

  it("spends quota on a rejected message, since the request was still made", async () => {
    const container = await makeContainer(
      voiceReturning({ body: "Hunter. Deadlift 999 kg. Continue." }),
    );
    await generateVoicePool(container);
    expect((await container.voiceQuota.forDay(TODAY)).requests).toBe(2);
  });

  it("counts provider failures and records them against the day", async () => {
    const container = await makeContainer(alwaysFails);
    const summary = await generateVoicePool(container);
    expect(summary.failed).toBe(2);
    expect(summary.stored).toBe(0);
    const quota = await container.voiceQuota.forDay(TODAY);
    expect(quota.consecutiveFailures).toBe(2);
    expect(quota.tripped).toBe(false);
  });

  it("REGRESSION: stops generating for the day once the breaker is tripped", async () => {
    const container = await makeContainer(alwaysFails);
    await container.voiceQuota.save(TODAY, {
      requests: 3,
      consecutiveFailures: 3,
      tripped: true,
    });
    const summary = await generateVoicePool(container);
    expect(summary).toEqual({
      attempted: 0,
      stored: 0,
      rejected: 0,
      failed: 0,
    });
  });

  it("REGRESSION: refuses to generate once the daily ceiling is reached", async () => {
    const container = await makeContainer(voiceReturning({}));
    await container.voiceQuota.save(TODAY, {
      requests: DAILY_REQUEST_LIMIT,
      consecutiveFailures: 0,
      tripped: false,
    });
    expect((await generateVoicePool(container)).attempted).toBe(0);
  });

  it("REGRESSION: a second run on the same day does not refill a filled slot", async () => {
    const container = await makeContainer(
      voiceReturning({ body: "Hunter. First. Go." }),
    );
    await generateVoicePool(container);
    const second = await generateVoicePool(container);
    expect(second.attempted).toBe(0);
    expect(
      (await container.systemMessages.byDayAndKind(TODAY, "briefing"))?.body,
    ).toBe("Hunter. First. Go.");
  });

  it("does nothing when no hunter exists to describe", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      clock: fixedClock(NOW_ISO),
      tzOffsetMinutes: 420,
      voice: voiceReturning({}),
    });
    expect((await generateVoicePool(container)).attempted).toBe(0);
  });
});
