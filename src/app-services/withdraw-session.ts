import { ok, err, type Result } from "@/core/shared/result";
import type { Container } from "@/server/container";

export type WithdrawSessionResult = { pendingCredits: number };

export type WithdrawSessionError =
  { type: "skill-not-equipped" } | { type: "no-banked-sessions" };

/**
 * Shadow Storage's second half: moves one banked surplus session into a
 * pending credit. The credit itself is spent automatically at the next
 * startSession call rather than here — withdrawing only makes the credit
 * available, it does not apply it to anything yet.
 */
export async function withdrawSession(
  container: Container,
): Promise<Result<WithdrawSessionResult, WithdrawSessionError>> {
  const equippedSkills = new Set(await container.skills.equippedIds());
  if (!equippedSkills.has("shadow-storage")) {
    return err({ type: "skill-not-equipped" });
  }

  const bank = await container.skills.bank();
  if (bank.bankedSessions <= 0) return err({ type: "no-banked-sessions" });

  await container.skills.withdraw();
  const updated = await container.skills.bank();
  return ok({ pendingCredits: updated.pendingCredits });
}
