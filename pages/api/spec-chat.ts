// pages/api/spec-chat.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

type ChatReq = {
  question: string;
  agentSpec?: any;
};

let cachedText: string | null = null;
let cachedChunks: string[] | null = null;

function nowIso() {
  return new Date().toISOString();
}

function loadAuraTxtPath() {
  // aura.txt is at repo root
  return path.join(process.cwd(), "aura.txt");
}


function getPolicyText() {
  if (cachedText) return cachedText;
  const p = loadAuraTxtPath();
  const text = fs.readFileSync(p, "utf8");
  cachedText = (text || "").replace(/\r/g, "").trim();
  return cachedText!;
}

function chunkText(text: string, chunkSize = 1200, overlap = 150) {
  const clean = text.replace(/\n{3,}/g, "\n\n");
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + chunkSize);
    out.push(clean.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
    if (end === clean.length) break;
  }
  return out;
}

function tokenize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreChunk(question: string, chunk: string) {
  const q = new Set(tokenize(question));
  let hit = 0;
  for (const w of tokenize(chunk)) if (q.has(w)) hit++;
  return hit;
}

function selectTopChunks(question: string, chunks: string[], k = 6) {
  return chunks
    .map((ch) => ({ ch, score: scoreChunk(question, ch) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.ch);
}

// Optional: LLM call (only if key exists)
async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Answer ONLY using the provided Aura framework excerpts and agent spec JSON. If not found, say: Not found in provided policy/spec.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `LLM call failed (HTTP ${r.status})`);
  return j?.choices?.[0]?.message?.content?.trim() || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as ChatReq;
    const question = String(body.question || "").trim();
    const agentSpec = body.agentSpec ?? null;

    if (!question) return res.status(400).json({ ok: false, error: "question required" });

    const text = getPolicyText();
    if (!cachedChunks) cachedChunks = chunkText(text);

    const top = selectTopChunks(question, cachedChunks!, 6);

    const prompt =
      `TS: ${nowIso()}\n\n` +
      `QUESTION:\n${question}\n\n` +
      `AGENT_SPEC_JSON:\n${JSON.stringify(agentSpec, null, 2)}\n\n` +
      `AURA_EXCERPTS (only source of truth):\n` +
      top.map((t, i) => `--- EXCERPT ${i + 1} ---\n${t}`).join("\n\n") +
      `\n\nINSTRUCTIONS:\n` +
      `- Provide a direct answer.\n` +
      `- Cite which excerpt number(s) you used.\n` +
      `- If the answer is not in excerpts/spec, say: Not found in provided policy/spec.\n`;

    const llm = await callOpenAI(prompt);

    if (llm) {
      return res.status(200).json({ ok: true, answer: llm, grounded_excerpts: top });
    }

    // No key → still return excerpts
    return res.status(200).json({
      ok: true,
      answer:
        "OPENAI_API_KEY not set. Here are the most relevant Aura excerpts for your question (enable an LLM key for natural-language answers).",
      grounded_excerpts: top,
    });
  } catch (e: any) {
    console.error("spec-chat error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "spec_chat_failed" });
  }
}
