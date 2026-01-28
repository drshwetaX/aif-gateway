/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Design-time approval (onboarding).
 * Moves agent from requested → active and marks approved=true.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, updateAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { agent_id, notes } = req.body || {};
  const id = String(agent_id || "");

  if (!id) return res.status(400).json({ error: "agent_id required" });

  const existing = getAgent(id);
  if (!existing) return res.status(404).json({ error: "Agent not found" });

  if (existing.status === "killed") return res.status(403).json({ error: "Agent is killed" });

  const updated = updateAgent(id, {
    approved: true,
    status: "active",
    review: {
      decision: "APPROVED",
      decidedAt: nowIso(),
      decidedBy: user,
      notes: notes ? String(notes) : undefined,
    },
  });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/agents/approve",
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
    agent_id: updated.id,
    status: updated.status,
    approved: updated.approved,
    review: updated.review,
  });
}
