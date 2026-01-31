import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agents = await listAgents();import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always JSON
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method not allowed", got: req.method });
  }

  try {
    const agents = await listAgents();
    return res.status(200).json({ ok: true, agents });
  } catch (e: any) {
    // If anything explodes, you still see JSON
    return res.status(500).json({
      ok: false,
      error: "agents_list_failed",
      detail: e?.message || String(e),
    });
  }
}

  return res.status(200).json({ ok: true, agents });
}
