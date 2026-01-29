import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agents = await listAgents();
  return res.status(200).json({ ok: true, agents });
}
