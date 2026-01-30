import type { NextApiRequest, NextApiResponse } from "next";
import { redis, multiExec } from "../../../lib/redis";

const KEY = "aif:demo:logs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      action: "Agent run",
      outcome: "Allowed – context validated, read-only execution",
    });

    await multiExec([
      () => redis.lpush(KEY, entry),
      () => redis.ltrim(KEY, 0, 49),
    ]);

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "run failed" });
  }
}
