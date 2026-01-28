import type { NextApiRequest, NextApiResponse } from "next";
import { Store } from "@/lib/demostore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    // Try common method names—pick the one that exists in your Store
    const entries =
      (await (Store as any).readAudit?.({ limit: 50 })) ??
      (await (Store as any).listAudit?.({ limit: 50 })) ??
      (await (Store as any).getAudit?.({ limit: 50 })) ??
      [];

    return res.status(200).json({ logs: entries });
  } catch (err: any) {
    console.error("logs error", err);
    return res.status(500).json({ error: "failed_to_read_logs" });
  }
}
