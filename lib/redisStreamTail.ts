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

type StreamEntryFields = Record<string, any>;
type StreamRangeResult = Record<string, StreamEntryFields>;

export async function tailStream(stream: string, limit?: number) {
  const n = Math.max(1, Math.min(500, Number(limit ?? 50)));

  // Upstash TS SDK: xrevrange(key, end, start, count?)
  const result = (await redis.xrevrange(stream, "+", "-", n)) as StreamRangeResult;

  // result shape: { [id]: { field1: value1, ... }, ... } (latest first)
  return Object.entries(result).map(([id, fields]) => {
    const obj: Record<string, any> = { id, ...(fields || {}) };

    // Try to parse payload if present
    if (typeof obj.payload === "string") {
      try {
        obj.payload = JSON.parse(obj.payload);
      } catch {
        // keep as string
      }
    }

    return obj;
  });
}
