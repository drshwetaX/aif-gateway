import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, updateAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = String(req.query.id || req.body?.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing agent id" });

  const a = await getAgent(id);
  if (!a) return res.status(404).json({ error: "Agent not found" });

  const updated = await updateAgent(id, {
    status: "killed",
    killed_at: nowIso(),
  });

  const status = updated?.status ?? a.status ?? "unknown";

  await writeAudit({
  ts: nowIso(),
  kind: "agent.kill",
  endpoint: "/api/agents/kill",
  decision: "allow",
  reason: "agent_killed",
  agentId: id,
  status,
});


  return res.status(200).json({ ok: true, agent_id: id, status });
}
