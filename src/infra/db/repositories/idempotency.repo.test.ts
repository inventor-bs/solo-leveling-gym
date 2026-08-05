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
  it("find() trả null cho id chưa từng thấy", async () => {
    expect(await repo.find("chua-co")).toBeNull();
  });

  it("remember() rồi find() trả lại đúng kết quả đã lưu", async () => {
    await repo.remember("action-1", { expGained: 450 }, epoch(1754400000000));
    expect(await repo.find<{ expGained: number }>("action-1")).toEqual({
      expGained: 450,
    });
  });

  it("REGRESSION: gọi remember() hai lần cùng id không ghi đè kết quả đầu", async () => {
    // Người dùng tap hai lần khi sóng yếu. Kết quả lần đầu phải thắng.
    await repo.remember("action-1", { expGained: 450 }, epoch(1754400000000));
    await repo.remember("action-1", { expGained: 900 }, epoch(1754400001000));
    expect(await repo.find<{ expGained: number }>("action-1")).toEqual({
      expGained: 450,
    });
  });

  it("các id khác nhau được lưu độc lập", async () => {
    await repo.remember("a", { v: 1 }, epoch(1));
    await repo.remember("b", { v: 2 }, epoch(2));
    expect(await repo.find<{ v: number }>("a")).toEqual({ v: 1 });
    expect(await repo.find<{ v: number }>("b")).toEqual({ v: 2 });
  });
});
