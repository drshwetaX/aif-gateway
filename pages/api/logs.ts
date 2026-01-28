import type { NextApiRequest, NextApiResponse } from "next";
import { readAudit } from "@/lib/audit/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const entries = await readAudit({ limit: 50 });

    return res.status(200).json({
      logs: entries.map((e) => ({
        ts: e.ts,
        decision: e.decision,
        reason: e.reason,
        agentId: e.agentId,
      })),
    });
  } catch (err: any) {
    console.error("logs error", err);
    return res.status(500).json({ error: "failed_to_read_logs" });
  }
}
