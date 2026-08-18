// src/core/system-voice/architecture.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The executable form of this phase's one hard rule: a voice changes how
 * the System speaks, never what it speaks about.
 *
 * Reading source text rather than importing modules is the point. A
 * parameter list can widen and still compile; a grep cannot be talked out
 * of what it sees. This is the regression sweep that would otherwise be a
 * manual check somebody eventually forgets to run.
 */
const CORE_DIR = join(process.cwd(), "src", "core");

/** The only three modules allowed to know a voice tone exists. */
const TONE_AWARE = [
  join("src", "core", "system-voice", "tone.ts"),
  join("src", "core", "system-voice", "prompt.ts"),
  join("src", "core", "system-voice", "template-engine.ts"),
];

/**
 * Parameter lists that must stay closed to a tone, and why each one:
 *
 *   contextNumbers, factsBlock — the facts and the anti-hallucination
 *     whitelist are built before a voice is known. One whitelist, not four.
 *   branchFor  — the nine-branch priority order encodes a rule about what
 *     deserves to be said first. No voice may reorder it.
 *   severityFor — how bad a situation is belongs to the situation.
 *   moderateDraft, canGenerate, afterSuccess, afterFailure — the safety
 *     gate and the daily budget are the same for every voice.
 *   sessionVolumeLoad, bestE1rmForExercise, detectPrs, deriveStats,
 *     armyRank — measured numbers, which nothing bought may ever touch.
 */
const CLOSED_SIGNATURES = [
  "contextNumbers",
  "factsBlock",
  "branchFor",
  "severityFor",
  "moderateDraft",
  "canGenerate",
  "afterSuccess",
  "afterFailure",
  "sessionVolumeLoad",
  "bestE1rmForExercise",
  "detectPrs",
  "deriveStats",
  "armyRank",
];

function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesUnder(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Test files are excluded from the sweeps below on purpose: a test may name
 * the type in order to drive it, and the invariant being protected is about
 * production signatures, not about what a test is allowed to mention.
 */
const productionFiles = tsFilesUnder(CORE_DIR).filter(
  (file) => !file.endsWith(".test.ts"),
);

function repoPath(file: string): string {
  return relative(process.cwd(), file);
}

describe("the voice tone is contained to three modules", () => {
  it("finds the modules it is asserting about", () => {
    // Guards against the whole suite passing vacuously after a rename.
    expect(productionFiles.length).toBeGreaterThan(20);
    for (const allowed of TONE_AWARE) {
      expect(productionFiles.map(repoPath)).toContain(allowed);
    }
  });

  it("names VoiceToneId nowhere else in core", () => {
    const violations = productionFiles
      .filter((file) => readFileSync(file, "utf8").includes("VoiceToneId"))
      .map(repoPath)
      .filter((path) => !TONE_AWARE.includes(path));
    expect(violations).toEqual([]);
  });

  it("is imported by no other core module", () => {
    const violations: string[] = [];
    for (const file of productionFiles) {
      if (TONE_AWARE.includes(repoPath(file))) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        if (match[1]!.includes("system-voice/tone")) {
          violations.push(`${repoPath(file)} -> ${match[1]!}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("no closed signature accepts a tone", () => {
  it("finds every function it is asserting about", () => {
    for (const name of CLOSED_SIGNATURES) {
      const found = productionFiles.some((file) =>
        new RegExp(`function\\s+${name}\\s*\\(`).test(
          readFileSync(file, "utf8"),
        ),
      );
      // A renamed function must fail loudly here rather than silently stop
      // being checked.
      expect(found, `${name} was not found anywhere in core`).toBe(true);
    }
  });

  it("takes neither a tone parameter nor a tone type, in any of them", () => {
    const violations: string[] = [];
    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      for (const name of CLOSED_SIGNATURES) {
        const match = source.match(
          new RegExp(`function\\s+${name}\\s*\\(([^)]*)\\)`),
        );
        if (!match) continue;
        const params = match[1]!;
        if (params.includes("tone") || params.includes("VoiceToneId")) {
          violations.push(`${repoPath(file)}: ${name}(${params.trim()})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
