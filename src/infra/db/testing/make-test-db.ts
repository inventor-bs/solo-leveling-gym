import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../schema";
import type { Db } from "../client";

/**
 * An in-memory SQLite DB with migrations already applied. Each test gets
 * its own instance, so no state leaks between tests.
 */
export async function makeTestDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/infra/db/migrations" });
  return db as Db;
}
