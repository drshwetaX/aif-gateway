const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  "";

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  "";

function assertEnv() {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("Missing Redis REST env vars");
  }
}
// lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function multiExec(commands: (string | number)[][]) {
  assertEnv();

  const res = await fetch(`${REST_URL}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Redis error");
  return data;
}

export async function cmdUrl(path: string) {
  assertEnv();

  const res = await fetch(`${REST_URL}/${path}`, {
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Redis error");
  return data?.result;
}
