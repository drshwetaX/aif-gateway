/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: HITL approval endpoint (demo). In enterprise, protect via role checks.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { setDecisionStatus } from "../../../../lib/decisions/decisionStore";
import { hashIdentity } from "../../../../lib/safety/hash";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const by_hash = hashIdentity(user);

  const decision_id = String(req.query.decision_id || "");
  await setDecisionStatus(decision_id, "APPROVED", by_hash);

  return res.status(200).json({ ok: true, decision_id, status: "APPROVED" });
}
