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
  | "stake-too-large";

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
};
