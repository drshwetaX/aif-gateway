import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Returns all registered agents (Redis-backed via demoStore when Redis is enabled).
 *
 * Dependencies:
 *   - listAgents() from lib/demoStore
 *
 * When is this file called?
 *   - GET /api/agents/list
 * ---------------------------------------------------------------------------
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always JSON + no cache (helps debugging + Safari)
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
    return res.status(500).json({
      ok: false,
      error: "agents_list_failed",
      detail: e?.message || String(e),
    });
  }
}
