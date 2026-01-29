import type { NextApiRequest, NextApiResponse } from "next";
import { getLogs } from "@/lib/demoStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(500, Math.max(1, Number(limitRaw ?? 50) || 50));

  try {
    const entries = getLogs(limit);
    return res.status(200).json({ ok: true, entries });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
