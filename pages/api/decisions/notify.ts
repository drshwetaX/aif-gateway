/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Demo-safe "email notify": collects approver/reviewer email,
 * generates a link (approve/deny or review), and stores it in an outbox.
 *
 * NOTE: This does NOT send real email (safe for public demo).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { isExpiredNow, isEmailAllowed } from "../../../lib/demoAuth";
import { getDecision, pushOutbox, updateDecision, appendAudit } from "../../../lib/demoStore";
import { hashEmail, redact } from "../../../lib/safeLog";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const { decision_id, approver_email } = req.body || {};
  const did = String(decision_id || "");
  const approver = String(approver_email || "").trim().toLowerCase();

  // Prevent abuse: only allow allowlisted emails/domains
  if (!isEmailAllowed(approver)) return res.status(403).json({ error: "Approver email not allowlisted" });

  const d = getDecision(did);
  if (!d) return res.status(404).json({ error: "Decision not found" });

  const token = crypto.randomBytes(20).toString("hex");
  const tokenExp = Date.now() + 15 * 60 * 1000; // 15 minutes

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  // For local dev, base may be empty; UI can render relative links too.
  const approveLink = `${base}/approvals?decision_id=${encodeURIComponent(did)}&token=${encodeURIComponent(token)}`;

  updateDecision(did, {
    approver_hash: hashEmail(approver),
    approval_token: token,
    token_expires_at: tokenExp,
  });

  // Outbox item for demo UI
  pushOutbox({
    ts: Date.now(),
    to_hash: hashEmail(approver),
    kind: d.control_mode === "HITL" ? "HITL_APPROVAL" : "HOTL_REVIEW",
    decision_id: did,
    link: approveLink,
  });

  appendAudit({
    ts: Date.now(),
    type: "notify_outbox",
    user_hash: hashEmail(String(req.headers["x-demo-user"] || "")),
    data: redact({ decision_id: did, control_mode: d.control_mode }),
  });

  return res.status(200).json({
    ok: true,
    decision_id: did,
    outbox_link: approveLink,
    note: "Demo-safe notify: link stored in outbox (no real email sent).",
  });
}
