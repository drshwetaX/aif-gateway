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
