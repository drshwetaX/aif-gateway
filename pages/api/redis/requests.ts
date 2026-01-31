/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Monitoring plane endpoint: returns latest request envelopes from Redis
 *   so the gateway UI can display incoming agent requests.
 *
 * Dependencies:
 *   - tailStream() helper
 *   - Redis stream: aif:requests
 *
 * When is this file called?
 *   - Gateway UI calls:
 *       GET /api/redis/requests?limit=50
 * ---------------------------------------------------------------------------
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { tailStream } from "../../../lib/redisStreamTail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const limit = Number(req.query.limit ?? 50);
    const items = await tailStream("aif:requests", limit);
    return res.status(200).json({ stream: "aif:requests", count: items.length, items });
  } catch (e: any) {
    return res.status(503).json({ error: "Redis unavailable", detail: String(e?.message || e) });
  }
}
