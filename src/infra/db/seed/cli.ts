import "dotenv/config";
import { getDb } from "../client";
import { seedProgram } from "./program";
import { ShadowRepo } from "../repositories/shadow.repo";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { TitleRepo } from "../repositories/title.repo";
import { TITLE_CATALOG } from "@/core/title/catalog";
import { SkillRepo } from "../repositories/skill.repo";
import { SKILL_CATALOG } from "@/core/skill/catalog";

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

  // This CLI step is the only seed path needed for the skill catalog —
  // unlike titles/shadows, which also needed an onboarding-time seed to
  // cover a pre-existing production DB with no hunter row yet, every
  // hunter already exists by the time this phase ships, so a fresh
  // onboarding seed path would be dead code.
  const skills = new SkillRepo(db);
  await skills.seed(SKILL_CATALOG.map((s) => ({ id: s.id })));

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
