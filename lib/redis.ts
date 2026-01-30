// lib/redis.ts
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({
  url: url ?? "",
  token: token ?? "",
});

/**
 * Compatibility helper for older code that expects getRedis().
 */
export function getRedis() {
  return redis;
}

/**
 * Compatibility helper for older code that expected multi/exec style batching.
 * Upstash REST doesn't do true MULTI/EXEC, so we run sequentially.
 */
export async function multiExec<T = any>(ops: Array<() => Promise<T>>) {
  const results: T[] = [];
  for (const op of ops) results.push(await op());
  return results;
}
