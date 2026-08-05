import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../schema";
import type { Db } from "../client";

/**
 * DB SQLite in-memory, đã chạy migration. Mỗi test một instance riêng
 * nên không có trạng thái rò rỉ giữa các test.
 */
export async function makeTestDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/infra/db/migrations" });
  return db as Db;
}
