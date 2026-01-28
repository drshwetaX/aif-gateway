// pages/api/run.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuraPolicy } from "@/lib/policy/policyServer";
import { resolveTier, controlsForTier } from "@/lib/policy/policyEngine";
import { buildIntent } from "@/lib/policy/intent";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req, res) {
  // 1) Build intent
  const intent = buildIntent(req.body);

  // 2) Resolve tier + controls
  const tier = resolveTier(intent);
  const controls = controlsForTier(tier);

  // 3) Enforce
  if (controls.approvalRequired && !req.body?.approved) {
    return res.status(403).json({
      ok: false,
      error: "approval_required",
      tier,
      controls,
      intent,
      ts: nowIso(),
    });
  }

  if (controls.sandboxOnly && req.body?.env !== "sandbox") {
    return res.status(403).json({
      ok: false,
      error: "sandbox_only",
      tier,
      controls,
      intent,
      ts: nowIso(),
    });
  }

  // 4) Continue with normal execution…
  // runToolCall(req.body) ...
  return res.status(200).json({
    ok: true,
    tier,
    controls,
    intent,
    ts: nowIso(),
  });
}

export default async function handler(req, res) {
  const policy = getAuraPolicy();

  // Example: lookup tier defaults
  const tier = "A4";
  const tierObj = policy.tiers.find((t: any) => t.tier === tier);
  const controls = tierObj?.defaultControls;

  return res.status(200).json({ tier, controls });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { problemStatement = "" } = req.body || {};

  // Minimal response just to prove the route + method work.  
  // (You can wire it to execute.ts later.)
  return res.status(200).json({
    decision: "ALLOWED",
    tier: "A1",
    rationale: "Demo: /api/run POST is reachable",
    audit_id: "demo",
    echo: { problemStatement }
  });
}
