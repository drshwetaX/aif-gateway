// lib/safety/redact.ts
// Minimal redaction helper for audit logs.
// Keep it conservative: remove secrets + obvious PII-like patterns.

const SECRET_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "token",
  "access_token",
  "refresh_token",
  "openai_api_key",
  "password",
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function redactString(s: string): string {
  // Basic patterns (tune as needed)
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const longToken = /\b[A-Za-z0-9_\-]{24,}\b/g; // catches many tokens/keys
  const bearer = /\bBearer\s+[A-Za-z0-9._\-]+\b/gi;

  return s
    .replace(bearer, "Bearer [REDACTED]")
    .replace(email, "[REDACTED_EMAIL]")
    .replace(longToken, (m) => (m.length >= 32 ? "[REDACTED_TOKEN]" : m));
}

function deepRedact(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string") return redactString(value);

  if (Array.isArray(value)) return value.map((v) => deepRedact(v, parentKey));

  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lk = k.toLowerCase();
      const shouldRedactKey =
        SECRET_KEYS.includes(lk) || SECRET_KEYS.some((sk) => lk.endsWith(sk));

      out[k] = shouldRedactKey ? "[REDACTED]" : deepRedact(v, k);
    }
    return out;
  }

  return value;
}

export function redactForAudit<T = unknown>(payload: T): T {
  return deepRedact(payload) as T;
}
