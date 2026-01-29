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

export async function listAgents(): Promise<Agent[]> {
  return store.agents;
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
