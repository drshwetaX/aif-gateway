// pages/api/demo/write.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const LOG_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

function appendJsonl(obj: any) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify(obj) + "\n", "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const event = {
    ts: new Date().toISOString(),
    type: body.type || "demo_log",
    message: body.message || "demo write",
    payload: body.payload ?? body,
  };

  try {
    appendJsonl(event);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "write failed" });
  }
}
