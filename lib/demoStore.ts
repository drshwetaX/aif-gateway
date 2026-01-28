// lib/demoStore.ts
// Minimal demo store to unblock builds and support demo agent endpoints.

import fs from "fs";
import path from "path";

export type Agent = {
  id: string;
  name?: string;
  status?: string; // "active" | "killed" | etc.
  [k: string]: any;
};

const DATA_DIR = process.env.DEMO_DATA_DIR || "./data/demo";
const AGENTS_PATH = path.join(DATA_DIR, "agents.json");
const AUDIT_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

function ensureDirs() {
  fs.mkdirSync(path.dirname(AGENTS_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
}

function readAgents(): Record<string, Agent> {
  ensureDirs();
  if (!fs.existsSync(AGENTS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(AGENTS_PATH, "utf8") || "{}");
  } catch {
    return {};
  }
}

function writeAgents(obj: Record<string, Agent>) {
  ensureDirs();
  fs.writeFileSync(AGENTS_PATH, JSON.stringify(obj, null, 2), "utf8");
}

export function getAgent(id: string): Agent | null {
  const agents = readAgents();
  return agents[id] ?? null;
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent {
  const agents = readAgents();
  const existing: Agent = agents[id] ?? { id };
  const updated: Agent = { ...existing, ...patch, id };
  agents[id] = updated;
  writeAgents(agents);
  return updated;
}
// --- Decisions store (minimal) ---

export type Decision = {
  id: string;
  status?: string; // "PENDING" | "APPROVED" | "DENIED" | etc.
  [k: string]: any;
};

const DECISIONS_PATH = path.join(DATA_DIR, "decisions.json");

function readDecisions(): Record<string, Decision> {
  ensureDirs();
  if (!fs.existsSync(DECISIONS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DECISIONS_PATH, "utf8") || "{}");
  } catch {
    return {};
  }
}

function writeDecisions(obj: Record<string, Decision>) {
  ensureDirs();
  fs.writeFileSync(DECISIONS_PATH, JSON.stringify(obj, null, 2), "utf8");
}

export function getDecision(id: string): Decision | null {
  const decisions = readDecisions();
  return decisions[id] ?? null;
}

export function updateDecision(id: string, patch: Partial<Decision>): Decision {
  const decisions = readDecisions();
  const existing: Decision = decisions[id] ?? { id, status: "PENDING" };
  const updated: Decision = { ...existing, ...patch, id };
  decisions[id] = updated;
  writeDecisions(decisions);
  return updated;
}

export function appendAudit(event: any) {
  ensureDirs();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  });
  fs.appendFileSync(AUDIT_PATH, line + "\n", "utf8");
}
