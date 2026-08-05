import { cookies } from "next/headers";
import { getEnv } from "@/infra/config/env";
import { SESSION_COOKIE, verifySession } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("A PIN is required to write data.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Call this at the START of every server action that writes data.
 * Reads are public — this guard only blocks writes.
 */
export async function requireWriteAccess(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || !verifySession(token, getEnv().SESSION_SECRET, Date.now())) {
    throw new UnauthorizedError();
  }
}

/** Reads login state for UI rendering. Never throws. */
export async function hasWriteAccess(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySession(token, getEnv().SESSION_SECRET, Date.now());
}
