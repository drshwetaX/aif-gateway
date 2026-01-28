/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Design-time governance endpoint.
 * Accepts agent intent metadata (or problem_statement as a fallback),
 * assigns tier & controls using the SAME runtime policy pack as /api/run,
 * registers agent in demo registry + writes audit.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { buildIntent } from "@/lib/policy/intent";
import { resolveTier, controlsForTier, type Tier, type AgentIntent } from "@/lib/policy/policyEngine";
import { loadAuraPolicy } from "@/lib/policy/loadPolicy";
import { updateAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

function newAgentId(externalAgentId?: string) {
  // If Foundry gives you an ID, keep it stable for registry mapping
  if (externalAgentId && String(externalAgentId).trim()) return `foundry_${String(externalAgentId).trim()}`;
  return `agent_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * Optional: if caller only sends a free-text problem_statement,
 * we derive a conservative intent. (Better: send actions/systems explicitly.)
 */
function intentFromProblemStatement(problem_statement: string): AgentIntent {
  const text = (problem_statement || "").toLowerCase();

  // super conservative defaults
  const intent: AgentIntent = {
    actions: ["retrieve"],
    systems: ["kb"],
    dataSensitivity: "INTERNAL",
    crossBorder: false,
  };

  // crude signals (keeps demo moving without LLM)
  if (/\b(update|write|create|submit|change|delete|approve|send)\b/.test(text)) {
    intent.actions = ["update_record"];
    intent.systems = ["salesforce"];
  }
  if (/\b(workday|hr|employee|onboarding)\b/.test(text)) {
    intent.systems = ["workday"];
  }
  if (/\b(pii|sin|ssn|passport|medical|claim|benefit)\b/.test(text)) {
    intent.dataSensitivity = "PII";
  }
  if (/\b(cross[- ]border|international|outside canada|eu|uk|us)\b/.test(text)) {
    intent.crossBorder = true;
  }

  return intent;
}

/**
 * Explain which tiering rules matched (useful for exec demos).
 * Works with your runtime policy pack: policy.tiering.rules[].
 */
function explainTiering(intent: AgentIntent, finalTier: Tier) {
  const policy = loadAuraPolicy();
  const rules = (policy.tiering?.rules ?? []) as any[];

  const matched: Array<{ ruleId: string; thenTier: string; reason: string }> = [];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const cond = r?.if ?? {};

    const actionsAny = cond.actionsAny as string[] | undefined;
    const actionsOnly = cond.actionsOnly as string[] | undefined;
    const systemsAny = cond.systemsAny as string[] | undefined;
    const dataSensitivityIn = cond.dataSensitivityIn as string[] | undefined;
    const crossBorder = cond.crossBorder as boolean | undefined;

    const ok =
      (actionsAny ? actionsAny.some((a) => intent.actions.includes(a)) : true) &&
      (actionsOnly ? intent.actions.length > 0 && intent.actions.every((a) => actionsOnly.includes(a)) : true) &&
      (systemsAny ? systemsAny.some((s) => intent.systems.includes(s)) : true) &&
      (dataSensitivityIn ? dataSensitivityIn.includes(intent.dataSensitivity ?? "") : true) &&
      (crossBorder !== undefined ? crossBorder === !!intent.crossBorder : true);

    if (!ok) continue;

    const rid = String(r?.id ?? `rule_${i}`);
    matched.push({
      ruleId: rid,
      thenTier: String(r?.thenTier ?? ""),
      reason: JSON.stringify(r?.if ?? {}),
    });
  }

  return {
    finalTier,
    matched_rule_ids: matched.map((m) => m.ruleId),
    matched_rules: matched,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const body = req.body || {};

  // Inputs you may get from Foundry/tool callers
  const name = String(body.name || "Demo Agent");
  const externalAgentId = body.externalAgentId ? String(body.externalAgentId) : undefined;
  const overrideTier = body.override_tier ? String(body.override_tier) : undefined;
  const problemStatement = body.problem_statement ? String(body.problem_statement) : "";

  // Prefer explicit intent (actions/systems/...) if provided
  let intent = buildIntent(body);

  // If caller didn't pass actions/systems, derive from problem statement
  if ((!intent.actions || intent.actions.length === 0) && problemStatement) {
    intent = intentFromProblemStatement(problemStatement);
  }

  // Safety: if still empty, default to conservative
  if (!Array.isArray(intent.actions) || intent.actions.length === 0) intent.actions = ["retrieve"];
  if (!Array.isArray(intent.systems) || intent.systems.length === 0) intent.systems = ["kb"];

  // Compute tier/controls from the SAME engine used at runtime
  let tier = resolveTier(intent);
  if (overrideTier && ["A1", "A2", "A3", "A4", "A5", "A6"].includes(overrideTier)) {
    tier = overrideTier as Tier;
  }
  const controls = controlsForTier(tier);

  // Simple demo tool allowlist mapping
  const allowed_tools =
    tier === "A1" || tier === "A2" ? ["read_only"] : ["read_only", "write_via_gateway"];

  const agentId = newAgentId(externalAgentId);

  // Register in local demo registry
  const agent = updateAgent(agentId, {
    id: agentId,
    externalAgentId,
    name,
    owner: user,
    status: "active",
    createdAt: nowIso(),
    problem_statement: problemStatement,
    intent,
    tier,
    controls,
    allowed_tools,
    policy_version: loadAuraPolicy()?.version ?? "unknown",
  });

  // Audit
  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/agents/register",
    decision: "ALLOW",
    reason: "agent_registered",
    agentId,
    externalAgentId,
    tier,
    controls,
    intent,
  });

  // Explain (for execs)
  const tiering_explain = explainTiering(intent, tier);

  return res.status(200).json({
    ok: true,
    agent_id: agent.id,
    status: agent.status,
    risk_tier: agent.tier,
    controls: agent.controls,
    allowed_tools: agent.allowed_tools,
    policy_version: agent.policy_version,
    tiering_explain,
  });
}
