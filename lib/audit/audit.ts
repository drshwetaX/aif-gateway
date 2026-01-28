// lib/audit/audit.ts
// Minimal audit writer with extensible event type.

import fs from "fs";
import path from "path";

export type AuditEvent = {
  ts: string;                     // ISO
  user?: string;
  endpoint: string;
  decision: "ALLOW" | "DENY";
  reason?: string;

  tier?: string;
  controls?: any;
  intent?: any;

  // ✅ allow extra telemetry fields (agentId, decision_id, latency_ms, tokens, cost, etc.)
  [k: string]: any;
};

const AUDIT_PATH = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

function ensureDir() {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
}

export function writeAudit(evt: AuditEvent) {
  ensureDir();
  fs.appendFileSync(AUDIT_PATH, JSON.stringify(evt) + "\n", "utf8");
  return { ok: true };
}
