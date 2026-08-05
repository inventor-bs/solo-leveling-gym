# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền kỹ thuật cho Solo Leveling Gym — database, ranh giới kiến trúc được máy kiểm tra, xử lý múi giờ đúng, auth bằng PIN, và hạ tầng test — để Phase 1 có thể build engine tập luyện mà không phải quyết định lại bất cứ điều gì.

**Architecture:** Clean layering một chiều: `app/ → server/ → app-services/ → core/`, với `infra/` implement các interface trong `ports/`. `core/` là domain thuần, không I/O, không framework, không đọc thời gian hay số ngẫu nhiên từ môi trường. Ranh giới được ép bằng ESLint chứ không bằng quy ước.

**Tech Stack:** Next.js 15 · TypeScript 5 (strict) · Drizzle ORM · Turso (libSQL) · Zod · Vitest · Playwright · Node 24

## Global Constraints

- **Node 24.19.0 (Krypton, Active LTS), pnpm 11.1.3** — ghim bằng `.nvmrc` và trường `packageManager`.
- **TypeScript `strict: true`** — đã bật trong `tsconfig.json`, không được tắt.
- **Path alias `@/*` → `./src/*`** — đã cấu hình, dùng nhất quán trong mọi import.
- **`src/core/**` KHÔNG được import:** `next/*`, `react`, `drizzle-orm`, `@libsql/client`, bất cứ thứ gì trong `src/infra`, `src/server`, `src/ui`, `src/app`, `src/app-services`.
- **`src/core/**` KHÔNG được gọi:** `Date.now()`, `Math.random()`, `process.env`, `fetch`. Cho phép `new Date(epochTườngMinh)` và `Date.UTC(...)` — đó là số học lịch tất định, không phải đọc thời gian môi trường.
- **Mọi thời điểm lưu trong DB là UTC epoch milliseconds** (`integer`). Không lưu chuỗi ngày local ở bất cứ đâu ngoài kiểu `TrainingDay`.
- **Múi giờ mặc định: `+420` phút (ICT, UTC+7).** Việt Nam không có DST nên offset cố định là đúng — không cần thư viện tzdata.
- **Mọi file test đặt cạnh file nguồn**, đặt tên `*.test.ts`.
- **Commit sau mỗi task.** Message theo Conventional Commits (`feat:`, `chore:`, `test:`).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `vitest.config.ts` | Cấu hình test runner, alias `@/` |
| `playwright.config.ts` | Cấu hình E2E |
| `drizzle.config.ts` | Cấu hình migration |
| `.eslintrc.json` | Ép ranh giới kiến trúc |
| `.env.example` | Khai báo biến môi trường cần thiết |
| `src/core/shared/result.ts` | `Result<T,E>` — lỗi là giá trị, không throw |
| `src/core/shared/units.ts` | Branded types: `Kg`, `Reps`, `Exp`, `Gold`, `Epoch` |
| `src/core/shared/events.ts` | Union type domain events |
| `src/core/quest/training-day.ts` | Ranh giới "ngày tập" theo múi giờ — nơi DUY NHẤT suy ra ngày |
| `src/ports/clock.port.ts` | Interface đọc thời gian |
| `src/ports/rng.port.ts` | Interface số ngẫu nhiên |
| `src/infra/clock/system-clock.ts` | Clock thật + `fixedClock` cho test |
| `src/infra/rng/seeded-rng.ts` | RNG tất định |
| `src/infra/config/env.ts` | Validate env lúc boot, sai là chết ngay |
| `src/infra/db/client.ts` | Kết nối Turso/libSQL |
| `src/infra/db/schema/hunter.ts` | Bảng `hunter` (1 dòng duy nhất) |
| `src/infra/db/schema/system.ts` | Bảng `processed_action` (idempotency) |
| `src/infra/db/schema/index.ts` | Gom schema cho drizzle-kit |
| `src/infra/db/repositories/hunter.repo.ts` | Đọc/ghi hunter |
| `src/infra/db/repositories/idempotency.repo.ts` | Chống xử lý trùng |
| `src/server/auth/pin.ts` | So khớp PIN an toàn về thời gian |
| `src/server/auth/session.ts` | Ký/xác thực cookie phiên |
| `src/server/auth/guard.ts` | `requireWriteAccess()` cho server actions |
| `src/server/container.ts` | Composition root — nơi DUY NHẤT ráp mọi thứ |
| `.github/workflows/ci.yml` | Chạy lint + test |

---

## Task 1: Project setup — git, dependencies, test runners

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces: script `pnpm test`, `pnpm test:e2e`, `pnpm lint`; alias `@/` hoạt động trong Vitest

- [ ] **Step 1: Khởi tạo git**

```bash
git init
git branch -M main
```

- [ ] **Step 2: Tạo `.gitignore`**

```
node_modules
.next
.env
.env.local
*.db
*.db-journal
/test-results
/playwright-report
/src/infra/db/local.db
coverage
.DS_Store
```

- [ ] **Step 3: Cài dependencies**

```bash
pnpm add drizzle-orm @libsql/client zod
pnpm add -D drizzle-kit vitest @vitest/coverage-v8 @playwright/test eslint-plugin-import dotenv tsx
pnpm exec playwright install chromium
```

- [ ] **Step 4: Thêm scripts vào `package.json`**

Trong `"scripts"`, thêm bốn dòng sau (giữ nguyên các dòng đã có):

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx src/infra/db/migrate.ts"
```

- [ ] **Step 5: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 6: Tạo `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 7: Tạo `.env.example`**

```
# Turso. Local dev dùng file SQLite:
TURSO_DATABASE_URL=file:./src/infra/db/local.db
TURSO_AUTH_TOKEN=

# PIN để ghi dữ liệu. Tối thiểu 4 ký tự.
HUNTER_PIN=

# Chuỗi ngẫu nhiên >= 32 ký tự để ký cookie phiên.
# Sinh bằng: openssl rand -hex 32
SESSION_SECRET=

# Không bắt buộc. Thiếu thì System Voice chạy bằng template.
GEMINI_API_KEY=

# Múi giờ của hunter, tính bằng phút lệch so với UTC. ICT = 420.
HUNTER_TZ_OFFSET_MINUTES=420
```

- [ ] **Step 8: Xác nhận Vitest chạy được**

Tạo file tạm `src/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("setup", () => {
  it("chạy được test", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: PASS, 1 test

- [ ] **Step 9: Xoá file smoke và commit**

```bash
rm src/smoke.test.ts
git add -A
git commit -m "chore: init git, add drizzle/zod/vitest/playwright, test config"
```

---

## Task 2: Core shared primitives

**Files:**
- Create: `src/core/shared/result.ts`
- Create: `src/core/shared/result.test.ts`
- Create: `src/core/shared/units.ts`
- Create: `src/core/shared/units.test.ts`
- Create: `src/core/shared/events.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
  - `ok<T>(value: T): Result<T, never>`
  - `err<E>(error: E): Result<never, E>`
  - `isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T }`
  - `unwrapOr<T, E>(r: Result<T, E>, fallback: T): T`
  - Branded types `Kg`, `Reps`, `Exp`, `Gold`, `Epoch` với constructor `kg()`, `reps()`, `exp()`, `gold()`, `epoch()`
  - `type DomainEvent` (union, mở rộng dần ở các phase sau)

- [ ] **Step 1: Viết test thất bại cho `Result`**

Tạo `src/core/shared/result.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ok, err, isOk, unwrapOr } from "./result";

describe("Result", () => {
  it("ok() gói giá trị thành công", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r) && r.value).toBe(42);
  });

  it("err() gói lỗi", () => {
    const r = err("BOOM");
    expect(r.ok).toBe(false);
    expect(isOk(r)).toBe(false);
  });

  it("unwrapOr trả giá trị khi ok", () => {
    expect(unwrapOr(ok(10), 0)).toBe(10);
  });

  it("unwrapOr trả fallback khi err", () => {
    expect(unwrapOr(err<string>("nope"), 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/core/shared/result.test.ts`
Expected: FAIL — `Failed to resolve import "./result"`

- [ ] **Step 3: Implement `Result`**

Tạo `src/core/shared/result.ts`:

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function isOk<T, E>(
  r: Result<T, E>,
): r is { readonly ok: true; readonly value: T } {
  return r.ok;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test -- src/core/shared/result.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Viết test thất bại cho branded units**

Tạo `src/core/shared/units.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kg, reps, exp, gold, epoch } from "./units";

describe("branded units", () => {
  it("giữ nguyên giá trị số lúc runtime", () => {
    expect(kg(82.5)).toBe(82.5);
    expect(reps(6)).toBe(6);
    expect(exp(450)).toBe(450);
    expect(gold(1247)).toBe(1247);
    expect(epoch(1754400000000)).toBe(1754400000000);
  });

  it("cộng được như số bình thường", () => {
    const total = kg(80) + kg(2.5);
    expect(total).toBe(82.5);
  });
});
```

- [ ] **Step 6: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/core/shared/units.test.ts`
Expected: FAIL — không resolve được `./units`

- [ ] **Step 7: Implement branded units**

Tạo `src/core/shared/units.ts`:

```ts
declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Khối lượng tạ, kilogram. */
export type Kg = Brand<number, "Kg">;
/** Số lần lặp trong một set. */
export type Reps = Brand<number, "Reps">;
/** Điểm kinh nghiệm. */
export type Exp = Brand<number, "Exp">;
/** Tiền tệ trong game. */
export type Gold = Brand<number, "Gold">;
/** UTC epoch milliseconds. */
export type Epoch = Brand<number, "Epoch">;

export const kg = (n: number): Kg => n as Kg;
export const reps = (n: number): Reps => n as Reps;
export const exp = (n: number): Exp => n as Exp;
export const gold = (n: number): Gold => n as Gold;
export const epoch = (n: number): Epoch => n as Epoch;
```

- [ ] **Step 8: Chạy test để xác nhận pass**

Run: `pnpm test -- src/core/shared/units.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 9: Tạo khung domain events**

Tạo `src/core/shared/events.ts`:

```ts
import type { Exp, Gold } from "./units";

/**
 * Domain event = kết quả trả về của core, KHÔNG phải hạ tầng.
 * app-services nhận mảng này, ghi DB trong một transaction,
 * rồi đẩy sang UI để chạy animation.
 *
 * Mỗi phase sau sẽ thêm biến thể mới vào union này.
 */
export type DomainEvent =
  | { type: "ExpGained"; amount: Exp; source: string }
  | { type: "GoldGained"; amount: Gold; source: string }
  | { type: "LevelUp"; from: number; to: number };

export type DomainEventOfType<T extends DomainEvent["type"]> = Extract<
  DomainEvent,
  { type: T }
>;
```

- [ ] **Step 10: Chạy toàn bộ test và commit**

Run: `pnpm test`
Expected: PASS, 6 tests

```bash
git add src/core/shared
git commit -m "feat(core): add Result type, branded units, domain event union"
```

---

## Task 3: Ports và implementation của chúng

**Files:**
- Create: `src/ports/clock.port.ts`
- Create: `src/ports/rng.port.ts`
- Create: `src/infra/clock/system-clock.ts`
- Create: `src/infra/clock/system-clock.test.ts`
- Create: `src/infra/rng/seeded-rng.ts`
- Create: `src/infra/rng/seeded-rng.test.ts`

**Interfaces:**
- Consumes: `Epoch`, `epoch()` từ `@/core/shared/units`
- Produces:
  - `interface ClockPort { now(): Epoch }`
  - `interface RngPort { next(): number; int(minInclusive: number, maxExclusive: number): number }`
  - `systemClock: ClockPort` — đọc giờ thật
  - `fixedClock(iso: string): ClockPort` — cho test
  - `seededRng(seed: number): RngPort` — tất định

- [ ] **Step 1: Tạo hai port interface**

Tạo `src/ports/clock.port.ts`:

```ts
import type { Epoch } from "@/core/shared/units";

/**
 * Lý do port này tồn tại: app đầy logic phụ thuộc thời gian
 * (reset quest 00:00, quest hết hạn, Penalty Zone, shadow suy yếu).
 * Nếu core gọi thẳng Date.now() thì không thể test "23:59 vs 00:01"
 * mà không đổi giờ hệ thống.
 */
export interface ClockPort {
  now(): Epoch;
}
```

Tạo `src/ports/rng.port.ts`:

```ts
/**
 * Hidden quest, loot drop, Emergency Quest đều có xác suất.
 * Seeded RNG cho phép test phân phối một cách tất định.
 */
export interface RngPort {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
}
```

- [ ] **Step 2: Viết test thất bại cho clock**

Tạo `src/infra/clock/system-clock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { systemClock, fixedClock } from "./system-clock";

describe("systemClock", () => {
  it("trả về thời điểm gần với Date.now()", () => {
    const before = Date.now();
    const t = systemClock.now();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

describe("fixedClock", () => {
  it("luôn trả về đúng một thời điểm", () => {
    const clock = fixedClock("2026-08-05T16:59:00Z");
    expect(clock.now()).toBe(Date.parse("2026-08-05T16:59:00Z"));
    expect(clock.now()).toBe(clock.now());
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/infra/clock`
Expected: FAIL — không resolve được `./system-clock`

- [ ] **Step 4: Implement clock**

Tạo `src/infra/clock/system-clock.ts`:

```ts
import type { ClockPort } from "@/ports/clock.port";
import { epoch } from "@/core/shared/units";

export const systemClock: ClockPort = {
  now: () => epoch(Date.now()),
};

/** Clock đứng yên, dùng cho test. */
export function fixedClock(iso: string): ClockPort {
  const at = epoch(Date.parse(iso));
  if (Number.isNaN(at)) {
    throw new Error(`fixedClock: chuỗi ISO không hợp lệ: ${iso}`);
  }
  return { now: () => at };
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `pnpm test -- src/infra/clock`
Expected: PASS, 2 tests

- [ ] **Step 6: Viết test thất bại cho RNG**

Tạo `src/infra/rng/seeded-rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { seededRng } from "./seeded-rng";

describe("seededRng", () => {
  it("cùng seed cho cùng chuỗi số", () => {
    const a = seededRng(1234);
    const b = seededRng(1234);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("seed khác cho chuỗi khác", () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next() luôn nằm trong [0, 1)", () => {
    const rng = seededRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() luôn nằm trong [min, max)", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/infra/rng`
Expected: FAIL — không resolve được `./seeded-rng`

- [ ] **Step 8: Implement seeded RNG**

Tạo `src/infra/rng/seeded-rng.ts`:

```ts
import type { RngPort } from "@/ports/rng.port";

/**
 * mulberry32 — PRNG 32-bit, nhanh, phân phối đủ tốt cho loot/quest.
 * Không dùng cho mục đích mật mã.
 */
export function seededRng(seed: number): RngPort {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (minInclusive: number, maxExclusive: number): number => {
      if (maxExclusive <= minInclusive) {
        throw new Error(
          `seededRng.int: max (${maxExclusive}) phải lớn hơn min (${minInclusive})`,
        );
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
  };
}
```

- [ ] **Step 9: Chạy test để xác nhận pass**

Run: `pnpm test -- src/infra/rng`
Expected: PASS, 4 tests

- [ ] **Step 10: Commit**

```bash
git add src/ports src/infra/clock src/infra/rng
git commit -m "feat(ports): add ClockPort and RngPort with system/seeded implementations"
```

---

## Task 4: Ranh giới ngày tập theo múi giờ

Đây là task quan trọng nhất trong Phase 0. Nó chặn một lỗi cụ thể: hunter ở UTC+7, Vercel chạy UTC — nếu bất kỳ đâu gọi `new Date().getDate()` thì **mọi buổi tập log sau 19:00 giờ Việt Nam sẽ bị ghi sang ngày hôm sau**, làm vỡ streak và kích hoạt Penalty Zone sai.

**Files:**
- Create: `src/core/quest/training-day.ts`
- Create: `src/core/quest/training-day.test.ts`

**Interfaces:**
- Consumes: `Epoch`, `epoch()` từ `@/core/shared/units`
- Produces:
  - `type TrainingDay` — chuỗi branded dạng `YYYY-MM-DD`
  - `toTrainingDay(at: Epoch, tzOffsetMinutes: number): TrainingDay`
  - `trainingDayStart(day: TrainingDay, tzOffsetMinutes: number): Epoch`
  - `trainingDayEnd(day: TrainingDay, tzOffsetMinutes: number): Epoch`
  - `addDays(day: TrainingDay, n: number): TrainingDay`
  - `daysBetween(from: TrainingDay, to: TrainingDay): number`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/quest/training-day.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { epoch } from "@/core/shared/units";
import {
  toTrainingDay,
  trainingDayStart,
  trainingDayEnd,
  addDays,
  daysBetween,
  type TrainingDay,
} from "./training-day";

const ICT = 420; // UTC+7

describe("toTrainingDay", () => {
  it("23:59 giờ ICT vẫn thuộc ngày hôm đó", () => {
    // 2026-08-05 16:59 UTC = 2026-08-05 23:59 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T16:59:00Z")), ICT)).toBe(
      "2026-08-05",
    );
  });

  it("00:00 giờ ICT đã sang ngày mới", () => {
    // 2026-08-05 17:00 UTC = 2026-08-06 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T17:00:00Z")), ICT)).toBe(
      "2026-08-06",
    );
  });

  it("REGRESSION: buổi tập lúc 19:00 giờ ICT KHÔNG bị đẩy sang ngày sau", () => {
    // Đây chính là bug mà hàm này tồn tại để chặn.
    // 2026-08-05 12:00 UTC = 2026-08-05 19:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T12:00:00Z")), ICT)).toBe(
      "2026-08-05",
    );
  });

  it("xử lý đúng khi vắt qua ranh giới tháng", () => {
    // 2026-08-31 17:00 UTC = 2026-09-01 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-31T17:00:00Z")), ICT)).toBe(
      "2026-09-01",
    );
  });

  it("hoạt động với offset UTC", () => {
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T23:59:00Z")), 0)).toBe(
      "2026-08-05",
    );
  });
});

describe("trainingDayStart / trainingDayEnd", () => {
  it("start là 00:00:00.000 giờ địa phương", () => {
    const start = trainingDayStart("2026-08-05" as TrainingDay, ICT);
    expect(new Date(start).toISOString()).toBe("2026-08-04T17:00:00.000Z");
  });

  it("end là 23:59:59.999 giờ địa phương", () => {
    const end = trainingDayEnd("2026-08-05" as TrainingDay, ICT);
    expect(new Date(end).toISOString()).toBe("2026-08-05T16:59:59.999Z");
  });

  it("khứ hồi: mọi thời điểm trong ngày đều quy về đúng ngày đó", () => {
    const day = "2026-08-05" as TrainingDay;
    const start = trainingDayStart(day, ICT);
    const end = trainingDayEnd(day, ICT);
    expect(toTrainingDay(start, ICT)).toBe(day);
    expect(toTrainingDay(end, ICT)).toBe(day);
  });

  it("end của một ngày liền ngay trước start của ngày kế", () => {
    const end = trainingDayEnd("2026-08-05" as TrainingDay, ICT);
    const nextStart = trainingDayStart("2026-08-06" as TrainingDay, ICT);
    expect(nextStart - end).toBe(1);
  });
});

describe("addDays", () => {
  it("cộng ngày trong cùng tháng", () => {
    expect(addDays("2026-08-05" as TrainingDay, 3)).toBe("2026-08-08");
  });

  it("vắt qua ranh giới tháng", () => {
    expect(addDays("2026-08-30" as TrainingDay, 3)).toBe("2026-09-02");
  });

  it("trừ ngày với n âm", () => {
    expect(addDays("2026-09-02" as TrainingDay, -3)).toBe("2026-08-30");
  });
});

describe("daysBetween", () => {
  it("đếm đúng số ngày giữa hai mốc", () => {
    expect(
      daysBetween("2026-08-05" as TrainingDay, "2026-08-16" as TrainingDay),
    ).toBe(11);
  });

  it("trả 0 khi cùng ngày", () => {
    expect(
      daysBetween("2026-08-05" as TrainingDay, "2026-08-05" as TrainingDay),
    ).toBe(0);
  });

  it("trả số âm khi ngược chiều", () => {
    expect(
      daysBetween("2026-08-16" as TrainingDay, "2026-08-05" as TrainingDay),
    ).toBe(-11);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/core/quest/training-day.test.ts`
Expected: FAIL — không resolve được `./training-day`

- [ ] **Step 3: Implement**

Tạo `src/core/quest/training-day.ts`:

```ts
import { epoch, type Epoch } from "@/core/shared/units";

declare const trainingDayBrand: unique symbol;

/**
 * Ngày lịch địa phương của hunter, dạng "YYYY-MM-DD".
 *
 * ĐÂY LÀ NƠI DUY NHẤT trong toàn codebase được phép suy ra "ngày"
 * từ một thời điểm. Không nơi nào khác được gọi getDate()/getMonth().
 *
 * DB luôn lưu UTC epoch. Kiểu này chỉ tồn tại ở tầng logic.
 */
export type TrainingDay = string & { readonly [trainingDayBrand]: "TrainingDay" };

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Quy một thời điểm về ngày lịch địa phương của hunter. */
export function toTrainingDay(at: Epoch, tzOffsetMinutes: number): TrainingDay {
  // Dịch thời điểm sang "giờ địa phương biểu diễn dưới dạng UTC",
  // rồi đọc các thành phần UTC. Cách này tránh hoàn toàn múi giờ của máy chủ.
  const shifted = new Date(at + tzOffsetMinutes * MS_PER_MINUTE);
  const y = shifted.getUTCFullYear();
  const m = pad2(shifted.getUTCMonth() + 1);
  const d = pad2(shifted.getUTCDate());
  return `${y}-${m}-${d}` as TrainingDay;
}

/** Thời điểm 00:00:00.000 giờ địa phương của ngày đó. */
export function trainingDayStart(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  const [y, m, d] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  return epoch(utcMidnight - tzOffsetMinutes * MS_PER_MINUTE);
}

/** Thời điểm 23:59:59.999 giờ địa phương của ngày đó. */
export function trainingDayEnd(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  return epoch(trainingDayStart(day, tzOffsetMinutes) + MS_PER_DAY - 1);
}

/** Cộng (hoặc trừ, khi n âm) số ngày lịch. */
export function addDays(day: TrainingDay, n: number): TrainingDay {
  const [y, m, d] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + n * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad2(
    shifted.getUTCMonth() + 1,
  )}-${pad2(shifted.getUTCDate())}` as TrainingDay;
}

/** Số ngày lịch từ `from` đến `to`. Âm nếu `to` trước `from`. */
export function daysBetween(from: TrainingDay, to: TrainingDay): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY,
  );
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test -- src/core/quest/training-day.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/quest
git commit -m "feat(core): add timezone-safe TrainingDay boundary"
```

---

## Task 5: Validate biến môi trường lúc boot

**Files:**
- Create: `src/infra/config/env.ts`
- Create: `src/infra/config/env.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `parseEnv(source: Record<string, string | undefined>): Env` — thuần, test được
  - `env: Env` — singleton đọc từ `process.env`
  - `type Env = { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; HUNTER_PIN: string; SESSION_SECRET: string; GEMINI_API_KEY?: string; HUNTER_TZ_OFFSET_MINUTES: number }`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/infra/config/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  TURSO_DATABASE_URL: "file:./local.db",
  HUNTER_PIN: "1234",
  SESSION_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("chấp nhận env hợp lệ tối thiểu", () => {
    const env = parseEnv(valid);
    expect(env.TURSO_DATABASE_URL).toBe("file:./local.db");
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(420);
  });

  it("ép kiểu offset múi giờ về number", () => {
    const env = parseEnv({ ...valid, HUNTER_TZ_OFFSET_MINUTES: "0" });
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(0);
  });

  it("báo lỗi khi thiếu TURSO_DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, TURSO_DATABASE_URL: undefined })).toThrow(
      /TURSO_DATABASE_URL/,
    );
  });

  it("báo lỗi khi PIN ngắn hơn 4 ký tự", () => {
    expect(() => parseEnv({ ...valid, HUNTER_PIN: "12" })).toThrow(/HUNTER_PIN/);
  });

  it("báo lỗi khi SESSION_SECRET ngắn hơn 32 ký tự", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("GEMINI_API_KEY là tuỳ chọn", () => {
    expect(parseEnv(valid).GEMINI_API_KEY).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/infra/config`
Expected: FAIL — không resolve được `./env`

- [ ] **Step 3: Implement**

Tạo `src/infra/config/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().optional(),
  HUNTER_PIN: z.string().min(4),
  SESSION_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().optional(),
  HUNTER_TZ_OFFSET_MINUTES: z.coerce.number().int().default(420),
});

export type Env = z.infer<typeof schema>;

/**
 * Hàm thuần để test được. Ném lỗi có tên biến cụ thể
 * thay vì để app chết ở một chỗ ngẫu nhiên sau này.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Biến môi trường không hợp lệ:\n${details}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test -- src/infra/config`
Expected: PASS, 6 tests

- [ ] **Step 5: Tạo `.env` cho local dev**

```bash
cp .env.example .env
```

Sau đó điền vào `.env`:

```bash
# In ra một secret và dán vào SESSION_SECRET
openssl rand -hex 32
```

Đặt `HUNTER_PIN` thành một chuỗi số bạn nhớ được (tối thiểu 4 ký tự), giữ nguyên `TURSO_DATABASE_URL=file:./src/infra/db/local.db`.

- [ ] **Step 6: Commit**

```bash
git add src/infra/config
git commit -m "feat(infra): validate environment variables at boot with zod"
```

---

## Task 6: Database — Turso client, schema hunter, migration

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/infra/db/client.ts`
- Create: `src/infra/db/schema/hunter.ts`
- Create: `src/infra/db/schema/index.ts`
- Create: `src/infra/db/migrate.ts`

**Interfaces:**
- Consumes: `env` từ `@/infra/config/env`
- Produces:
  - `db` — instance Drizzle đã kết nối
  - `hunter` — bảng Drizzle, PK cố định `id = 1`
  - `type HunterRow = typeof hunter.$inferSelect`
  - `createDb(url: string, authToken?: string)` — factory cho test dùng DB riêng

- [ ] **Step 1: Tạo schema bảng hunter**

Tạo `src/infra/db/schema/hunter.ts`:

```ts
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * Bảng một dòng. id luôn bằng 1.
 * App phục vụ đúng một hunter theo thiết kế.
 *
 * 6 stat là số ĐO LƯỜNG (spec §1.3): luôn lưu giá trị gốc suy ra
 * từ set_log. Mọi modifier (penalty -15%, buff) áp ở tầng đọc,
 * KHÔNG bao giờ ghi đè các cột này.
 */
export const hunter = sqliteTable("hunter", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  rank: text("rank").notNull().default("E"),
  title: text("title"),
  className: text("class_name"),

  strength: real("strength").notNull().default(0),
  agility: real("agility").notNull().default(0),
  vitality: real("vitality").notNull().default(0),
  intelligence: real("intelligence").notNull().default(0),
  perception: real("perception").notNull().default(0),
  luck: real("luck").notNull().default(0),
  fatigue: real("fatigue").notNull().default(0),

  reasonForHunting: text("reason_for_hunting"),
  tzOffsetMinutes: integer("tz_offset_minutes").notNull().default(420),
  createdAt: integer("created_at").notNull(),
});

export type HunterRow = typeof hunter.$inferSelect;
export type HunterInsert = typeof hunter.$inferInsert;

export const HUNTER_ID = 1;
```

- [ ] **Step 2: Tạo file gom schema**

Tạo `src/infra/db/schema/index.ts`:

```ts
export * from "./hunter";
export * from "./system";
```

- [ ] **Step 3: Tạo schema bảng idempotency**

Tạo `src/infra/db/schema/system.ts`:

```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Chống xử lý trùng. Sóng phòng gym yếu → người dùng tap lại
 * → không được cộng EXP hai lần.
 *
 * Client sinh clientActionId (UUID) cho mỗi mutation.
 * Lần gọi thứ hai với cùng id trả lại kết quả lần đầu.
 */
export const processedAction = sqliteTable("processed_action", {
  id: text("id").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type ProcessedActionRow = typeof processedAction.$inferSelect;
```

- [ ] **Step 4: Tạo db client**

Tạo `src/infra/db/client.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/infra/config/env";
import * as schema from "./schema";

export function createDb(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);

export type Db = ReturnType<typeof createDb>;
```

- [ ] **Step 5: Tạo `drizzle.config.ts`**

```ts
import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/infra/db/schema/index.ts",
  out: "./src/infra/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

- [ ] **Step 6: Tạo runner migration**

Tạo `src/infra/db/migrate.ts`:

```ts
import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "./src/infra/db/migrations" });
  console.log("Migration hoàn tất.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 7: Sinh và chạy migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: thư mục `src/infra/db/migrations/` xuất hiện file `.sql`, và console in "Migration hoàn tất."

- [ ] **Step 8: Xác nhận bảng đã tạo**

```bash
pnpm exec tsx -e "import('@libsql/client').then(async(m)=>{const c=m.createClient({url:'file:./src/infra/db/local.db'});const r=await c.execute(\"select name from sqlite_master where type='table' order by name\");console.log(r.rows)})"
```

Expected: kết quả chứa `hunter` và `processed_action`

- [ ] **Step 9: Commit**

```bash
git add drizzle.config.ts src/infra/db
git commit -m "feat(db): add Turso client, hunter and processed_action schema, migrations"
```

---

## Task 7: Repository hunter và idempotency

**Files:**
- Create: `src/infra/db/repositories/hunter.repo.ts`
- Create: `src/infra/db/repositories/hunter.repo.test.ts`
- Create: `src/infra/db/repositories/idempotency.repo.ts`
- Create: `src/infra/db/repositories/idempotency.repo.test.ts`
- Create: `src/infra/db/testing/make-test-db.ts`

**Interfaces:**
- Consumes: `Db`, `createDb` từ `@/infra/db/client`; `hunter`, `HUNTER_ID`, `processedAction` từ schema
- Produces:
  - `makeTestDb(): Promise<Db>` — DB in-memory đã migrate, cho test
  - `class HunterRepo { constructor(db: Db); get(): Promise<HunterRow | null>; create(input): Promise<HunterRow>; update(patch): Promise<void> }`
  - `class IdempotencyRepo { constructor(db: Db); find<T>(id: string): Promise<T | null>; remember<T>(id: string, result: T, at: Epoch): Promise<void> }`

- [ ] **Step 1: Tạo helper DB cho test**

Tạo `src/infra/db/testing/make-test-db.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../schema";
import type { Db } from "../client";

/**
 * DB SQLite in-memory, đã chạy migration. Mỗi test một instance riêng
 * nên không có trạng thái rò rỉ giữa các test.
 */
export async function makeTestDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/infra/db/migrations" });
  return db as Db;
}
```

- [ ] **Step 2: Viết test thất bại cho HunterRepo**

Tạo `src/infra/db/repositories/hunter.repo.test.ts`:

```ts
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

  it("create() lần hai ném lỗi — chỉ có đúng một hunter", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await expect(
      repo.create({ name: "Khác", createdAt: 1754400000000 }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/infra/db/repositories/hunter.repo.test.ts`
Expected: FAIL — không resolve được `./hunter.repo`

- [ ] **Step 4: Implement HunterRepo**

Tạo `src/infra/db/repositories/hunter.repo.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { hunter, HUNTER_ID, type HunterRow } from "../schema/hunter";

export type CreateHunterInput = {
  name: string;
  createdAt: number;
  tzOffsetMinutes?: number;
};

export type HunterPatch = Partial<Omit<HunterRow, "id" | "createdAt">>;

export class HunterRepo {
  constructor(private readonly db: Db) {}

  async get(): Promise<HunterRow | null> {
    const rows = await this.db
      .select()
      .from(hunter)
      .where(eq(hunter.id, HUNTER_ID))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: CreateHunterInput): Promise<HunterRow> {
    await this.db.insert(hunter).values({
      id: HUNTER_ID,
      name: input.name,
      createdAt: input.createdAt,
      tzOffsetMinutes: input.tzOffsetMinutes ?? 420,
    });
    const created = await this.get();
    if (!created) {
      throw new Error("HunterRepo.create: không đọc lại được sau khi ghi");
    }
    return created;
  }

  async update(patch: HunterPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(hunter).set(patch).where(eq(hunter.id, HUNTER_ID));
  }
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `pnpm test -- src/infra/db/repositories/hunter.repo.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Viết test thất bại cho IdempotencyRepo**

Tạo `src/infra/db/repositories/idempotency.repo.test.ts`:

```ts
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
```

- [ ] **Step 7: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/infra/db/repositories/idempotency.repo.test.ts`
Expected: FAIL — không resolve được `./idempotency.repo`

- [ ] **Step 8: Implement IdempotencyRepo**

Tạo `src/infra/db/repositories/idempotency.repo.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Epoch } from "@/core/shared/units";
import type { Db } from "../client";
import { processedAction } from "../schema/system";

export class IdempotencyRepo {
  constructor(private readonly db: Db) {}

  async find<T>(id: string): Promise<T | null> {
    const rows = await this.db
      .select()
      .from(processedAction)
      .where(eq(processedAction.id, id))
      .limit(1);
    const row = rows[0];
    return row ? (JSON.parse(row.resultJson) as T) : null;
  }

  /**
   * Ghi kết quả lần đầu. Lần gọi sau với cùng id KHÔNG ghi đè —
   * kết quả lần đầu là kết quả duy nhất đúng.
   */
  async remember<T>(id: string, result: T, at: Epoch): Promise<void> {
    await this.db
      .insert(processedAction)
      .values({ id, resultJson: JSON.stringify(result), createdAt: at })
      .onConflictDoNothing();
  }
}
```

- [ ] **Step 9: Chạy test để xác nhận pass**

Run: `pnpm test -- src/infra/db/repositories`
Expected: PASS, 8 tests

- [ ] **Step 10: Commit**

```bash
git add src/infra/db
git commit -m "feat(db): add HunterRepo, IdempotencyRepo, in-memory test db helper"
```

---

## Task 8: Xác thực bằng PIN

**Files:**
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/session.test.ts`
- Create: `src/server/auth/guard.ts`

**Interfaces:**
- Consumes: `env` từ `@/infra/config/env`; `ClockPort` từ `@/ports/clock.port`
- Produces:
  - `signSession(expiresAt: number, secret: string): string`
  - `verifySession(token: string, secret: string, now: number): boolean`
  - `checkPin(input: string, expected: string): boolean` — an toàn về thời gian
  - `SESSION_COOKIE = "sl_session"`
  - `SESSION_TTL_MS = 30 ngày`
  - `requireWriteAccess(): Promise<void>` — ném lỗi nếu chưa xác thực

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/auth/session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession, checkPin } from "./session";

const SECRET = "s".repeat(32);
const NOW = 1754400000000;

describe("signSession / verifySession", () => {
  it("token vừa ký thì xác thực thành công", () => {
    const token = signSession(NOW + 1000, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(true);
  });

  it("token hết hạn bị từ chối", () => {
    const token = signSession(NOW - 1, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("token bị sửa chữ ký bị từ chối", () => {
    const token = signSession(NOW + 1000, SECRET);
    const [expiresAt] = token.split(".");
    expect(verifySession(`${expiresAt}.deadbeef`, SECRET, NOW)).toBe(false);
  });

  it("token bị sửa hạn dùng bị từ chối", () => {
    const token = signSession(NOW + 1000, SECRET);
    const [, sig] = token.split(".");
    expect(verifySession(`${NOW + 999999}.${sig}`, SECRET, NOW)).toBe(false);
  });

  it("token ký bằng secret khác bị từ chối", () => {
    const token = signSession(NOW + 1000, "x".repeat(32));
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("chuỗi rác bị từ chối, không ném lỗi", () => {
    expect(verifySession("khong-phai-token", SECRET, NOW)).toBe(false);
    expect(verifySession("", SECRET, NOW)).toBe(false);
  });
});

describe("checkPin", () => {
  it("PIN đúng trả true", () => {
    expect(checkPin("1234", "1234")).toBe(true);
  });

  it("PIN sai trả false", () => {
    expect(checkPin("9999", "1234")).toBe(false);
  });

  it("PIN khác độ dài trả false, không ném lỗi", () => {
    expect(checkPin("12", "1234")).toBe(false);
    expect(checkPin("123456", "1234")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/server/auth`
Expected: FAIL — không resolve được `./session`

- [ ] **Step 3: Implement session**

Tạo `src/server/auth/session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sl_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Token dạng "<expiresAt>.<hmac>". */
export function signSession(expiresAt: number, secret: string): string {
  return `${expiresAt}.${hmac(String(expiresAt), secret)}`;
}

export function verifySession(
  token: string,
  secret: string,
  now: number,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;

  // Kiểm chữ ký TRƯỚC khi tin vào expiresAt.
  if (!safeEqualHex(signature, hmac(expiresAtRaw, secret))) return false;

  return now < expiresAt;
}

/** So khớp PIN. So sánh an toàn về thời gian để không rò rỉ độ dài khớp. */
export function checkPin(input: string, expected: string): boolean {
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test -- src/server/auth`
Expected: PASS, 9 tests

- [ ] **Step 5: Implement guard cho server actions**

Tạo `src/server/auth/guard.ts`:

```ts
import { cookies } from "next/headers";
import { env } from "@/infra/config/env";
import { SESSION_COOKIE, verifySession } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("Cần PIN để ghi dữ liệu.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Gọi ở ĐẦU mọi server action có ghi dữ liệu.
 * Đọc dữ liệu là công khai — guard này chỉ chặn ghi.
 */
export async function requireWriteAccess(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || !verifySession(token, env.SESSION_SECRET, Date.now())) {
    throw new UnauthorizedError();
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server/auth
git commit -m "feat(auth): add HMAC session tokens, timing-safe PIN check, write guard"
```

---

## Task 9: Composition root

**Files:**
- Create: `src/server/container.ts`
- Create: `src/server/container.test.ts`

**Interfaces:**
- Consumes: `db`, `HunterRepo`, `IdempotencyRepo`, `systemClock`, `seededRng`, `env`
- Produces:
  - `type Container = { db: Db; clock: ClockPort; rng: RngPort; hunters: HunterRepo; idempotency: IdempotencyRepo; tzOffsetMinutes: number }`
  - `buildContainer(overrides?: Partial<Container>): Container` — factory thuần
  - `container: Container` — singleton production

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/container.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { seededRng } from "@/infra/rng/seeded-rng";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer } from "./container";

describe("buildContainer", () => {
  it("ráp đủ các phụ thuộc từ một db", async () => {
    const db = await makeTestDb();
    const c = buildContainer({ db });
    expect(c.hunters).toBeDefined();
    expect(c.idempotency).toBeDefined();
    expect(c.tzOffsetMinutes).toBe(420);
  });

  it("cho phép thay clock và rng để test", async () => {
    const db = await makeTestDb();
    const c = buildContainer({
      db,
      clock: fixedClock("2026-08-05T16:59:00Z"),
      rng: seededRng(42),
    });
    expect(c.clock.now()).toBe(Date.parse("2026-08-05T16:59:00Z"));
    expect(c.rng.next()).toBe(seededRng(42).next());
  });

  it("repo dùng đúng db được truyền vào", async () => {
    const db = await makeTestDb();
    const c = buildContainer({ db });
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    expect((await c.hunters.get())?.name).toBe("Jin-Woo");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `pnpm test -- src/server/container.test.ts`
Expected: FAIL — không resolve được `./container`

- [ ] **Step 3: Implement container**

Tạo `src/server/container.ts`:

```ts
import type { ClockPort } from "@/ports/clock.port";
import type { RngPort } from "@/ports/rng.port";
import { systemClock } from "@/infra/clock/system-clock";
import { seededRng } from "@/infra/rng/seeded-rng";
import { db as prodDb, type Db } from "@/infra/db/client";
import { HunterRepo } from "@/infra/db/repositories/hunter.repo";
import { IdempotencyRepo } from "@/infra/db/repositories/idempotency.repo";
import { env } from "@/infra/config/env";

export type Container = {
  db: Db;
  clock: ClockPort;
  rng: RngPort;
  hunters: HunterRepo;
  idempotency: IdempotencyRepo;
  tzOffsetMinutes: number;
};

type ContainerSeed = {
  db?: Db;
  clock?: ClockPort;
  rng?: RngPort;
  tzOffsetMinutes?: number;
};

/**
 * Nơi DUY NHẤT ráp phụ thuộc. Không dùng DI framework —
 * app một người dùng không cần thứ đó.
 */
export function buildContainer(seed: ContainerSeed = {}): Container {
  const db = seed.db ?? prodDb;
  return {
    db,
    clock: seed.clock ?? systemClock,
    rng: seed.rng ?? seededRng(Date.now() >>> 0),
    hunters: new HunterRepo(db),
    idempotency: new IdempotencyRepo(db),
    tzOffsetMinutes: seed.tzOffsetMinutes ?? env.HUNTER_TZ_OFFSET_MINUTES,
  };
}

export const container: Container = buildContainer();
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test -- src/server/container.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/server/container.ts src/server/container.test.ts
git commit -m "feat(server): add composition root"
```

---

## Task 10: Ép ranh giới kiến trúc bằng ESLint + CI

Kiến trúc không được máy kiểm tra sẽ mục trong vài tháng. Task này biến các luật ở phần Global Constraints thành lỗi CI.

**Files:**
- Create: `.eslintrc.json`
- Create: `.github/workflows/ci.yml`
- Create: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `eslint-plugin-import` (đã cài ở Task 1)
- Produces: `pnpm lint` fail khi `core/` bị nhiễm bẩn

- [ ] **Step 1: Tạo `.eslintrc.json`**

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["import"],
  "rules": {
    "import/no-restricted-paths": [
      "error",
      {
        "zones": [
          {
            "target": "./src/core",
            "from": "./src/infra",
            "message": "core/ không được biết infra/ tồn tại. Dùng ports/."
          },
          {
            "target": "./src/core",
            "from": "./src/server",
            "message": "core/ không được import server/."
          },
          {
            "target": "./src/core",
            "from": "./src/app-services",
            "message": "Phụ thuộc chảy vào core/, không chảy ra."
          },
          {
            "target": "./src/core",
            "from": "./src/ui",
            "message": "core/ là domain thuần, không biết gì về UI."
          },
          {
            "target": "./src/core",
            "from": "./src/app",
            "message": "core/ không được import route Next."
          },
          {
            "target": "./src/ports",
            "from": "./src/infra",
            "message": "ports/ chỉ chứa interface. infra/ implement chúng, không ngược lại."
          }
        ]
      }
    ]
  },
  "overrides": [
    {
      "files": ["src/core/**/*.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              "next/*",
              "react",
              "react-dom",
              "drizzle-orm",
              "drizzle-orm/*",
              "@libsql/*"
            ]
          }
        ],
        "no-restricted-syntax": [
          "error",
          {
            "selector": "CallExpression[callee.object.name='Date'][callee.property.name='now']",
            "message": "core/ không được đọc thời gian môi trường. Dùng ClockPort."
          },
          {
            "selector": "CallExpression[callee.object.name='Math'][callee.property.name='random']",
            "message": "core/ không được sinh số ngẫu nhiên. Dùng RngPort."
          },
          {
            "selector": "MemberExpression[object.object.name='process'][object.property.name='env']",
            "message": "core/ không được đọc process.env. Nhận cấu hình qua tham số."
          }
        ]
      }
    }
  ],
  "ignorePatterns": ["src/infra/db/migrations/**", ".next/**"]
}
```

- [ ] **Step 2: Xác nhận lint phát hiện vi phạm**

Tạo file vi phạm tạm `src/core/violation.ts`:

```ts
export const bad = Date.now();
```

Run: `pnpm lint`
Expected: FAIL với thông báo "core/ không được đọc thời gian môi trường. Dùng ClockPort."

- [ ] **Step 3: Xác nhận lint phát hiện import xuyên tầng**

Thay nội dung `src/core/violation.ts` bằng:

```ts
import { db } from "@/infra/db/client";
export const bad = db;
```

Run: `pnpm lint`
Expected: FAIL với thông báo về `drizzle-orm` hoặc `import/no-restricted-paths`

- [ ] **Step 4: Xoá file vi phạm và xác nhận lint sạch**

```bash
rm src/core/violation.ts
pnpm lint
```

Expected: không có lỗi

- [ ] **Step 5: Tạo E2E smoke test**

Tạo `e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("trang chủ tải được", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});
```

- [ ] **Step 6: Chạy E2E để xác nhận hạ tầng hoạt động**

Run: `pnpm test:e2e`
Expected: PASS, 1 test

- [ ] **Step 7: Tạo CI workflow**

Tạo `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      TURSO_DATABASE_URL: "file:./ci.db"
      HUNTER_PIN: "0000"
      SESSION_SECRET: "ci-secret-ci-secret-ci-secret-ok"
      HUNTER_TZ_OFFSET_MINUTES: "420"
    steps:
      - uses: actions/checkout@v4
      # pnpm phải được cài TRƯỚC setup-node, vì cache: pnpm cần lệnh pnpm tồn tại.
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm typecheck
```

- [ ] **Step 8: Chạy toàn bộ kiểm tra**

```bash
pnpm lint && pnpm test && pnpm typecheck
```

Expected: cả ba lệnh pass. Tổng 34 unit test.

- [ ] **Step 9: Commit**

```bash
git add .eslintrc.json .github e2e
git commit -m "chore: enforce architecture boundaries in eslint, add CI workflow"
```

---

## Definition of Done — Phase 0

- [ ] `pnpm lint` sạch, và **fail** khi cố tình đưa `Date.now()` vào `src/core/`
- [ ] `pnpm test` pass toàn bộ 34 unit test
- [ ] `pnpm typecheck` sạch
- [ ] `pnpm test:e2e` pass smoke test
- [ ] `pnpm db:migrate` tạo được bảng `hunter` và `processed_action`
- [ ] `toTrainingDay` xử lý đúng ranh giới 23:59 / 00:00 giờ ICT — có test regression cho bug 19:00
- [ ] `.env` đã điền, `.env.example` đã commit, `.env` bị `.gitignore` chặn
- [ ] Đã commit đủ 10 lần, mỗi task một commit

**Chưa có ở Phase 0 (đúng như thiết kế):** chưa có UI mới, chưa log được buổi tập, chưa có quest. `src/app/**` và `src/store/useAppStore.ts` vẫn nguyên trạng mock — Phase 1 mới thay.
