/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Notify / enqueue human approval request (demo outbox).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { isExpiredNow, isEmailAllowed } from "../../../lib/demoAuth";
import { getDecision, pushOutbox, updateDecision } from "../../../lib/demoStore";
import { writeAudit } from "../../../lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Demo window expired?
  if (isExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const { decision_id } = req.body || {};
  const id = String(decision_id || "");
  if (!id) return res.status(400).json({ error: "decision_id required" });

  const d = await getDecision(id);
  if (!d) return res.status(404).json({ error: "Decision not found" });
  
  if (d.status !== "PENDING") {


  // For demo: notify only makes sense if decision is still pending
  if (d.status !== "PENDING") {
    return res.status(400).json({ error: "Decision is not pending", status: d.status });
  }

  // Optional: allowlist check (if notify is used by “approvers”)
  // If you want notify to be callable by anyone, remove this block.
  if (!isEmailAllowed(user)) {
    return res.status(403).json({ error: "Email not allowlisted" });
  }

  const token = newToken();

  // Save token + notified timestamp on the decision (minimal)
  const updated = updateDecision(id, {
    notify_token: token,
    notifiedAt: nowIso(),
  });

  // Push to outbox (demo email queue / Teams queue / etc.)
  await pushOutbox({
  id: `out_${updated.id}_${Date.now()}`,
  ts: nowIso(),

  type: "decision_notify",
  decision_id: updated.id,
  agent_id: updated.agent_id,
  action: updated.action,
  target: updated.target,
  tier: updated.tier,
  control_mode: updated.control_mode,
  status: updated.status,
  notify_token,
});


  // Unified audit
  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/decisions/notify",
    decision: "ALLOW",
    reason: "decision_notify_enqueued",
    decision_id: updated.id,
    agentId: updated.agent_id,
    control_mode: updated.control_mode,
    action: updated.action,
    target: updated.target,
    tier: updated.tier,
    policy_version: updated.policy_version,
  });

  return res.status(200).json({
    ok: true,
    decision_id: updated.id,
    status: updated.status,
    enqueued: true,
  });
}
