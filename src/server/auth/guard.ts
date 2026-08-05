import { cookies } from "next/headers";
import { getEnv } from "@/infra/config/env";
import { SESSION_COOKIE, verifySession } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("Cần PIN để ghi dữ liệu.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Gọi ở ĐẦU mọi server action có ghi dữ liệu.
 * Đọc dữ liệu là công khai — guard này chỉ chặn ghi.
 */
export async function requireWriteAccess(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || !verifySession(token, getEnv().SESSION_SECRET, Date.now())) {
    throw new UnauthorizedError();
  }
}

/** Đọc trạng thái đăng nhập để render UI. Không ném lỗi. */
export async function hasWriteAccess(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySession(token, getEnv().SESSION_SECRET, Date.now());
}
