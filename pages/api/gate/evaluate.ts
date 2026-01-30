import type { NextApiRequest, NextApiResponse } from "next";

function assertAuth(req: NextApiRequest) {
  const hdr =
  (req.headers["authorization"] as string) ||
  (req.headers["x-service-authorization"] as string) ||
  "";
const token = hdr.toLowerCase().startsWith("bearer ") ? hdr.slice(7).trim() : "";

 console.log("EVAL hdr len:", hdr.length);
console.log("EVAL token len:", token.length);
console.log("EVAL head/tail:", token.slice(0, 6), token.slice(-6));

  if (!process.env.AIF_GATEWAY_API_KEY || token !== process.env.AIF_GATEWAY_API_KEY) {
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // ✅ allow non-session machine calls
  if (!assertAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const { agent_id, action, system, dataSensitivity, request_id } = req.body ?? {};

  return res.status(200).json({
    decision: "ALLOW",
    reason: "ok",
    policy_version: "v1",
    request_id,
  });
}
