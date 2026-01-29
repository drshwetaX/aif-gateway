import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent } from "@/lib/demoStore";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

function requireServiceAuth(req: NextApiRequest): { ok: true } | { ok: false; error: string } {
  const expected = process.env.AIF_GATEWAY_SERVICE_TOKEN;
  if (!expected) {
    return { ok: false, error: "AIF_GATEWAY_SERVICE_TOKEN is not configured" };
  }

  const h = req.headers;
  const auth = String(h.authorization || "");
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

type CheckDecision = {
  allow: boolean;
  status: string;
  approved: boolean;
  reason: string;
};

function decide(agent: any): CheckDecision {
  const status = String(agent?.status || "unknown");
  const approved = Boolean(agent?.approved);

  if (!agent) {
    return { allow: false, status: "not_found", approved: false, reason: "agent_not_registered" };
  }

  if (status === "killed" || status === "terminated") {
    return { allow: false, status, approved, reason: `agent_${status}` };
  }
  if (status === "paused") {
    return { allow: false, status, approved, reason: "agent_paused" };
  }
  if (!approved) {
    return { allow: false, status, approved, reason: "agent_not_approved" };
  }
  return { allow: true, status, approved, reason: "agent_allowed" };
}

// Server-to-server runtime gate for agents (Foundry / ServiceNow / Salesforce etc.)
// Call with Authorization: Bearer <AIF_GATEWAY_SERVICE_TOKEN>
// Input: { agent_id, heartbeat?: true, meta?: {...} }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = requireServiceAuth(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: auth.error });

  const body = (req.body ?? {}) as any;
  const agentId = String(req.query.agent_id || body.agent_id || body.id || "").trim();
  if (!agentId) return res.status(400).json({ ok: false, error: "Missing agent_id" });

  const ts = nowIso();
  const agent = await getAgent(agentId);

  // Optional: lightweight heartbeat so the console can show "last_seen"
  if (agent && (body.heartbeat === true || String(req.query.heartbeat || "") === "1")) {
    await updateAgent(agentId, { last_seen_at: ts });
  }

  const d = decide(agent);

  await writeAudit({
    ts,
    user: "service",
    endpoint: "/api/agents/check",
    decision: d.allow ? "ALLOW" : "DENY",
    reason: d.reason,
    agentId,
    status: d.status,
    approved: d.approved,
    tier: agent?.tier,
    controls: agent?.controls,
  } as any);

  return res.status(200).json({
    ok: true,
    ts,
    agent_id: agentId,
    allow: d.allow,
    status: d.status,
    approved: d.approved,
    reason: d.reason,
    risk_tier: agent?.tier,
    controls: agent?.controls,
    allowed_tools: agent?.allowed_tools,
    env: agent?.env,
    stage: agent?.stage,
    policy_version: agent?.policy_version,
    last_seen_at: (agent as any)?.last_seen_at ?? undefined,
  });
}
