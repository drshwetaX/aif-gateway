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

export type Decision = {
  id: string;
  status?: string; // "PENDING" | "APPROVED" | "DENIED" | etc.
  [k: string]: any;
};

const DATA_DIR = process.env.DEMO_DATA_DIR || "./data/demo";
const AGENTS_PATH = path.join(DATA_DIR, "agents.json");
const DECISIONS_PATH = path.join(DATA_DIR, "decisions.json");
const OUTBOX_PATH = path.join(DATA_DIR, "outbox.jsonl");

// Ledger / audit log (JSONL)
const AUDIT_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

function ensureDirs() {
  fs.mkdirSync(path.dirname(AGENTS_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(DECISIONS_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(OUTBOX_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  ensureDirs();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath: string, obj: any) {
  ensureDirs();
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

// --- Agents store ---
function readAgents(): Record<string, Agent> {
  return safeReadJson<Record<string, Agent>>(AGENTS_PATH, {});
}

function writeAgents(obj: Record<string, Agent>) {
  safeWriteJson(AGENTS_PATH, obj);
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

// --- Decisions store ---
function readDecisions(): Record<string, Decision> {
  return safeReadJson<Record<string, Decision>>(DECISIONS_PATH, {});
}

function writeDecisions(obj: Record<string, Decision>) {
  safeWriteJson(DECISIONS_PATH, obj);
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

// --- Outbox (minimal) ---
export function pushOutbox(msg: any) {
  ensureDirs();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...msg,
  });
  fs.appendFileSync(OUTBOX_PATH, line + "\n", "utf8");
  return { ok: true };
}

// --- Audit / Ledger (minimal) ---
export function appendAudit(event: any) {
  ensureDirs();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  });
  fs.appendFileSync(AUDIT_PATH, line + "\n", "utf8");
  return { ok: true };
}

// Optional helpers (so any callers won’t break)
export function getLogs(_limit = 200) {
  // If you want: parse last N lines from AUDIT_PATH. For now keep minimal.
  return [];
}

export function addLog(evt: any) {
  return appendAudit(evt);
}
