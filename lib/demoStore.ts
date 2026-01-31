// lib/demoStore.ts
import fs from "fs";
import path from "path";
import { getRedis } from "./redis";

export type AgentStatus =
  | "requested"
  | "approved"
  | "paused"
  | "killed"
  | "terminated"
  | "active"
  | string;

export type AgentEnv = "prod" | "test" | "sandbox" | string;
export type AgentStage = "poc" | "pilot" | "prod" | string;

export type Agent = {
  id: string;
  name: string;
  problem_statement: string;

  // tiering / policy
  override_tier?: string;
  tier?: string;
  controls?: any;
  intent?: any;
  allowed_tools?: string[];
  policy_version?: string;
  tiering_explain?: any;

  // ownership / lifecycle
  owner?: string;
  status?: AgentStatus;
  approved?: boolean;

  // timestamps
  created_at: string;
  requested_at?: string;
  approved_at?: string;

  // extra metadata
  env?: AgentEnv;
  stage?: AgentStage;
  comment?: string;
  review_notes?: string | null;

  review?: {
    decision: "PENDING" | "APPROVE" | "REJECT" | string;
    decidedAt?: string | null;
    decidedBy?: string | null;
    notes?: string | null;
  };

  // optional lifecycle fields
  killed_at?: string;
  terminated_at?: string;
  reason?: string;

  // optional operational fields (like heartbeat)
  last_seen_at?: string;

  [key: string]: any;
};

// --- Logs ---
export type DemoLog = {
  id: string;
  ts: string;
  level?: "info" | "warn" | "error" | string;
  msg: string;
  meta?: any;
  [key: string]: any;
};

// --- Decisions ---
export type Decision = {
  id: string;
  agentId?: string;
  decision: "ALLOW" | "DENY" | "PENDING" | string;
  decided_at?: string;
  decided_by?: string;
  reason?: string;
  notes?: string;
  [key: string]: any;
};

// --- Outbox ---
export type OutboxMessage = {
  id: string;
  ts: string;
  to?: string;
  channel?: "email" | "sms" | "slack" | string;
  subject?: string;
  body?: string;
  template?: string;
  decision_id?: string;
  agent_id?: string;
  [key: string]: any;
};

type PersistedStore = {
  agents: Agent[];
  logs: DemoLog[];
  decisions: Decision[];
  outbox: OutboxMessage[];
};

// If Upstash env vars are present, we treat Redis as the source of truth for agents.
// If Upstash env vars are present, we treat Redis as the source of truth for agents.
// ✅ Robust env detection (covers common naming differences between local/prod)
const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.UPSTASH_REDIS_URL ||
  process.env.AIF_REDIS_REST_URL ||
  process.env.REDIS_REST_URL ||
  "";

const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN || // (kept intentionally if you only use REST_TOKEN)
  process.env.UPSTASH_REDIS_TOKEN ||
  process.env.AIF_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN ||
  "";

const USE_REDIS = Boolean(REDIS_URL && REDIS_TOKEN);

const REDIS_AGENTS_LIST_KEY = `${REDIS_PREFIX}:agents:list`;
const redisAgentKey = (id: string) => `${REDIS_PREFIX}:agents:${id}`;

// ✅ single Redis handle
const r = USE_REDIS ? getRedis() : null;

// -------------------- Redis helpers (agents only) --------------------
async function redisListAgents(): Promise<Agent[]> {
  if (!r) return [];

  const ids = (await r.lrange(REDIS_AGENTS_LIST_KEY, 0, 499)) as unknown as
    | string[]
    | null;

  if (!ids?.length) return [];

  const keys = ids.map((id) => redisAgentKey(id));

  // Upstash supports MGET; depending on client version it can be mget(keys) or mget(...keys)
  let raws: Array<string | null> = [];
  try {
    const res = (await (r as any).mget(keys)) as Array<string | null>;
    raws = Array.isArray(res) ? res : [];
  } catch {
    // fallback: sequential GET
    raws = await Promise.all(
      keys.map(async (k) => ((await r.get(k)) as unknown as string | null) ?? null)
    );
  }

  const out: Agent[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as Agent);
    } catch {
      // ignore corrupt entries
    }
  }

  return out;
}

async function redisGetAgent(id: string): Promise<Agent | null> {
  if (!r) return null;
  const raw = (await r.get(redisAgentKey(id))) as unknown as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Agent;
  } catch {
    return null;
  }
}

async function redisUpsertAgent(agent: Agent): Promise<Agent> {
  if (!r) return agent;

  const id = agent.id;
  const json = JSON.stringify(agent);

  // Keep list ordered by most-recent update: remove then LPUSH
  await r.set(redisAgentKey(id), json);
  await r.lrem(REDIS_AGENTS_LIST_KEY, 0, id);
  await r.lpush(REDIS_AGENTS_LIST_KEY, id);
  await r.ltrim(REDIS_AGENTS_LIST_KEY, 0, 499);

  return agent;
}

async function redisClearAgents(): Promise<void> {
  if (!r) return;

  const ids = (await r.lrange(REDIS_AGENTS_LIST_KEY, 0, 9999)) as unknown as
    | string[]
    | null;

  if (ids?.length) {
    await Promise.all(ids.map((id) => r.del(redisAgentKey(id))));
  }

  await r.del(REDIS_AGENTS_LIST_KEY);
}

// -------------------- File-backed store (logs/decisions/outbox + fallback agents) --------------------
// ⚠️ IMPORTANT: On serverless, never touch filesystem when Redis is enabled.
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "demoStore.json");

function ensureFile() {
  if (USE_REDIS) return; // ✅ do nothing when Redis is enabled
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial: PersistedStore = { agents: [], logs: [], decisions: [], outbox: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readStore(): PersistedStore {
  if (USE_REDIS) {
    // ✅ never read from disk in Redis mode
    return { agents: [], logs: [], decisions: [], outbox: [] };
  }

  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}") as Partial<PersistedStore>;
    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
    };
  } catch {
    const fresh: PersistedStore = { agents: [], logs: [], decisions: [], outbox: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

let writeChain: Promise<void> = Promise.resolve();
function writeStore(next: PersistedStore): Promise<void> {
  if (USE_REDIS) return Promise.resolve(); // ✅ never write to disk in Redis mode
  ensureFile();
  writeChain = writeChain.then(async () => {
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  return writeChain;
}

// In-process cache
const g = globalThis as any;

// ✅ Critical fix: do NOT call readStore() at import time when Redis is enabled
if (!g.__DEMO_STORE_PERSIST__) {
  g.__DEMO_STORE_PERSIST__ = USE_REDIS
    ? ({ agents: [], logs: [], decisions: [], outbox: [] } as PersistedStore)
    : readStore();
}

const store = g.__DEMO_STORE_PERSIST__ as PersistedStore;

// ----- Logs -----
export async function pushLog(log: DemoLog): Promise<DemoLog> {
  store.logs.unshift(log);
  if (store.logs.length > 500) store.logs.length = 500;
  await writeStore(store);
  return log;
}

export async function getLogs(limit = 200): Promise<DemoLog[]> {
  return store.logs.slice(0, Math.max(1, limit));
}

// ----- Decisions -----
export async function getDecision(id: string): Promise<Decision | null> {
  return store.decisions.find((d) => d.id === id) ?? null;
}

export async function updateDecision(
  id: string,
  patch: Partial<Decision> & { id?: string }
): Promise<Decision> {
  const idx = store.decisions.findIndex((d) => d.id === id);

  if (idx === -1) {
    const created: Decision = { id, decision: "PENDING", ...patch };
    store.decisions.unshift(created);
    await writeStore(store);
    return created;
  }

  const updated: Decision = { ...store.decisions[idx], ...patch, id };
  store.decisions[idx] = updated;
  await writeStore(store);
  return updated;
}

// ----- Outbox -----
export async function pushOutbox(msg: OutboxMessage): Promise<OutboxMessage> {
  store.outbox.unshift(msg);
  await writeStore(store);
  return msg;
}

// ----- Agents (Redis-backed when available) -----
export async function listAgents(): Promise<Agent[]> {
  if (USE_REDIS) return await redisListAgents();
  return store.agents;
}

export async function addAgent(agent: Agent) {
  return await upsertAgent(agent);
}

export async function upsertAgent(agent: Agent): Promise<Agent> {
  if (USE_REDIS) return await redisUpsertAgent(agent);

  const idx = store.agents.findIndex((a) => a.id === agent.id);
  if (idx === -1) {
    store.agents.unshift(agent);
    await writeStore(store);
    return agent;
  }
  const updated: Agent = { ...store.agents[idx], ...agent };
  store.agents[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (USE_REDIS) return await redisGetAgent(id);
  return store.agents.find((a) => a.id === id) ?? null;
}

export async function updateAgent(id: string, patch: Partial<Agent>): Promise<Agent | null> {
  if (USE_REDIS) {
    const existing = await redisGetAgent(id);
    if (!existing) return null;
    const updated: Agent = { ...existing, ...patch };
    return await redisUpsertAgent(updated);
  }

  const idx = store.agents.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const updated: Agent = { ...store.agents[idx], ...patch };
  store.agents[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function clearAgents() {
  if (USE_REDIS) return await redisClearAgents();
  store.agents = [];
  await writeStore(store);
}
