/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Run-time governance gate. Returns AUTO/HITL/HOTL and a decision_id.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent } from "../../lib/registry/agentRegistry";
import { createDecision } from "../../lib/decisions/decisionStore";
import { hashIdentity } from "../../lib/safety/hash";
import { evalTierFromRules } from "../../lib/policy/tierRules";
import { loadAuraPolicy } from "../../lib/policy/auraPolicyLoader";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const requester_hash = hashIdentity(user);

  const { agent_id, action, target, payload } = req.body || {};
  if (!agent_id || !action || !target) return res.status(400).json({ error: "agent_id, action, target required" });

  const agent = await getAgent(String(agent_id));
  if (!agent) return res.status(404).json({ error: "Unknown agent_id" });
  if (agent.status === "KILLED") return res.status(403).json({ error: "Agent is killed" });
  if (agent.status === "PAUSED") return res.status(403).json({ error: "Agent is paused" });

  const pack = loadAuraPolicy();

  // Determine control mode based on tier + action type
  // Demo policy:
  // - approvalRequired OR restricted actions => HITL
  // - write actions => HOTL unless approvalRequired
  const isRestricted = pack.mappings?.actions?.restricted_actions?.includes(String(action));
  const isWrite = pack.mappings?.actions?.write_actions?.includes(String(action));

  const approvalRequired = !!agent.controls?.approvalRequired;
  const control_mode = (approvalRequired || isRestricted) ? "HITL" : (isWrite ? "HOTL" : "AUTO");
  const allowed = control_mode !== "HITL";

  const decision = await createDecision({
    agent_id: agent.agent_id,
    requester_hash,
    action: String(action),
    target: String(target),
    tier: agent.tier,
    control_mode,
    allowed,
    reason: allowed ? "Allowed by policy (AUTO/HOTL)" : "Requires human approval (HITL)",
    policy_version: agent.policy_version,
    matched_rules: [], // optional: you can store matched rules from register step; kept minimal here
  });

  return res.status(200).json({
    decision_id: decision.decision_id,
    allowed,
    control_mode,
    reason: decision.reason,
    policy_version: decision.policy_version,
    status: decision.status,
    next: allowed ? { type: "execute" } : { type: "request_human_approval" },
  });
}
