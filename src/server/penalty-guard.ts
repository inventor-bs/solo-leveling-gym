import { redirect } from "next/navigation";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";

/** Owner-only redirect into the Penalty Zone. Visitors are never redirected. */
export async function redirectOwnerIfPenalised(): Promise<void> {
  const active = await getContainer().penalties.active();
  if (!active) return;
  if (await hasWriteAccess()) redirect("/penalty");
}
