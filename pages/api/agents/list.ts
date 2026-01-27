/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: List agents in registry.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Store } from "../../../lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const items = await Store.listAgents();
  return res.status(200).json({ items });
}
