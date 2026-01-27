/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Get one agent by agent_id (?agent_id=...).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Store } from "../../../lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const agent_id = String(req.query.agent_id || "");
  const a = await Store.getAgent(agent_id);
  if (!a) return res.status(404).json({ error: "Not found" });
  return res.status(200).json(a);
}
