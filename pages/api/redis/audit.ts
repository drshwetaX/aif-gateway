/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Monitoring plane endpoint: returns audit events from Redis
 *   so the gateway UI can display a trace of platform actions.
 *
 * Dependencies:
 *   - tailStream(): lib/redisStreamTail
 *   - Redis stream: aif:audit
 *
 * When is this file called?
 *   - Called by UI:
 *       GET /api/redis/audit?limit=100
 * ---------------------------------------------------------------------------
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { tailStream } from "../../../lib/redisStreamTail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const limit = Number(req.query.limit ?? 100);
    const items = await tailStream("aif:audit", limit);
    return res.status(200).json({ stream: "aif:audit", count: items.length, items });
  } catch (e: any) {
    return res.status(503).json({ error: "Redis unavailable", detail: String(e?.message || e) });
  }
}
