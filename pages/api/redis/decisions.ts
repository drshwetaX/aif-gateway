/**
 * Author: Shweta Shah
 * Purpose: Read latest decision events from Redis stream for Platform UI.
 * Endpoint: GET /api/redis/decisions?limit=50
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getRedis } from "@/lib/redis";

const REDIS_PREFIX = process.env.AIF_REDIS_PREFIX || "aif";
const KEY = `${REDIS_PREFIX}:decisions`;

function normalizeEntries(entries: any[]) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((row) => {
      const id = row?.[0];
      const fields = row?.[1] || {};
      return { id, ...fields };
    })
    .filter(Boolean);
}

async function xreadLatest(redis: any, key: string, limit: number) {
  try {
    const rows = await redis.xrevrange(key, "+", "-", { count: limit });
    return normalizeEntries(rows);
  } catch {
    const rows = await redis.xrevrange(key, "+", "-", limit);
    return normalizeEntries(rows);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));

  try {
    const redis = getRedis();
    const items = await xreadLatest(redis as any, KEY, limit);
    return res.status(200).json({ stream: KEY, count: items.length, items });
  } catch (e: any) {
    return res.status(500).json({ stream: KEY, count: 0, items: [], error: "read_failed", detail: e?.message || String(e) });
  }
}
