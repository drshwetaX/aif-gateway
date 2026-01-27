/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Store approve decisions + HITL approval state in the ledger (append-only).
 */
import crypto from "crypto";
import { appendLedgerEvent, getLatestStateByType } from "../audit/ledger";

export type Decision = {
  decision_id: string;
  agent_id: string;
  requester_hash: string;
  action: string;
  target: string;
  tier: string;
  control_mode: "AUTO" | "HITL" | "HOTL";
  allowed: boolean;           // allowed to proceed immediately (AUTO/HOTL)
  status: "PENDING" | "APPROVED" | "DENIED" | "EXECUTED";
  reason: string;
  policy_version: string;
  matched_rules: string[];
  created_at: number;
};

function did() {
  return `DEC-${crypto.randomBytes(8).toString("hex")}`;
}

export async function createDecision(d: Omit<Decision, "decision_id" | "status" | "created_at">) {
  const decision: Decision = {
    ...d,
    decision_id: did(),
    status: d.allowed ? "APPROVED" : "PENDING",
    created_at: Date.now(),
  };
  await appendLedgerEvent("decision_created", { decision });
  return decision;
}

export async function setDecisionStatus(decision_id: string, status: Decision["status"], by_hash: string) {
  await appendLedgerEvent("decision_status_changed", { decision_id, status, by_hash });
}

export async function getDecision(decision_id: string): Promise<Decision | null> {
  const evt = await getLatestStateByType("decision_created", "decision.decision_id", decision_id);
  if (!evt) return null;
  const decision = evt.decision as Decision;

  const st = await getLatestStateByType("decision_status_changed", "decision_id", decision_id);
  if (st?.status) decision.status = st.status;

  return decision;
}
