// lib/demoStore.ts
import { Redis } from "@upstash/redis";

export type Agent = {
  id: string;
  externalAgentId?: string;
  name?: string;
  owner?: string;

  status?: "requested" | "active" | "paused" | "killed";
  approved?: boolean;

  createdAt?: string;
  pausedAt?: string;
  killedAt?: string;

  problem_statement?: string;
  intent?: any;

  tier?: string; // A1-A6
  controls?: any;
  allowed_tools?: string[];

  policy_version?: string;

  review?: {
    decision: "PENDING" | "APPROVED" | "REJECTED";
    decidedAt: string | null;
    decidedBy?: string;
    notes?: string;
  };

  [k: string]: any;
};

export type Decision = {
  id: string;
  createdAt?: string;
  status?: "PENDING" | "APPROVED" | "DENIED" | "EXECUTED";
  agent_id?: string;
  externalAgentId?: string;

  action?: string;
  target?: string;

  tier?: string;
  controls?: any;

  control_mode?: "AUTO" | "HOTL" | "HITL";
  allowed?: boolean;
  reason?: string;

  policy_version?: string;

  executedAt?: string;
  executedBy?: string;

  [k: string]: any;
};

function nowIso() {
  return new Date().toISOString();
}

// Upstash Redis (REST)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Key helpers
const K = {
  agent: (id: string) => `aif:agent:${id}`,
  agents: `aif:agents`, // set of agent ids
  decision: (id: string) => `aif:decision:${id}`,
  decisions: `aif:decisions`, // set of decision ids
  audit: `aif:audit`, // list of JSON strings (newest at head)
  outbox: `aif:outbox`, // list of JSON strings
};

function requireRedis() {
  if (!redis) {
    throw new Error(
      "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }
  return redis;
}

// ---------- Agents ----------
export async function getAgent(id: string): Promise<Agent | null> {
  const r = requireRedis();
  const obj = await r.get<Agent>(K.agent(id));
  return obj ?? null;
}

export async function listAgents(): Promise<Agent[]> {
  const r = requireRedis();
  const ids = (await r.smembers<string[]>(K.agents)) ?? [];
  if (!ids.length) return [];

  // pipeline fetch
  const pipeline = r.pipeline();
  ids.forEach((id) => pipeline.get(K.agent(id)));
  const res = await pipeline.exec();
  return res
    .map((x) => (x as any)?.result as Agent | null)
    .filter((x): x is Agent => !!x);
}

export async function updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
  const r = requireRedis();
  const existing = (await r.get<Agent>(K.agent(id))) ?? {
    id,
    createdAt: nowIso(),
    status: "requested",
    approved: false,
  };

  const updated: Agent = { ...existing, ...patch, id };
  await r.set(K.agent(id), updated);
  await r.sadd(K.agents, id);
  return updated;
}

// ---------- Decisions ----------
export async function getDecision(id: string): Promise<Decision | null> {
  const r = requireRedis();
  const obj = await r.get<Decision>(K.decision(id));
  return obj ?? null;
}

export async function listDecisions(): Promise<Decision[]> {
  const r = requireRedis();
  const ids = (await r.smembers<string[]>(K.decisions)) ?? [];
  if (!ids.length) return [];

  const pipeline = r.pipeline();
  ids.forEach((id) => pipeline.get(K.decision(id)));
  const res = await pipeline.exec();
  return res
    .map((x) => (x as any)?.result as Decision | null)
    .filter((x): x is Decision => !!x);
}

export async function updateDecision(id: string, patch: Partial<Decision>): Promise<Decision> {
  const r = requireRedis();
  const existing = (await r.get<Decision>(K.decision(id))) ?? {
    id,
    createdAt: nowIso(),
    status: "PENDING",
  };

  const updated: Decision = { ...existing, ...patch, id };
  await r.set(K.decision(id), updated);
  await r.sadd(K.decisions, id);
  return updated;
}

// ---------- Outbox ----------
export async function pushOutbox(msg: any) {
  const r = requireRedis();
  const line = JSON.stringify({ ts: nowIso(), ...msg });
  await r.lpush(K.outbox, line);
  await r.ltrim(K.outbox, 0, 199);
  return { ok: true };
}

// --- Compatibility shim for older routes expecting appendAudit ---
export async function appendAudit(event: any) {
  const r = requireRedis();
  const ts = typeof event?.ts === "string" ? event.ts : nowIso();
  const line = JSON.stringify({ ts, ...event });

  await r.lpush(K.audit, line);
  await r.ltrim(K.audit, 0, 499); // keep last 500
  return { ok: true };
}

// ---------- Audit / Logs ----------
export async function getLogs(limit = 200): Promise<any[]> {
  const r = requireRedis();
  const lines = (await r.lrange<string[]>(K.audit, 0, Math.max(0, limit - 1))) ?? [];
  return lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
