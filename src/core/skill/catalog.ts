/**
 * A skill is a permanent, AP-bought unlock that only takes effect while it
 * occupies one of the hunter's skill slots — the same "earned once, then
 * worn/not-worn" shape as a title, generalized from one slot to many.
 */
export type SkillBranch = "body" | "shadow" | "sovereign";

export type SkillId =
  | "tenacity"
  | "advanced-regeneration"
  | "iron-body"
  | "vital-strike"
  | "shadow-preservation"
  | "army-discipline"
  | "shadow-extraction-plus"
  | "legion"
  | "bloodlust"
  | "stealth"
  | "rulers-authority"
  | "shadow-exchange"
  | "shadow-storage";

export type SkillDef = {
  readonly id: SkillId;
  readonly name: string;
  readonly branch: SkillBranch;
  readonly apCost: number;
  readonly effect: string;
};

export const SKILL_CATALOG: readonly SkillDef[] = [
  {
    id: "tenacity",
    name: "Tenacity",
    branch: "body",
    apCost: 3,
    effect: "Penalty Zone takes 5% of current EXP instead of 10%",
  },
  {
    id: "advanced-regeneration",
    name: "Advanced Regeneration",
    branch: "body",
    apCost: 4,
    effect: "Fatigue decays 25% faster",
  },
  {
    id: "iron-body",
    name: "Iron Body",
    branch: "body",
    apCost: 5,
    effect: "A shadow starts weakening after 10 inactive days instead of 7",
  },
  {
    id: "vital-strike",
    name: "Vital Strike",
    branch: "body",
    apCost: 6,
    effect: "A BOSS set pays double EXP instead of 1.5x",
  },
  {
    id: "shadow-preservation",
    name: "Shadow Preservation",
    branch: "shadow",
    apCost: 3,
    effect: "A weakening shadow decays 1% per day instead of 2%",
  },
  {
    id: "army-discipline",
    name: "Army Discipline",
    branch: "shadow",
    apCost: 5,
    effect: "Army Rank is the AVERAGE extracted grade instead of the weakest",
  },
  {
    id: "shadow-extraction-plus",
    name: "Shadow Extraction+",
    branch: "shadow",
    apCost: 6,
    effect: "A PR on an accessory exercise can also extract a shadow",
  },
  {
    id: "legion",
    name: "Legion",
    branch: "shadow",
    apCost: 8,
    effect: "Every shadow gains 10% more EXP",
  },
  {
    id: "bloodlust",
    name: "Bloodlust",
    branch: "sovereign",
    apCost: 4,
    effect: "A B-Rank or better dungeon pays 50% more gold",
  },
  {
    id: "stealth",
    name: "Stealth",
    branch: "sovereign",
    apCost: 4,
    effect: "Hidden Quests trigger on shorter conditions",
  },
  {
    id: "rulers-authority",
    name: "Ruler's Authority",
    branch: "sovereign",
    apCost: 7,
    effect: "Replace one of today's Daily Quest targets",
  },
  {
    id: "shadow-exchange",
    name: "Shadow Exchange",
    branch: "sovereign",
    apCost: 8,
    effect: "Swap two of this week's scheduled training days, once a week",
  },
  {
    id: "shadow-storage",
    name: "Shadow Storage",
    branch: "sovereign",
    apCost: 10,
    effect: "Bank a surplus session, withdraw it to cover a missed one",
  },
] as const;

export function skillById(id: string): SkillDef | null {
  return SKILL_CATALOG.find((s) => s.id === id) ?? null;
}

/**
 * The runtime guard for hunter_skill.skillId, a plain text primary key.
 * Every buff lookup and every repo write goes through this so a stale or
 * hand-edited id can never be treated as a real skill.
 */
export function isSkillId(value: string): value is SkillId {
  return skillById(value) !== null;
}
