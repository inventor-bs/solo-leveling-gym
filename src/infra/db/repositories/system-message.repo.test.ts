import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { SystemMessageRepo } from "./system-message.repo";

let repo: SystemMessageRepo;

beforeEach(async () => {
  repo = new SystemMessageRepo(await makeTestDb());
});

describe("SystemMessageRepo", () => {
  it("finds nothing for a slot that was never filled", async () => {
    expect(await repo.byDayAndKind("2026-08-08", "briefing")).toBeNull();
  });

  it("stores a message and reads it back by slot", async () => {
    await repo.insert({
      day: "2026-08-08",
      kind: "briefing",
      body: "Hunter. Continue.",
      severity: "info",
      source: "gemini",
      createdAt: 1000,
    });
    const row = await repo.byDayAndKind("2026-08-08", "briefing");
    expect(row).toMatchObject({
      body: "Hunter. Continue.",
      severity: "info",
      source: "gemini",
    });
  });

  it("keeps the two kinds of a single day apart", async () => {
    await repo.insert({
      day: "2026-08-08",
      kind: "briefing",
      body: "A.",
      severity: "info",
      source: "gemini",
      createdAt: 1,
    });
    await repo.insert({
      day: "2026-08-08",
      kind: "quest",
      body: "B.",
      severity: "info",
      source: "gemini",
      createdAt: 2,
    });
    expect((await repo.byDayAndKind("2026-08-08", "briefing"))?.body).toBe(
      "A.",
    );
    expect((await repo.byDayAndKind("2026-08-08", "quest"))?.body).toBe("B.");
  });

  it("REGRESSION: a retried reset never fills the same slot twice", async () => {
    const input = {
      day: "2026-08-08",
      kind: "briefing",
      body: "First.",
      severity: "info" as const,
      source: "gemini",
      createdAt: 1,
    };
    await repo.insert(input);
    await repo.insert({ ...input, body: "Second.", createdAt: 2 });
    expect((await repo.byDayAndKind("2026-08-08", "briefing"))?.body).toBe(
      "First.",
    );
  });

  it("returns recent bodies newest first, capped at the limit", async () => {
    for (let i = 1; i <= 7; i++) {
      await repo.insert({
        day: `2026-08-0${i}`,
        kind: "briefing",
        body: `Message ${i}.`,
        severity: "info",
        source: "gemini",
        createdAt: i,
      });
    }
    expect(await repo.recentBodies(5)).toEqual([
      "Message 7.",
      "Message 6.",
      "Message 5.",
      "Message 4.",
      "Message 3.",
    ]);
  });
});
