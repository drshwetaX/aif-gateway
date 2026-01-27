/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Load AURA runtime policy pack used for deterministic tiering + audit versioning.
 */

import fs from "fs";
import path from "path";

export type AuraPolicyPack = {
  version: string;
  generatedAt: string;
  tierOrder: string[];
  tiering: { mergeStrategy: "MAX_TIER"; tierOrder: string[]; rules: any[] };
  tiers: Array<{ tier: string; defaultControls: any }>;
  mappings: any;
};

let cached: AuraPolicyPack | null = null;

export function loadAuraPolicy(): AuraPolicyPack {
  if (cached) return cached;
  const p = path.join(process.cwd(), "config", "aura_policy_pack.runtime_v2.json");
  const raw = fs.readFileSync(p, "utf8");
  const json = JSON.parse(raw);

  // normalize shape based on your uploaded runtime pack :contentReference[oaicite:3]{index=3}
  cached = {
    version: json.version,
    generatedAt: json.generatedAt,
    tierOrder: json.tiering?.tierOrder || json.tierOrder || ["A1","A2","A3","A4","A5","A6"],
    tiering: json.tiering,
    tiers: json.tiers,
    mappings: json.mappings,
  };
  return cached!;
}

export function policyVersionTag() {
  const p = loadAuraPolicy();
  return { version: p.version, generatedAt: p.generatedAt };
}
