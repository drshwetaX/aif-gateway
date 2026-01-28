import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, updateAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { agent_id } = req.body || {};
  const id = String(agent_id || "");

  const existing = getAgent(id);
  if (!existing) return res.status(404).json({ error: "Agent not found" });

  const a = updateAgent(id, { status: "killed", killedAt: nowIso() });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/agents/kill",
    decision: "ALLOW",
    reason: "agent_killed",
    agentId: id,
    status: a.status,
  });

  return res.status(200).json({ ok: true, agent_id: id, status: a.status });
}
