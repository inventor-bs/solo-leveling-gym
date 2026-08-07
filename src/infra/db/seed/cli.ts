import "dotenv/config";
import { getDb } from "../client";
import { seedProgram } from "./program";
import { ShadowRepo } from "../repositories/shadow.repo";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { TitleRepo } from "../repositories/title.repo";
import { TITLE_CATALOG } from "@/core/title/catalog";

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

  // Seeded here as well as at onboarding so an already-onboarded production
  // database — which will never run onboarding again — still gets the roster.
  // onConflictDoNothing means a real earnedAt is never touched.
  const titles = new TitleRepo(db);
  await titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
