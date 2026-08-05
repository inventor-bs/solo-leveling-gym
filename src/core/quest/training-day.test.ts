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

  it("xử lý đúng khi vắt qua ranh giới năm", () => {
    // 2026-12-31 17:00 UTC = 2027-01-01 00:00 ICT
    expect(toTrainingDay(epoch(Date.parse("2026-12-31T17:00:00Z")), ICT)).toBe(
      "2027-01-01",
    );
  });

  it("hoạt động với offset UTC", () => {
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T23:59:00Z")), 0)).toBe(
      "2026-08-05",
    );
  });

  it("hoạt động với offset âm", () => {
    // 2026-08-05 03:00 UTC = 2026-08-04 22:00 giờ New York (-300)
    expect(toTrainingDay(epoch(Date.parse("2026-08-05T03:00:00Z")), -300)).toBe(
      "2026-08-04",
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

  it("cộng 0 ngày trả về chính nó", () => {
    expect(addDays("2026-08-05" as TrainingDay, 0)).toBe("2026-08-05");
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

  it("đếm đúng khi vắt qua năm", () => {
    expect(
      daysBetween("2026-12-30" as TrainingDay, "2027-01-02" as TrainingDay),
    ).toBe(3);
  });
});
