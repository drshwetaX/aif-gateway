// pages/api/redis/agents.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getRedis } from "@/lib/redis";

type Agent = Record<string, any>;

const PREFIX = process.env.AIF_REDIS_PREFIX || "aif";
const LIST_KEY = `${PREFIX}:agents:list`;
const AGENT_KEY = (id: string) => `${PREFIX}:agents:${id}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));

  try {
    const r = getRedis();

    const ids = (await (r as any).lrange(LIST_KEY, 0, limit - 1)) as string[] | null;
    if (!ids?.length) {
      return res.status(200).json({ ok: true, key: LIST_KEY, count: 0, items: [] });
    }

    const keys = ids.map((id) => AGENT_KEY(id));

    let raws: Array<string | null> = [];
    try {
      // some upstash clients support mget(keys) (array)
      const got = (await (r as any).mget(keys)) as Array<string | null>;
      raws = Array.isArray(got) ? got : [];
    } catch {
      // fallback: sequential
      raws = await Promise.all(keys.map(async (k) => ((await (r as any).get(k)) as string | null) ?? null));
    }

    const items: Agent[] = [];
    for (const raw of raws) {
      if (!raw) continue;
      try {
        items.push(JSON.parse(raw));
      } catch {
        // ignore malformed
      }
    }

    return res.status(200).json({
      ok: true,
      key: LIST_KEY,
      count: items.length,
      items,
    });
  } catch (e: any) {
    return res.status(200).json({
      ok: false,
      key: LIST_KEY,
      count: 0,
      items: [],
      error: e?.message || "failed",
      detail: e?.stack ? String(e.stack).slice(0, 600) : "",
    });
  }
}
