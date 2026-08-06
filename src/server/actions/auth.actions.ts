"use server";

import { cookies } from "next/headers";
import { getEnv } from "@/infra/config/env";
import {
  checkPin,
  signSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/server/auth/session";

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
  return { ok: true };
}
