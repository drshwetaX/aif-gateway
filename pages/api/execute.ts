/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Execute only after approval. Always simulated in demo.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getDecision, setDecisionStatus } from "../../lib/decisions/decisionStore";
import { hashIdentity } from "../../lib/safety/hash";
import { appendLedgerEvent } from "../../lib/audit/ledger";
import { salesforceSimExecute } from "../../lib/adapters/salesforce.sim";
import { servicenowSimExecute } from "../../lib/adapters/servicenow.sim";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const by_hash = hashIdentity(user);

  const { decision_id, payload } = req.body || {};
  if (!decision_id) return res.status(400).json({ error: "decision_id required" });

  const d = await getDecision(String(decision_id));
  if (!d) return res.status(404).json({ error: "Unknown decision_id" });

  if (d.control_mode === "HITL" && d.status !== "APPROVED") {
    return res.status(403).json({ error: "Not approved yet (HITL)" });
  }

  // Simulated adapters only
  let result: any;
  if (String(d.target).toLowerCase() === "salesforce") result = await salesforceSimExecute(d.action, payload);
  else if (String(d.target).toLowerCase() === "servicenow") result = await servicenowSimExecute(d.action, payload);
  else result = { simulated: true, system: d.target, action: d.action, result: "ok" };

  await setDecisionStatus(d.decision_id, "EXECUTED", by_hash);
  await appendLedgerEvent("execution", {
    decision_id: d.decision_id,
    agent_id: d.agent_id,
    action: d.action,
    target: d.target,
    tier: d.tier,
    policy_version: d.policy_version,
    result: { simulated: true }
  });

  return res.status(200).json({ ok: true, simulated: true, result });
}
