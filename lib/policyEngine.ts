/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Demo policy engine (AURA-style) that selects risk tier + control mode + obligations.
 *          Replace rules later with real enterprise policy sources.
 */

export type PolicyInput = {
  action: string;
  target: string;
  environment: "demo";
  agent_tier?: "L1" | "L2" | "L3" | "L4"; // optional demo dimension
  data_sensitivity?: "public" | "internal" | "confidential"; // optional demo dimension
};

export type PolicyOutput = {
  risk_tier: "low" | "medium" | "high";
  control_mode: "AUTO" | "HITL" | "HOTL";
  allowed: boolean;
  reason: string;
  obligations: string[];
};

export function evaluatePolicy(input: PolicyInput): PolicyOutput {
  const a = (input.action || "").toLowerCase();
  const t = (input.target || "").toLowerCase();

  const obligations: string[] = ["AUDIT_LOG", "NO_RAW_PAYLOAD_STORAGE"];

  // Demo risk heuristics
  const isDestructive = /(delete|terminate|kill|remove)/i.test(a);
  const isFinancial = /(payout|payment|refund|wire|transfer)/i.test(a);
  const isPII = input.data_sensitivity === "confidential";

  const high = isDestructive || isFinancial || isPII;
  const medium = /(update|change|escalate|close)/i.test(a) || /(salesforce|servicenow)/i.test(t);

  if (high) {
    obligations.push("DUAL_CONTROL_OPTIONAL", "APPROVAL_REQUIRED");
    return {
      risk_tier: "high",
      control_mode: "HITL",
      allowed: false,
      reason: "High-risk action requires Human-In-The-Loop approval (HITL).",
      obligations,
    };
  }

  if (medium) {
    obligations.push("POST_ACTION_REVIEW");
    return {
      risk_tier: "medium",
      control_mode: "HOTL",
      allowed: true,
      reason: "Medium-risk action allowed with Human-On-The-Loop review (HOTL).",
      obligations,
    };
  }

  return {
    risk_tier: "low",
    control_mode: "AUTO",
    allowed: true,
    reason: "Low-risk action allowed automatically (AUTO).",
    obligations,
  };
}
