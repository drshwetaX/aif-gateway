import type { NextApiRequest, NextApiResponse } from "next";
import { loadAuraPolicy } from "@/lib/policy/loadPolicy";
import { writeAudit } from "@/lib/audit/audit";

type ClassifyResult = {
  tier: string; // A1-A6
  confidence: number; // 0..1
  rationale: string;
  drivers: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function getAllowedTiers() {
  const policy = loadAuraPolicy();
  const tiers = Array.isArray((policy as any)?.tiers) ? (policy as any).tiers : [];
  return tiers.map((t: any) => String(t?.id || "")).filter(Boolean);
}

async function callOpenAIJSON(prompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  // Uses Responses API-compatible shape? We’ll keep it simple with Chat Completions style via fetch.
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a risk classifier. Output ONLY JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI error (HTTP ${res.status})`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No model output");
  return JSON.parse(content);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const user = (req.headers["x-demo-user"] as string | undefined) || "tool";
  const body = req.body || {};
  const problem_statement = String(body.problem_statement || "").trim();

  if (!problem_statement) {
    return res.status(400).json({ ok: false, error: "missing_problem_statement" });
  }

  const allowedTiers = getAllowedTiers();
  if (allowedTiers.length === 0) {
    return res.status(500).json({ ok: false, error: "policy_pack_missing_tiers" });
  }

  const prompt = [
    "Classify the following agent problem statement into a risk tier.",
    `Allowed tiers: ${allowedTiers.join(", ")}`,
    "",
    "Return JSON with fields:",
    `{ "tier": "A1|A2|A3|A4|A5|A6", "confidence": 0.0-1.0, "rationale": "string", "drivers": ["..."] }`,
    "",
    "Problem statement:",
    problem_statement,
  ].join("\n");

  try {
    const out = await callOpenAIJSON(prompt);

    const tier = String(out?.tier || "").trim();
    const confidence = Number(out?.confidence ?? 0);
    const rationale = String(out?.rationale || "").trim();
    const drivers = Array.isArray(out?.drivers) ? out.drivers.map((x: any) => String(x)) : [];

    if (!allowedTiers.includes(tier)) {
      writeAudit({
        ts: nowIso(),
        user,
        endpoint: "/api/classify",
        decision: "DENY",
        reason: "llm_returned_invalid_tier",
        tier_returned: tier,
        allowed_tiers: allowedTiers,
      });
      return res.status(422).json({
        ok: false,
        error: "invalid_tier_from_llm",
        allowed_tiers: allowedTiers,
      });
    }

    const result: ClassifyResult = {
      tier,
      confidence: Math.max(0, Math.min(1, confidence)),
      rationale: rationale || "LLM classification completed.",
      drivers,
    };

    writeAudit({
      ts: nowIso(),
      user,
      endpoint: "/api/classify",
      decision: "ALLOW",
      reason: "classified",
      tier: result.tier,
      confidence: result.confidence,
      drivers: result.drivers,
    });

    return res.status(200).json({ ok: true, result });
  } catch (e: any) {
    writeAudit({
      ts: nowIso(),
      user,
      endpoint: "/api/classify",
      decision: "DENY",
      reason: "llm_error",
      message: String(e?.message || e),
    });
    return res.status(500).json({ ok: false, error: "llm_error", message: e?.message || "LLM error" });
  }
}
