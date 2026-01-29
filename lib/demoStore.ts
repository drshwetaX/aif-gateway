// lib/demoStore.ts

export type Agent = {
  id: string;
  name: string;
  problem_statement: string;
  override_tier?: string;
  created_at: string;

  // optional lifecycle fields your routes may set
  status?: "active" | "killed" | "terminated" | string;
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

export async function addAgent(agent: Agent) {
  store.agents.unshift(agent);
  return agent;
}
// ---- Decisions (demo-friendly in-memory) ----
// ---- Logs (demo-friendly in-memory) ----

export type DemoLog = {
  id: string;
  ts: string;
  level?: "info" | "warn" | "error" | string;
  msg: string;
  meta?: any;
  [key: string]: any;
};

if (!g.__DEMO_STORE_LOGS__) {
  g.__DEMO_STORE_LOGS__ = {
    logs: [] as DemoLog[],
  };
}
const logStore = g.__DEMO_STORE_LOGS__ as { logs: DemoLog[] };

export async function pushLog(log: DemoLog): Promise<DemoLog> {
  logStore.logs.unshift(log);
  // optional: cap growth
  if (logStore.logs.length > 500) logStore.logs.length = 500;
  return log;
}

export async function getLogs(limit = 200): Promise<DemoLog[]> {
  return logStore.logs.slice(0, Math.max(1, limit));
}
export type Decision = {
  id: string;                 // decision id (or same as agent id, depending on your app)
  agentId?: string;
  decision: "ALLOW" | "DENY" | "PENDING" | string;
  decided_at?: string;
  decided_by?: string;
  reason?: string;
  notes?: string;
  [key: string]: any;
};

if (!g.__DEMO_STORE_DECISIONS__) {
  g.__DEMO_STORE_DECISIONS__ = {
    decisions: [] as Decision[],
  };
}
const decisionStore = g.__DEMO_STORE_DECISIONS__ as { decisions: Decision[] };
// ---- Outbox (demo-friendly in-memory) ----

export type OutboxMessage = {
  id: string;
  ts: string;

  // who/where
  to?: string;
  channel?: "email" | "sms" | "slack" | string;

  // what
  subject?: string;
  body?: string;
  template?: string;

  // related entity
  decision_id?: string;
  agent_id?: string;

  // anything else the app wants to attach
  [key: string]: any;
};

if (!g.__DEMO_STORE_OUTBOX__) {
  g.__DEMO_STORE_OUTBOX__ = {
    outbox: [] as OutboxMessage[],
  };
}
const outboxStore = g.__DEMO_STORE_OUTBOX__ as { outbox: OutboxMessage[] };

/**
 * Push a message to the outbox queue (for demo notifications).
 * Returns the queued message.
 */
export async function pushOutbox(msg: OutboxMessage): Promise<OutboxMessage> {
  outboxStore.outbox.unshift(msg);
  return msg;
}
export async function getDecision(id: string): Promise<Decision | null> {
  return decisionStore.decisions.find((d) => d.id === id) ?? null;
}

/**
 * Update a decision by id (creates it if missing).
 * This matches typical "updateDecision" semantics used by demo APIs.
 */
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


export async function listAgents(): Promise<Agent[]> {
  return store.agents;
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

/**
 * Update an agent by id with a partial patch.
 * Returns the updated agent, or null if not found.
 */
export async function updateAgent(
  id: string,
  patch: Partial<Agent>
): Promise<Agent | null> {
  const idx = store.agents.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const updated: Agent = {
    ...store.agents[idx],
    ...patch,
  };

  store.agents[idx] = updated;
  return updated;
}

export async function clearAgents() {
  store.agents = [];
}
