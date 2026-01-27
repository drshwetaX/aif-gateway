/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Redact payloads before logging (no secrets or personal data stored).
 */
export function redactForAudit(obj: any) {
  return {
    agent_id: obj?.agent_id,
    decision_id: obj?.decision_id,
    action: obj?.action,
    target: obj?.target,
    tier: obj?.tier,
    control_mode: obj?.control_mode,
    allowed: obj?.allowed,
    policy_version: obj?.policy_version,
    matched_rules: obj?.matched_rules,
    reason: obj?.reason,
  };
}
