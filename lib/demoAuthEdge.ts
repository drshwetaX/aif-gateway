// lib/demoAuthEdge.ts
// Edge-safe demo auth helpers (NO node:crypto)

export type Session = {
  email: string;
  iat: number; // unix seconds
  exp: number; // unix seconds
};

const COOKIE_NAME = "aif_demo_session";

export function getCookieName() {
  return COOKIE_NAME;
}

function parseCsv(envVal?: string): string[] {
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

// Back-compat name used by routes
export const isExpiredNow = isDemoExpiredNow;

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

// OPTIONAL: decode session payload WITHOUT verifying signature (Edge-safe).
// Token format: "<base64url(json)>.<sig>"
export function tryDecodeSession(token: string): Session | null {
  try {
    const [payload] = (token || "").split(".");
    if (!payload) return null;

    // base64url -> base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);

    const obj = JSON.parse(json) as Session;
    if (!obj?.email || !obj?.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    if (now >= obj.exp) return null;

    return obj;
  } catch {
    return null;
  }
}
