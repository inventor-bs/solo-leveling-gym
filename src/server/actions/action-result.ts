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
  | "title-not-earned";

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
};
