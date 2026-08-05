import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getEnv } from "@/infra/config/env";
import * as schema from "./schema";

export function createDb(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | null = null;

/**
 * Production DB. Lazily initialized for the same reason as getEnv():
 * importing the module must not require a valid env to already exist.
 */
export function getDb(): Db {
  if (cached === null) {
    const env = getEnv();
    cached = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
  }
  return cached;
}
