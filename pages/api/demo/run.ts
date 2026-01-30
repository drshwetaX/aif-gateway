import type { NextApiRequest, NextApiResponse } from "next";
const KEY = "aif:demo:logs";
import { multiExec } from "../../../lib/redis";

await multiExec((m) => {
  m.lpush(KEY, JSON.stringify(event));
  m.ltrim(KEY, 0, 200);
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      action: "Agent run",
      outcome: "Allowed – context validated, read-only execution",
    });

    // LPUSH + LTRIM to keep only last 50 entries (atomic)
    await multiExec([
      ["LPUSH", KEY, entry],
      ["LTRIM", KEY, 0, 49],
    ]);

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "run failed" });
  }
}
