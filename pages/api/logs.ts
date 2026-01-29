import type { NextApiRequest, NextApiResponse } from "next";
import demoStore from "@/lib/demoStore"; // OR: import { demoStore } from "@/lib/demoStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const store: any = demoStore; // normalize name so you can call store.*

    const entries =
      (await store.readAudit?.({ limit: 50 })) ??
      (await store.listAudit?.({ limit: 50 })) ??
      (await store.getAudit?.({ limit: 50 })) ??
      [];

    return res.status(200).json({ ok: true, entries });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
