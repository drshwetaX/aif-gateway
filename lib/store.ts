/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Demo data store for agents, decisions, and audit logs.
 *          Supports in-memory (fast) and optional Upstash Redis (stable on Vercel).
 */

import crypto from "crypto";

export type AgentStatus = "active" | "paused" | "killed";

export type AgentRecord = {
  agent_id: string;
  client_id: string; // e.g., "copilot-studio", "salesforce", "servicenow"
  owner_hash: string; // hashed email
  purpose: string;
  risk_tier: "low" | "medium" | "high";
  allowed_targets: string[];
  allowed_actions: string[];
  status: AgentStatus;
  created_at: number;
};

export type DecisionStatus = "pending" | "approved" | "denied" | "executed";

export type DecisionRecord = {
  decision_id: string;
  agent_id: string;
  client_id: string;
  requestor_hash: string;
  approver_hash?: string;
  action: string;
  target: string;
  risk_tier: "low" | "medium" | "high";
  control_mode: "AUTO" | "HITL" | "HOTL";
  status: DecisionStatus;
  reason: string;
  obligations: string[];
  created_at: number;
  approval_token?: string; // single-use token for HITL approvals
  approval_expires_at?: number;
};

export type AuditEvent = {
  ts: number;
  type:
    | "auth.login"
    | "auth.logout"
    | "agent.register"
    | "agent.pause"
    | "agent.kill"
    | "approve"
    | "decision.notify"
    | "decision.approve"
    | "decision.deny"
    | "execute";
  user?: string; // hashed email
  data: any; // redacted payload
};

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

/** -------------------------
 * In-memory store (default)
 * --------------------------*/
const memAgents = new Map<string, AgentRecord>();
const memDecisions = new Map<string, DecisionRecord>();
const memAudit: AuditEvent[] = [];

function auditAppend(e: AuditEvent) {
  memAudit.unshift(e);
  if (memAudit.length > 300) memAudit.pop();
}

/** -------------------------
 * Optional: Upstash Redis
 * --------------------------*/
async function redisFetch(path: string, body: any) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis not configured");

  const r = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Redis error");
  return j;
}

function useRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Keys */
const K = {
  agent: (id: string) => `aif:agent:${id}`,
  agentsIndex: `aif:agents:index`,
  decision: (id: string) => `aif:decision:${id}`,
  decisionsIndex: `aif:decisions:index`,
  audit: `aif:audit`, // list
};

/** Public store API used by endpoints */
export const Store = {
  async putAgent(a: AgentRecord) {
    if (!useRedis()) {
      memAgents.set(a.agent_id, a);
      auditAppend({ ts: Date.now(), type: "agent.register", user: a.owner_hash, data: { agent_id: a.agent_id } });
      return;
    }
    await redisFetch("/set", [K.agent(a.agent_id), JSON.stringify(a)]);
    await redisFetch("/sadd", [K.agentsIndex, a.agent_id]);
  },

  async getAgent(agent_id: string): Promise<AgentRecord | null> {
    if (!useRedis()) return memAgents.get(agent_id) || null;
    const j = await redisFetch("/get", [K.agent(agent_id)]);
    const v = j?.result;
    return v ? (JSON.parse(v) as AgentRecord) : null;
  },

  async listAgents(): Promise<AgentRecord[]> {
    if (!useRedis()) return Array.from(memAgents.values()).sort((a, b) => b.created_at - a.created_at);

    const ids = (await redisFetch("/smembers", [K.agentsIndex]))?.result || [];
    const out: AgentRecord[] = [];
    for (const id of ids) {
      const a = await Store.getAgent(String(id));
      if (a) out.push(a);
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  },

  async updateAgent(agent_id: string, patch: Partial<AgentRecord>) {
    const cur = await Store.getAgent(agent_id);
    if (!cur) return null;
    const updated = { ...cur, ...patch };
    if (!useRedis()) {
      memAgents.set(agent_id, updated);
      return updated;
    }
    await redisFetch("/set", [K.agent(agent_id), JSON.stringify(updated)]);
    return updated;
  },

  async putDecision(d: DecisionRecord) {
    if (!useRedis()) {
      memDecisions.set(d.decision_id, d);
      auditAppend({ ts: Date.now(), type: "approve", user: d.requestor_hash, data: { decision_id: d.decision_id, status: d.status } });
      return;
    }
    await redisFetch("/set", [K.decision(d.decision_id), JSON.stringify(d)]);
    await redisFetch("/sadd", [K.decisionsIndex, d.decision_id]);
  },

  async getDecision(decision_id: string): Promise<DecisionRecord | null> {
    if (!useRedis()) return memDecisions.get(decision_id) || null;
    const j = await redisFetch("/get", [K.decision(decision_id)]);
    const v = j?.result;
    return v ? (JSON.parse(v) as DecisionRecord) : null;
  },

  async updateDecision(decision_id: string, patch: Partial<DecisionRecord>) {
    const cur = await Store.getDecision(decision_id);
    if (!cur) return null;
    const updated = { ...cur, ...patch };
    if (!useRedis()) {
      memDecisions.set(decision_id, updated);
      return updated;
    }
    await redisFetch("/set", [K.decision(decision_id), JSON.stringify(updated)]);
    return updated;
  },

  async listDecisions(): Promise<DecisionRecord[]> {
    if (!useRedis()) return Array.from(memDecisions.values()).sort((a, b) => b.created_at - a.created_at);

    const ids = (await redisFetch("/smembers", [K.decisionsIndex]))?.result || [];
    const out: DecisionRecord[] = [];
    for (const id of ids) {
      const d = await Store.getDecision(String(id));
      if (d) out.push(d);
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  },

  async appendAudit(e: AuditEvent) {
    if (!useRedis()) {
      auditAppend(e);
      return;
    }
    await redisFetch("/lpush", [K.audit, JSON.stringify(e)]);
    await redisFetch("/ltrim", [K.audit, 0, 299]);
  },

  async listAudit(): Promise<AuditEvent[]> {
    if (!useRedis()) return memAudit.slice(0, 200);
    const j = await redisFetch("/lrange", [K.audit, 0, 199]);
    const arr = j?.result || [];
    return arr.map((s: string) => JSON.parse(s));
  },
};
