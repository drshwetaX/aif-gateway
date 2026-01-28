// lib/policy/policyServer.ts
import fs from "fs";
import path from "path";

let cached: any = null;

export function getAuraPolicy() {
  if (cached) return cached;

  const p = path.join(
    process.cwd(),
    "runtime",
    "policy",
    "aura_policy_pack.runtime_v2.json"
  );

  cached = JSON.parse(fs.readFileSync(p, "utf-8"));
  return cached;
}
