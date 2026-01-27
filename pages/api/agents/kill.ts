/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Kill agent (hard stop).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { updateAgent, appendAudit } from "../../../lib/demoStore";
import { hashEmail, redact } from "../../../lib/safeLog";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = hashEmail(String(req.headers["x-demo-user"] || ""));
  const { agent_id } = req.body || {};
  const id = String(agent_id || "");

  const a = updateAgent(id, { status: "killed" });
  if (!a) return res.status(404).json({ error: "Agent not found" });

  appendAudit({ ts: Date.now(), type: "agent_kill", user_hash: user, data: redact({ agent_id: id, agent_status: a.status }) });
  return res.status(200).json({ ok: true, agent_id: id, status: a.status });
}
