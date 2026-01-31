/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Redis inspection endpoint to debug what Platform should show.
 *   Shows list lengths and sample items for:
 *     - agents list key:   <prefix>:agents:list
 *     - streams:           <prefix>:requests / decisions / audit
 *
 * Dependencies:
 *   - lib/redis.ts (getRedis)
 *
 * When is this file called?
 *   - Hit directly in browser/curl:
 *       GET /api/redis/inspect?limit=5
 * ---------------------------------------------------------------------------
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getRedis } from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const r = getRedis();

  const prefix = process.env.AIF_REDIS_PREFIX || "aif";
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 5)));

  const keys = {
    agentsList: `${prefix}:agents:list`,
    agentKeyExample: `${prefix}:agents:<id>`,
    requests: `${prefix}:requests`,
    decisions: `${prefix}:decisions`,
    audit: `${prefix}:audit`,
  };

  async function safe<T>(fn: () => Promise<T>) {
    try {
      return { ok: true, value: await fn() } as const;
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) } as const;
    }
  }

  // Agents list
  const llenAgents = await safe(() => r.llen(keys.agentsList) as any);
  const lrangeAgents = await safe(() => r.lrange(keys.agentsList, 0, limit - 1) as any);

  // Streams
  const xlenRequests = await safe(() => (r as any).xlen(keys.requests));
  const xlenDecisions = await safe(() => (r as any).xlen(keys.decisions));
  const xlenAudit = await safe(() => (r as any).xlen(keys.audit));

  // XRANGE last N: use "-" "+" with COUNT; easiest is XRANGE with "-" "+" and slice
  // Upstash supports xrevrange in many versions; we’ll try it and fallback.
  const xrevrange = async (stream: string) => {
    // prefer XREVRANGE + COUNT
    const rr = await safe(() => (r as any).xrevrange(stream, "+", "-", { count: limit }));
    if (rr.ok) return rr;

    // fallback: XRANGE then take last N
    const fr = await safe(() => (r as any).xrange(stream, "-", "+"));
    if (!fr.ok) return fr;

    const arr = Array.isArray(fr.value) ? fr.value : [];
    return { ok: true, value: arr.slice(Math.max(0, arr.length - limit)) } as const;
  };

  const requestsSample = await xrevrange(keys.requests);
  const decisionsSample = await xrevrange(keys.decisions);
  const auditSample = await xrevrange(keys.audit);

  return res.status(200).json({
    ok: true,
    prefix,
    keys,
    env: {
      hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    },
    agents: {
      llen: llenAgents,
      lrange: lrangeAgents,
    },
    streams: {
      requests: { xlen: xlenRequests, sample: requestsSample },
      decisions: { xlen: xlenDecisions, sample: decisionsSample },
      audit: { xlen: xlenAudit, sample: auditSample },
    },
  });
}
