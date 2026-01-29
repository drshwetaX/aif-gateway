import type { NextApiRequest, NextApiResponse } from "next";
import { resolveTier, controlsForTier } from "@/lib/policy/policyEngine";
import { buildIntent } from "@/lib/policy/intent";
import { writeAudit } from "@/lib/audit/audit";
import { getAgent } from "@/lib/demoStore";
import { getActiveOverrideForAgent } from "@/lib/overrideStore";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t0 = Date.now();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const user = (req.headers["x-demo-user"] as string | undefined) ?? undefined;
  const body = req.body || {};
  const env = body?.env;
  const approvedFlag = !!body?.approved;

  const intent = buildIntent(body);

  const agentId = body?.agent_id ? String(body.agent_id) : "";
  const agent = agentId ? getAgent(agentId) : null;

  const computedTier = resolveTier(intent);
  const computedControls = controlsForTier(computedTier);

  const latency_ms = () => Date.now() - t0;

  if (!agent) {
    writeAudit({
      ts: nowIso(),
      user,
      endpoint: "/api/run",
      decision: "DENY",
      reason: "agent_not_registered",
      agentId,
      intent,
      tier: computedTier,
      controls: computedControls,
      latency_ms: latency_ms(),
      env,
    });

    return res.status(403).json({
      ok: false,
      decision: "DENIED",
      error: "invalid_request",
      rationale: "Agent not registered. Register via /api/agents/register first.",
      ts: nowIso(),
      tier: computedTier,
      controls: computedControls,
      intent,
    });
  }

  // --- Apply governed override if active ---
  const activeOverride = getActiveOverrideForAgent(agentId);
  const tier = (activeOverride?.requestedTier || agent.tier || computedTier) as any;
  const controls = agent.controls ?? controlsForTier(tier);

  if (agent.status === "paused") {
    writeAudit({ ts: nowIso(), user, endpoint: "/api/run", decision: "DENY", reason: "agent_paused", agentId, intent, tier, controls, latency_ms: latency_ms(), env });
    return res.status(403).json({ ok: false, decision: "DENIED", error: "invalid_request", rationale: "Agent is paused by governance.", ts: nowIso(), tier, controls, intent });
  }

  if (agent.status === "killed") {
    writeAudit({ ts: nowIso(), user, endpoint: "/api/run", decision: "DENY", reason: "agent_killed", agentId, intent, tier, controls, latency_ms: latency_ms(), env });
    return res.status(403).json({ ok: false, decision: "DENIED", error: "invalid_request", rationale: "Agent is killed by governance.", ts: nowIso(), tier, controls, intent });
  }

  if (agent.approved === false || agent.status === "requested") {
    writeAudit({ ts: nowIso(), user, endpoint: "/api/run", decision: "DENY", reason: "agent_not_approved", agentId, intent, tier, controls, latency_ms: latency_ms(), env });
    return res.status(403).json({ ok: false, decision: "DENIED", error: "approval_required", rationale: "Agent is not approved yet (design-time gate).", ts: nowIso(), tier, controls, intent });
  }

  if (controls?.approvalRequired && !approvedFlag) {
    writeAudit({ ts: nowIso(), user, endpoint: "/api/run", decision: "DENY", reason: "approval_required", agentId, intent, tier, controls, latency_ms: latency_ms(), env, override_id: activeOverride?.id || null });
    return res.status(403).json({ ok: false, decision: "DENIED", error: "approval_required", rationale: "This action requires approval per policy controls.", ts: nowIso(), tier, controls, intent, override_id: activeOverride?.id || null });
  }

  if (controls?.sandboxOnly && env !== "sandbox") {
    writeAudit({ ts: nowIso(), user, endpoint: "/api/run", decision: "DENY", reason: "sandbox_only", agentId, intent, tier, controls, latency_ms: latency_ms(), env, override_id: activeOverride?.id || null });
    return res.status(403).json({ ok: false, decision: "DENIED", error: "sandbox_only", rationale: "This action is restricted to sandbox per policy controls.", ts: nowIso(), tier, controls, intent, override_id: activeOverride?.id || null });
  }

  writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/run",
    decision: "ALLOW",
    reason: "policy_checks_passed",
    agentId,
    intent,
    tier,
    controls,
    latency_ms: latency_ms(),
    env,
    override_id: activeOverride?.id || null,
    override_applied: !!activeOverride,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
  });

  return res.status(200).json({
    ok: true,
    decision: "ALLOWED",
    rationale: "Policy checks passed. (Execution stub response.)",
    ts: nowIso(),
    tier,
    controls,
    intent,
    override_id: activeOverride?.id || null,
    override_applied: !!activeOverride,
  });
}
