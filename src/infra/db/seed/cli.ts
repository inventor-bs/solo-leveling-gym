import "dotenv/config";
import { getDb } from "../client";
import { seedProgram } from "./program";

/**
 * Runs on every deploy, after migrations. seedProgram upserts, so a
 * repeat run is a no-op — that is what makes it safe to keep in the
 * build rather than as a one-off command someone has to remember.
 */
async function main() {
  await seedProgram(getDb());
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
