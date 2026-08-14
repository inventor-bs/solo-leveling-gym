import { ok, err, type Result } from "@/core/shared/result";
import { normalizeDashboardOrder } from "@/core/cosmetic/dashboard-order";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  DEFAULT_DASHBOARD_ORDER,
} from "@/core/cosmetic/catalog";
import type { Container } from "@/server/container";

export type SaveDashboardOrderResult = { order: string[] };

export type SaveDashboardOrderError =
  { type: "hunter-not-found" } | { type: "cosmetic-not-owned" };

/**
 * Stores a new Dashboard panel order.
 *
 * The same normalization that guards every read guards this write, so a
 * stored value can never be one a read would have to repair, and no client
 * can persist an unknown id or a hundred duplicates. Free and unlimited
 * once unlocked: charging per rearrangement would tax the hunter for using
 * the thing they just bought.
 */
export async function saveDashboardOrder(
  container: Container,
  order: string[],
): Promise<Result<SaveDashboardOrderResult, SaveDashboardOrderError>> {
  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  const unlocked = await container.store.isUnlocked(
    DASHBOARD_LAYOUT_UNLOCK_KEY,
  );
  if (!unlocked) return err({ type: "cosmetic-not-owned" });

  const normalized = normalizeDashboardOrder(
    JSON.stringify(order),
    DEFAULT_DASHBOARD_ORDER,
  );
  await container.hunters.update({
    dashboardOrder: JSON.stringify(normalized),
  });

  return ok({ order: normalized });
}
