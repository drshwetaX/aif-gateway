/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: ID helpers for demo entities (agent, decision, audit)
 */
import crypto from "crypto";

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}
