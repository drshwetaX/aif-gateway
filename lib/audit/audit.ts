// lib/audit/audit.ts
// Minimal audit writer with extensible event type.

import fs from "fs";
import path from "path";

export type AuditEvent = {
  ts: string; // ISO
  user?: string;
  endpoint: string;
  decision: "ALLOW" | "DENY";
  reason?: string;

  tier?: string;
  controls?: any;
  intent?: any;

  // allow extra telemetry fields (agentId, decision_id, latency_ms, tokens, cost, etc.)
  [k: string]: any;
};

// If LEDGER_PATH is set, use it.
// Otherwise, use /tmp on Vercel, local ./data/... elsewhere.
const DEFAULT_AUDIT_PATH =
  process.env.VERCEL ? "/tmp/ledger/aif_ledger.jsonl" : "./data/ledger/aif_ledger.jsonl";

const AUDIT_PATH = process.env.LEDGER_PATH || DEFAULT_AUDIT_PATH;

async function ensureDir() {
  const dir = path.dirname(AUDIT_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function writeAudit(evt: AuditEvent) {
  try {
    await ensureDir();
    await fs.promises.appendFile(AUDIT_PATH, JSON.stringify(evt) + "\n", "utf8");
    return { ok: true, path: AUDIT_PATH };
  } catch (e: any) {
    // Never crash the API just because audit writing failed (especially on serverless)
    console.error("writeAudit failed:", e?.message || e);
    return { ok: false, error: e?.message || String(e), path: AUDIT_PATH };
  }
}
