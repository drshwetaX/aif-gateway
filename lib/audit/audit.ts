/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Write audit events to Redis stream so /console/platform can display them.
 *
 * Dependencies:
 *   - lib/redis.getRedis()
 *   - Env:
 *       UPSTASH_REDIS_REST_URL
 *       UPSTASH_REDIS_REST_TOKEN
 *       (optional) AIF_REDIS_PREFIX (default "aif")
 *
 * When is this file called?
 *   - Called by API routes (e.g., /api/agents/register, /api/gate/*) to log events.
 * ---------------------------------------------------------------------------
 */
import { getRedis } from "@/lib/redis";

const REDIS_PREFIX = process.env.AIF_REDIS_PREFIX || "aif";
const AUDIT_STREAM = `${REDIS_PREFIX}:audit`;

function toStr(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function writeAudit(evt: {
  ts: string;
  user?: string;
  endpoint?: string;
  event?: string;
  decision?: string;
  reason?: string;
  request_id?: string;
  agent_id?: string;
  agentId?: string;
  action?: string;
  system?: string;
  tier?: string;
  policy_version?: string;
  controls?: any;
  intent?: any;
  env?: string;
  stage?: string;
  [key: string]: any;
}) {
  const redis = getRedis();

  const agent_id = evt.agent_id || evt.agentId || "";
  const event = evt.event || "audit";

  const fields: Record<string, string> = {
    ts: toStr(evt.ts),
    event: toStr(event),
    user: toStr(evt.user),
    endpoint: toStr(evt.endpoint),
    decision: toStr(evt.decision),
    reason: toStr(evt.reason),
    request_id: toStr(evt.request_id),
    agent_id: toStr(agent_id),
    action: toStr(evt.action),
    system: toStr(evt.system),
    tier: toStr(evt.tier),
    policy_version: toStr(evt.policy_version),
    env: toStr(evt.env),
    stage: toStr(evt.stage),

    // keep JSON blobs as strings
    controls: toStr(evt.controls),
    intent: toStr(evt.intent),
  };

  // Remove empty fields to keep stream neat
  Object.keys(fields).forEach((k) => {
    if (!fields[k]) delete fields[k];
  });

  // Upstash supports XADD. Signature differs by client version; keep it tolerant.
  try {
    // most common: xadd(key, "*", fields)
    await (redis as any).xadd(AUDIT_STREAM, "*", fields);
  } catch {
    // fallback: xadd(key, fields)
    await (redis as any).xadd(AUDIT_STREAM, fields);
  }

  return { ok: true };
}
