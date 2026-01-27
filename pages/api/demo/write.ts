import type { NextApiRequest, NextApiResponse } from "next";
import { multiExec } from "./_redis";

const KEY = "aif:demo:logs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      action: "Write attempt",
      outcome: "Blocked – insufficient authorization",
    });

    await multiExec([
      ["LPUSH", KEY, entry],
      ["LTRIM", KEY, 0, 49],
    ]);

    res.status(403).json({ ok: false });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "write failed" });
  }
}
