import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { HunterRepo } from "./hunter.repo";
import type { Db } from "../client";

let db: Db;
let repo: HunterRepo;

beforeEach(async () => {
  db = await makeTestDb();
  repo = new HunterRepo(db);
});

describe("HunterRepo", () => {
  it("get() trả null khi chưa có hunter", async () => {
    expect(await repo.get()).toBeNull();
  });

  it("create() rồi get() trả về đúng hunter", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    const h = await repo.get();
    expect(h?.name).toBe("Jin-Woo");
    expect(h?.id).toBe(1);
    expect(h?.level).toBe(1);
    expect(h?.rank).toBe("E");
    expect(h?.tzOffsetMinutes).toBe(420);
  });

  it("update() sửa được các trường được chỉ định", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await repo.update({ level: 5, exp: 1200, strength: 41.5 });
    const h = await repo.get();
    expect(h?.level).toBe(5);
    expect(h?.exp).toBe(1200);
    expect(h?.strength).toBe(41.5);
    expect(h?.name).toBe("Jin-Woo");
  });

  it("update() với patch rỗng không đổi gì", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await repo.update({});
    expect((await repo.get())?.name).toBe("Jin-Woo");
  });

  it("create() lần hai ném lỗi — chỉ có đúng một hunter", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await expect(
      repo.create({ name: "Khác", createdAt: 1754400000000 }),
    ).rejects.toThrow();
  });
});
