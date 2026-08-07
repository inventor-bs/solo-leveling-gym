"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/infra/config/env";
import { getContainer } from "@/server/container";
import {
  checkPin,
  signSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/server/auth/session";

/**
 * Redirects here, server-side, rather than returning success and letting
 * the client decide where to go. The destination depends on whether a
 * hunter has been onboarded yet — only the server can answer that at the
 * moment the session cookie is set. Deciding it here means the client
 * never has to guess and correct itself.
 */
export async function loginAction(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const pin = formData.get("pin");
  if (typeof pin !== "string" || pin.length === 0) {
    return { ok: false };
  }

  if (!checkPin(pin, getEnv().HUNTER_PIN)) {
    return { ok: false };
  }

  const token = signSession(
    Date.now() + SESSION_TTL_MS,
    getEnv().SESSION_SECRET,
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });

  const hunter = await getContainer().hunters.get();
  redirect(hunter ? "/dashboard" : "/onboarding");
}
