# Phase 1A — Training Domain (core logic thuần)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây toàn bộ luật chơi của engine tập luyện dưới dạng hàm thuần trong `src/core/` — e1RM, volume load, progressive overload, EXP/level/rank, 6 stat, fatigue — với test dày, không chạm database.

**Architecture:** Mọi thứ trong plan này nằm trong `src/core/`, tuân luật Phase 0: không I/O, không framework, không `Date.now()`, không `Math.random()`. Vào số, ra số. Đây là nơi duy nhất chứa luật chơi, và là nơi duy nhất thực sự cần test kỹ.

**Tech Stack:** TypeScript 5 (strict) · Vitest

## Global Constraints

- **Phụ thuộc Phase 0 đã hoàn tất.** Cần có: `Result`/`ok`/`err` từ `@/core/shared/result`, branded types `Kg`/`Reps`/`Exp`/`Gold`/`Epoch` từ `@/core/shared/units`, `DomainEvent` từ `@/core/shared/events`, `TrainingDay`/`toTrainingDay`/`daysBetween` từ `@/core/quest/training-day`.
- **`src/core/**` KHÔNG được import** `next/*`, `react`, `drizzle-orm`, `@libsql/*`, hay bất cứ thứ gì trong `src/infra`, `src/server`, `src/ui`, `src/app`, `src/app-services`. ESLint sẽ fail.
- **`src/core/**` KHÔNG được gọi** `Date.now()`, `Math.random()`, `process.env`. Cho phép `new Date(epochTườngMinh)` và `Date.UTC(...)`.
- **Mọi hằng số cân bằng phải nằm trong một `const` được export ở đầu file**, không rải rác trong thân hàm. Spec §8.10 và §9.8 nói rõ các hằng này sẽ phải tinh chỉnh sau khi có dữ liệu thật.
- **Phân loại số theo spec §1.3:** 6 stat, e1RM, volume, PR là số **Đo lường** — hàm tính chúng chỉ nhận log tập làm đầu vào, không nhận buff/item/modifier.
- **Đơn vị:** khối lượng là kg, quãng đường là km, thời gian chạy là giây, thời điểm là UTC epoch milliseconds.
- **Commit sau mỗi task**, message theo Conventional Commits.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/core/training/types.ts` | Kiểu dữ liệu dùng chung cho toàn bộ domain tập luyện |
| `src/core/training/pr.ts` | e1RM (Epley) và phát hiện PR |
| `src/core/training/volume.ts` | Volume load, tổng hợp theo nhóm cơ |
| `src/core/training/overload.ts` | Double progression — đề xuất tạ buổi sau |
| `src/core/hunter/progression.ts` | EXP → level → rank |
| `src/core/hunter/stats.ts` | Suy ra 6 stat từ log |
| `src/core/hunter/fatigue.ts` | Tích luỹ và tiêu tan fatigue |
| `src/core/training/dungeon-rank.ts` | Rank của buổi tập từ volume tương đối |

Tất cả đều có file `*.test.ts` đi kèm.

---

## Task 1: Kiểu dữ liệu dùng chung

**Files:**
- Create: `src/core/training/types.ts`

**Interfaces:**
- Consumes: `Kg`, `Reps`, `Epoch` từ `@/core/shared/units`; `TrainingDay` từ `@/core/quest/training-day`
- Produces:
  - `type MuscleGroup = "chest" | "back" | "quads" | "posterior" | "shoulders" | "arms" | "core" | "cardio"`
  - `type ExerciseKind = "compound" | "isolation"`
  - `type RepRange = { min: Reps; max: Reps }`
  - `interface ExerciseDef { id: string; name: string; muscle: MuscleGroup; kind: ExerciseKind; isMainLift: boolean; incrementKg: Kg }`
  - `interface LoggedSet { exerciseId: string; setIndex: number; reps: Reps; weight: Kg; completed: boolean }`
  - `interface SessionRecord { id: string; day: TrainingDay; programDayId: string; startedAt: Epoch; endedAt: Epoch | null; sets: LoggedSet[] }`
  - `interface RunRecord { day: TrainingDay; distanceKm: number; durationSec: number }`

- [ ] **Step 1: Tạo file kiểu dữ liệu**

Tạo `src/core/training/types.ts`:

```ts
import type { Kg, Reps, Epoch } from "@/core/shared/units";
import type { TrainingDay } from "@/core/quest/training-day";

/**
 * Tám nhóm cơ, ánh xạ 1-1 với tám shadow (spec §7.1).
 * "posterior" = chuỗi sau (glutes/hamstrings) — nhóm của Beru.
 */
export type MuscleGroup =
  | "chest"
  | "back"
  | "quads"
  | "posterior"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio";

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "chest",
  "back",
  "quads",
  "posterior",
  "shoulders",
  "arms",
  "core",
  "cardio",
] as const;

export type ExerciseKind = "compound" | "isolation";

export type RepRange = { readonly min: Reps; readonly max: Reps };

export interface ExerciseDef {
  readonly id: string;
  readonly name: string;
  readonly muscle: MuscleGroup;
  readonly kind: ExerciseKind;
  /** 5 bài chính nuôi stat STR: bench, squat, deadlift, OHP, row. */
  readonly isMainLift: boolean;
  /** Bước tăng tạ khi đạt cận trên (spec §5.3). */
  readonly incrementKg: Kg;
}

export interface LoggedSet {
  readonly exerciseId: string;
  readonly setIndex: number;
  readonly reps: Reps;
  readonly weight: Kg;
  readonly completed: boolean;
}

export interface SessionRecord {
  readonly id: string;
  readonly day: TrainingDay;
  readonly programDayId: string;
  readonly startedAt: Epoch;
  readonly endedAt: Epoch | null;
  readonly sets: readonly LoggedSet[];
}

export interface RunRecord {
  readonly day: TrainingDay;
  readonly distanceKm: number;
  readonly durationSec: number;
}
```

- [ ] **Step 2: Xác nhận biên dịch được**

Run: `npx tsc --noEmit`
Expected: không có lỗi

- [ ] **Step 3: Commit**

```bash
git add src/core/training/types.ts
git commit -m "feat(core): add training domain types"
```

---

## Task 2: e1RM và phát hiện PR

**Files:**
- Create: `src/core/training/pr.ts`
- Create: `src/core/training/pr.test.ts`

**Interfaces:**
- Consumes: `Kg`, `Reps`, `kg` từ `@/core/shared/units`; `LoggedSet` từ `./types`
- Produces:
  - `estimateOneRepMax(weight: Kg, repsDone: Reps): Kg`
  - `bestE1rmForExercise(sets: readonly LoggedSet[], exerciseId: string): Kg`
  - `detectPrs(newSets: readonly LoggedSet[], previousBest: ReadonlyMap<string, Kg>): PrResult[]`
  - `type PrResult = { exerciseId: string; newE1rm: Kg; previousE1rm: Kg }`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/training/pr.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import { estimateOneRepMax, bestE1rmForExercise, detectPrs } from "./pr";
import type { LoggedSet } from "./types";

function set(
  exerciseId: string,
  setIndex: number,
  r: number,
  w: number,
  completed = true,
): LoggedSet {
  return { exerciseId, setIndex, reps: reps(r), weight: kg(w), completed };
}

describe("estimateOneRepMax", () => {
  it("1 rep trả về đúng mức tạ đó", () => {
    expect(estimateOneRepMax(kg(100), reps(1))).toBe(100);
  });

  it("áp dụng công thức Epley cho nhiều rep", () => {
    // 100 * (1 + 6/30) = 120
    expect(estimateOneRepMax(kg(100), reps(6))).toBe(120);
  });

  it("làm tròn đến 0.1 kg", () => {
    // 82.5 * (1 + 7/30) = 101.75 -> 101.8
    expect(estimateOneRepMax(kg(82.5), reps(7))).toBe(101.8);
  });

  it("0 rep trả về 0", () => {
    expect(estimateOneRepMax(kg(100), reps(0))).toBe(0);
  });

  it("tạ 0 kg trả về 0 (bài tay không)", () => {
    expect(estimateOneRepMax(kg(0), reps(20))).toBe(0);
  });
});

describe("bestE1rmForExercise", () => {
  it("lấy e1RM cao nhất trong các set của bài đó", () => {
    const sets = [
      set("bench", 0, 8, 70), // 70 * 1.2667 = 88.7
      set("bench", 1, 6, 80), // 80 * 1.2 = 96
      set("bench", 2, 5, 80), // 80 * 1.1667 = 93.3
    ];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("bỏ qua set chưa hoàn thành", () => {
    const sets = [set("bench", 0, 6, 80), set("bench", 1, 10, 100, false)];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("bỏ qua set của bài khác", () => {
    const sets = [set("bench", 0, 6, 80), set("squat", 1, 6, 120)];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("trả 0 khi không có set nào của bài đó", () => {
    expect(bestE1rmForExercise([set("squat", 0, 6, 120)], "bench")).toBe(0);
  });
});

describe("detectPrs", () => {
  it("báo PR khi vượt kỷ lục cũ", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80)],
      new Map([["bench", kg(90)]]),
    );
    expect(prs).toEqual([
      { exerciseId: "bench", newE1rm: 96, previousE1rm: 90 },
    ]);
  });

  it("KHÔNG báo PR khi bằng kỷ lục cũ", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80)],
      new Map([["bench", kg(96)]]),
    );
    expect(prs).toEqual([]);
  });

  it("KHÔNG báo PR khi thấp hơn kỷ lục cũ", () => {
    const prs = detectPrs(
      [set("bench", 0, 5, 70)],
      new Map([["bench", kg(96)]]),
    );
    expect(prs).toEqual([]);
  });

  it("bài chưa từng tập thì lần đầu là PR", () => {
    const prs = detectPrs([set("squat", 0, 6, 100)], new Map());
    expect(prs).toEqual([
      { exerciseId: "squat", newE1rm: 120, previousE1rm: 0 },
    ]);
  });

  it("báo được nhiều PR trong cùng một buổi", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80), set("row", 0, 6, 70)],
      new Map([["bench", kg(90)]]),
    );
    expect(prs).toHaveLength(2);
    expect(prs.map((p) => p.exerciseId).sort()).toEqual(["bench", "row"]);
  });

  it("bỏ qua bài tay không (tạ 0) — không tạo PR giả", () => {
    expect(detectPrs([set("pushup", 0, 30, 0)], new Map())).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/training/pr.test.ts`
Expected: FAIL — không resolve được `./pr`

- [ ] **Step 3: Implement**

Tạo `src/core/training/pr.ts`:

```ts
import { kg, type Kg, type Reps } from "@/core/shared/units";
import type { LoggedSet } from "./types";

/** Hệ số Epley. 1RM = w * (1 + reps/30). */
const EPLEY_DIVISOR = 30;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Ước lượng 1RM theo công thức Epley (spec §5.4).
 * 1 rep là trường hợp đặc biệt: chính mức tạ đó, không nhân hệ số.
 */
export function estimateOneRepMax(weight: Kg, repsDone: Reps): Kg {
  if (weight <= 0 || repsDone <= 0) return kg(0);
  if (repsDone === 1) return kg(round1(weight));
  return kg(round1(weight * (1 + repsDone / EPLEY_DIVISOR)));
}

/** e1RM tốt nhất trong các set ĐÃ HOÀN THÀNH của một bài. */
export function bestE1rmForExercise(
  sets: readonly LoggedSet[],
  exerciseId: string,
): Kg {
  let best = 0;
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || !s.completed) continue;
    const e1rm = estimateOneRepMax(s.weight, s.reps);
    if (e1rm > best) best = e1rm;
  }
  return kg(best);
}

export type PrResult = {
  readonly exerciseId: string;
  readonly newE1rm: Kg;
  readonly previousE1rm: Kg;
};

/**
 * PR = e1RM mới VƯỢT kỷ lục cũ. Bằng nhau không tính.
 *
 * Bài tay không (tạ 0) không sinh PR — chúng thuộc Daily Quest,
 * không phải dungeon, và e1RM của chúng vô nghĩa.
 */
export function detectPrs(
  newSets: readonly LoggedSet[],
  previousBest: ReadonlyMap<string, Kg>,
): PrResult[] {
  const exerciseIds = new Set(
    newSets.filter((s) => s.completed && s.weight > 0).map((s) => s.exerciseId),
  );

  const results: PrResult[] = [];
  for (const exerciseId of exerciseIds) {
    const newE1rm = bestE1rmForExercise(newSets, exerciseId);
    const previousE1rm = previousBest.get(exerciseId) ?? kg(0);
    if (newE1rm > previousE1rm) {
      results.push({ exerciseId, newE1rm, previousE1rm });
    }
  }
  return results;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/training/pr.test.ts`
Expected: PASS, 16 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/training/pr.ts src/core/training/pr.test.ts
git commit -m "feat(core): add e1RM estimation and PR detection"
```

---

## Task 3: Volume load

**Files:**
- Create: `src/core/training/volume.ts`
- Create: `src/core/training/volume.test.ts`

**Interfaces:**
- Consumes: `LoggedSet`, `ExerciseDef`, `MuscleGroup`, `MUSCLE_GROUPS` từ `./types`
- Produces:
  - `sessionVolumeLoad(sets: readonly LoggedSet[]): number`
  - `volumeByMuscle(sets: readonly LoggedSet[], catalog: ReadonlyMap<string, ExerciseDef>): Record<MuscleGroup, number>`
  - `averageVolumeLoad(sessionVolumes: readonly number[]): number`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/training/volume.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import { sessionVolumeLoad, volumeByMuscle, averageVolumeLoad } from "./volume";
import type { LoggedSet, ExerciseDef } from "./types";

function set(
  exerciseId: string,
  r: number,
  w: number,
  completed = true,
): LoggedSet {
  return { exerciseId, setIndex: 0, reps: reps(r), weight: kg(w), completed };
}

const catalog = new Map<string, ExerciseDef>([
  [
    "bench",
    {
      id: "bench",
      name: "Bench Press",
      muscle: "chest",
      kind: "compound",
      isMainLift: true,
      incrementKg: kg(2.5),
    },
  ],
  [
    "squat",
    {
      id: "squat",
      name: "Back Squat",
      muscle: "quads",
      kind: "compound",
      isMainLift: true,
      incrementKg: kg(5),
    },
  ],
]);

describe("sessionVolumeLoad", () => {
  it("cộng reps × weight của các set hoàn thành", () => {
    // 6*80 + 6*80 = 960
    expect(sessionVolumeLoad([set("bench", 6, 80), set("bench", 6, 80)])).toBe(
      960,
    );
  });

  it("bỏ qua set chưa hoàn thành", () => {
    expect(
      sessionVolumeLoad([set("bench", 6, 80), set("bench", 6, 80, false)]),
    ).toBe(480);
  });

  it("trả 0 khi không có set nào", () => {
    expect(sessionVolumeLoad([])).toBe(0);
  });

  it("set tay không (tạ 0) đóng góp 0", () => {
    expect(sessionVolumeLoad([set("pushup", 30, 0)])).toBe(0);
  });
});

describe("volumeByMuscle", () => {
  it("gom volume theo nhóm cơ", () => {
    const result = volumeByMuscle(
      [set("bench", 6, 80), set("squat", 6, 100)],
      catalog,
    );
    expect(result.chest).toBe(480);
    expect(result.quads).toBe(600);
  });

  it("khởi tạo mọi nhóm cơ về 0", () => {
    const result = volumeByMuscle([], catalog);
    expect(result.chest).toBe(0);
    expect(result.back).toBe(0);
    expect(result.cardio).toBe(0);
    expect(Object.keys(result)).toHaveLength(8);
  });

  it("bỏ qua bài không có trong catalog", () => {
    const result = volumeByMuscle([set("khong-ton-tai", 6, 80)], catalog);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });

  it("cộng dồn nhiều bài cùng nhóm cơ", () => {
    const extended = new Map(catalog);
    extended.set("fly", {
      id: "fly",
      name: "Cable Fly",
      muscle: "chest",
      kind: "isolation",
      isMainLift: false,
      incrementKg: kg(2.5),
    });
    const result = volumeByMuscle(
      [set("bench", 6, 80), set("fly", 15, 15)],
      extended,
    );
    expect(result.chest).toBe(480 + 225);
  });
});

describe("averageVolumeLoad", () => {
  it("tính trung bình cộng", () => {
    expect(averageVolumeLoad([1000, 2000, 3000])).toBe(2000);
  });

  it("trả 0 cho mảng rỗng", () => {
    expect(averageVolumeLoad([])).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/training/volume.test.ts`
Expected: FAIL — không resolve được `./volume`

- [ ] **Step 3: Implement**

Tạo `src/core/training/volume.ts`:

```ts
import type { LoggedSet, ExerciseDef, MuscleGroup } from "./types";
import { MUSCLE_GROUPS } from "./types";

/**
 * Volume load = Σ (reps × kg) của các set ĐÃ HOÀN THÀNH.
 * Đây là đơn vị đo công cơ học, và là nguồn nuôi
 * stat VIT, EXP của shadow, và rank của dungeon.
 */
export function sessionVolumeLoad(sets: readonly LoggedSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (!s.completed) continue;
    total += s.reps * s.weight;
  }
  return total;
}

/** Volume tách theo nhóm cơ. Mọi nhóm luôn có mặt, mặc định 0. */
export function volumeByMuscle(
  sets: readonly LoggedSet[],
  catalog: ReadonlyMap<string, ExerciseDef>,
): Record<MuscleGroup, number> {
  const result = Object.fromEntries(
    MUSCLE_GROUPS.map((m) => [m, 0]),
  ) as Record<MuscleGroup, number>;

  for (const s of sets) {
    if (!s.completed) continue;
    const def = catalog.get(s.exerciseId);
    if (!def) continue;
    result[def.muscle] += s.reps * s.weight;
  }
  return result;
}

export function averageVolumeLoad(sessionVolumes: readonly number[]): number {
  if (sessionVolumes.length === 0) return 0;
  return sessionVolumes.reduce((a, b) => a + b, 0) / sessionVolumes.length;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/training/volume.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/training/volume.ts src/core/training/volume.test.ts
git commit -m "feat(core): add volume load calculation"
```

---

## Task 4: Progressive overload — double progression

Đây là thuật toán quyết định "hôm nay đẩy bao nhiêu kg". Nó phải tường minh và test được — spec §5.3 nói rõ LLM không được đụng vào đây.

**Files:**
- Create: `src/core/training/overload.ts`
- Create: `src/core/training/overload.test.ts`

**Interfaces:**
- Consumes: `Kg`, `Reps`, `kg` từ `@/core/shared/units`; `RepRange`, `LoggedSet` từ `./types`
- Produces:
  - `type ExercisePerformance = { weight: Kg; repsPerSet: readonly Reps[] }`
  - `type OverloadDecision = { weight: Kg; targetReps: Reps; action: "increase" | "hold" | "deload" | "first-time" }`
  - `suggestNextLoad(history: readonly ExercisePerformance[], range: RepRange, incrementKg: Kg): OverloadDecision`
  - `toExercisePerformance(sets: readonly LoggedSet[], exerciseId: string): ExercisePerformance | null`
  - `DELOAD_FACTOR = 0.9`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/training/overload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import {
  suggestNextLoad,
  toExercisePerformance,
  type ExercisePerformance,
} from "./overload";
import type { RepRange, LoggedSet } from "./types";

const RANGE_6_8: RepRange = { min: reps(6), max: reps(8) };

function perf(weight: number, repsPerSet: number[]): ExercisePerformance {
  return { weight: kg(weight), repsPerSet: repsPerSet.map(reps) };
}

describe("suggestNextLoad", () => {
  it("chưa từng tập → dùng mức khởi điểm và cận dưới", () => {
    const d = suggestNextLoad([], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("first-time");
    expect(d.targetReps).toBe(6);
    expect(d.weight).toBe(0);
  });

  it("TẤT CẢ set đạt cận trên → tăng tạ, rep về cận dưới", () => {
    const d = suggestNextLoad([perf(80, [8, 8, 8, 8])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("increase");
    expect(d.weight).toBe(82.5);
    expect(d.targetReps).toBe(6);
  });

  it("vượt cận trên vẫn tính là đạt", () => {
    const d = suggestNextLoad([perf(80, [9, 8, 8, 8])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("increase");
    expect(d.weight).toBe(82.5);
  });

  it("một set chưa tới cận trên → giữ tạ, thêm 1 rep", () => {
    const d = suggestNextLoad([perf(80, [8, 8, 8, 7])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
    expect(d.targetReps).toBe(8);
  });

  it("đạt cận dưới nhưng chưa cận trên → giữ tạ", () => {
    const d = suggestNextLoad([perf(80, [6, 6, 6, 6])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
    expect(d.targetReps).toBe(7);
  });

  it("MỘT buổi tụt dưới cận dưới → vẫn giữ, chưa deload", () => {
    const d = suggestNextLoad([perf(80, [6, 5, 5, 4])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
  });

  it("HAI buổi liên tiếp tụt dưới cận dưới → deload 10%", () => {
    const d = suggestNextLoad(
      [perf(80, [5, 5, 4, 4]), perf(80, [6, 5, 5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("deload");
    expect(d.weight).toBe(72);
    expect(d.targetReps).toBe(6);
  });

  it("buổi gần nhất tụt nhưng buổi trước đó ổn → chưa deload", () => {
    const d = suggestNextLoad(
      [perf(80, [5, 5, 4, 4]), perf(80, [8, 8, 8, 8])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
  });

  it("deload làm tròn xuống bội của 0.5 kg", () => {
    // 77.5 * 0.9 = 69.75 -> 69.5
    const d = suggestNextLoad(
      [perf(77.5, [5, 4]), perf(77.5, [5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.weight).toBe(69.5);
  });

  it("bài chân dùng bước nhảy 5 kg", () => {
    const d = suggestNextLoad([perf(100, [8, 8, 8, 8])], RANGE_6_8, kg(5));
    expect(d.weight).toBe(105);
  });

  it("buổi không có set nào hoàn thành coi như chưa từng tập", () => {
    const d = suggestNextLoad([perf(80, [])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("first-time");
  });

  it("chỉ xét hai buổi gần nhất, buổi cũ hơn bị bỏ qua", () => {
    const d = suggestNextLoad(
      [perf(80, [8, 8, 8, 8]), perf(80, [5, 4]), perf(80, [5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("increase");
  });
});

describe("toExercisePerformance", () => {
  function set(
    exerciseId: string,
    r: number,
    w: number,
    completed = true,
  ): LoggedSet {
    return { exerciseId, setIndex: 0, reps: reps(r), weight: kg(w), completed };
  }

  it("gom set của một bài thành một ExercisePerformance", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 7, 80), set("squat", 6, 100)],
      "bench",
    );
    expect(p).toEqual({ weight: 80, repsPerSet: [8, 7] });
  });

  it("bỏ qua set chưa hoàn thành", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 7, 80, false)],
      "bench",
    );
    expect(p?.repsPerSet).toEqual([8]);
  });

  it("trả null khi không có set nào của bài đó", () => {
    expect(toExercisePerformance([set("squat", 6, 100)], "bench")).toBeNull();
  });

  it("lấy mức tạ nặng nhất khi các set khác tạ", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 6, 85)],
      "bench",
    );
    expect(p?.weight).toBe(85);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/training/overload.test.ts`
Expected: FAIL — không resolve được `./overload`

- [ ] **Step 3: Implement**

Tạo `src/core/training/overload.ts`:

```ts
import { kg, reps as makeReps, type Kg, type Reps } from "@/core/shared/units";
import type { RepRange, LoggedSet } from "./types";

/** Hằng số cân bằng — spec §5.3. Tinh chỉnh ở đây, không rải rác. */
export const DELOAD_FACTOR = 0.9;
export const DELOAD_AFTER_CONSECUTIVE_FAILURES = 2;
export const WEIGHT_ROUNDING_KG = 0.5;

export type ExercisePerformance = {
  readonly weight: Kg;
  readonly repsPerSet: readonly Reps[];
};

export type OverloadAction = "increase" | "hold" | "deload" | "first-time";

export type OverloadDecision = {
  readonly weight: Kg;
  readonly targetReps: Reps;
  readonly action: OverloadAction;
};

function roundDownTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function hasCompletedSets(p: ExercisePerformance | undefined): boolean {
  return !!p && p.repsPerSet.length > 0;
}

function allSetsReachedMax(p: ExercisePerformance, range: RepRange): boolean {
  return p.repsPerSet.every((r) => r >= range.max);
}

function anySetBelowMin(p: ExercisePerformance, range: RepRange): boolean {
  return p.repsPerSet.some((r) => r < range.min);
}

/**
 * Double progression (spec §5.3):
 *   • TẤT CẢ set đạt cận trên  → tăng tạ, rep về cận dưới
 *   • Chưa đạt hết cận trên    → giữ tạ, cố thêm 1 rep
 *   • 2 buổi LIÊN TIẾP tụt dưới cận dưới → deload 10%
 *
 * `history` sắp xếp MỚI NHẤT TRƯỚC. Chỉ hai phần tử đầu được xét.
 */
export function suggestNextLoad(
  history: readonly ExercisePerformance[],
  range: RepRange,
  incrementKg: Kg,
): OverloadDecision {
  const last = history[0];
  const previous = history[1];

  if (!hasCompletedSets(last)) {
    return { weight: kg(0), targetReps: range.min, action: "first-time" };
  }

  const lastFailed = anySetBelowMin(last, range);
  const previousFailed = hasCompletedSets(previous)
    ? anySetBelowMin(previous, range)
    : false;

  if (
    lastFailed &&
    previousFailed &&
    DELOAD_AFTER_CONSECUTIVE_FAILURES === 2
  ) {
    return {
      weight: kg(roundDownTo(last.weight * DELOAD_FACTOR, WEIGHT_ROUNDING_KG)),
      targetReps: range.min,
      action: "deload",
    };
  }

  if (allSetsReachedMax(last, range)) {
    return {
      weight: kg(last.weight + incrementKg),
      targetReps: range.min,
      action: "increase",
    };
  }

  const worstSet = Math.min(...last.repsPerSet);
  const nextTarget = Math.min(Math.max(worstSet + 1, range.min), range.max);
  return {
    weight: last.weight,
    targetReps: makeReps(nextTarget),
    action: "hold",
  };
}

/**
 * Gom các set đã hoàn thành của một bài thành ExercisePerformance.
 * Mức tạ lấy giá trị nặng nhất — nếu buổi đó có nhiều mức
 * thì mức nặng nhất là mức đang tiến bộ.
 */
export function toExercisePerformance(
  sets: readonly LoggedSet[],
  exerciseId: string,
): ExercisePerformance | null {
  const relevant = sets.filter(
    (s) => s.exerciseId === exerciseId && s.completed,
  );
  if (relevant.length === 0) return null;

  return {
    weight: kg(Math.max(...relevant.map((s) => s.weight))),
    repsPerSet: relevant.map((s) => s.reps),
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/training/overload.test.ts`
Expected: PASS, 16 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/training/overload.ts src/core/training/overload.test.ts
git commit -m "feat(core): add double-progression overload algorithm"
```

---

## Task 5: EXP, level, rank

**Files:**
- Create: `src/core/hunter/progression.ts`
- Create: `src/core/hunter/progression.test.ts`

**Interfaces:**
- Consumes: `Exp`, `exp` từ `@/core/shared/units`
- Produces:
  - `type Rank = "E" | "D" | "C" | "B" | "A" | "S" | "National" | "Monarch"`
  - `expToNextLevel(level: number): Exp`
  - `applyExp(currentLevel: number, currentExp: Exp, gained: Exp): { level: number; exp: Exp; levelsGained: number }`
  - `rankForLevel(level: number): Rank`
  - `RANK_THRESHOLDS: readonly { rank: Rank; minLevel: number }[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/hunter/progression.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { exp } from "@/core/shared/units";
import { expToNextLevel, applyExp, rankForLevel } from "./progression";

describe("expToNextLevel", () => {
  it("level 1 cần 100 EXP", () => {
    expect(expToNextLevel(1)).toBe(100);
  });

  it("tăng đơn điệu theo level", () => {
    for (let l = 1; l < 100; l++) {
      expect(expToNextLevel(l + 1)).toBeGreaterThan(expToNextLevel(l));
    }
  });

  it("luôn trả số nguyên dương", () => {
    for (const l of [1, 10, 28, 40, 99]) {
      const v = expToNextLevel(l);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("level 0 hoặc âm coi như level 1", () => {
    expect(expToNextLevel(0)).toBe(100);
    expect(expToNextLevel(-5)).toBe(100);
  });
});

describe("applyExp", () => {
  it("cộng EXP mà chưa đủ lên level", () => {
    const r = applyExp(1, exp(0), exp(50));
    expect(r).toEqual({ level: 1, exp: 50, levelsGained: 0 });
  });

  it("lên đúng một level khi vừa đủ", () => {
    const r = applyExp(1, exp(0), exp(100));
    expect(r.level).toBe(2);
    expect(r.exp).toBe(0);
    expect(r.levelsGained).toBe(1);
  });

  it("giữ phần EXP dư sau khi lên level", () => {
    const r = applyExp(1, exp(0), exp(130));
    expect(r.level).toBe(2);
    expect(r.exp).toBe(30);
  });

  it("lên nhiều level trong một lần nếu EXP lớn", () => {
    const r = applyExp(1, exp(0), exp(100000));
    expect(r.levelsGained).toBeGreaterThan(5);
    expect(r.exp).toBeLessThan(expToNextLevel(r.level));
  });

  it("cộng 0 EXP không đổi gì", () => {
    const r = applyExp(5, exp(42), exp(0));
    expect(r).toEqual({ level: 5, exp: 42, levelsGained: 0 });
  });

  it("EXP âm không làm tụt level, sàn ở 0", () => {
    const r = applyExp(5, exp(42), exp(-100));
    expect(r.level).toBe(5);
    expect(r.exp).toBe(0);
    expect(r.levelsGained).toBe(0);
  });

  it("EXP âm trừ trong cùng level thì giữ phần còn lại", () => {
    const r = applyExp(5, exp(200), exp(-50));
    expect(r.level).toBe(5);
    expect(r.exp).toBe(150);
  });
});

describe("rankForLevel", () => {
  it("ánh xạ level sang rank theo ngưỡng", () => {
    expect(rankForLevel(1)).toBe("E");
    expect(rankForLevel(9)).toBe("E");
    expect(rankForLevel(10)).toBe("D");
    expect(rankForLevel(20)).toBe("C");
    expect(rankForLevel(35)).toBe("B");
    expect(rankForLevel(50)).toBe("A");
    expect(rankForLevel(70)).toBe("S");
    expect(rankForLevel(90)).toBe("National");
    expect(rankForLevel(100)).toBe("Monarch");
  });

  it("level dưới 1 vẫn là E", () => {
    expect(rankForLevel(0)).toBe("E");
  });

  it("level rất cao vẫn là Monarch", () => {
    expect(rankForLevel(999)).toBe("Monarch");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/hunter/progression.test.ts`
Expected: FAIL — không resolve được `./progression`

- [ ] **Step 3: Implement**

Tạo `src/core/hunter/progression.ts`:

```ts
import { exp as makeExp, type Exp } from "@/core/shared/units";

export type Rank =
  | "E"
  | "D"
  | "C"
  | "B"
  | "A"
  | "S"
  | "National"
  | "Monarch";

/**
 * Hằng số cân bằng — spec §11.4 nói ngưỡng E→D được tinh chỉnh
 * sao cho người tập đều thường chạm tới quanh ngày 12–16.
 * Sửa ở đây khi có dữ liệu thật.
 */
export const EXP_BASE = 100;
export const EXP_EXPONENT = 1.35;

export const RANK_THRESHOLDS: readonly { rank: Rank; minLevel: number }[] = [
  { rank: "Monarch", minLevel: 100 },
  { rank: "National", minLevel: 90 },
  { rank: "S", minLevel: 70 },
  { rank: "A", minLevel: 50 },
  { rank: "B", minLevel: 35 },
  { rank: "C", minLevel: 20 },
  { rank: "D", minLevel: 10 },
  { rank: "E", minLevel: 0 },
] as const;

/** EXP cần để đi từ `level` lên `level + 1`. */
export function expToNextLevel(level: number): Exp {
  const l = Math.max(1, Math.floor(level));
  return makeExp(Math.round(EXP_BASE * Math.pow(l, EXP_EXPONENT)));
}

/**
 * Cộng EXP và giải quyết mọi lần lên level.
 * EXP âm (hình phạt Penalty Zone) trừ vào EXP hiện tại
 * nhưng KHÔNG BAO GIỜ làm tụt level — spec §6.3.
 */
export function applyExp(
  currentLevel: number,
  currentExp: Exp,
  gained: Exp,
): { level: number; exp: Exp; levelsGained: number } {
  let level = Math.max(1, Math.floor(currentLevel));
  let pool = currentExp + gained;

  if (pool < 0) {
    return { level, exp: makeExp(0), levelsGained: 0 };
  }

  let levelsGained = 0;
  let needed = expToNextLevel(level);
  while (pool >= needed) {
    pool -= needed;
    level += 1;
    levelsGained += 1;
    needed = expToNextLevel(level);
  }

  return { level, exp: makeExp(pool), levelsGained };
}

export function rankForLevel(level: number): Rank {
  for (const t of RANK_THRESHOLDS) {
    if (level >= t.minLevel) return t.rank;
  }
  return "E";
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/hunter/progression.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/hunter/progression.ts src/core/hunter/progression.test.ts
git commit -m "feat(core): add EXP curve, level-up, and rank thresholds"
```

---

## Task 6: Suy ra 6 stat từ log

Spec §1.3 và §5.4: đây là số **Đo lường**. Hàm này chỉ nhận log tập, không nhận buff, item, hay modifier nào.

**Files:**
- Create: `src/core/hunter/stats.ts`
- Create: `src/core/hunter/stats.test.ts`

**Interfaces:**
- Consumes: `Kg` từ `@/core/shared/units`
- Produces:
  - `interface Stats { strength: number; agility: number; vitality: number; intelligence: number; perception: number; luck: number }`
  - `interface StatInput { mainLiftE1rms: ReadonlyMap<string, Kg>; km28d: number; avgPaceSecPerKm: number | null; volume28d: number; sessionsCompleted28d: number; sessionsScheduled28d: number; setsCompleted28d: number; setsPlanned28d: number; sideQuestsCompleted28d: number; sideQuestsIssued28d: number; streakDays: number; hiddenQuestsFound: number }`
  - `deriveStats(input: StatInput): Stats`
  - `emptyStatInput(): StatInput`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/hunter/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kg } from "@/core/shared/units";
import { deriveStats, emptyStatInput, type StatInput } from "./stats";

function input(patch: Partial<StatInput> = {}): StatInput {
  return { ...emptyStatInput(), ...patch };
}

describe("deriveStats — STR", () => {
  it("bằng 0 khi chưa tập gì", () => {
    expect(deriveStats(emptyStatInput()).strength).toBe(0);
  });

  it("tính từ tổng e1RM của các bài chính", () => {
    const s = deriveStats(
      input({
        mainLiftE1rms: new Map([
          ["bench", kg(96)],
          ["squat", kg(120)],
          ["deadlift", kg(144)],
          ["ohp", kg(60)],
          ["row", kg(84)],
        ]),
      }),
    );
    // (96+120+144+60+84) / 10 = 50.4 -> 50
    expect(s.strength).toBe(50);
  });

  it("tăng khi e1RM tăng", () => {
    const before = deriveStats(
      input({ mainLiftE1rms: new Map([["bench", kg(90)]]) }),
    ).strength;
    const after = deriveStats(
      input({ mainLiftE1rms: new Map([["bench", kg(120)]]) }),
    ).strength;
    expect(after).toBeGreaterThan(before);
  });
});

describe("deriveStats — AGI", () => {
  it("bằng 0 khi không chạy", () => {
    expect(deriveStats(emptyStatInput()).agility).toBe(0);
  });

  it("tăng theo quãng đường", () => {
    const s = deriveStats(input({ km28d: 40, avgPaceSecPerKm: null }));
    expect(s.agility).toBe(60); // 40 * 1.5
  });

  it("thưởng thêm khi pace nhanh hơn 7:00/km", () => {
    const slow = deriveStats(input({ km28d: 40, avgPaceSecPerKm: 420 }));
    const fast = deriveStats(input({ km28d: 40, avgPaceSecPerKm: 300 }));
    expect(slow.agility).toBe(60);
    expect(fast.agility).toBe(80); // 60 + (420-300)/6
  });

  it("pace chậm hơn 7:00/km không bị phạt xuống dưới 0", () => {
    const s = deriveStats(input({ km28d: 10, avgPaceSecPerKm: 600 }));
    expect(s.agility).toBe(15);
  });

  it("thưởng pace bị chặn trần ở 30", () => {
    const s = deriveStats(input({ km28d: 0, avgPaceSecPerKm: 100 }));
    expect(s.agility).toBe(30);
  });
});

describe("deriveStats — VIT", () => {
  it("kết hợp volume và số buổi", () => {
    const s = deriveStats(
      input({ volume28d: 40000, sessionsCompleted28d: 16 }),
    );
    // 40000/2000 + 16*1.5 = 20 + 24 = 44
    expect(s.vitality).toBe(44);
  });

  it("bằng 0 khi chưa tập", () => {
    expect(deriveStats(emptyStatInput()).vitality).toBe(0);
  });
});

describe("deriveStats — PER", () => {
  it("là phần trăm set hoàn thành so với kế hoạch", () => {
    const s = deriveStats(input({ setsCompleted28d: 180, setsPlanned28d: 200 }));
    expect(s.perception).toBe(90);
  });

  it("bằng 0 khi chưa có kế hoạch nào", () => {
    expect(deriveStats(emptyStatInput()).perception).toBe(0);
  });

  it("bị chặn trần ở 100 dù làm dư", () => {
    const s = deriveStats(input({ setsCompleted28d: 250, setsPlanned28d: 200 }));
    expect(s.perception).toBe(100);
  });
});

describe("deriveStats — INT", () => {
  it("kết hợp tuân thủ lịch và side quest", () => {
    const s = deriveStats(
      input({
        sessionsCompleted28d: 16,
        sessionsScheduled28d: 16,
        sideQuestsCompleted28d: 14,
        sideQuestsIssued28d: 28,
      }),
    );
    // 0.7*100 + 0.3*50 = 70 + 15 = 85
    expect(s.intelligence).toBe(85);
  });

  it("chưa có side quest thì chỉ tính tuân thủ lịch", () => {
    const s = deriveStats(
      input({ sessionsCompleted28d: 12, sessionsScheduled28d: 16 }),
    );
    // 0.7*75 = 52.5 -> 53
    expect(s.intelligence).toBe(53);
  });
});

describe("deriveStats — LUCK", () => {
  it("tăng theo streak và hidden quest", () => {
    const s = deriveStats(input({ streakDays: 30, hiddenQuestsFound: 4 }));
    // 30*0.8 + 4*5 = 24 + 20 = 44
    expect(s.luck).toBe(44);
  });

  it("bằng 0 khi chưa có streak", () => {
    expect(deriveStats(emptyStatInput()).luck).toBe(0);
  });

  it("bị chặn trần ở 100", () => {
    const s = deriveStats(input({ streakDays: 365, hiddenQuestsFound: 50 }));
    expect(s.luck).toBe(100);
  });
});

describe("deriveStats — tính chất chung", () => {
  it("mọi stat đều là số nguyên không âm", () => {
    const s = deriveStats(
      input({
        mainLiftE1rms: new Map([["bench", kg(96)]]),
        km28d: 33.3,
        avgPaceSecPerKm: 355,
        volume28d: 41234,
        sessionsCompleted28d: 13,
        sessionsScheduled28d: 16,
        setsCompleted28d: 177,
        setsPlanned28d: 200,
        streakDays: 7,
        hiddenQuestsFound: 1,
      }),
    );
    for (const v of Object.values(s)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("REGRESSION: ngừng tập làm stat tụt (detraining)", () => {
    const active = deriveStats(
      input({ volume28d: 40000, sessionsCompleted28d: 16 }),
    );
    const stopped = deriveStats(
      input({ volume28d: 0, sessionsCompleted28d: 0 }),
    );
    expect(stopped.vitality).toBeLessThan(active.vitality);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/hunter/stats.test.ts`
Expected: FAIL — không resolve được `./stats`

- [ ] **Step 3: Implement**

Tạo `src/core/hunter/stats.ts`:

```ts
import type { Kg } from "@/core/shared/units";

export interface Stats {
  readonly strength: number;
  readonly agility: number;
  readonly vitality: number;
  readonly intelligence: number;
  readonly perception: number;
  readonly luck: number;
}

/**
 * Đầu vào để suy ra stat. TOÀN BỘ đến từ log tập thật.
 * Không có trường nào cho buff, item, hay điểm cộng tay —
 * đó là chủ ý (spec §1.3: stat là số Đo lường).
 */
export interface StatInput {
  readonly mainLiftE1rms: ReadonlyMap<string, Kg>;
  readonly km28d: number;
  readonly avgPaceSecPerKm: number | null;
  readonly volume28d: number;
  readonly sessionsCompleted28d: number;
  readonly sessionsScheduled28d: number;
  readonly setsCompleted28d: number;
  readonly setsPlanned28d: number;
  readonly sideQuestsCompleted28d: number;
  readonly sideQuestsIssued28d: number;
  readonly streakDays: number;
  readonly hiddenQuestsFound: number;
}

/** Hằng số cân bằng. Tinh chỉnh ở đây sau khi có dữ liệu thật. */
export const STAT_TUNING = {
  strengthPerKgE1rm: 1 / 10,
  agilityPerKm: 1.5,
  paceBaselineSecPerKm: 420, // 7:00/km
  paceBonusDivisor: 6,
  paceBonusCap: 30,
  vitalityPerVolume: 1 / 2000,
  vitalityPerSession: 1.5,
  intelligenceScheduleWeight: 0.7,
  intelligenceSideQuestWeight: 0.3,
  luckPerStreakDay: 0.8,
  luckPerHiddenQuest: 5,
  luckCap: 100,
} as const;

export function emptyStatInput(): StatInput {
  return {
    mainLiftE1rms: new Map(),
    km28d: 0,
    avgPaceSecPerKm: null,
    volume28d: 0,
    sessionsCompleted28d: 0,
    sessionsScheduled28d: 0,
    setsCompleted28d: 0,
    setsPlanned28d: 0,
    sideQuestsCompleted28d: 0,
    sideQuestsIssued28d: 0,
    streakDays: 0,
    hiddenQuestsFound: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ratioPercent(done: number, planned: number): number {
  if (planned <= 0) return 0;
  return clamp((done / planned) * 100, 0, 100);
}

export function deriveStats(input: StatInput): Stats {
  const t = STAT_TUNING;

  let sumE1rm = 0;
  for (const v of input.mainLiftE1rms.values()) sumE1rm += v;
  const strength = sumE1rm * t.strengthPerKgE1rm;

  const paceBonus =
    input.avgPaceSecPerKm === null
      ? 0
      : clamp(
          (t.paceBaselineSecPerKm - input.avgPaceSecPerKm) / t.paceBonusDivisor,
          0,
          t.paceBonusCap,
        );
  const agility = input.km28d * t.agilityPerKm + paceBonus;

  const vitality =
    input.volume28d * t.vitalityPerVolume +
    input.sessionsCompleted28d * t.vitalityPerSession;

  const perception = ratioPercent(input.setsCompleted28d, input.setsPlanned28d);

  const intelligence =
    ratioPercent(input.sessionsCompleted28d, input.sessionsScheduled28d) *
      t.intelligenceScheduleWeight +
    ratioPercent(input.sideQuestsCompleted28d, input.sideQuestsIssued28d) *
      t.intelligenceSideQuestWeight;

  const luck = clamp(
    input.streakDays * t.luckPerStreakDay +
      input.hiddenQuestsFound * t.luckPerHiddenQuest,
    0,
    t.luckCap,
  );

  return {
    strength: Math.round(strength),
    agility: Math.round(agility),
    vitality: Math.round(vitality),
    intelligence: Math.round(intelligence),
    perception: Math.round(perception),
    luck: Math.round(luck),
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/hunter/stats.test.ts`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/hunter/stats.ts src/core/hunter/stats.test.ts
git commit -m "feat(core): derive six stats from training logs"
```

---

## Task 7: Fatigue

**Files:**
- Create: `src/core/hunter/fatigue.ts`
- Create: `src/core/hunter/fatigue.test.ts`

**Interfaces:**
- Consumes: (không có ngoài kiểu số)
- Produces:
  - `type FatigueLevel = "normal" | "warning" | "critical"`
  - `fatigueAfterSession(current: number, sessionVolume: number, avgVolume: number): number`
  - `decayFatigue(current: number, days: number, sleptWell: boolean): number`
  - `fatigueLevel(value: number): FatigueLevel`
  - `expMultiplierForFatigue(value: number): number`
  - `FATIGUE_TUNING`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/hunter/fatigue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  fatigueAfterSession,
  decayFatigue,
  fatigueLevel,
  expMultiplierForFatigue,
} from "./fatigue";

describe("fatigueAfterSession", () => {
  it("buổi bằng trung bình cộng đúng mức cơ sở", () => {
    expect(fatigueAfterSession(0, 10000, 10000)).toBe(20);
  });

  it("buổi nặng gấp rưỡi cộng nhiều hơn", () => {
    expect(fatigueAfterSession(0, 15000, 10000)).toBe(30);
  });

  it("buổi nhẹ cộng ít hơn", () => {
    expect(fatigueAfterSession(0, 5000, 10000)).toBe(10);
  });

  it("cộng dồn vào mức hiện có", () => {
    expect(fatigueAfterSession(30, 10000, 10000)).toBe(50);
  });

  it("bị chặn trần ở 100", () => {
    expect(fatigueAfterSession(95, 20000, 10000)).toBe(100);
  });

  it("chưa có lịch sử (trung bình 0) dùng mức cơ sở", () => {
    expect(fatigueAfterSession(0, 10000, 0)).toBe(20);
  });
});

describe("decayFatigue", () => {
  it("giảm 12 điểm mỗi ngày khi ngủ bình thường", () => {
    expect(decayFatigue(50, 1, false)).toBe(38);
  });

  it("giảm nhanh hơn khi ngủ đủ", () => {
    expect(decayFatigue(50, 1, true)).toBe(32);
  });

  it("cộng dồn theo nhiều ngày", () => {
    expect(decayFatigue(50, 3, false)).toBe(14);
  });

  it("sàn ở 0, không xuống âm", () => {
    expect(decayFatigue(10, 5, false)).toBe(0);
  });

  it("0 ngày thì không đổi", () => {
    expect(decayFatigue(50, 0, false)).toBe(50);
  });
});

describe("fatigueLevel", () => {
  it("dưới 70 là normal", () => {
    expect(fatigueLevel(0)).toBe("normal");
    expect(fatigueLevel(69)).toBe("normal");
  });

  it("từ 70 đến dưới 85 là warning", () => {
    expect(fatigueLevel(70)).toBe("warning");
    expect(fatigueLevel(84)).toBe("warning");
  });

  it("từ 85 trở lên là critical", () => {
    expect(fatigueLevel(85)).toBe("critical");
    expect(fatigueLevel(100)).toBe("critical");
  });
});

describe("expMultiplierForFatigue", () => {
  it("bình thường và cảnh báo không giảm EXP", () => {
    expect(expMultiplierForFatigue(50)).toBe(1);
    expect(expMultiplierForFatigue(80)).toBe(1);
  });

  it("critical giảm EXP còn một nửa", () => {
    expect(expMultiplierForFatigue(85)).toBe(0.5);
    expect(expMultiplierForFatigue(100)).toBe(0.5);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/hunter/fatigue.test.ts`
Expected: FAIL — không resolve được `./fatigue`

- [ ] **Step 3: Implement**

Tạo `src/core/hunter/fatigue.ts`:

```ts
/**
 * Fatigue là stat GIỚI HẠN (spec §5.5) — stat duy nhất
 * không nên tăng. Đây là cơ chế duy nhất trong app
 * thưởng cho việc nghỉ, và là thứ chặn overtraining.
 */
export type FatigueLevel = "normal" | "warning" | "critical";

export const FATIGUE_TUNING = {
  baseGainPerSession: 20,
  decayPerDay: 12,
  decayPerDayWellRested: 18,
  warningThreshold: 70,
  criticalThreshold: 85,
  criticalExpMultiplier: 0.5,
  max: 100,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Cộng fatigue theo volume buổi tập so với trung bình 4 tuần.
 * Chưa có lịch sử (avgVolume = 0) thì dùng mức cơ sở.
 */
export function fatigueAfterSession(
  current: number,
  sessionVolume: number,
  avgVolume: number,
): number {
  const ratio = avgVolume > 0 ? sessionVolume / avgVolume : 1;
  const gain = FATIGUE_TUNING.baseGainPerSession * ratio;
  return clamp(Math.round(current + gain), 0, FATIGUE_TUNING.max);
}

export function decayFatigue(
  current: number,
  days: number,
  sleptWell: boolean,
): number {
  const perDay = sleptWell
    ? FATIGUE_TUNING.decayPerDayWellRested
    : FATIGUE_TUNING.decayPerDay;
  return clamp(Math.round(current - perDay * days), 0, FATIGUE_TUNING.max);
}

export function fatigueLevel(value: number): FatigueLevel {
  if (value >= FATIGUE_TUNING.criticalThreshold) return "critical";
  if (value >= FATIGUE_TUNING.warningThreshold) return "warning";
  return "normal";
}

/** Fatigue critical cắt một nửa EXP nhận được — spec §5.5. */
export function expMultiplierForFatigue(value: number): number {
  return fatigueLevel(value) === "critical"
    ? FATIGUE_TUNING.criticalExpMultiplier
    : 1;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/hunter/fatigue.test.ts`
Expected: PASS, 16 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/hunter/fatigue.ts src/core/hunter/fatigue.test.ts
git commit -m "feat(core): add fatigue accumulation and decay"
```

---

## Task 8: Rank của dungeon

**Files:**
- Create: `src/core/training/dungeon-rank.ts`
- Create: `src/core/training/dungeon-rank.test.ts`

**Interfaces:**
- Consumes: `Rank` từ `@/core/hunter/progression`
- Produces:
  - `type DungeonRank = "E" | "D" | "C" | "B" | "A"`
  - `dungeonRankFor(plannedVolume: number, avgVolume: number): DungeonRank`
  - `goldForDungeonRank(rank: DungeonRank): number`
  - `DUNGEON_RANK_TUNING`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/core/training/dungeon-rank.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dungeonRankFor, goldForDungeonRank } from "./dungeon-rank";

describe("dungeonRankFor", () => {
  it("dưới 0.5× trung bình là E", () => {
    expect(dungeonRankFor(4000, 10000)).toBe("E");
  });

  it("0.5–0.8× là D", () => {
    expect(dungeonRankFor(5000, 10000)).toBe("D");
    expect(dungeonRankFor(7900, 10000)).toBe("D");
  });

  it("0.8–1.1× là C", () => {
    expect(dungeonRankFor(8000, 10000)).toBe("C");
    expect(dungeonRankFor(10900, 10000)).toBe("C");
  });

  it("1.1–1.4× là B", () => {
    expect(dungeonRankFor(11000, 10000)).toBe("B");
    expect(dungeonRankFor(13900, 10000)).toBe("B");
  });

  it("trên 1.4× là A", () => {
    expect(dungeonRankFor(14000, 10000)).toBe("A");
    expect(dungeonRankFor(30000, 10000)).toBe("A");
  });

  it("chưa có lịch sử thì mặc định C", () => {
    expect(dungeonRankFor(10000, 0)).toBe("C");
  });

  it("REGRESSION: khi khoẻ lên, buổi cũ tụt rank", () => {
    // Cùng buổi 11000, trung bình tăng từ 10000 lên 14000
    expect(dungeonRankFor(11000, 10000)).toBe("B");
    expect(dungeonRankFor(11000, 14000)).toBe("D");
  });
});

describe("goldForDungeonRank", () => {
  it("gold tăng dần theo rank", () => {
    expect(goldForDungeonRank("E")).toBe(30);
    expect(goldForDungeonRank("D")).toBe(50);
    expect(goldForDungeonRank("C")).toBe(70);
    expect(goldForDungeonRank("B")).toBe(95);
    expect(goldForDungeonRank("A")).toBe(120);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/core/training/dungeon-rank.test.ts`
Expected: FAIL — không resolve được `./dungeon-rank`

- [ ] **Step 3: Implement**

Tạo `src/core/training/dungeon-rank.ts`:

```ts
/**
 * Rank của buổi tập suy ra từ volume dự kiến so với
 * trung bình gần đây (spec §5.6). Không đặt tay.
 *
 * Hệ quả có chủ ý: khi hunter khoẻ lên, buổi từng là B
 * tự động tụt xuống C — đúng cảm giác của truyện.
 */
export type DungeonRank = "E" | "D" | "C" | "B" | "A";

export const DUNGEON_RANK_TUNING = {
  thresholds: [
    { rank: "A" as const, minRatio: 1.4 },
    { rank: "B" as const, minRatio: 1.1 },
    { rank: "C" as const, minRatio: 0.8 },
    { rank: "D" as const, minRatio: 0.5 },
    { rank: "E" as const, minRatio: 0 },
  ],
  gold: { E: 30, D: 50, C: 70, B: 95, A: 120 },
} as const;

export function dungeonRankFor(
  plannedVolume: number,
  avgVolume: number,
): DungeonRank {
  if (avgVolume <= 0) return "C";
  const ratio = plannedVolume / avgVolume;
  for (const t of DUNGEON_RANK_TUNING.thresholds) {
    if (ratio >= t.minRatio) return t.rank;
  }
  return "E";
}

export function goldForDungeonRank(rank: DungeonRank): number {
  return DUNGEON_RANK_TUNING.gold[rank];
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/core/training/dungeon-rank.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Chạy toàn bộ kiểm tra**

```bash
npm run lint && npm test && npx tsc --noEmit
```

Expected: cả ba pass. Tổng khoảng 132 unit test (34 từ Phase 0 + 98 từ Phase 1A).

- [ ] **Step 6: Commit**

```bash
git add src/core/training/dungeon-rank.ts src/core/training/dungeon-rank.test.ts
git commit -m "feat(core): derive dungeon rank from relative volume"
```

---

## Definition of Done — Phase 1A

- [ ] `npm test` pass toàn bộ, không có test nào bị skip
- [ ] `npm run lint` sạch — không file nào trong `src/core/` vi phạm ranh giới
- [ ] `npx tsc --noEmit` sạch
- [ ] Mọi hằng số cân bằng nằm trong object `*_TUNING` được export, không rải rác trong thân hàm
- [ ] Không hàm nào trong `src/core/` nhận buff/item/modifier làm tham số — stat vẫn là số Đo lường thuần
- [ ] Có test regression cho: detraining làm tụt stat, dungeon rank tụt khi hunter khoẻ lên, deload chỉ sau 2 buổi liên tiếp
- [ ] Đã commit 8 lần, mỗi task một commit

**Chưa có ở Phase 1A (đúng thiết kế):** chưa chạm database, chưa có UI, chưa log được gì. Phase 1B nối domain này với DB và server actions; Phase 1C dựng UI.

**Tiếp theo:** `2026-08-05-phase-1b-persistence-and-actions.md`
