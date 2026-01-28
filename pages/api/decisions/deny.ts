/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Deny a decision (HITL).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getDecision, updateDecision } from "../../../lib/demoStore";
import { writeAudit } from "../../../lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { decision_id, reason } = req.body || {};
  const id = String(decision_id || "");

  if (!id) return res.status(400).json({ error: "decision_id required" });

  const d = getDecision(id);
  if (!d) return res.status(404).json({ error: "Decision not found" });

  const updated = updateDecision(id, {
    status: "DENIED",
    deniedAt: nowIso(),
    deniedBy: user,
    deniedReason: reason ? String(reason) : "Denied by reviewer",
  });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/decisions/deny",
    decision: "ALLOW",
    reason: "decision_denied",
    decision_id: updated.id,
    agentId: updated.agent_id,
    control_mode: updated.control_mode,
    action: updated.action,
    target: updated.target,
    tier: updated.tier,
    policy_version: updated.policy_version,
  });

  return res.status(200).json({ ok: true, decision: updated });
}
