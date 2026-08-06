import { NextResponse } from "next/server";
import { getEnv } from "@/infra/config/env";
import { secretsMatch } from "@/server/auth/session";
import { getContainer } from "@/server/container";
import { runDailyReset } from "@/app-services/daily-reset";

export const dynamic = "force-dynamic";

/**
 * Invoked by Vercel Cron at 17:00 UTC — 00:00 in the hunter's timezone.
 *
 * Hobby crons fire once a day and may be delayed by up to an hour, so this
 * is not the only thing that issues a quest: every read of the Quests page
 * calls the same idempotent ensure. What only happens here is judging the
 * day that just ended.
 */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runDailyReset(getContainer());
  return NextResponse.json(summary);
}
