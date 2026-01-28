import type { NextApiRequest, NextApiResponse } from "next";
import { listAgents } from "@/lib/demoStore";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ items: listAgents() });
}
