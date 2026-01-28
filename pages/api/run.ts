// pages/api/run.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { problemStatement = "" } = req.body || {};

  // Minimal response just to prove the route + method work.  
  // (You can wire it to execute.ts later.)
  return res.status(200).json({
    decision: "ALLOWED",
    tier: "A1",
    rationale: "Demo: /api/run POST is reachable",
    audit_id: "demo",
    echo: { problemStatement }
  });
}
