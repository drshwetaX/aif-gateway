/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Get agent details by id.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent } from "../../../lib/demoStore";



export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "");
  const a = getAgent(id);
  if (!a) return res.status(404).json({ error: "Agent not found" });
  return res.status(200).json(a);
}
