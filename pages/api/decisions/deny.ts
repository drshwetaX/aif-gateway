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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { decision_id, notes } = req.body || {};
  const id = String(decision_id || "").trim();

  if (!id) return res.status(400).json({ error: "decision_id required" });

  const d = await getDecision(id);
  if (!d) return res.status(404).json({ error: "Decision not found" });

  const updated = await updateDecision(id, {
    status: "DENIED",
    denied_at: nowIso(),
    denied_by: user,
    denied_notes: notes ? String(notes) : undefined,
    decision: "DENY",
  });

  await writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/decisions/deny",
    decision: "DENY",
    reason: "decision_denied",
    decision_id: updated.id,
    agentId: updated.agent_id,
    control_mode: updated.control_mode,
    action: updated.action,
    target: updated.target,
    tier: updated.tier,
    policy_version: updated.policy_version,
  } as any);

  return res.status(200).json({ ok: true, decision: updated });
}
