/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Use OpenAI to extract risk signals from an agent problem statement.
 *          NOTE: LLM does NOT decide tier; it only produces structured signals.
 */

export type AuraSignals = {
  inferred_actions: string[];
  data_sensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII";
  cross_border: boolean;
  risk_flags: string[];
  confidence: number;
};

export async function classifyProblemStatement(problem: {
  statement: string;
  target_systems: string[];
  requested_actions: string[];
}): Promise<AuraSignals> {

  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    // Safe fallback: no LLM; return minimal conservative signals
    return {
      inferred_actions: problem.requested_actions || [],
      data_sensitivity: "CONFIDENTIAL",
      cross_border: false,
      risk_flags: ["LLM_DISABLED_FALLBACK"],
      confidence: 0.1
    };
  }

  const prompt = `
You are a risk signal extractor for an enterprise agent control plane.
Given an agent problem statement, return ONLY valid JSON with keys:
inferred_actions (array of strings),
data_sensitivity (PUBLIC|INTERNAL|CONFIDENTIAL|PII),
cross_border (boolean),
risk_flags (array of strings),
confidence (0..1)

Problem statement:
${problem.statement}

Target systems: ${JSON.stringify(problem.target_systems)}
Requested actions: ${JSON.stringify(problem.requested_actions)}

Be conservative if uncertain.
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    return {
      inferred_actions: problem.requested_actions || [],
      data_sensitivity: "CONFIDENTIAL",
      cross_border: false,
      risk_flags: ["LLM_CALL_FAILED"],
      confidence: 0.2
    };
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      inferred_actions: Array.isArray(parsed.inferred_actions) ? parsed.inferred_actions : [],
      data_sensitivity: parsed.data_sensitivity || "CONFIDENTIAL",
      cross_border: !!parsed.cross_border,
      risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5
    };
  } catch {
    return {
      inferred_actions: problem.requested_actions || [],
      data_sensitivity: "CONFIDENTIAL",
      cross_border: false,
      risk_flags: ["LLM_OUTPUT_NOT_JSON"],
      confidence: 0.2
    };
  }
}
