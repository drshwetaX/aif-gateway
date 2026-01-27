import type { NextApiRequest, NextApiResponse } from "next";
import { cmdUrl } from "./_redis";

const KEY = "aif:demo:logs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // LRANGE key 0 19  (latest 20 if we LPUSH)
    const result = await cmdUrl(`lrange/${encodeURIComponent(KEY)}/0/19`);
    const items: string[] = Array.isArray(result) ? result : [];
    const logs = items.map((s) => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    res.status(200).json({ logs });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "log read failed" });
  }
}
