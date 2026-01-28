import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = (req.headers["x-demo-user"] as string | undefined) || "";
  return res.status(200).json({ email });
}
