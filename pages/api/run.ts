// pages/api/run.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuraPolicy } from "@/lib/policy/policyServer";

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
