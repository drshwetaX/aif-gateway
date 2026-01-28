import type { NextApiRequest, NextApiResponse } from "next";
import { buildIntent } from "@/lib/policy/intent";
import { resolveTier, controlsForTier } from "@/lib/policy/policyEngine";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const intent = buildIntent(req.body || {});
  const tier = resolveTier(intent);
  const controls = controlsForTier(tier);
  return res.status(200).json({ intent, tier, controls });
}
