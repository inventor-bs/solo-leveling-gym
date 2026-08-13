/**
 * What a server action hands back to the browser.
 *
 * Server actions must not throw for expected outcomes. Next.js strips the
 * message from any error crossing the server/client boundary in production
 * builds, so a thrown domain error reaches the user as an opaque
 * "An error occurred in the Server Components render" with no way to act
 * on it. Returning the failure as data keeps it renderable.
 */
export type ActionError =
  | "unauthorized"
  | "invalid-input"
  | "program-day-not-found"
  | "session-not-found"
  | "session-already-completed"
  | "hunter-not-found"
  | "quest-not-found"
  | "no-active-penalty"
  | "survival-incomplete"
  | "title-not-found"
  | "title-not-earned"
  | "insufficient-gold"
  | "unknown-unlock"
  | "already-unlocked"
  | "requirement-not-met"
  | "challenge-already-pending"
  | "floor-locked"
  | "hourglass-already-active"
  | "hourglass-already-used-this-week"
  | "shadow-not-found"
  | "shadow-not-extracted"
  | "wager-not-monday"
  | "wager-already-placed"
  | "stake-too-large"
  | "unknown-skill"
  | "already-learned"
  | "insufficient-ap"
  | "not-learned"
  | "no-free-slot"
  | "slots-maxed"
  | "skill-not-equipped"
  | "already-overridden-today"
  | "quest-not-found-override"
  | "already-swapped-this-week"
  | "weekday-from-not-scheduled"
  | "weekday-to-already-scheduled"
  | "no-banked-sessions"
  | "no-session-to-deposit"
  | "not-a-surplus-session"
  | "already-deposited";

export type ActionResult<T> =
  { ok: true; value: T } | { ok: false; error: ActionError };

/** Wording shown to the hunter. Keyed by the same union, so adding an
 * error without a message is a compile error rather than a blank screen. */
export const ACTION_ERROR_MESSAGE: Record<ActionError, string> = {
  unauthorized: "Your session has expired. Sign in again to keep training.",
  "invalid-input": "Those numbers don't look right. Check them and retry.",
  "program-day-not-found": "No program is registered for this gate.",
  "session-not-found": "That session no longer exists.",
  "session-already-completed": "This dungeon has already been cleared.",
  "hunter-not-found": "No Hunter has been registered yet.",
  "quest-not-found": "No quest has been issued for today yet.",
  "no-active-penalty": "There is no penalty to escape.",
  "survival-incomplete": "The Survival Quest is not finished yet.",
  "title-not-found": "That title does not exist.",
  "title-not-earned": "That title has not been earned yet.",
  "insufficient-gold": "Not enough gold for that yet.",
  "unknown-unlock": "The System has no record of that item.",
  "already-unlocked": "That is already unlocked.",
  "requirement-not-met": "You have not met the requirement for that yet.",
  "challenge-already-pending":
    "A challenge is already open. Finish it before buying another.",
  "floor-locked": "Clear the floor below this one first.",
  "hourglass-already-active": "Today is already under an Hourglass.",
  "hourglass-already-used-this-week":
    "The Hourglass has already been used this week.",
  "shadow-not-found": "No such shadow stands in your army.",
  "shadow-not-extracted": "That shadow has not been extracted yet.",
  "wager-not-monday": "A wager can only be placed on a Monday.",
  "wager-already-placed": "A wager is already open for this week.",
  "stake-too-large": "A stake may not exceed half the gold you hold.",
  "unknown-skill": "The System has no record of that skill.",
  "already-learned": "That skill is already learned.",
  "insufficient-ap": "Not enough Ability Points for that yet.",
  "not-learned": "That skill has not been learned yet.",
  "no-free-slot":
    "Every skill slot is full. Unequip one first, or buy a Rune Stone.",
  "slots-maxed": "Skill slots are already at the maximum.",
  "skill-not-equipped": "That skill is not equipped.",
  "already-overridden-today":
    "Today's Daily Quest has already been changed once.",
  "quest-not-found-override": "That is not a valid Daily Quest field.",
  "already-swapped-this-week": "This week's schedule has already been swapped.",
  "weekday-from-not-scheduled":
    "That day is not part of your current schedule.",
  "weekday-to-already-scheduled": "That day is already part of your schedule.",
  "no-banked-sessions": "There is no banked session to withdraw.",
  "no-session-to-deposit": "There is no completed session to deposit.",
  "not-a-surplus-session":
    "Only a session outside the regular schedule can be deposited.",
  "already-deposited": "That session has already been deposited.",
};
