// lib/demoStore.ts

export type AgentStatus = "requested" | "approved" | "paused" | "killed" | "terminated" | "active" | string;
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

  // timestamps (keep created_at to satisfy your existing type)
  created_at: string;
  requested_at?: string;
  approved_at?: string;

  // extra metadata you asked for
  env?: AgentEnv;          // prod/test/sandbox
  stage?: AgentStage;      // poc/pilot/prod
  review_notes?: string | null;

  review?: {
    decision: "PENDING" | "APPROVE" | "REJECT" | string;
    decidedAt?: string | null;
    decidedBy?: string | null;
    notes?: string | null;
  };

  // optional lifecycle fields your routes may set
  killed_at?: string;
  terminated_at?: string;
  reason?: string;

  // allow future fields without TS fights
  [key: string]: any;
};

// Simple in-memory store (demo-friendly).
// NOTE: Resets on server restart and won't persist across deployments.
const g = globalThis as any;

if (!g.__DEMO_STORE__) {
  g.__DEMO_STORE__ = {
    agents: [] as Agent[],
  };
}
const store = g.__DEMO_STORE__ as { agents: Agent[] };

// --- Logs (demo-friendly in-memory) ---
export type DemoLog = {
  id: string;
  ts: string;
  level?: "info" | "warn" | "error" | string;
  msg: string;
  meta?: any;
  [key: string]: any;
};

if (!g.__DEMO_STORE_LOGS__) {
  g.__DEMO_STORE_LOGS__ = { logs: [] as DemoLog[] };
}
const logStore = g.__DEMO_STORE_LOGS__ as { logs: DemoLog[] };

export async function pushLog(log: DemoLog): Promise<DemoLog> {
  logStore.logs.unshift(log);
  if (logStore.logs.length > 500) logStore.logs.length = 500;
  return log;
}

export async function getLogs(limit = 200): Promise<DemoLog[]> {
  return logStore.logs.slice(0, Math.max(1, limit));
}

// --- Decisions (demo-friendly in-memory) ---
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

if (!g.__DEMO_STORE_DECISIONS__) {
  g.__DEMO_STORE_DECISIONS__ = { decisions: [] as Decision[] };
}
const decisionStore = g.__DEMO_STORE_DECISIONS__ as { decisions: Decision[] };

// --- Outbox (demo-friendly in-memory) ---
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

if (!g.__DEMO_STORE_OUTBOX__) {
  g.__DEMO_STORE_OUTBOX__ = { outbox: [] as OutboxMessage[] };
}
const outboxStore = g.__DEMO_STORE_OUTBOX__ as { outbox: OutboxMessage[] };

export async function pushOutbox(msg: OutboxMessage): Promise<OutboxMessage> {
  outboxStore.outbox.unshift(msg);
  return msg;
}

export async function getDecision(id: string): Promise<Decision | null> {
  return decisionStore.decisions.find((d) => d.id === id) ?? null;
}

export async function updateDecision(
  id: string,
  patch: Partial<Decision> & { id?: string }
): Promise<Decision> {
  const idx = decisionStore.decisions.findIndex((d) => d.id === id);

  if (idx === -1) {
    const created: Decision = { id, decision: "PENDING", ...patch };
    decisionStore.decisions.unshift(created);
    return created;
  }

  const updated: Decision = { ...decisionStore.decisions[idx], ...patch, id };
  decisionStore.decisions[idx] = updated;
  return updated;
}

// --- Agents ---
export async function listAgents(): Promise<Agent[]> {
  return store.agents;
}

export async function addAgent(agent: Agent) {
  store.agents.unshift(agent);
  return agent;
}

export async function upsertAgent(agent: Agent): Promise<Agent> {
  const idx = store.agents.findIndex((a) => a.id === agent.id);
  if (idx === -1) {
    store.agents.unshift(agent);
    return agent;
  }
  const updated: Agent = { ...store.agents[idx], ...agent };
  store.agents[idx] = updated;
  return updated;
}

export async function getAgent(id: string): Promise<Agent | null> {
  return store.agents.find((a) => a.id === id) ?? null;
}

export async function updateAgent(id: string, patch: Partial<Agent>): Promise<Agent | null> {
  const idx = store.agents.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const updated: Agent = { ...store.agents[idx], ...patch };
  store.agents[idx] = updated;
  return updated;
}

export async function clearAgents() {
  store.agents = [];
}
