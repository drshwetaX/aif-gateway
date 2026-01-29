import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent, upsertAgent, updateAgent } from "@/lib/demoStore";
import { controlsForTier } from "@/lib/policy/policyEngine";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = String(req.headers["x-demo-user"] || "unknown");
  const body = req.body || {};

  // Adjust these to match your actual request shape
  const externalAgentId = body.externalAgentId ? String(body.externalAgentId).trim() : "";
  const requestedTier = body.requestedTier ? String(body.requestedTier).trim() : "";
  const name = body.name ? String(body.name) : "Foundry Agent";
  const problem_statement = body.problem_statement ? String(body.problem_statement) : "";

  if (!externalAgentId) {
    return res.status(400).json({ error: "externalAgentId required" });
  }

  const internalId = `foundry_${externalAgentId}`;

  // ✅ FIX: await getAgent
  const existing = await getAgent(internalId);

  const allowedTiers: string[] = Array.isArray(body.allowedTiers)
    ? body.allowedTiers.map((x: any) => String(x))
    : ["A1", "A2", "A3", "A4", "A5", "A6"];

  const tier = allowedTiers.includes(requestedTier)
    ? requestedTier
    : (existing?.tier || "A2");

  const controls = controlsForTier(tier as any);

  // Ensure agent exists (link Foundry agent → internal registry)
  // Prefer upsert for "create-or-update"
  const agent =
    (typeof upsertAgent === "function")
      ? await upsertAgent({
          id: internalId,
          externalAgentId,
          name: existing?.name || name,
          owner: existing?.owner || user,
          status: existing?.status || "requested",
          approved: existing?.approved ?? false,
          created_at: existing?.created_at || nowIso(),
          problem_statement: existing?.problem_statement || problem_statement,
          tier,
          controls,
        } as any)
      : await updateAgent(internalId, {
          // If you *don’t* have upsertAgent wired, updateAgent might return null.
          // In that case you should add upsertAgent in demoStore (recommended).
          tier,
          controls,
        });

  if (!agent) {
    return res.status(500).json({
      error: "Agent record missing; please implement upsertAgent in demoStore",
      agent_id: internalId,
    });
  }

  await writeAudit({
    ts: nowIso(),
    user,
    endpoint: "/api/foundry/run",
    decision: "ALLOW",
    reason: "foundry_run_requested",
    agentId: agent.id,
    externalAgentId,
    tier: agent.tier,
    controls: agent.controls,
    status: agent.status,
    approved: agent.approved,
  } as any);

  // Whatever your run endpoint returns
  return res.status(200).json({
    ok: true,
    agent_id: agent.id,
    tier: agent.tier,
    controls: agent.controls,
  });
}
