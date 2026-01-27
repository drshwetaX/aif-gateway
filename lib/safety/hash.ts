/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Pseudonymize identities for audit trails (avoid storing personal data in demo logs).
 */
import crypto from "crypto";

export function hashIdentity(value: string) {
  return crypto.createHash("sha256").update((value || "").toLowerCase()).digest("hex").slice(0, 12);
}
