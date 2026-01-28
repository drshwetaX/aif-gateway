import type { NextApiRequest, NextApiResponse } from "next";
import { getDecision, updateDecision, getAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

async function simulateExecute(target: string, action: string, payload: any) {
  return { simulated: true, target, action, received_payload: !!payload, result: "ok" };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { decision_id, payload } = req.body || {};
  if (!decision_id) return res.status(400).json({ error: "decision_id required" });

  const d = getDecision(String(decision_id));
  if (!d) return res.status(404).json({ error: "Unknown decision_id" });

  if (d.control_mode === "HITL" && d.status !== "APPROVED") {
    return res.status(403).json({ error: "Not approved yet (HITL)" });
  }

  const agent = d.agent_id ? getAgent(String(d.agent_id)) : null;
  if (agent) {
    if (agent.status === "killed") return res.status(403).json({ error: "Agent is killed" });
    if (agent.status === "paused") return res.status(403).json({ error: "Agent is paused" });
  }

  const result = await simulateExecute(String(d.target), String(d.action), payload);

  updateDecision(String(d.id), {
    status: "EXECUTED",
    executedAt: nowIso(),
    executedBy: user,
  });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/execute",
    decision: "ALLOW",
    reason: "executed_simulated",
    agentId: d.agent_id,
    decision_id: d.id,
    target: d.target,
    action: d.action,
    tier: d.tier,
    policy_version: d.policy_version,
    simulated: true,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
  });

  return res.status(200).json({ ok: true, simulated: true, result });
}
