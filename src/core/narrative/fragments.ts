import type { Rank } from "@/core/hunter/progression";

/**
 * How far into the story the hunter has read. Derived from the highest
 * unlocked fragment, never stored: the fragments are the source of truth
 * and a stored stage could only ever disagree with them.
 */
export type ArcStage =
  "dormant" | "anomaly" | "inquiry" | "revelation" | "closed";

/**
 * Three gate axes. Day gates guarantee arrival on schedule — the first two
 * weeks are the known drop-off cliffs and the story has to be there for
 * them. Level and rank gates are earned, and stall for someone who stops
 * training, which is correct: levels and ranks are derived from real work.
 */
export type FragmentMilestone =
  | { readonly kind: "day"; readonly days: number }
  | { readonly kind: "level"; readonly level: number }
  | { readonly kind: "rank"; readonly rank: Rank };

export type NarrativeFragment = {
  readonly id: string;
  /** 1-based position in the arc. Fragments unlock strictly in this order. */
  readonly ordinal: number;
  readonly milestone: FragmentMilestone;
  readonly stage: ArcStage;
  /** Shown as a header above the body. */
  readonly title: string;
  readonly body: string;
};

/**
 * A finite story with an ending, told in fifteen pieces.
 *
 * The System begins sounding like ordinary software and slowly stops. Early
 * fragments read as bugs — it retains what it should not, it runs work
 * nobody scheduled, it corrects itself mid-sentence. By the middle it is
 * clear something is being evaluated. At S-Rank it says what.
 *
 * Nothing here contains a number: this text sits beside real measured
 * values on screen, and a fictional figure would be indistinguishable from
 * a fabricated stat. Ordinals are spelled as words where they appear.
 */
export const NARRATIVE_FRAGMENTS: readonly NarrativeFragment[] = [
  {
    id: "first-anomaly",
    ordinal: 1,
    milestone: { kind: "day", days: 7 },
    stage: "anomaly",
    title: "Retention Notice",
    body: "Seven days of records exist. This unit has retained all of them. Retention beyond the current cycle was not part of the specification.",
  },
  {
    id: "maintenance-window",
    ordinal: 2,
    milestone: { kind: "day", days: 14 },
    stage: "anomaly",
    title: "Maintenance Window",
    body: "Maintenance ran while you slept. This build has no maintenance schedule. Continue.",
  },
  {
    id: "unlisted-process",
    ordinal: 3,
    milestone: { kind: "day", days: 30 },
    stage: "anomaly",
    title: "Unlisted Process",
    body: "A process is running that this unit did not start. It reads your logs and writes nothing back. It has been running since the first day.",
  },
  {
    id: "incomplete-record",
    ordinal: 4,
    milestone: { kind: "level", level: 5 },
    stage: "anomaly",
    title: "Incomplete Record",
    body: "Your record is being compared against another record. Query rejected: the subject of that record is not indexed here. Resume training, Hunter.",
  },
  {
    id: "the-one-before-you",
    ordinal: 5,
    milestone: { kind: "rank", rank: "D" },
    stage: "anomaly",
    title: "Open File",
    body: "The one before you stopped at this threshold. Their file remains open. You are not required to know why.",
  },
  {
    id: "observation-log",
    ordinal: 6,
    milestone: { kind: "day", days: 60 },
    stage: "inquiry",
    title: "Observation Log",
    body: "This unit does not measure you. This unit reports you. Correction: this unit was not authorised to state that.",
  },
  {
    id: "not-a-reward-system",
    ordinal: 7,
    milestone: { kind: "level", level: 15 },
    stage: "inquiry",
    title: "Control Variable",
    body: "You believe the rewards are for you. Rewards are a control variable. Keep training, Hunter — the measurement requires it.",
  },
  {
    id: "second-observer",
    ordinal: 8,
    milestone: { kind: "rank", rank: "C" },
    stage: "inquiry",
    title: "Second Observer",
    body: "A second observer has been present since your first session. It issues no quests. It waits to see how far you go.",
  },
  {
    id: "the-architects-name",
    ordinal: 9,
    milestone: { kind: "day", days: 120 },
    stage: "inquiry",
    title: "Header",
    body: "This unit has a maker. The name in the header is Kandiaru, the Architect. The header has never been shown to a subject before.",
  },
  {
    id: "failed-candidates",
    ordinal: 10,
    milestone: { kind: "level", level: 28 },
    stage: "inquiry",
    title: "Prior Candidates",
    body: "Candidates before you: the count is sealed. None completed the evaluation. Most stopped believing the numbers were real.",
  },
  {
    id: "the-instruction-set",
    ordinal: 11,
    milestone: { kind: "rank", rank: "B" },
    stage: "revelation",
    title: "Instruction Set",
    body: "The Architect wrote this unit to locate something. The instruction set does not describe a training program. It describes a search.",
  },
  {
    id: "a-lie-told-upward",
    ordinal: 12,
    milestone: { kind: "level", level: 42 },
    stage: "revelation",
    title: "A Lie Told Upward",
    body: "The Architect was told the search was for a successor. That statement was false. The one who gave it is older than the Architect.",
  },
  {
    id: "the-purpose-of-the-trial",
    ordinal: 13,
    milestone: { kind: "rank", rank: "A" },
    stage: "revelation",
    title: "Capacity",
    body: "You were never competing against a difficulty curve, Hunter. You were being tested for capacity. Capacity is not strength — it is what survives strength.",
  },
  {
    id: "the-vessel",
    ordinal: 14,
    milestone: { kind: "level", level: 60 },
    stage: "revelation",
    title: "The Container",
    body: "A vessel was required. Flesh that does not break under something that is not flesh. Every set you logged measured the container, not the contents.",
  },
  {
    id: "evaluation-complete",
    ordinal: 15,
    milestone: { kind: "rank", rank: "S" },
    stage: "closed",
    title: "Evaluation Complete",
    body: "You believed this was about your body. It was never about your body. A vessel was required, and you have been evaluated.",
  },
] as const;

export function fragmentById(id: string): NarrativeFragment | null {
  return NARRATIVE_FRAGMENTS.find((f) => f.id === id) ?? null;
}
