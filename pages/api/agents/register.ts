/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Register agent into registry and emit platform stream events for dashboard.
 *
 * Dependencies:
 *   - lib/demoStore.upsertAgent (agent registry)
 *   - lib/redis.getRedis (platform streams)
 *   - lib/audit/audit.writeAudit (audit stream)
 *
 * When is this file called?
 *   - POST /api/agents/register
 * ---------------------------------------------------------------------------
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { buildIntent } from "@/lib/policy/intent";
import { resolveTier, controlsForTier, type Tier, type AgentIntent } from "@/lib/policy/policyEngine";
import { loadAuraPolicy } from "@/lib/policy/loadPolicy";
import { writeAudit } from "@/lib/audit/audit";
import { upsertAgent } from "@/lib/demoStore";
import { getRedis } from "@/lib/redis";

const REDIS_PREFIX = process.env.AIF_REDIS_PREFIX || "aif";
const REQ_STREAM = `${REDIS_PREFIX}:requests`;
const DEC_STREAM = `${REDIS_PREFIX}:decisions`;

function nowIso() {
  return new Date().toISOString();
}

function newAgentId(externalAgentId?: string) {
  if (externalAgentId && String(externalAgentId).trim()) return `foundry_${String(externalAgentId).trim()}`;
  return `agent_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function intentFromProblemStatement(problem_statement: string): AgentIntent {
  const text = (problem_statement || "").toLowerCase();
  const intent: AgentIntent = {
    actions: ["retrieve"],
    systems: ["kb"],
    dataSensitivity: "INTERNAL",
    crossBorder: false,
  };

  if (/\b(update|write|create|submit|change|delete|approve|send)\b/.test(text)) {
    intent.actions = ["update_record"];
    intent.systems = ["salesforce"];
  }
  if (/\b(workday|hr|employee|onboarding)\b/.test(text)) intent.systems = ["workday"];
  if (/\b(pii|sin|ssn|passport|medical|claim|benefit)\b/.test(text)) intent.dataSensitivity = "PII";
  if (/\b(cross[- ]border|international|outside canada|eu|uk|us)\b/.test(text)) intent.crossBorder = true;

  return intent;
}

function explainTiering(intent: AgentIntent, finalTier: Tier) {
  const policy = loadAuraPolicy();
  const rules = (policy.tiering?.rules ?? []) as any[];

  const matched: Array<{ ruleId: string; thenTier: string; reason: string }> = [];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const cond = r?.if ?? {};

    const actionsAny = cond.actionsAny as string[] | undefined;
    const actionsOnly = cond.actionsOnly as string[] | undefined;
    const systemsAny = cond.systemsAny as string[] | undefined;
    const dataSensitivityIn = cond.dataSensitivityIn as string[] | undefined;
    const crossBorder = cond.crossBorder as boolean | undefined;

    const ok =
      (actionsAny ? actionsAny.some((a) => intent.actions.includes(a)) : true) &&
      (actionsOnly ? intent.actions.length > 0 && intent.actions.every((a) => actionsOnly.includes(a)) : true) &&
      (systemsAny ? systemsAny.some((s) => intent.systems.includes(s)) : true) &&
      (dataSensitivityIn ? dataSensitivityIn.includes(intent.dataSensitivity ?? "") : true) &&
      (crossBorder !== undefined ? crossBorder === !!intent.crossBorder : true);

    if (!ok) continue;

    const rid = String(r?.id ?? `rule_${i}`);
    matched.push({
      ruleId: rid,
      thenTier: String(r?.thenTier ?? ""),
      reason: JSON.stringify(r?.if ?? {}),
    });
  }

  return {
    finalTier,
    matched_rule_ids: matched.map((m) => m.ruleId),
    matched_rules: matched,
  };
}

function toStr(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

async function emitPlatformStreams(args: {
  ts: string;
  request_id: string;
  agent_id: string;
  decision: string;
  reason: string;
  policy_version: string;
  action?: string;
  system?: string;
  dataSensitivity?: string;
  source?: string;
}) {
  const redis = getRedis();

  // 1) Request stream
  const reqFields: Record<string, string> = {
    received_at: args.ts,
    request_id: args.request_id,
    agent_id: args.agent_id,
    action: args.action || "register_agent",
    system: args.system || "aif",
    dataSensitivity: args.dataSensitivity || "INTERNAL",
    source: args.source || "console",
  };

  // 2) Decision stream
  const decFields: Record<string, string> = {
    decided_at: args.ts,
    request_id: args.request_id,
    decision: args.decision,
    reason: args.reason,
    policy_version: args.policy_version,
  };

  // tolerate client signature differences
  try {
    await (redis as any).xadd(REQ_STREAM, "*", reqFields);
  } catch {
    await (redis as any).xadd(REQ_STREAM, reqFields);
  }

  try {
    await (redis as any).xadd(DEC_STREAM, "*", decFields);
  } catch {
    await (redis as any).xadd(DEC_STREAM, decFields);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).json({ ok: false, error: "Method not allowed", got: req.method, url: req.url });
  }

  const body = (req.body ?? {}) as any;
  const user = String(req.headers["x-demo-user"] || "unknown");

  const name = String(body.name || "Demo Agent");
  const externalAgentId = body.externalAgentId ? String(body.externalAgentId) : undefined;

  const overrideTier = body.override_tier ? String(body.override_tier) : undefined;
  const problemStatement = body.problem_statement ? String(body.problem_statement) : "";

  const env = body.env ? String(body.env) : "test";
  const stage = body.stage ? String(body.stage) : "poc";
  const comment = body.comment ? String(body.comment) : "";
  const review_notes = body.review_notes ? String(body.review_notes) : null;

  let intent = buildIntent(body);
  if ((!intent.actions || intent.actions.length === 0) && problemStatement) intent = intentFromProblemStatement(problemStatement);

  if (!Array.isArray(intent.actions) || intent.actions.length === 0) intent.actions = ["retrieve"];
  if (!Array.isArray(intent.systems) || intent.systems.length === 0) intent.systems = ["kb"];

  let tier = resolveTier(intent);
  if (overrideTier && ["A1", "A2", "A3", "A4", "A5", "A6"].includes(overrideTier)) tier = overrideTier as Tier;

  const controls = controlsForTier(tier);
  const allowed_tools = tier === "A1" || tier === "A2" ? ["read_only"] : ["read_only", "write_via_gateway"];

  const agentId = newAgentId(externalAgentId);
  const ts = nowIso();
  const policy_version = loadAuraPolicy()?.version ?? "unknown";
  const tiering_explain = explainTiering(intent, tier);

  const agent = await upsertAgent({
    id: agentId,
    externalAgentId,
    name,
    owner: user,
    status: "requested",
    approved: false,
    created_at: ts,
    requested_at: ts,
    approved_at: null,
    env,
    stage,
    comment,
    review_notes,
    problem_statement: problemStatement,
    intent,
    tier,
    controls,
    allowed_tools,
    policy_version,
    tiering_explain,
    review: { decision: "PENDING", decidedAt: null, decidedBy: null, notes: review_notes },
  } as any);

  // ✅ platform streams (so /console/platform shows something)
  const request_id = `reg_${agentId}_${Date.now()}`;
  await emitPlatformStreams({
    ts,
    request_id,
    agent_id: agentId,
    decision: "ALLOW",
    reason: "agent_registered",
    policy_version,
    action: "register_agent",
    system: "aif",
    dataSensitivity: String(intent?.dataSensitivity || "INTERNAL"),
    source: "console",
  });

  // ✅ audit stream
  await writeAudit({
    ts,
    user,
    endpoint: "/api/agents/register",
    event: "agent_registered",
    decision: "ALLOW",
    reason: "agent_registered",
    request_id,
    agent_id: agentId,
    tier,
    controls,
    intent,
    env,
    stage,
    policy_version,
  });

  return res.status(200).json({
    ok: true,
    agent_id: agent.id,
    status: agent.status,
    approved: agent.approved,
    risk_tier: agent.tier,
    controls: agent.controls,
    allowed_tools: agent.allowed_tools,
    policy_version: agent.policy_version,
    tiering_explain: agent.tiering_explain,
    env: agent.env,
    stage: agent.stage,
    requested_at: agent.requested_at || agent.created_at,
    review_notes: agent.review_notes,
  });
}
