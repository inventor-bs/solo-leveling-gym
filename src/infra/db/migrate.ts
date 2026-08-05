import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "./client";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./src/infra/db/migrations" });
  console.log("Migration hoàn tất.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
