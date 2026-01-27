/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Demo-safe authentication + allowlist enforcement + signed session cookies.
 */

import crypto from "crypto";

export type Session = {
  email: string;
  iat: number; // unix seconds
  exp: number; // unix seconds
};

const COOKIE_NAME = "aif_demo_session";

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBuf(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64");
}

function hmac(data: string, secret: string) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function parseCsv(envVal?: string): string[] {
  return (envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isDemoExpiredNow(): boolean {
  const expiresAt = process.env.DEMO_EXPIRES_AT;
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() > ts;
}

export function isEmailAllowed(emailRaw: string): boolean {
  const email = (emailRaw || "").trim().toLowerCase();
  if (!email.includes("@")) return false;

  const allowedEmails = parseCsv(process.env.DEMO_ALLOWED_EMAILS);
  const allowedDomains = parseCsv(process.env.DEMO_ALLOWED_DOMAINS);

  if (allowedEmails.includes(email)) return true;

  const domain = email.split("@")[1] || "";
  if (allowedDomains.includes(domain)) return true;

  return false;
}

export function signSession(session: Session, secret: string): string {
  const payload = b64url(JSON.stringify(session));
  const sig = hmac(payload, secret);
  return `${payload}.${sig}`;
}

export function verifySession(token: string, secret: string): Session | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expected = hmac(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const obj = JSON.parse(b64urlToBuf(payload).toString("utf8")) as Session;
    if (!obj?.email || !obj?.exp) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now >= obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

export function cookieSerialize(name: string, value: string, maxAgeSec: number) {
  return [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`,
    `Max-Age=${maxAgeSec}`,
  ].join("; ");
}

export function clearCookieHeader(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}
