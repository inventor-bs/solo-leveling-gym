import { describe, it, expect, beforeEach } from "vitest";
import { epoch } from "@/core/shared/units";
import { makeTestDb } from "../testing/make-test-db";
import { IdempotencyRepo } from "./idempotency.repo";
import type { Db } from "../client";

let db: Db;
let repo: IdempotencyRepo;

beforeEach(async () => {
  db = await makeTestDb();
  repo = new IdempotencyRepo(db);
});

describe("IdempotencyRepo", () => {
  it("find() returns null for an id never seen before", async () => {
    expect(await repo.find("not-there")).toBeNull();
  });

  it("remember() then find() returns the stored result", async () => {
    await repo.remember("action-1", { expGained: 450 }, epoch(1754400000000));
    expect(await repo.find<{ expGained: number }>("action-1")).toEqual({
      expGained: 450,
    });
  });

  it("REGRESSION: calling remember() twice with the same id doesn't overwrite the first result", async () => {
    // The user taps twice on flaky wifi. The first result must win.
    await repo.remember("action-1", { expGained: 450 }, epoch(1754400000000));
    await repo.remember("action-1", { expGained: 900 }, epoch(1754400001000));
    expect(await repo.find<{ expGained: number }>("action-1")).toEqual({
      expGained: 450,
    });
  });

  it("different ids are stored independently", async () => {
    await repo.remember("a", { v: 1 }, epoch(1));
    await repo.remember("b", { v: 2 }, epoch(2));
    expect(await repo.find<{ v: number }>("a")).toEqual({ v: 1 });
    expect(await repo.find<{ v: number }>("b")).toEqual({ v: 2 });
  });
});
