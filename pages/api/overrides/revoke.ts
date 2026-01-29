import type { NextApiRequest, NextApiResponse } from "next";
import { revokeOverride } from "@/lib/overrideStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() { return new Date().toISOString(); }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const user = (req.headers["x-demo-user"] as string | undefined) || "unknown";
  const { id } = req.body || {};
  const oid = String(id || "").trim();
  if (!oid) return res.status(400).json({ ok: false, error: "missing_id" });

  const rec = revokeOverride(oid, user);
  if (!rec) return res.status(404).json({ ok: false, error: "override_not_found" });

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/overrides/revoke",
    decision: "ALLOW",
    reason: "override_revoked",
    override_id: rec.id,
    agentId: rec.agent_id,
  });

  return res.status(200).json({ ok: true, override: rec });
}
