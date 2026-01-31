// lib/redis.ts
import { Redis } from "@upstash/redis";

/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Central Redis client for AIF Gateway (Upstash Redis REST).
 *
 * Dependencies:
 *   - @upstash/redis
 *   - Env vars:
 *       UPSTASH_REDIS_REST_URL
 *       UPSTASH_REDIS_REST_TOKEN
 *
 * When is this file called?
 *   - Imported by any API route or worker needing Redis access.
 * ---------------------------------------------------------------------------
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  // Fail fast in server logs; avoids "mystery 503"
  console.warn(
    "[redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
  );
}

export const redis = new Redis({
  url: url || "",
  token: token || "",
});

export function getRedis() {
  return redis;
}

export async function multiExec<T = any>(ops: Array<() => Promise<T>>) {
  const results: T[] = [];
  for (const op of ops) results.push(await op());
  return results;
}
