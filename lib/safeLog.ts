/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Safe logging utilities — prevent storing secrets or personal data.
 */

import crypto from "crypto";

export function hashEmail(email: string) {
  const s = (email || "").toLowerCase().trim();
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}
// Backwards-compatible alias expected by some demo routes.
export function redact(input: any) {
  // If you already have a stronger redactor, call it here.
  // Keep this simple & safe: remove obvious secrets-ish fields.
  if (input == null) return input;

  try {
    const s = typeof input === "string" ? input : JSON.stringify(input);

    // lightweight redaction patterns
    return s
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .replace(/sk-[A-Za-z0-9]{10,}/g, "sk-[REDACTED]")
      .replace(/"apiKey"\s*:\s*"[^"]+"/gi, `"apiKey":"[REDACTED]"`)
      .replace(/"password"\s*:\s*"[^"]+"/gi, `"password":"[REDACTED]"`);
  } catch {
    return "[REDACTED]";
  }
}


/**
 * Redact payload: keep only high-level governance metadata for exec demo.
 * Never store raw "payload" contents from user/system.
 */
export function redactForAudit(input: any) {
  return {
    agent_id: input?.agent_id,
    client_id: input?.client_id,
    action: input?.action,
    target: input?.target,
    risk_tier: input?.risk_tier,
    control_mode: input?.control_mode,
    allowed: input?.allowed,
    decision_id: input?.decision_id,
    status: input?.status,
    reason: input?.reason,
    obligations: input?.obligations,
  };
}
