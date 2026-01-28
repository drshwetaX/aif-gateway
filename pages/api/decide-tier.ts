import type { NextApiRequest, NextApiResponse } from "next";
import { resolveTier, controlsForTier } from "@/lib/policy/policyEngine";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const intent = req.body; // validate later
  const tier = resolveTier(intent);
  const controls = controlsForTier(tier);

  res.status(200).json({ tier, controls });
}
