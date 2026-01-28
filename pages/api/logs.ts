import type { NextApiRequest, NextApiResponse } from "next";
import { getLogs } from "@/lib/demoStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const limit = req.query.limit ? Number(req.query.limit) : 200;
  return res.status(200).json({ items: getLogs(Number.isFinite(limit) ? limit : 200) });
}
