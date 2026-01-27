/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Runtime governance gate: approve/deny/HITL/HOTL/AUTO decision creation.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { isExpiredNow } from "../../lib/demoAuth";
import { makeId } from "../../lib/ids";
import { appendAudit, getAgent, putDecision } from "../../lib/demoStore";
import { hashEmail, redact } from "../../lib/safeLog";
import { classifyRisk, decideControl } from "../../lib/policy";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const requestorEmail = String(req.headers["x-demo-user"] || "");
  const requestor_hash = hashEmail(requestorEmail);

  const { agent_id, action, target } = req.body || {};
  const aid = String(agent_id || "");
  const a = getAgent(aid);
  if (!a) return res.status(404).json({ error: "Agent not found" });
  if (a.status !== "active") return res.status(403).json({ error: `Agent is ${a.status}` });

  const actionStr = String(action || "UnknownAction");
  const targetStr = String(target || "UnknownTarget");

  // Risk = max(agent risk, action risk) for demo
  const actionRisk = classifyRisk(actionStr, targetStr);
  const risk_tier = (a.risk_tier === "high" || actionRisk === "high") ? "high"
                 : (a.risk_tier === "medium" || actionRisk === "medium") ? "medium"
                 : "low";

  const { control_mode, allowed, reason } = decideControl(risk_tier);

  const decision_id = makeId("DEC");
  const status = control_mode === "HITL" ? "pending" : "approved";

  putDecision({
    decision_id,
    agent_id: aid,
    requestor_hash,
    action: actionStr,
    target: targetStr,
    risk_tier,
    control_mode,
    allowed,
    reason,
    status,
    created_at: Date.now(),
  });

  appendAudit({
    ts: Date.now(),
    type: "approve_request",
    user_hash: requestor_hash,
    data: redact({ decision_id, agent_id: aid, action: actionStr, target: targetStr, risk_tier, control_mode, allowed, reason }),
  });

  return res.status(200).json({
    decision_id,
    risk_tier,
    control_mode,
    allowed,
    reason,
    next:
      control_mode === "HITL"
        ? { type: "collect_approver_email" }
        : control_mode === "HOTL"
        ? { type: "collect_reviewer_email" }
        : { type: "execute" },
  });
}
