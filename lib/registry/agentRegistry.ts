/**  NOTE: Not wired in demo. Production CMDB - ledger-backed registry.
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Agent registry for demo. In production this maps to CMDB/asset registry.
 */
import crypto from "crypto";
import { appendLedgerEvent, getLatestStateByType } from "../audit/ledger";

export type AgentRecord = {
  agent_id: string;
  name: string;
  owner_hash: string;
  problem_statement: string;
  tier: string;
  controls: any;
  allowed_tools: string[];
  status: "ACTIVE" | "PAUSED" | "KILLED";
  policy_version: string;
  created_at: number;
};

function id() {
  return `agent-${crypto.randomBytes(8).toString("hex")}`;
}

export async function registerAgent(input: Omit<AgentRecord, "agent_id" | "status" | "created_at">) {
  const agent: AgentRecord = {
    ...input,
    agent_id: id(),
    status: "ACTIVE",
    created_at: Date.now(),
  };
  await appendLedgerEvent("agent_registered", { agent });
  return agent;
}

export async function setAgentStatus(agent_id: string, status: AgentRecord["status"]) {
  await appendLedgerEvent("agent_status_changed", { agent_id, status });
}

export async function getAgent(agent_id: string): Promise<AgentRecord | null> {
  const state = await getLatestStateByType("agent_registered", "agent.agent_id", agent_id);
  if (!state) return null;
  const agent = state.agent as AgentRecord;

  // Apply latest status if exists
  const statusEvt = await getLatestStateByType("agent_status_changed", "agent_id", agent_id);
  if (statusEvt?.status) agent.status = statusEvt.status;

  return agent;
}
