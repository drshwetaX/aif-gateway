// pages/api/spec-chat.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";

type ChatReq = {
  question: string;
  agentSpec?: any; // register response JSON
};

let cachedDocText: string | null = null;
let cachedChunks: string[] | null = null;

function loadDocxAbsolutePath() {
  // ✅ Adjust if your doc is elsewhere
  // If the file is at repo root: /Aura_framework_v1.6.docx
  // If it’s inside /aif-gateway/ in your local machine, put it at repo root for Vercel
  const p = path.join(process.cwd(), "Aura_framework_v1.6.docx");
  return p;
}

async function getDocText(): Promise<string> {
  if (cachedDocText) return cachedDocText;

  const docPath = loadDocxAbsolutePath();
  const buf = fs.readFileSync(docPath);
  const res = await mammoth.extractRawText({ buffer: buf });
  cachedDocText = (res.value || "").replace(/\r/g, "").trim();
  return cachedDocText!;
}

function chunkText(text: string, chunkSize = 900, overlap = 120) {
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
  const c = tokenize(chunk);
  let hit = 0;
  for (const w of c) if (q.has(w)) hit++;
  return hit;
}

function selectTopChunks(question: string, chunks: string[], k = 5) {
  const scored = chunks
    .map((ch) => ({ ch, score: scoreChunk(question, ch) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((x) => x.ch);
}

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
            "You are a governance assistant. Answer using ONLY the provided policy excerpts and agent spec. If not found, say you cannot find it in the policy.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(j?.error?.message || `LLM call failed (HTTP ${r.status})`);
  }
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

    const text = await getDocText();
    if (!cachedChunks) cachedChunks = chunkText(text);

    const top = selectTopChunks(question, cachedChunks!, 5);

    const prompt =
      `QUESTION:\n${question}\n\n` +
      `AGENT_SPEC_JSON:\n${JSON.stringify(agentSpec, null, 2)}\n\n` +
      `AURA_POLICY_EXCERPTS (use these as your only source):\n` +
      top.map((t, i) => `--- EXCERPT ${i + 1} ---\n${t}`).join("\n\n") +
      `\n\nINSTRUCTIONS:\n` +
      `- Answer clearly and concisely.\n` +
      `- If the question asks “what is A4”, use the policy excerpt definition (not a generic answer).\n` +
      `- If not present in excerpts/spec, say “Not found in provided policy/spec.”\n`;

    // If key exists -> real LLM answer, grounded
    const llmAnswer = await callOpenAI(prompt);

    if (llmAnswer) {
      return res.status(200).json({
        ok: true,
        answer: llmAnswer,
        grounded_excerpts: top,
      });
    }

    // No API key -> return excerpts + guidance (still useful)
    return res.status(200).json({
      ok: true,
      answer:
        "No OPENAI_API_KEY configured. Here are the most relevant policy excerpts; add an LLM key to generate natural-language answers.",
      grounded_excerpts: top,
    });
  } catch (e: any) {
    console.error("spec-chat error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "spec_chat_failed" });
  }
}
