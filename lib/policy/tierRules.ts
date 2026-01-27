/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Deterministic evaluation of tiering rules from the policy pack.
 */
import { loadAuraPolicy } from "./auraPolicyLoader";

export type TierEvalResult = {
  tier: string;
  matched_rule_ids: string[];
  reasons: string[];
};

function maxTier(tiers: string[], order: string[]) {
  const idx = (t: string) => Math.max(0, order.indexOf(t));
  return tiers.sort((a, b) => idx(b) - idx(a))[0] || order[0];
}

function includesAny(hay: string[], needles: string[]) {
  const s = new Set((hay || []).map((x) => String(x).toLowerCase()));
  return (needles || []).some((n) => s.has(String(n).toLowerCase()));
}

export function evalTierFromRules(attrs: {
  actions: string[];
  systems: string[];
  dataSensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII";
  crossBorder: boolean;
}): TierEvalResult {
  const pack = loadAuraPolicy();

  const hits: { id: string; tier: string; rationale: string }[] = [];

  for (const rule of pack.tiering.rules) {
    const cond = rule.if || {};
    let ok = true;

    if (cond.actionsAny) ok = ok && includesAny(attrs.actions, cond.actionsAny);
    if (cond.systemsAny) ok = ok && includesAny(attrs.systems, cond.systemsAny);
    if (cond.dataSensitivityIn) ok = ok && cond.dataSensitivityIn.includes(attrs.dataSensitivity);
    if (typeof cond.crossBorder === "boolean") ok = ok && attrs.crossBorder === cond.crossBorder;

    // actionsOnly means ALL actions must be within the listed set
    if (cond.actionsOnly) {
      const allowed = new Set((cond.actionsOnly || []).map((x: string) => x.toLowerCase()));
      ok = ok && (attrs.actions || []).every((a) => allowed.has(String(a).toLowerCase()));
    }

    if (ok) hits.push({ id: rule.id, tier: rule.thenTier, rationale: rule.rationale });
  }

  const chosen = maxTier(hits.map((h) => h.tier), pack.tiering.tierOrder);

  return {
    tier: chosen,
    matched_rule_ids: hits.map((h) => h.id),
    reasons: hits.map((h) => `${h.id}: ${h.rationale}`),
  };
}
