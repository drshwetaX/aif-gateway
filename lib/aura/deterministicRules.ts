/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Deterministic tier evaluation using policy pack rules.
 * Merge strategy: MAX_TIER (conservative floor)
 */

import { loadAuraPolicy } from "./policyLoader";
import type { AuraSignals } from "../llm/auraClassifier";

type Tier = "A1"|"A2"|"A3"|"A4"|"A5"|"A6";

function maxTier(a: Tier, b: Tier, order: string[]): Tier {
  return (order.indexOf(a) >= order.indexOf(b) ? a : b) as Tier;
}

export function evaluateTierFromRules(input: {
  actions: string[];
  systems: string[];
  data_sensitivity: string;
  cross_border: boolean;
}, signals: AuraSignals): { tier: Tier; matched_rule_ids: string[] } {

  const policy = loadAuraPolicy();
  const order = policy.tiering.tierOrder as Tier[];

  const facts = {
    actionsAny: Array.from(new Set([...(input.actions||[]), ...(signals.inferred_actions||[])])),
    systemsAny: input.systems || [],
    dataSensitivity: input.data_sensitivity || signals.data_sensitivity,
    crossBorder: !!(input.cross_border || signals.cross_border),
  };

  let tier: Tier = "A1";
  const matched: string[] = [];

  for (const r of policy.tiering.rules || []) {
    const cond = r.if || {};
    let hit = true;

    if (cond.actionsAny) {
      hit = hit && cond.actionsAny.some((x: string) => facts.actionsAny.includes(x));
    }
    if (cond.actionsOnly) {
      hit = hit && facts.actionsAny.every((x: string) => cond.actionsOnly.includes(x));
    }
    if (cond.systemsAny) {
      hit = hit && cond.systemsAny.some((x: string) => facts.systemsAny.includes(x));
    }
    if (cond.dataSensitivityIn) {
      hit = hit && cond.dataSensitivityIn.includes(facts.dataSensitivity);
    }
    if (typeof cond.crossBorder === "boolean") {
      hit = hit && (facts.crossBorder === cond.crossBorder);
    }

    if (hit) {
      matched.push(r.id);
      tier = maxTier(tier, r.thenTier as Tier, order);
    }
  }

  return { tier, matched_rule_ids: matched };
}
