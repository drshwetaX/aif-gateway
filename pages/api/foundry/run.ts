import type { NextApiRequest, NextApiResponse } from "next";
import { updateAgent, getAgent } from "@/lib/demoStore";
import { loadAuraPolicy } from "@/lib/policy/loadPolicy";
import { controlsForTier } from "@/lib/policy/policyEngine";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() { return new Date().toISOString(); }

function requireBearer(req: NextApiRequest) {
  const want = process.env.FOUNDRY_TOOL_SECRET || "";
  if (!want || want.length < 20) return { ok: false, error: "missing_FOUNDRY_TOOL_SECRET" };

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token || token !== want) return { ok: false, error: "unauthorized" };

  return { ok: true };
}

function internalId(externalAgentId: string) {
  return `foundry_${externalAgentId}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = requireBearer(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: auth.error });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = req.body || {};
  const externalAgentId = String(body.externalAgentId || "").trim();
  const problem_statement = String(body.problem_statement || body.task || "").trim();
  const requestedTier = String(body.requestedTier || "").trim(); // optional (if Foundry sends it)

  if (!externalAgentId) return res.status(400).json({ ok: false, error: "missing_externalAgentId" });
  if (!problem_statement) return res.status(400).json({ ok: false, error: "missing_problem_statement" });

  const agentId = internalId(externalAgentId);
  const existing = getAgent(agentId);

  // Use policy pack to validate tiers + controls
  const policy = loadAuraPolicy();
  const allowedTiers = Array.isArray((policy as any)?.tiers)
    ? (policy as any).tiers.map((t: any) => String(t?.id)).filter(Boolean)
    : ["A1","A2","A3","A4","A5","A6"];

  const tier = allowedTiers.includes(requestedTier) ? requestedTier : (existing?.tier || "A2");
  const controls = controlsForTier(tier as any);

  // Ensure agent exists (link Foundry agent → internal registry)
  const agent = updateAgent(agentId, {
    id: agentId,
    externalAgentId,
    name: existing?.name || String(body.name || "Foundry Agent"),
    owner: existing?.owner || "foundry",
    status: existing?.status || "requested",
    approved: existing?.approved ?? false,
    createdAt: existing?.createdAt || nowIso(),
    problem_statement,
    tier,
    controls,
    policy_version: String((policy as any)?.version || "unknown"),
  });

  // In Foundry tool mode, we don’t auto-execute if not approved.
  if (agent.approved === false || agent.status === "requested") {
    writeAudit({
      ts: nowIso(),
      user: "foundry",
      endpoint: "/api/foundry/run",
      decision: "DENY",
      reason: "agent_not_approved",
      agentId,
      externalAgentId,
      tier: agent.tier,
      controls: agent.controls,
    });

    return res.status(403).json({
      ok: false,
      decision: "DENIED",
      error: "approval_required",
      rationale: "Agent exists but is not approved yet. Approve via /api/approve (human console).",
      agent_id: agent.id,
      tier: agent.tier,
      controls: agent.controls,
      policy_version: agent.policy_version,
    });
  }

  writeAudit({
    ts: nowIso(),
    user: "foundry",
    endpoint: "/api/foundry/run",
    decision: "ALLOW",
    reason: "tool_call_stub",
    agentId,
    externalAgentId,
    tier: agent.tier,
    controls: agent.controls,
  });

  return res.status(200).json({
    ok: true,
    decision: "ALLOWED",
    rationale: "Foundry tool call accepted (stub execution).",
    agent_id: agent.id,
    tier: agent.tier,
    controls: agent.controls,
    policy_version: agent.policy_version,
  });
}
