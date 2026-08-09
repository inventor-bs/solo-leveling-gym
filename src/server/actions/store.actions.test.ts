import { describe, it, expect } from "vitest";
import { ACTION_ERROR_MESSAGE, type ActionError } from "./action-result";

describe("ACTION_ERROR_MESSAGE", () => {
  it("carries a message for every economy failure the store can produce", () => {
    const economyErrors: ActionError[] = [
      "insufficient-gold",
      "unknown-unlock",
      "already-unlocked",
      "requirement-not-met",
      "challenge-already-pending",
      "floor-locked",
      "hourglass-already-active",
      "hourglass-already-used-this-week",
      "shadow-not-found",
      "shadow-not-extracted",
      "wager-not-monday",
      "wager-already-placed",
      "stake-too-large",
    ];
    for (const error of economyErrors) {
      expect(ACTION_ERROR_MESSAGE[error]).toBeTruthy();
    }
  });

  it("never leaves a message blank, so no failure can render as an empty panel", () => {
    for (const [key, message] of Object.entries(ACTION_ERROR_MESSAGE)) {
      expect(message.length, key).toBeGreaterThan(0);
    }
  });

  it("writes every message in English, matching the rest of the app", () => {
    for (const message of Object.values(ACTION_ERROR_MESSAGE)) {
      expect(message).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});
