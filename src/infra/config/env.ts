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

let cached: Env | null = null;

/**
 * Đọc env một lần rồi nhớ lại.
 *
 * Cố ý LƯỜI thay vì chạy lúc import: nếu validate ngay ở top level thì
 * mọi file test lỡ import module này sẽ chết, kể cả khi nó chỉ cần
 * `parseEnv`. Fail-fast vẫn được giữ — chỉ là ở lần dùng thật đầu tiên
 * (khi Next khởi động hoặc build), không phải lúc nạp module.
 */
export function getEnv(): Env {
  if (cached === null) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Chỉ dùng trong test. */
export function resetEnvCache(): void {
  cached = null;
}
