import type { NextApiRequest, NextApiResponse } from "next";
import { redis } from "../../lib/redis"; // adjust to your redis client export

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // (Optional) Auth here (Bearer / x-api-key) – keep it consistent with your gateway
  const { agent_id, action, system, dataSensitivity, request_id, payload } = req.body ?? {};
  if (!agent_id || !action || !system || !dataSensitivity || !request_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const envelope = {
    request_id,
    agent_id,
    action,
    system,
    dataSensitivity,
    payload: payload ?? null,
    received_at: new Date().toISOString(),
    source: "foundry",
  };

  // Redis Stream (best for “platform” behavior)
  await redis.xadd(
    "aif:requests",
    "*",
    "request_id", envelope.request_id,
    "agent_id", envelope.agent_id,
    "action", envelope.action,
    "system", envelope.system,
    "dataSensitivity", envelope.dataSensitivity,
    "received_at", envelope.received_at,
    "source", envelope.source,
    "payload", JSON.stringify(envelope.payload)
  );

  return res.status(202).json({ status: "queued", request_id });
}
