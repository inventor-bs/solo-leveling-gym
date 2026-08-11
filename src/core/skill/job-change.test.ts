import { describe, it, expect } from "vitest";
import {
  jobChangeEligible,
  evaluateJobChangeProgress,
  JOB_CHANGE_MIN_LEVEL,
  JOB_CHANGE_RETRY_LEVEL,
  JOB_CHANGE_TARGET_CLEARS,
  JOB_CHANGE_WINDOW_DAYS,
} from "./job-change";

describe("jobChangeEligible", () => {
  it("is false below level 40 with no attempt yet", () => {
    expect(jobChangeEligible(39, null)).toBe(false);
  });

  it("is true at level 40 with no attempt yet", () => {
    expect(jobChangeEligible(JOB_CHANGE_MIN_LEVEL, null)).toBe(true);
  });

  it("is false once already completed", () => {
    const attempt = {
      startedDay: "2026-08-01",
      consecutiveCleared: 3,
      failedAt: null,
      completedAt: 100,
    };
    expect(jobChangeEligible(50, attempt)).toBe(false);
  });

  it("is false after a failed attempt until level 45", () => {
    const attempt = {
      startedDay: "2026-08-01",
      consecutiveCleared: 0,
      failedAt: 100,
      completedAt: null,
    };
    expect(jobChangeEligible(42, attempt)).toBe(false);
    expect(jobChangeEligible(JOB_CHANGE_RETRY_LEVEL, attempt)).toBe(true);
  });
});

describe("evaluateJobChangeProgress", () => {
  it("fails immediately on a Daily Quest failure inside the window", () => {
    const outcome = evaluateJobChangeProgress({
      consecutiveCleared: 2,
      sessionMetTarget: true,
      daysIntoWindow: 3,
      dailyQuestFailedInWindow: true,
    });
    expect(outcome).toEqual({ status: "failed" });
  });

  it("fails once the window has elapsed without 3 consecutive clears", () => {
    const outcome = evaluateJobChangeProgress({
      consecutiveCleared: 1,
      sessionMetTarget: false,
      daysIntoWindow: JOB_CHANGE_WINDOW_DAYS,
      dailyQuestFailedInWindow: false,
    });
    expect(outcome).toEqual({ status: "failed" });
  });

  it("resets the streak on a session that misses the volume target", () => {
    const outcome = evaluateJobChangeProgress({
      consecutiveCleared: 2,
      sessionMetTarget: false,
      daysIntoWindow: 3,
      dailyQuestFailedInWindow: false,
    });
    expect(outcome).toEqual({ status: "in-progress", consecutiveCleared: 0 });
  });

  it("completes on the 3rd consecutive cleared dungeon", () => {
    const outcome = evaluateJobChangeProgress({
      consecutiveCleared: JOB_CHANGE_TARGET_CLEARS - 1,
      sessionMetTarget: true,
      daysIntoWindow: 5,
      dailyQuestFailedInWindow: false,
    });
    expect(outcome).toEqual({ status: "completed" });
  });
});
