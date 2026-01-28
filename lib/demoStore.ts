// lib/demoStore.ts
import fs from "fs";
import path from "path";

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

  tier?: string;         // A1-A6
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

const DATA_DIR = process.env.DEMO_DATA_DIR || "./data/demo";
const AGENTS_PATH = path.join(DATA_DIR, "agents.json");
const DECISIONS_PATH = path.join(DATA_DIR, "decisions.json");
const OUTBOX_PATH = path.join(DATA_DIR, "outbox.jsonl");

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

function nowIso() {
  return new Date().toISOString();
}

// ---------- Agents ----------
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

export function listAgents(): Agent[] {
  return Object.values(readAgents());
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent {
  const agents = readAgents();
  const existing: Agent = agents[id] ?? { id, createdAt: nowIso(), status: "requested", approved: false };
  const updated: Agent = { ...existing, ...patch, id };
  agents[id] = updated;
  writeAgents(agents);
  return updated;
}

// ---------- Decisions ----------
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

export function listDecisions(): Decision[] {
  return Object.values(readDecisions());
}

export function updateDecision(id: string, patch: Partial<Decision>): Decision {
  const decisions = readDecisions();
  const existing: Decision = decisions[id] ?? { id, createdAt: nowIso(), status: "PENDING" };
  const updated: Decision = { ...existing, ...patch, id };
  decisions[id] = updated;
  writeDecisions(decisions);
  return updated;
}

// ---------- Outbox ----------
export function pushOutbox(msg: any) {
  ensureDirs();
  const line = JSON.stringify({ ts: nowIso(), ...msg });
  fs.appendFileSync(OUTBOX_PATH, line + "\n", "utf8");
  return { ok: true };
}

// ---------- Audit / Logs ----------
export function getLogs(limit = 200): any[] {
  ensureDirs();
  if (!fs.existsSync(AUDIT_PATH)) return [];
  try {
    const raw = fs.readFileSync(AUDIT_PATH, "utf8");
    if (!raw) return [];
    const lines = raw.trim().split("\n");
    const tail = lines.slice(Math.max(0, lines.length - limit));
    return tail
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
