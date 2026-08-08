import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { HiddenQuestRepo } from "./hidden-quest.repo";

let repo: HiddenQuestRepo;

const input = {
  id: "the-seventh-day",
  name: "The Seventh Day",
  revealedDay: "2026-08-08",
  revealedAt: 1000,
  goldAwarded: 90,
};

beforeEach(async () => {
  repo = new HiddenQuestRepo(await makeTestDb());
});

describe("HiddenQuestRepo", () => {
  it("has nothing before a reveal — a hidden quest has no pending state", async () => {
    expect(await repo.all()).toEqual([]);
    expect(await repo.byId("the-seventh-day")).toBeNull();
  });

  it("reports true for the call that actually revealed the quest", async () => {
    expect(await repo.reveal(input)).toBe(true);
    expect(await repo.byId("the-seventh-day")).toMatchObject({
      name: "The Seventh Day",
      goldAwarded: 90,
    });
  });

  it("REGRESSION: reports false on every later call, so gold is paid once", async () => {
    await repo.reveal(input);
    expect(
      await repo.reveal({ ...input, revealedAt: 2000, goldAwarded: 210 }),
    ).toBe(false);
    const row = await repo.byId("the-seventh-day");
    expect(row?.goldAwarded).toBe(90);
    expect(row?.revealedAt).toBe(1000);
  });

  it("REGRESSION: only one of several truly concurrent callers is told it won, even with identical payloads", async () => {
    const attempts = Array.from({ length: 5 }, () => repo.reveal(input));
    const results = await Promise.all(attempts);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await repo.byId(input.id)).toMatchObject({
      goldAwarded: input.goldAwarded,
    });
  });
});
