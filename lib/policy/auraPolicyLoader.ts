/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Load AURA policy pack (tiers, rules, merge strategy) for tiering + controls.
 */
import fs from "fs";

export type AuraPolicyPack = {
  version: string;
  generatedAt: string;
  tiers: Array<{
    tier: string;
    autonomyBehavior: string;
    governanceRequirements: string;
    defaultControls: any;
  }>;
  tiering: {
    mergeStrategy: "MAX_TIER";
    tierOrder: string[];
    rules: Array<{
      id: string;
      if: any;
      thenTier: string;
      rationale: string;
    }>;
  };
  mappings: any;
};

let cached: AuraPolicyPack | null = null;

export function loadAuraPolicy(): AuraPolicyPack {
  if (cached) return cached;
  const p = process.env.AURA_POLICY_PATH || "./data/policy/aura_policy_pack.runtime_v2.json";
  const raw = fs.readFileSync(p, "utf-8");
  cached = JSON.parse(raw);
  return cached!;
}
