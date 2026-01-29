import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, updateAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const id = String(req.query.id || req.body?.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing agent id" });

  const existing = await getAgent(id);
  if (!existing) return res.status(404).json({ error: "Agent not found" });

  if (existing.status === "killed") {
    return res.status(403).json({ error: "Agent is killed" });
  }

  const updated = await updateAgent(id, {
    approved: true,
    status: "approved",
    approved_at: nowIso(),
    review: { decision: "APPROVE", decidedAt: nowIso(), decidedBy: user },
  });

  if (!updated) return res.status(404).json({ error: "Agent not found" });

  await writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/approve",
    decision: "ALLOW",
    reason: "agent_approved",
    agentId: id,
    status: updated.status,
    approved: updated.approved,
    tier: updated.tier,
    controls: updated.controls,
  });

  return res.status(200).json({
    ok: true,
    agent_id: id,
    status: updated.status,
    approved: updated.approved,
    tier: updated.tier,
    controls: updated.controls,
  });
}
