/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Register a governed agent (design-time governance).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { isExpiredNow } from "../../../lib/demoAuth";
import { makeId } from "../../../lib/ids";
import { appendAudit, putAgent } from "../../../lib/demoStore";
import { hashEmail, redact } from "../../../lib/safeLog";
import { classifyRisk } from "../../../lib/policy";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const ownerEmail = String(req.headers["x-demo-user"] || "");
  const owner_hash = hashEmail(ownerEmail);

  const { purpose, proposed_targets } = req.body || {};
  const purposeStr = String(purpose || "Demo agent").slice(0, 200);

  const targets: string[] = Array.isArray(proposed_targets) ? proposed_targets.map(String) : ["Salesforce"];
  const allowed_targets = targets.slice(0, 5);

  // Demo: derive risk tier from purpose/targets (replace later)
  const risk_tier = classifyRisk(purposeStr, allowed_targets.join(","));

  const agent_id = makeId("AGENT");
  const agent = {
    agent_id,
    owner_hash,
    purpose: purposeStr,
    risk_tier,
    allowed_targets,
    status: "active" as const,
    created_at: Date.now(),
  };

  putAgent(agent);

  appendAudit({
    ts: Date.now(),
    type: "agent_register",
    user_hash: owner_hash,
    data: redact({ agent_id, risk_tier, agent_status: agent.status }),
  });

  return res.status(200).json({
    agent_id,
    risk_tier,
    allowed_targets,
    status: agent.status,
    controls_required: risk_tier === "high" ? ["HITL"] : risk_tier === "medium" ? ["HOTL"] : ["AUTO"],
  });
}
