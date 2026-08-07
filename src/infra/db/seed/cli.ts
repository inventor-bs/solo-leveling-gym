import "dotenv/config";
import { getDb } from "../client";
import { seedProgram } from "./program";
import { ShadowRepo } from "../repositories/shadow.repo";
import { SHADOW_ROSTER } from "@/core/shadow/roster";

/**
 * Runs on every deploy, after migrations. seedProgram and ShadowRepo.seed
 * both upsert, so a repeat run is a no-op — that is what makes it safe to
 * keep in the build rather than as a one-off command someone has to
 * remember.
 */
async function main() {
  const db = getDb();
  await seedProgram(db);

  const now = Date.now();
  const shadows = new ShadowRepo(db);
  await shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? now : null,
    })),
  );

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
