/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Ingress plane for the AIF Gateway platform. Accepts action-intent requests
 *   from external agent runtimes (e.g., Foundry) and enqueues them into Redis
 *   for downstream policy evaluation, orchestration, and monitoring.
 *
 * Dependencies:
 *   - Next.js Pages Router API: NextApiRequest, NextApiResponse
 *   - Redis client from: lib/redis (must export a connected redis instance)
 *   - Environment variables (recommended):
 *       - AIF_GATEWAY_API_KEY (if you enforce Bearer auth here)
 *
 * When is this file called?
 *   - Called by Foundry (or any client) via HTTPS:
 *       POST https://<gateway-host>/api/requests/submit
 *   - This is the "platform intake" endpoint: it does NOT make decisions.
 *     It only normalizes + enqueues the request.
 * ---------------------------------------------------------------------------
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { redis } from "../../../lib/redis"; // adjust path if needed

// Redis keys (keep consistent across planes)
const STREAM_REQUESTS = "aif:requests";

// Minimal request shape accepted from Foundry/tools
type SubmitRequestBody = {
  agent_id: string;
  action: string;
  system: string;
  dataSensitivity: "low" | "medium" | "high";
  request_id: string;
  payload?: Record<string, any>; // optional arbitrary data
};

// Optional: lightweight auth (same pattern as your evaluate endpoint)
// NOTE: keep this consistent with your existing gateway auth approach.
function assertBearer(req: NextApiRequest): boolean {
  const hdr = (req.headers["authorization"] as string) || "";
  const token = hdr.toLowerCase().startsWith("bearer ") ? hdr.slice(7).trim() : "";
  const expected = process.env.AIF_GATEWAY_API_KEY || "";
  if (!expected) return false;
  return token === expected;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ---- Method guard ----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ---- Auth guard (optional but recommended) ----
  // If you want "public demo mode", you can feature-flag this check.
  if (!assertBearer(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ---- Validate payload ----
  const body = (req.body ?? {}) as Partial<SubmitRequestBody>;

  const required = ["agent_id", "action", "system", "dataSensitivity", "request_id"] as const;
  for (const k of required) {
    if (!body[k]) return res.status(400).json({ error: `Missing field: ${k}` });
  }

  // ---- Build the platform request envelope (normalized) ----
  const envelope = {
    request_id: String(body.request_id),
    agent_id: String(body.agent_id),
    action: String(body.action),
    system: String(body.system),
    dataSensitivity: body.dataSensitivity as "low" | "medium" | "high",
    payload: body.payload ?? null,
    received_at: new Date().toISOString(),
    source: "foundry", // or "tool", "ui", etc.
    version: "v1",
  };

  // ---- Enqueue to Redis stream ----
  // Streams are ideal for platform pipelines: replay, consumer groups, monitoring.
  await redis.xadd(
    STREAM_REQUESTS,
    "*",
    "request_id",
    envelope.request_id,
    "agent_id",
    envelope.agent_id,
    "action",
    envelope.action,
    "system",
    envelope.system,
    "dataSensitivity",
    envelope.dataSensitivity,
    "received_at",
    envelope.received_at,
    "source",
    envelope.source,
    "version",
    envelope.version,
    "payload",
    JSON.stringify(envelope.payload)
  );

  // ---- Return "accepted" (async platform behavior) ----
  // Client can poll /api/requests/status?request_id=... later.
  return res.status(202).json({
    status: "queued",
    request_id: envelope.request_id,
  });
}
