import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { VoiceQuotaRepo } from "./voice-quota.repo";

let repo: VoiceQuotaRepo;

beforeEach(async () => {
  repo = new VoiceQuotaRepo(await makeTestDb());
});

describe("VoiceQuotaRepo", () => {
  it("REGRESSION: a day with no row reads as a fresh, untripped budget", async () => {
    expect(await repo.forDay("2026-08-08")).toEqual({
      requests: 0,
      consecutiveFailures: 0,
      tripped: false,
    });
  });

  it("saves and reloads a state", async () => {
    await repo.save("2026-08-08", {
      requests: 4,
      consecutiveFailures: 1,
      tripped: false,
    });
    expect(await repo.forDay("2026-08-08")).toEqual({
      requests: 4,
      consecutiveFailures: 1,
      tripped: false,
    });
  });

  it("overwrites the same day rather than accumulating rows", async () => {
    await repo.save("2026-08-08", {
      requests: 1,
      consecutiveFailures: 0,
      tripped: false,
    });
    await repo.save("2026-08-08", {
      requests: 9,
      consecutiveFailures: 3,
      tripped: true,
    });
    expect(await repo.forDay("2026-08-08")).toEqual({
      requests: 9,
      consecutiveFailures: 3,
      tripped: true,
    });
  });

  it("REGRESSION: a new day starts untripped, so the breaker closes itself", async () => {
    await repo.save("2026-08-08", {
      requests: 9,
      consecutiveFailures: 3,
      tripped: true,
    });
    expect((await repo.forDay("2026-08-09")).tripped).toBe(false);
  });
});
