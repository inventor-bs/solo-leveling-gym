import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { seededRng } from "@/infra/rng/seeded-rng";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer } from "./container";

describe("buildContainer", () => {
  it("wires up every dependency from a single db", async () => {
    const db = await makeTestDb();
    const c = buildContainer({ db, tzOffsetMinutes: 420 });
    expect(c.hunters).toBeDefined();
    expect(c.idempotency).toBeDefined();
    expect(c.tzOffsetMinutes).toBe(420);
  });

  it("allows swapping the clock and rng for testing", async () => {
    const db = await makeTestDb();
    const c = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-05T16:59:00Z"),
      rng: seededRng(42),
    });
    expect(c.clock.now()).toBe(Date.parse("2026-08-05T16:59:00Z"));
    expect(c.rng.next()).toBe(seededRng(42).next());
  });

  it("repositories use the db that was passed in", async () => {
    const db = await makeTestDb();
    const c = buildContainer({ db, tzOffsetMinutes: 420 });
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    expect((await c.hunters.get())?.name).toBe("Jin-Woo");
  });

  it("two containers on two different dbs don't share data", async () => {
    const a = buildContainer({ db: await makeTestDb(), tzOffsetMinutes: 420 });
    const b = buildContainer({ db: await makeTestDb(), tzOffsetMinutes: 420 });
    await a.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    expect(await b.hunters.get()).toBeNull();
  });
});
