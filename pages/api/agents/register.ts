/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Register an agent (design-time governance). Creates Sun Life-owned registry record.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { isDemoExpiredNow } from "../../../lib/demoAuth";
import { hashEmail, redactForAudit } from "../../../lib/safeLog";
import { Store, makeId } from "../../../lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isDemoExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const userEmail = String(req.headers["x-demo-user"] || "");
  const { client_id, purpose } = req.body || {};

  const agent_id = makeId("AGENT");
  const owner_hash = hashEmail(userEmail);

  // Demo defaults: you can expand later
  const risk_tier: "low" | "medium" | "high" = "medium";
  const allowed_targets = ["Salesforce", "ServiceNow"];
  const allowed_actions = ["AddNote", "UpdateStatus", "CreateIncident", "EscalateCase"];

  const record = {
    agent_id,
    client_id: String(client_id || "copilot-studio"),
    owner_hash,
    purpose: String(purpose || "Demo agent"),
    risk_tier,
    allowed_targets,
    allowed_actions,
    status: "active" as const,
    created_at: Date.now(),
  };

  await Store.putAgent(record);
  await Store.appendAudit({
    ts: Date.now(),
    type: "agent.register",
    user: owner_hash,
    data: redactForAudit(record),
  });

  return res.status(200).json(record);
}
