// pages/api/demo/log.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";

const LOG_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

function readJsonlTail(limit = 200) {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, "utf8").trim();
    if (!raw) return [];
    const lines = raw.split("\n").filter(Boolean);
    const tail = lines.slice(Math.max(0, lines.length - limit));
    return tail.map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l };
      }
    });
  } catch {
    return [];
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const limit = Math.max(1, Math.min(1000, Number(req.query.limit ?? 200)));
  const logs = readJsonlTail(limit);

  return res.status(200).json({ ok: true, logs });
}
