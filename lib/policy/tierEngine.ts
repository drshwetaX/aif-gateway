/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Compute AURA tier using:
 *  1) OpenAI-inferred attributes
 *  2) Deterministic policy rules (MAX_TIER)
 *  3) Optional manual override (audited)
 */
import { inferAuraAttributes } from "../llm/auraClassifier";
import { evalTierFromRules } from "./tierRules";
import { loadAuraPolicy } from "./auraPolicyLoader";

export async function computeTier(problemStatement: string, overrideTier?: string) {
  const pack = loadAuraPolicy();
  const attrs = await inferAuraAttributes(problemStatement);
  const ruleEval = evalTierFromRules({
    actions: attrs.actions,
    systems: attrs.systems,
    dataSensitivity: attrs.dataSensitivity,
    crossBorder: attrs.crossBorder,
  });

  const finalTier = overrideTier || ruleEval.tier;

  const tierDef = pack.tiers.find((t) => t.tier === finalTier) || pack.tiers[0];

  return {
    policy_version: pack.version, // from your policy pack :contentReference[oaicite:4]{index=4}
    generatedAt: pack.generatedAt,
    attrs,
    ruleEval,
    finalTier,
    controls: tierDef?.defaultControls || {},
  };
}
