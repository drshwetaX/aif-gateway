import type { NextApiRequest, NextApiResponse } from "next";

function assertAuth(req: NextApiRequest) {
  const hdr =
    (req.headers["authorization"] as string) ||
    (req.headers["x-service-authorization"] as string) ||
    "";

  const token = hdr.toLowerCase().startsWith("bearer ")
    ? hdr.slice(7).trim()
    : "";

  // Debug (remove once fixed)
  console.log("AUTH hdr:", hdr);
  console.log("AUTH len:", hdr.length);
  console.log("TOKEN len:", token.length);
  console.log("TOKEN head/tail:", token.slice(0, 6), token.slice(-6));

  const expected = process.env.AIF_GATEWAY_API_KEY || "";
  if (!expected) {
    console.log("AUTH expected missing: AIF_GATEWAY_API_KEY not set");
    return false;
  }

  // Debug expected length (DON'T print the secret)
  console.log("EXPECTED len:", expected.length);

  return token === expected;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!assertAuth(req)) {
    // keep your existing debug structure if you want, but this is fine for now
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { agent_id, action, system, dataSensitivity, request_id } = req.body ?? {};

  return res.status(200).json({
    decision: "ALLOW",
    reason: "ok",
    policy_version: "v1",
    request_id,
  });
}
