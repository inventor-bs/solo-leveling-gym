import { epoch, type Epoch } from "@/core/shared/units";

declare const trainingDayBrand: unique symbol;

/**
 * Ngày lịch địa phương của hunter, dạng "YYYY-MM-DD".
 *
 * ĐÂY LÀ NƠI DUY NHẤT trong toàn codebase được phép suy ra "ngày"
 * từ một thời điểm. Không nơi nào khác được gọi getDate()/getMonth().
 *
 * DB luôn lưu UTC epoch. Kiểu này chỉ tồn tại ở tầng logic.
 *
 * Dùng offset cố định (phút) thay vì tzdata: Việt Nam không có DST
 * nên UTC+7 luôn đúng, và tránh được cả một thư viện phụ thuộc.
 */
export type TrainingDay = string & {
  readonly [trainingDayBrand]: "TrainingDay";
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcParts(d: Date): TrainingDay {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}` as TrainingDay;
}

/** Quy một thời điểm về ngày lịch địa phương của hunter. */
export function toTrainingDay(at: Epoch, tzOffsetMinutes: number): TrainingDay {
  // Dịch thời điểm sang "giờ địa phương biểu diễn dưới dạng UTC",
  // rồi đọc các thành phần UTC. Cách này tránh hoàn toàn múi giờ của máy chủ.
  return formatUtcParts(new Date(at + tzOffsetMinutes * MS_PER_MINUTE));
}

/** Thời điểm 00:00:00.000 giờ địa phương của ngày đó. */
export function trainingDayStart(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  const [y, m, d] = day.split("-").map(Number);
  return epoch(Date.UTC(y, m - 1, d) - tzOffsetMinutes * MS_PER_MINUTE);
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
  return formatUtcParts(new Date(Date.UTC(y, m - 1, d) + n * MS_PER_DAY));
}

/** Số ngày lịch từ `from` đến `to`. Âm nếu `to` trước `from`. */
export function daysBetween(from: TrainingDay, to: TrainingDay): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY,
  );
}
