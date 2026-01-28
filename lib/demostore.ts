// lib/demoStore.ts
// Minimal demo store to unblock builds. Replace with real registry wiring later.

export type Agent = {
  id: string;
  name?: string;
  status?: string;
  [k: string]: any;
};

const AGENTS: Record<string, Agent> = {
  "demo-agent": { id: "demo-agent", name: "Demo Agent", status: "active" },
};

export function getAgent(id: string): Agent | null {
  return AGENTS[id] ?? null;
}
