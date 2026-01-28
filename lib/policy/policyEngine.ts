/**
 * policyEngine.ts
 * Purpose: Resolve agent tier + default controls from the runtime policy pack.
 */

import { loadAuraPolicy } from "./loadPolicy";

export type Tier = "A1" | "A2" | "A3" | "A4" | "A5" | "A6";

export type AgentIntent = {
  actions: string[];
  systems: string[];
  dataSensitivity?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII";
  crossBorder?: boolean;
};

const TIER_ORDER: Tier[] = ["A1", "A2", "A3", "A4", "A5", "A6"];

function tierRank(t: Tier) {
  return TIER_ORDER.indexOf(t);
}

function isTier(x: any): x is Tier {
  return typeof x === "string" && (TIER_ORDER as string[]).includes(x);
}

/**
 * Compute the max tier across all matching rules (MAX_TIER strategy).
 * - Safer when policy.tiering is missing
 * - Prevents empty actions from accidentally matching actionsOnly rules
 */
export function resolveTier(intent: AgentIntent): Tier {
  const policy = loadAuraPolicy();
  const rules = (policy.tiering?.rules ?? []) as any[];

  let best: Tier = "A1";

  for (const r of rules) {
    const cond = r?.if ?? {};

    const actionsAny = cond.actionsAny as string[] | undefined;
    const actionsOnly = cond.actionsOnly as string[] | undefined;
    const systemsAny = cond.systemsAny as string[] | undefined;
    const dataSensitivityIn = cond.dataSensitivityIn as string[] | undefined;
    const crossBorder = cond.crossBorder as boolean | undefined;

    const matches =
      (actionsAny ? actionsAny.some((a) => intent.actions.includes(a)) : true) &&
      (actionsOnly
        ? intent.actions.length > 0 &&
          intent.actions.every((a) => actionsOnly.includes(a))
        : true) &&
      (systemsAny ? systemsAny.some((s) => intent.systems.includes(s)) : true) &&
      (dataSensitivityIn
        ? dataSensitivityIn.includes(intent.dataSensitivity ?? "")
        : true) &&
      (crossBorder !== undefined ? crossBorder === !!intent.crossBorder : true);

    if (!matches) continue;

    const proposed = r?.thenTier;
    if (!isTier(proposed)) continue;

    if (tierRank(proposed) > tierRank(best)) best = proposed;
  }

  return best;
}

/**
 * Get defaultControls for a given tier (logging, piiRedaction, HITL, etc.)
 */
export function controlsForTier(tier: Tier) {
  const policy = loadAuraPolicy();
  const tiers = (policy.tiers ?? []) as any[];

  const t = tiers.find((x) => x?.tier === tier);
  if (!t) throw new Error(`Unknown tier ${tier}`);

  // Keep return shape stable for callers:
  return t.defaultControls ?? {};
}
