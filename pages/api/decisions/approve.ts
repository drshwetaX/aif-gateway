/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Approver endpoint (HITL): validates token + marks decision approved.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getDecision, updateDecision, appendAudit } from "../../../lib/demoStore";
import { hashEmail, redact } from "../../../lib/safeLog";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { decision_id, token } = req.body || {};
  const did = String(decision_id || "");
  const tok = String(token || "");

  const d = getDecision(did);
  if (!d) return res.status(404).json({ error: "Decision not found" });
  if (d.control_mode !== "HITL") return res.status(400).json({ error: "Not a HITL decision" });
  if (d.status !== "pending") return res.status(400).json({ error: `Decision already ${d.status}` });

  if (!d.approval_token || tok !== d.approval_token) return res.status(403).json({ error: "Invalid token" });
  if (!d.token_expires_at || Date.now() > d.token_expires_at) return res.status(403).json({ error: "Token expired" });

  // single-use token
  updateDecision(did, { status: "approved", allowed: true, approval_token: undefined, token_expires_at: undefined });

  appendAudit({
    ts: Date.now(),
    type: "hitl_approved",
    user_hash: hashEmail(String(req.headers["x-demo-user"] || "")),
    data: redact({ decision_id: did, allowed: true }),
  });

  return res.status(200).json({ ok: true, decision_id: did, status: "approved" });
}
