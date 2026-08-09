import { NextResponse } from "next/server";
import { getEnv } from "@/infra/config/env";
import { secretsMatch } from "@/server/auth/session";
import { getContainer } from "@/server/container";
import { runGraceReset } from "@/app-services/daily-reset-grace";

export const dynamic = "force-dynamic";

/**
 * Invoked by Vercel Cron at 21:00 UTC — 04:00 in the hunter's timezone.
 *
 * This is the second half of the Hourglass of Grace: the 00:00 reset leaves
 * a purchased day unjudged, and this decides it four hours later. On a day
 * with no grace row it finds nothing to do and returns an empty verdict,
 * which is the normal case.
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

  const summary = await runGraceReset(getContainer());
  return NextResponse.json(summary);
}
