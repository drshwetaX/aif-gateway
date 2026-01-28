import { loadAuraPolicy } from "./loadPolicy";

type Tier = "A1" | "A2" | "A3" | "A4" | "A5" | "A6";

export type AgentIntent = {
  actions: string[];
  systems: string[];
  dataSensitivity?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII";
  crossBorder?: boolean;
};

function tierRank(t: Tier) {
  const order: Tier[] = ["A1","A2","A3","A4","A5","A6"];
  return order.indexOf(t);
}

export function resolveTier(intent: AgentIntent): Tier {
  const policy = loadAuraPolicy();
  const rules = policy.tiering.rules as any[];

  let best: Tier = "A1";

  for (const r of rules) {
    const cond = r.if || {};

    const actionsAny = cond.actionsAny as string[] | undefined;
    const actionsOnly = cond.actionsOnly as string[] | undefined;
    const systemsAny = cond.systemsAny as string[] | undefined;
    const dataSensitivityIn = cond.dataSensitivityIn as string[] | undefined;
    const crossBorder = cond.crossBorder as boolean | undefined;

    const matches =
      (actionsAny ? actionsAny.some(a => intent.actions.includes(a)) : true) &&
      (actionsOnly ? intent.actions.every(a => actionsOnly.includes(a)) : true) &&
      (systemsAny ? systemsAny.some(s => intent.systems.includes(s)) : true) &&
      (dataSensitivityIn ? dataSensitivityIn.includes(intent.dataSensitivity ?? "") : true) &&
      (crossBorder !== undefined ? crossBorder === !!intent.crossBorder : true);

    if (matches) {
      const proposed = r.thenTier as Tier;
      if (tierRank(proposed) > tierRank(best)) best = proposed;
    }
  }

  return best;
}

export function controlsForTier(tier: Tier) {
  const policy = loadAuraPolicy();
  const t = (policy.tiers as any[]).find(x => x.tier === tier);
  if (!t) throw new Error(`Unknown tier ${tier}`);
  return t.defaultControls;
}
