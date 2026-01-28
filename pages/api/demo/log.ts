import type { NextApiRequest, NextApiResponse } from "next";
import { cmdUrl } from "../../../lib/redis";
import { getLogs } from "../../../lib/store";
import fs from "fs";

const LOG_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

export function getLogs(limit = 200) {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const lines = fs.readFileSync(LOG_PATH, "utf8").trim().split("\n").filter(Boolean);
    const tail = lines.slice(Math.max(0, lines.length - limit));
    return tail.map((l) => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch {
    return [];
  }
}

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
