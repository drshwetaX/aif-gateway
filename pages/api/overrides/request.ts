import type { NextApiRequest, NextApiResponse } from "next";
import { requestOverride } from "@/lib/overrideStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() { return new Date().toISOString(); }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const user = (req.headers["x-demo-user"] as string | undefined) || "unknown";
  const { agent_id, requestedTier, reason } = req.body || {};
  const aid = String(agent_id || "").trim();
  const tier = String(requestedTier || "").trim();

  if (!aid || !tier) return res.status(400).json({ ok: false, error: "missing_fields" });

  const rec = requestOverride({
    agent_id: aid,
    requestedTier: tier,
    requestedBy: user,
    reason: String(reason || ""),
  });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/overrides/request",
    decision: "ALLOW",
    reason: "override_requested",
    agentId: aid,
    requestedTier: tier,
    override_id: rec.id,
  });

  return res.status(200).json({ ok: true, override: rec });
}
