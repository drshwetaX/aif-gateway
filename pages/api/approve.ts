import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, updateDecision } from "@/lib/demoStore";
import { loadAuraPolicy } from "@/lib/policy/loadPolicy";
import { buildIntent } from "@/lib/policy/intent";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

function newDecisionId() {
  return `dec_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

type ControlMode = "AUTO" | "HOTL" | "HITL";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { agent_id, action, target, payload } = req.body || {};

  if (!agent_id || !action || !target) return res.status(400).json({ error: "agent_id, action, target required" });

  const agent = getAgent(String(agent_id));
  if (!agent) return res.status(404).json({ error: "Unknown agent_id" });

  if (agent.status === "killed") return res.status(403).json({ error: "Agent is killed" });
  if (agent.status === "paused") return res.status(403).json({ error: "Agent is paused" });
  if (agent.approved === false || agent.status === "requested") return res.status(403).json({ error: "Agent not approved (design-time gate)" });

  const pack = loadAuraPolicy();

  const intent = buildIntent({
    actions: [String(action)],
    systems: [String(target)],
    ...(req.body || {}),
  });

  const restricted = pack?.mappings?.actions?.restricted_actions?.includes(String(action));
  const writeAction = pack?.mappings?.actions?.write_actions?.includes(String(action));
  const approvalRequired = !!agent.controls?.approvalRequired;

  const control_mode: ControlMode =
    approvalRequired || restricted ? "HITL" : writeAction ? "HOTL" : "AUTO";

  const allowed = control_mode !== "HITL";

  const decision_id = newDecisionId();
  const decision = updateDecision(decision_id, {
    id: decision_id,
    createdAt: nowIso(),
    status: allowed ? "APPROVED" : "PENDING",
    agent_id: agent.id,
    externalAgentId: agent.externalAgentId,
    action: String(action),
    target: String(target),
    tier: agent.tier,
    controls: agent.controls,
    control_mode,
    allowed,
    reason: allowed ? "Allowed by policy (AUTO/HOTL)" : "Requires human approval (HITL)",
    policy_version: agent.policy_version,
    payload_preview: payload ? { has_payload: true } : { has_payload: false },
  });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/approve",
    decision: allowed ? "ALLOW" : "DENY",
    reason: allowed ? "approve_gate_auto_or_hotl" : "approve_gate_hitl",
    agentId: agent.id,
    decision_id: decision.id,
    intent,
    tier: agent.tier,
    controls: agent.controls,
    control_mode,
  });

  return res.status(200).json({
    decision_id: decision.id,
    allowed,
    control_mode,
    reason: decision.reason,
    policy_version: decision.policy_version,
    status: decision.status,
    next: allowed ? { type: "execute" } : { type: "request_human_approval" },
  });
}
