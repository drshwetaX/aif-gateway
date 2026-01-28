/**
 * Edge-safe auth helpers (no Node crypto).
 * Decodes the session payload from "payload.sig" token and returns { email }.
 */

export type EdgeSession = {
  email: string;
  iat?: number;
  exp?: number;
};

const COOKIE_NAME = "aif_demo_session";

export function getCookieName() {
  return COOKIE_NAME;
}

// Keep same behavior as server-side demoAuth.ts
export function parseCsv(envVal?: string): string[] {
  return (envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function canonicalizeEmail(emailRaw: string): string {
  const email = (emailRaw || "").trim().toLowerCase();
  const [localRaw, domainRaw] = email.split("@");
  if (!localRaw || !domainRaw) return email;

  let local = localRaw;
  let domain = domainRaw;

  if (domain === "googlemail.com") domain = "gmail.com";

  if (domain === "gmail.com") {
    local = local.split("+")[0];
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

export function isEmailAllowed(emailRaw: string): boolean {
  const email = canonicalizeEmail(emailRaw);
  if (!email.includes("@")) return false;

  const allowedEmailsRaw = parseCsv(process.env.DEMO_ALLOWED_EMAILS);
  const allowedDomains = parseCsv(process.env.DEMO_ALLOWED_DOMAINS);

  const allowedEmails = allowedEmailsRaw.map(canonicalizeEmail);

  if (allowedEmails.includes(email)) return true;

  const domain = email.split("@")[1] || "";
  if (allowedDomains.includes(domain)) return true;

  return false;
}

export function isExpiredNow(): boolean {
  const expiresAt = process.env.DEMO_EXPIRES_AT;
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() > ts;
}

// ---- base64url decode for Edge ----
function b64urlToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;

  // atob is available in Edge runtime
  const decoded = atob(s);
  // Convert binary string to UTF-8 string
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Edge-safe session decode:
 * token format = "<payload_b64url>.<sig_b64url>"
 * We DO NOT verify signature in middleware; we just decode payload and check exp.
 */
export function tryDecodeSession(token: string): EdgeSession | null {
  try {
    const t = (token || "").trim();
    if (!t) return null;

    const parts = t.split(".");
    if (parts.length < 1) return null;

    const payload = parts[0];
    if (!payload) return null;

    const json = b64urlToString(payload);
    const obj = JSON.parse(json) as EdgeSession;

    if (!obj?.email) return null;

    // Optional exp check (keeps behavior consistent)
    if (obj.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= obj.exp) return null;
    }

    return { email: String(obj.email).trim().toLowerCase(), iat: obj.iat, exp: obj.exp };
  } catch {
    return null;
  }
}
