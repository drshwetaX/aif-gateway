/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Monitoring plane endpoint: returns latest decisions from Redis
 *   so the gateway UI can display allow/deny outcomes.
 *
 * Dependencies:
 *   - tailStream(): lib/redisStreamTail
 *   - Redis stream: aif:decisions
 *
 * When is this file called?
 *   - Called by UI:
 *       GET /api/redis/decisions?limit=50
 * ---------------------------------------------------------------------------
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { tailStream } from "../../../lib/redisStreamTail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const limit = Number(req.query.limit ?? 50);
    const items = await tailStream("aif:decisions", limit);
    return res.status(200).json({ stream: "aif:decisions", count: items.length, items });
  } catch (e: any) {
    return res.status(503).json({ error: "Redis unavailable", detail: String(e?.message || e) });
  }
}
