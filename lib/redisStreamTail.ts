/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Read-only helper to tail Redis Streams for gateway UI visibility.
 *   Used by monitoring endpoints to display latest platform events.
 *
 * Dependencies:
 *   - Redis client export: lib/redis (must support xrevrange)
 *
 * When is this file called?
 *   - Invoked by API routes:
 *       /api/redis/requests
 *       /api/redis/decisions
 *       /api/redis/audit
 * ---------------------------------------------------------------------------
 */

import { redis } from "./redis";

export async function tailStream(stream: string, limit: number) {
  const n = Math.max(1, Math.min(500, Number(limit || 50)));
  // XREVRANGE stream + - COUNT n (latest first)
  const rows = await redis.xrevrange(stream, "+", "-", "COUNT", n);

  // rows: [[id, [k1,v1,k2,v2...]], ...]
  return rows.map(([id, kv]: any) => {
    const obj: Record<string, any> = { id };
    for (let i = 0; i < kv.length; i += 2) obj[kv[i]] = kv[i + 1];
    // Try to parse payload if present
    if (typeof obj.payload === "string") {
      try { obj.payload = JSON.parse(obj.payload); } catch {}
    }
    return obj;
  });
}
