import { z } from "zod";

const schema = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().optional(),
  HUNTER_PIN: z.string().min(4),
  SESSION_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().optional(),
  HUNTER_TZ_OFFSET_MINUTES: z.coerce.number().int().default(420),
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof schema>;

/**
 * A pure function so it stays testable. Throws with the specific
 * variable name instead of letting the app die somewhere unrelated later.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}

let cached: Env | null = null;

/**
 * Reads env once and memoizes it.
 *
 * Deliberately LAZY instead of running at import time: validating eagerly
 * at the top level would kill any test file that happens to import this
 * module, even when it only needs `parseEnv`. Fail-fast is still preserved —
 * just deferred to first real use (Next startup or build), not module load.
 */
export function getEnv(): Env {
  if (cached === null) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test-only. */
export function resetEnvCache(): void {
  cached = null;
}
