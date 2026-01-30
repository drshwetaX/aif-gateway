// lib/redis.ts
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  // Don’t crash at import-time in Next build; throw only when used.
  console.warn("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
}

export const redis = new Redis({
  url: url ?? "",
  token: token ?? "",
});

/**
 * Upstash REST doesn't support true MULTI/EXEC like TCP Redis clients.
 * This helper runs ops sequentially.
 */
export async function multiExec<T = any>(ops: Array<() => Promise<T>>) {
  const results: T[] = [];
  for (const op of ops) results.push(await op());
  return results;
}
