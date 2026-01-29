import fs from "fs";
import path from "path";

export type OverrideRecord = {
  id: string;
  agent_id: string;
  requestedTier: string;
  requestedBy: string;
  requestedAt: string; // ISO
  reason: string;

  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

  approvedBy?: string;
  approvedAt?: string; // ISO
  expiresAt?: string; // ISO
};

const DATA_DIR = process.env.DEMO_DATA_DIR || "./data/demo";
const OVERRIDES_PATH = path.join(DATA_DIR, "overrides.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true });
}

function safeRead(): Record<string, OverrideRecord> {
  ensureDir();
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, "utf8");
    return raw ? (JSON.parse(raw) as Record<string, OverrideRecord>) : {};
  } catch {
    return {};
  }
}

function safeWrite(obj: Record<string, OverrideRecord>) {
  ensureDir();
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(obj, null, 2), "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = "ovr") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function requestOverride(input: {
  agent_id: string;
  requestedTier: string;
  requestedBy: string;
  reason: string;
}): OverrideRecord {
  const all = safeRead();
  const id = uid();
  const rec: OverrideRecord = {
    id,
    agent_id: input.agent_id,
    requestedTier: input.requestedTier,
    requestedBy: input.requestedBy,
    requestedAt: nowIso(),
    reason: input.reason || "",
    status: "PENDING",
  };
  all[id] = rec;
  safeWrite(all);
  return rec;
}

export function approveOverride(input: {
  id: string;
  approvedBy: string;
  ttlMinutes: number;
}): OverrideRecord | null {
  const all = safeRead();
  const rec = all[input.id];
  if (!rec) return null;

  const ttl = Math.max(1, Math.min(24 * 60, Number(input.ttlMinutes || 60))); // 1..1440
  const exp = new Date(Date.now() + ttl * 60 * 1000).toISOString();

  const updated: OverrideRecord = {
    ...rec,
    status: "APPROVED",
    approvedBy: input.approvedBy,
    approvedAt: nowIso(),
    expiresAt: exp,
  };

  all[input.id] = updated;
  safeWrite(all);
  return updated;
}

export function revokeOverride(id: string, by: string): OverrideRecord | null {
  const all = safeRead();
  const rec = all[id];
  if (!rec) return null;
  const updated: OverrideRecord = {
    ...rec,
    status: "REVOKED",
    approvedBy: rec.approvedBy || by,
    approvedAt: rec.approvedAt || nowIso(),
    expiresAt: nowIso(),
  };
  all[id] = updated;
  safeWrite(all);
  return updated;
}

export function listOverrides(): OverrideRecord[] {
  return Object.values(safeRead()).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

export function getActiveOverrideForAgent(agent_id: string): OverrideRecord | null {
  const all = safeRead();
  const recs = Object.values(all)
    .filter((r) => r.agent_id === agent_id && r.status === "APPROVED" && r.expiresAt)
    .sort((a, b) => (String(a.expiresAt) < String(b.expiresAt) ? 1 : -1));

  const top = recs[0];
  if (!top?.expiresAt) return null;

  const exp = Date.parse(top.expiresAt);
  if (Number.isNaN(exp) || Date.now() >= exp) return null;

  return top;
}
