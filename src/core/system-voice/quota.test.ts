import { describe, it, expect } from "vitest";
import {
  afterFailure,
  afterSuccess,
  canGenerate,
  DAILY_REQUEST_LIMIT,
  emptyQuota,
  FAILURE_THRESHOLD,
  type QuotaState,
} from "./quota";

const state = (patch: Partial<QuotaState> = {}): QuotaState => ({
  ...emptyQuota(),
  ...patch,
});

describe("canGenerate", () => {
  it("allows a fresh day", () => {
    expect(canGenerate(emptyQuota())).toBe(true);
  });

  it("allows the last request under the limit and refuses the one past it", () => {
    expect(canGenerate(state({ requests: DAILY_REQUEST_LIMIT - 1 }))).toBe(
      true,
    );
    expect(canGenerate(state({ requests: DAILY_REQUEST_LIMIT }))).toBe(false);
  });

  it("refuses everything once the breaker is tripped", () => {
    expect(canGenerate(state({ tripped: true }))).toBe(false);
  });
});

describe("afterFailure", () => {
  it("counts consecutive failures", () => {
    const one = afterFailure(emptyQuota());
    expect(one.consecutiveFailures).toBe(1);
    expect(one.tripped).toBe(false);
  });

  it("still spends the quota on a failed attempt", () => {
    expect(afterFailure(emptyQuota()).requests).toBe(1);
  });

  it("REGRESSION: trips the breaker on the third consecutive failure", () => {
    let s = emptyQuota();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) s = afterFailure(s);
    expect(s.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(s.tripped).toBe(true);
    expect(canGenerate(s)).toBe(false);
  });

  it("stays tripped for the rest of the day", () => {
    let s = emptyQuota();
    for (let i = 0; i < FAILURE_THRESHOLD + 2; i++) s = afterFailure(s);
    expect(s.tripped).toBe(true);
  });
});

describe("afterSuccess", () => {
  it("spends quota and clears the failure streak", () => {
    const s = afterSuccess(state({ requests: 4, consecutiveFailures: 2 }));
    expect(s.requests).toBe(5);
    expect(s.consecutiveFailures).toBe(0);
  });

  it("REGRESSION: a success never un-trips a breaker that already opened", () => {
    // The breaker is a day-long circuit, not a retry counter: something is
    // wrong upstream and the day should finish on the template.
    const s = afterSuccess(state({ tripped: true }));
    expect(s.tripped).toBe(true);
  });
});
