/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Append-only, tamper-evident ledger (hash chain) for auditability.
 *
 * "Immutable" in demo sense = append-only + chained hashes.
 * In enterprise, this can map to WORM storage / SIEM / audit lake.
 */
import fs from "fs";
import crypto from "crypto";
import { redactForAudit } from "../safety/redact";

const LEDGER = process.env.LEDGER_PATH || "./data/ledger/aif_ledger.jsonl";

type LedgerEvent = {
  ts: number;
  type: string;
  payload: any;          // already redacted / safe
  prev_hash: string;
  hash: string;
};

function ensureDir() {
  const dir = LEDGER.split("/").slice(0, -1).join("/");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function readLastHash(): string {
  try {
    if (!fs.existsSync(LEDGER)) return "GENESIS";
    const lines = fs.readFileSync(LEDGER, "utf-8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    return last.hash || "GENESIS";
  } catch {
    return "GENESIS";
  }
}

export async function appendLedgerEvent(type: string, rawPayload: any) {
  ensureDir();
  const prev = readLastHash();
  const safe = redactForAudit(rawPayload);

  const base = {
    ts: Date.now(),
    type,
    payload: safe,
    prev_hash: prev,
  };

  const hash = sha(JSON.stringify(base));
  const evt: LedgerEvent = { ...base, hash };

  fs.appendFileSync(LEDGER, JSON.stringify(evt) + "\n");
  return evt;
}

// helper: get latest matching event by dotted field equality
export async function getLatestStateByType(type: string, dottedKey: string, equals: string) {
  if (!fs.existsSync(LEDGER)) return null;
  const lines = fs.readFileSync(LEDGER, "utf-8").trim().split("\n").reverse();

  for (const line of lines) {
    const evt = JSON.parse(line);
    if (evt.type !== type) continue;

    const parts = dottedKey.split(".");
    let v = evt.payload;
    for (const p of parts) v = v?.[p];

    if (String(v) === String(equals)) return evt.payload;
  }
  return null;
}
