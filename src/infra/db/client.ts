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
 * DB production. Lười khởi tạo cùng lý do như getEnv():
 * import module không được kéo theo việc phải có env hợp lệ.
 */
export function getDb(): Db {
  if (cached === null) {
    const env = getEnv();
    cached = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
  }
  return cached;
}
