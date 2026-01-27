/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Use OpenAI to infer governance-relevant attributes from a problem statement.
 *
 * IMPORTANT: LLM returns attributes ONLY. Final tier is computed by deterministic rules.
 */
import OpenAI from "openai";

export type AuraAttributes = {
  actions: string[];         // e.g., ["update_record","send_message"]
  systems: string[];         // e.g., ["salesforce"]
  dataSensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII";
  crossBorder: boolean;
  rationale: string;
  confidence: number;
};

export async function inferAuraAttributes(problemStatement: string): Promise<AuraAttributes> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const prompt = `
You are classifying an enterprise agent proposal into governance-relevant attributes.
Return JSON ONLY with:
- actions: array of strings from this set:
  ["summarize_request","search","retrieve","lookup","classify","create_ticket","update_record","send_message","approve","execute_workflow","send_external_email","transfer_funds","terminate_access"]
- systems: array of strings from this set:
  ["servicenow","workday","salesforce","core_banking","payments","kb","sharepoint","confluence","jira","public_web","static_docs"]
- dataSensitivity: one of ["PUBLIC","INTERNAL","CONFIDENTIAL","PII"]
- crossBorder: boolean
- rationale: string (short)
- confidence: number 0..1

Problem statement:
"""${problemStatement}"""
`;

  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const txt = r.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch {
    // fallback: safe defaults
    parsed = {
      actions: ["retrieve"],
      systems: ["kb"],
      dataSensitivity: "INTERNAL",
      crossBorder: false,
      rationale: "Fallback parse failure",
      confidence: 0.2,
    };
  }

  return {
    actions: parsed.actions || ["retrieve"],
    systems: parsed.systems || ["kb"],
    dataSensitivity: parsed.dataSensitivity || "INTERNAL",
    crossBorder: !!parsed.crossBorder,
    rationale: String(parsed.rationale || ""),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
  };
}
