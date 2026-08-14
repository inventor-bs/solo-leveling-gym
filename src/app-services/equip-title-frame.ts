import { ok, err, type Result } from "@/core/shared/result";
import { isTitleFrameId, titleFrameKey } from "@/core/cosmetic/catalog";
import type { Container } from "@/server/container";

export type EquipTitleFrameResult = { titleFrame: string | null };

export type EquipTitleFrameError =
  | { type: "hunter-not-found" }
  | { type: "unknown-cosmetic" }
  | { type: "cosmetic-not-owned" };

/**
 * Chooses the decoration drawn around the worn title, or removes it.
 *
 * Wearing a frame while wearing no title is deliberately allowed: the
 * frame is an attribute of how a title is displayed, so with no title
 * there is simply nothing on screen yet. Refusing it would be a rule the
 * hunter has to discover by being blocked, which is worse than a frame
 * that quietly waits for a title to decorate.
 */
export async function equipTitleFrame(
  container: Container,
  frameId: string | null,
): Promise<Result<EquipTitleFrameResult, EquipTitleFrameError>> {
  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  if (frameId === null) {
    await container.hunters.update({ titleFrame: null });
    return ok({ titleFrame: null });
  }

  if (!isTitleFrameId(frameId)) return err({ type: "unknown-cosmetic" });

  const owned = await container.store.isUnlocked(titleFrameKey(frameId));
  if (!owned) return err({ type: "cosmetic-not-owned" });

  await container.hunters.update({ titleFrame: frameId });
  return ok({ titleFrame: frameId });
}
