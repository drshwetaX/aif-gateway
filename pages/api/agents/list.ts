import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agents = await listAgents();

  agents.sort((a: any, b: any) =>
    String(b.requested_at || b.created_at || "").localeCompare(
      String(a.requested_at || a.created_at || "")
    )
  );

  return res.status(200).json({ ok: true, agents });
}
