// lib/demoStore.ts
export type Agent = {
  id: string;
  name: string;
  problem_statement: string;
  override_tier?: string;
  created_at: string;
};

// Simple in-memory store (demo-friendly).
// NOTE: This resets on server restart and won’t persist across deployments.
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

export async function clearAgents() {
  store.agents = [];
}
