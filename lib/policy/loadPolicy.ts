import fs from "fs";
import path from "path";

export type AuraPolicyPack = any; // (optional: replace with a real TS type later)

function readJson(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

let _cached: AuraPolicyPack | null = null;

export function loadAuraPolicy(): AuraPolicyPack {
  if (_cached) return _cached;

  const p = path.join(
    process.cwd(),
    "runtime",
    "policy",
    "aura_policy_pack.runtime_v2.json"
  );

  if (!fs.existsSync(p)) {
    throw new Error(
      `AURA policy pack not found at ${p}. Did you commit it or mount it in the container?`
    );
  }

  const json = readJson(p);

  // Minimal safety checks so failures are obvious:
  if (!json.version) throw new Error("Policy missing: version");
  if (!json.tiers?.length) throw new Error("Policy missing: tiers[]");
  if (!json.tiering?.rules?.length) throw new Error("Policy missing: tiering.rules[]");

  _cached = json;
  return json;
}
