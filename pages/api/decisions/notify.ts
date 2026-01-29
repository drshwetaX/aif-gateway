/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Notify reviewers about a pending decision (HITL).
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const body = req.body || {};

  const decision_id = String(body.decision_id || "").trim();
  const to = body.to ? String(body.to).trim() : "";
  const expires_at = body.expires_at ? String(body.expires_at).trim() : ""; // stored as metadata only

  if (!decision_id) return res.status(400).json({ error: "decision_id required" });
  if (!to) return res.status(400).json({ error: "to required" });

  // DemoAuth expiry check (no-arg in your codebase)
  if (isExpiredNow()) {
    return res.status(400).json({ error: "Demo expired" });
  }

  // Enforce allowlist (demo safety)
  if (!isEmailAllowed(to)) {
    return res.status(403).json({ error: "Recipient email is not allowlisted", to });
  }

  const d = await getDecision(decision_id);
  if (!d) return res.status(404).json({ error: "Decision not found" });

  // For demo: notify only makes sense if still pending
  if (d.status !== "PENDING") {
    return res.status(400).json({ error: "Decision is not pending", status: d.status });
  }

  const notify_token = newToken();

  // Persist notify metadata onto the decision (optional but useful)
  const updated = await updateDecision(decision_id, {
    status: d.status ?? "PENDING",
    notify_to: to,
    notify_token,
    notified_at: nowIso(),
    notified_by: user,
    notify_expires_at: expires_at || undefined,
  });

  // Push to outbox (demo email queue / Teams queue / etc.)
  await pushOutbox({
    id: `out_${updated.id}_${Date.now()}`,
    ts: nowIso(),

    type: "decision_notify",
    to,
    channel: "email",
    subject: "Decision pending approval",
    body: `A decision is pending approval.\nDecision ID: ${updated.id}\nToken: ${notify_token}`,

    decision_id: updated.id,
    agent_id: updated.agent_id,
    action: updated.action,
    target: updated.target,
    tier: updated.tier,
    control_mode: updated.control_mode,
    status: updated.status,
    notify_token,
  });

  await writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/decisions/notify",
    decision: "ALLOW",
    reason: "decision_notified",
    decision_id: updated.id,
    agentId: updated.agent_id,
    control_mode: updated.control_mode,
    action: updated.action,
    target: updated.target,
    tier: updated.tier,
    policy_version: updated.policy_version,
    status: updated.status,
    to,
  } as any);

  return res.status(200).json({
    ok: true,
    decision_id: updated.id,
    notified: true,
    to,
  });
}
