import { describe, it, expect } from "vitest";
import { epoch } from "@/core/shared/units";
import {
  toTrainingDay,
  trainingDayStart,
  trainingDayEnd,
  addDays,
  daysBetween,
  parseTrainingDay,
  isTrainingDay,
  InvalidTrainingDayError,
  type TrainingDay,
} from "./training-day";

const ICT = 420; // UTC+7

describe("toTrainingDay", () => {
  it("23:59 ICT still belongs to that day", () => {
    // 2026-08-05 16:59 UTC = 2026-08-05 23:59 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T16:59:00Z")), ICT)).toBe(
      "2026-08-05",
    );
  });

  it("00:00 ICT has already rolled to the next day", () => {
    // 2026-08-05 17:00 UTC = 2026-08-06 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T17:00:00Z")), ICT)).toBe(
      "2026-08-06",
    );
  });

  it("REGRESSION: a session logged at 19:00 ICT is NOT pushed to the next day", () => {
    // This is exactly the bug this function exists to prevent.
    // 2026-08-05 12:00 UTC = 2026-08-05 19:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T12:00:00Z")), ICT)).toBe(
      "2026-08-05",
    );
  });

  it("handles a month boundary correctly", () => {
    // 2026-08-31 17:00 UTC = 2026-09-01 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-08-31T17:00:00Z")), ICT)).toBe(
      "2026-09-01",
    );
  });

  it("handles a year boundary correctly", () => {
    // 2026-12-31 17:00 UTC = 2027-01-01 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-12-31T17:00:00Z")), ICT)).toBe(
      "2027-01-01",
    );
  });

  it("works with a UTC offset", () => {
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T23:59:00Z")), 0)).toBe(
      "2026-08-05",
    );
  });

  it("works with a negative offset", () => {
    // 2026-08-05 03:00 UTC = 2026-08-04 22:00 New York time (-300)
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T03:00:00Z")), -300)).toBe(
      "2026-08-04",
    );
  });
});

describe("trainingDayStart / trainingDayEnd", () => {
  it("start is 00:00:00.000 local time", () => {
    const start = trainingDayStart("2026-08-05" as TrainingDay, ICT);
    expect(new Date(start).toISOString()).toBe("2026-08-04T17:00:00.000Z");
  });

  it("end is 23:59:59.999 local time", () => {
    const end = trainingDayEnd("2026-08-05" as TrainingDay, ICT);
    expect(new Date(end).toISOString()).toBe("2026-08-05T16:59:59.999Z");
  });

  it("round-trips: every instant in the day maps back to that day", () => {
    const day = "2026-08-05" as TrainingDay;
    const start = trainingDayStart(day, ICT);
    const end = trainingDayEnd(day, ICT);
    expect(toTrainingDay(start, ICT)).toBe(day);
    expect(toTrainingDay(end, ICT)).toBe(day);
  });

  it("a day's end is immediately followed by the next day's start", () => {
    const end = trainingDayEnd("2026-08-05" as TrainingDay, ICT);
    const nextStart = trainingDayStart("2026-08-06" as TrainingDay, ICT);
    expect(nextStart - end).toBe(1);
  });
});

describe("addDays", () => {
  it("adds days within the same month", () => {
    expect(addDays("2026-08-05" as TrainingDay, 3)).toBe("2026-08-08");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-08-30" as TrainingDay, 3)).toBe("2026-09-02");
  });

  it("subtracts days with a negative n", () => {
    expect(addDays("2026-09-02" as TrainingDay, -3)).toBe("2026-08-30");
  });

  it("adding 0 days returns the same day", () => {
    expect(addDays("2026-08-05" as TrainingDay, 0)).toBe("2026-08-05");
  });
});

describe("daysBetween", () => {
  it("counts the days between two dates correctly", () => {
    expect(
      daysBetween("2026-08-05" as TrainingDay, "2026-08-16" as TrainingDay),
    ).toBe(11);
  });

  it("returns 0 for the same day", () => {
    expect(
      daysBetween("2026-08-05" as TrainingDay, "2026-08-05" as TrainingDay),
    ).toBe(0);
  });

  it("returns a negative number when reversed", () => {
    expect(
      daysBetween("2026-08-16" as TrainingDay, "2026-08-05" as TrainingDay),
    ).toBe(-11);
  });

  it("counts correctly across a year boundary", () => {
    expect(
      daysBetween("2026-12-30" as TrainingDay, "2027-01-02" as TrainingDay),
    ).toBe(3);
  });
});

describe("parseTrainingDay / isTrainingDay", () => {
  it("accepts a well-formed date", () => {
    expect(parseTrainingDay("2026-08-05")).toBe("2026-08-05");
    expect(isTrainingDay("2026-08-05")).toBe(true);
  });

  it("rejects a non-date string", () => {
    expect(() => parseTrainingDay("garbage")).toThrow(InvalidTrainingDayError);
    expect(isTrainingDay("garbage")).toBe(false);
  });

  it("rejects unpadded components", () => {
    expect(isTrainingDay("2026-8-5")).toBe(false);
    expect(isTrainingDay("26-08-05")).toBe(false);
  });

  it("rejects trailing or leading text", () => {
    expect(isTrainingDay("2026-08-05T00:00:00Z")).toBe(false);
    expect(isTrainingDay(" 2026-08-05")).toBe(false);
    expect(isTrainingDay("")).toBe(false);
  });

  it("rejects calendar-invalid dates the regex alone would accept", () => {
    expect(isTrainingDay("2026-13-01")).toBe(false); // month 13
    expect(isTrainingDay("2026-02-30")).toBe(false); // Feb 30
    expect(isTrainingDay("2026-00-10")).toBe(false); // month 0
    expect(isTrainingDay("2026-04-31")).toBe(false); // April has 30 days
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(isTrainingDay("2028-02-29")).toBe(true); // 2028 is a leap year
    expect(isTrainingDay("2026-02-29")).toBe(false); // 2026 is not
  });
});

describe("malformed input is rejected instead of silently producing NaN", () => {
  const malformed = "garbage" as unknown as TrainingDay;

  it("REGRESSION: trainingDayStart throws rather than returning NaN", () => {
    // Before the runtime guard this returned NaN silently, and the NaN
    // propagated through streak, penalty, and quest-reset logic unnoticed.
    expect(() => trainingDayStart(malformed, ICT)).toThrow(
      InvalidTrainingDayError,
    );
  });

  it("trainingDayEnd throws", () => {
    expect(() => trainingDayEnd(malformed, ICT)).toThrow(
      InvalidTrainingDayError,
    );
  });

  it("addDays throws", () => {
    expect(() => addDays(malformed, 1)).toThrow(InvalidTrainingDayError);
  });

  it("daysBetween throws on either argument", () => {
    const valid = "2026-08-05" as TrainingDay;
    expect(() => daysBetween(malformed, valid)).toThrow(
      InvalidTrainingDayError,
    );
    expect(() => daysBetween(valid, malformed)).toThrow(
      InvalidTrainingDayError,
    );
  });

  it("the error message names the offending value", () => {
    expect(() => parseTrainingDay("nope")).toThrow(/"nope"/);
  });
});

describe("toTrainingDay always emits parseable output", () => {
  it("round-trips through parseTrainingDay for a range of instants", () => {
    for (let i = 0; i < 400; i++) {
      const at = epoch(Date.parse("2026-01-01T00:00:00Z") + i * 86_400_000);
      const day = toTrainingDay(at, ICT);
      expect(() => parseTrainingDay(day)).not.toThrow();
    }
  });
});
