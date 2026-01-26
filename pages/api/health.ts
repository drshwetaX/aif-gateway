import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    service: "aif-gateway",
    version: "0.1.0",
    ts: new Date().toISOString(),
  });
}
