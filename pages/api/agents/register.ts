/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Design-time governance endpoint.
 * Accepts problem statement, assigns tier & controls, registers agent in ledger registry.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { computeTier } from "../../../lib/policy/tierEngine";
import { registerAgent } from "../../../lib/registry/agentRegistry";
import { hashIdentity } from "../../../lib/safety/hash";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = String(req.headers["x-demo-user"] || "unknown");
  const owner_hash = hashIdentity(user);

  const { name, problem_statement, override_tier } = req.body || {};
  if (!problem_statement) return res.status(400).json({ error: "problem_statement required" });

  const tiering = await computeTier(String(problem_statement), override_tier ? String(override_tier) : undefined);

  // allowed tools from tier (simple demo mapping)
  const allowed_tools =
    tiering.finalTier === "A1" || tiering.finalTier === "A2"
      ? ["read_only"]
      : ["read_only", "write_via_gateway"];

  const agent = await registerAgent({
    name: String(name || "Demo Agent"),
    owner_hash,
    problem_statement: String(problem_statement),
    tier: tiering.finalTier,
    controls: tiering.controls,
    allowed_tools,
    policy_version: tiering.policy_version,
  });

  return res.status(200).json({
    agent_id: agent.agent_id,
    status: agent.status,
    risk_tier: agent.tier,
    controls: agent.controls,
    allowed_tools: agent.allowed_tools,
    policy_version: agent.policy_version,
    // helpful to show execs:
    tiering_explain: {
      llm_attrs: tiering.attrs,
      matched_rules: tiering.ruleEval.matched_rule_ids,
      reasons: tiering.ruleEval.reasons,
    },
  });
}
