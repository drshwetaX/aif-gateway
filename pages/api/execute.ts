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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { decision_id, payload } = req.body || {};
  const id = String(decision_id || "").trim();

  if (!id) return res.status(400).json({ error: "decision_id required" });

  const d = await getDecision(id);
  if (!d) return res.status(404).json({ error: "Unknown decision_id" });

  // HITL gate: must be approved before execution
  if (d.control_mode === "HITL" && d.status !== "APPROVED") {
    return res.status(403).json({ error: "Not approved yet (HITL)", status: d.status });
  }

  // Agent lifecycle gate (if decision is linked to an agent)
  let agent: any = null;
  if (d.agent_id) {
    agent = await getAgent(String(d.agent_id));
    if (agent) {
      if (agent.status === "killed") return res.status(403).json({ error: "Agent is killed" });
      if (agent.status === "paused") return res.status(403).json({ error: "Agent is paused" });
    }
  }

  const target = String(d.target || "");
  const action = String(d.action || "");
  if (!target || !action) {
    return res.status(400).json({ error: "Decision missing target/action", target, action });
  }

  const result = await simulateExecute(target, action, payload);

  const updated = await updateDecision(String(d.id), {
    status: "EXECUTED",
    executed_at: nowIso(),
    executed_by: user,
    simulated: true,
  });

  await writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/execute",
    decision: "ALLOW",
    reason: "executed_simulated",
    agentId: updated.agent_id,
    decision_id: updated.id,
    target: updated.target,
    action: updated.action,
    tier: updated.tier,
    policy_version: updated.policy_version,
    simulated: true,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    status: updated.status,
  } as any);

  return res.status(200).json({ ok: true, simulated: true, result });
}
