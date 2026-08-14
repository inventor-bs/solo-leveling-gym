// src/core/cosmetic/architecture.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The executable form of this phase's one hard rule: a cosmetic must never
 * reach a real number's calculation.
 *
 * Reading source text rather than importing modules is the point. A type
 * signature can be widened and still compile; a grep cannot be talked out
 * of what it sees. This is the regression sweep that would otherwise be a
 * manual check somebody eventually forgets to run.
 */
const CORE_DIR = join(process.cwd(), "src", "core");
const COSMETIC_DIR = join(CORE_DIR, "cosmetic");

function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesUnder(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function isInsideCosmetic(file: string): boolean {
  return !relative(COSMETIC_DIR, file).startsWith(`..${sep}`);
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  // The capture group is mandatory in this pattern, so it is always present
  // on a match; the assertion only works around noUncheckedIndexedAccess.
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
}

const coreFiles = tsFilesUnder(CORE_DIR);
const cosmeticFiles = coreFiles.filter(isInsideCosmetic);
const nonCosmeticCoreFiles = coreFiles.filter((f) => !isInsideCosmetic(f));

// Violations are collected into arrays rather than asserted one at a time,
// so a failure names every offending file and specifier at once instead of
// stopping at the first.
describe("core/cosmetic is a leaf of the domain", () => {
  it("finds the modules it is asserting about", () => {
    // Guards against the whole suite passing vacuously after a rename.
    expect(cosmeticFiles.length).toBeGreaterThan(3);
    expect(nonCosmeticCoreFiles.length).toBeGreaterThan(20);
  });

  it("imports nothing from core except the pricing module", () => {
    const violations: string[] = [];
    for (const file of cosmeticFiles) {
      for (const specifier of importSpecifiers(file)) {
        const reachesElsewhereInCore =
          specifier.startsWith("@/core/") &&
          specifier !== "@/core/economy/pricing";
        // "../" is the relative escape out of core/cosmetic; "./" stays inside.
        if (reachesElsewhereInCore || specifier.startsWith("../")) {
          violations.push(`${relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("is imported by no other core module", () => {
    const violations: string[] = [];
    for (const file of nonCosmeticCoreFiles) {
      for (const specifier of importSpecifiers(file)) {
        if (
          specifier.includes("core/cosmetic") ||
          specifier.includes("/cosmetic/")
        ) {
          violations.push(`${relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("no cosmetic state appears in any real calculation", () => {
  // Every stored cosmetic field, by name. None of them may be mentioned
  // anywhere in core outside core/cosmetic — which covers, and is stronger
  // than, checking the signatures of sessionVolumeLoad, bestE1rmForExercise,
  // detectPrs, dungeonRankFor, deriveStats, weakenedExp and armyRank one by
  // one: it also catches an eighth function nobody thought to list.
  //
  // Case matters: core/economy/pricing.ts legitimately declares the types
  // ShadowSkinId and TitleFrameId, and neither contains the lower-cased
  // "skinId" or "frameId" this list is looking for.
  const FORBIDDEN = [
    "auraLevel",
    "equippedSkinId",
    "titleFrame",
    "dashboardOrder",
    "skinId",
    "frameId",
  ];

  it("never names a cosmetic field outside core/cosmetic", () => {
    const violations: string[] = [];
    for (const file of nonCosmeticCoreFiles) {
      const source = readFileSync(file, "utf8");
      for (const name of FORBIDDEN) {
        if (source.includes(name)) {
          violations.push(`${relative(process.cwd(), file)} mentions ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
