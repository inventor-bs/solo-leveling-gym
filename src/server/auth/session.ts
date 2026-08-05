import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sl_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Token shaped as "<expiresAt>.<hmac>". */
export function signSession(expiresAt: number, secret: string): string {
  return `${expiresAt}.${hmac(String(expiresAt), secret)}`;
}

export function verifySession(
  token: string,
  secret: string,
  now: number,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;

  // Verify the signature BEFORE trusting expiresAt.
  if (!safeEqualHex(signature, hmac(expiresAtRaw, secret))) return false;

  return now < expiresAt;
}

/** Compares a PIN in constant time so matched length is never leaked. */
export function checkPin(input: string, expected: string): boolean {
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
