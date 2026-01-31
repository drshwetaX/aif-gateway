/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   TEMP: seed a small test event into Redis streams so UI can be validated.
 *
 * Dependencies:
 *   - lib/redis (redis client)
 *
 * When is this file called?
 *   - Manual test only:
 *       POST /api/redis/seed
 * ---------------------------------------------------------------------------
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { redis } from "../../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const now = new Date().toISOString();
  const request_id = `seed_${Date.now()}`;

  await redis.xadd("aif:requests", "*",
    "request_id", request_id,
    "agent_id", "seed_agent",
    "action", "write_log",
    "system", "demo_log",
    "dataSensitivity", "low",
    "received_at", now,
    "source", "seed",
    "version", "v1",
    "payload", JSON.stringify({ hello: "world" })
  );

  await redis.xadd("aif:decisions", "*",
    "request_id", request_id,
    "decision", "ALLOW",
    "reason", "seed decision",
    "policy_version", "v1",
    "decided_at", now
  );

  await redis.xadd("aif:audit", "*",
    "event", "seed_event",
    "request_id", request_id,
    "agent_id", "seed_agent",
    "action", "write_log",
    "system", "demo_log",
    "decision", "ALLOW",
    "ts", now
  );

  return res.status(200).json({ ok: true, request_id });
}
