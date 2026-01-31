// pages/console/registry.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConsoleShell from "@/components/ConsoleShell";

type RegisterResponse = any;
type ChatMsg = { role: "user" | "assistant"; text: string };

function summarizeControls(controls: any) {
  if (!controls) return [];
  const out: string[] = [];
  if (controls.humanInLoop) out.push("Human-in-the-loop required");
  if (controls.approvalRequired) out.push("Approval required");
  if (controls.piiRedaction) out.push("PII redaction on");
  if (controls.logging) out.push("Logging enabled");
  if (controls.sandboxOnly) out.push("Sandbox-only");
  if (typeof controls.rateLimitPerMin === "number") out.push(`Rate limit: ${controls.rateLimitPerMin}/min`);
  if (controls.auditLevel) out.push(`Audit level: ${controls.auditLevel}`);
  if (controls.killSwitchRequired) out.push("Kill switch required");
  return out;
}

function explainTier(tier?: string) {
  const map: Record<string, string> = {
    A1: "Low risk. Read-only, low-sensitivity, minimal governance controls.",
    A2: "Moderate risk. Read-only with basic logging/guardrails.",
    A3: "Elevated risk. Broader access or higher impact actions; stronger controls.",
    A4: "High risk. Internal systems/knowledge sources and higher blast radius. Requires approval + human oversight.",
    A5: "Very high risk. Sensitive data and/or impactful actions. Strict gating, auditing, and approvals.",
    A6: "Critical risk. Regulated/high-impact operations. Maximum governance, hard gates, and continuous monitoring.",
  };
  return tier ? map[tier] || `Tier ${tier}: governance tier determined by policy.` : "No tier assigned.";
}

export default function RegisterAgentPage() {
  const [name, setName] = useState("Demo Agent");
  const [problem, setProblem] = useState("Retrieve internal knowledge to answer customer questions.");
  const [overrideTier, setOverrideTier] = useState("");

  // ✅ move inside component (React rules)
  const [env, setEnv] = useState("test");
  const [stage, setStage] = useState("poc");
  const [comment, setComment] = useState("");

  const [out, setOut] = useState<RegisterResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [chat, setChat] = useState<ChatMsg[]>([
    { role: "assistant", text: 'Ask me about the agent spec — e.g., "what is A4?" or "why A4?"' },
  ]);
  const [chatInput, setChatInput] = useState("");

  async function refreshRegistry() {
  setLoadingAgents(true);
  try {
    const r = await fetch("/api/agents/list", {
      method: "GET",
      credentials: "include",          // ✅ force cookies (Safari-safe)
      cache: "no-store",               // ✅ avoid stale cache
      headers: { Accept: "application/json" },
    });

    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await r.text().catch(() => "");
      throw new Error(`Expected JSON from /api/agents/list but got ${ct}. First chars: ${text.slice(0, 80)}`);
    }

    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

    setAgents(j?.agents || []);
  } catch (e: any) {
    setErr(e?.message || "Failed to load agents"); // ✅ show error banner
    setAgents([]);
  } finally {
    setLoadingAgents(false);
  }
}


  useEffect(() => {
    refreshRegistry();
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim() && problem.trim() && !busy);
  }, [name, problem, busy]);

  async function classifyOnly() {
    if (!name.trim() || !problem.trim() || busy) return;

    setBusy(true);
    setErr(null);
    setOut(null);

    try {
      const payload: any = {
        name: name.trim(),
        problem_statement: problem.trim(),
      };
      if (overrideTier) payload.override_tier = overrideTier;

      const res = await fetch("/api/agents/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Classify failed (HTTP ${res.status})`);

      setOut(data);
      setChat([{ role: "assistant", text: `Classified. Ask: "why ${data?.risk_tier}?" or "what controls?"` }]);
    } catch (e: any) {
      setErr(e?.message || "Classify failed");
    } finally {
      setBusy(false);
    }
  }

  async function registerAfterClassify() {
    if (busy) return;
    if (!out) return setErr("Please classify first.");

    setBusy(true);
    setErr(null);

    try {
      const payload: any = {
        name: name.trim(),
        problem_statement: problem.trim(),
        override_tier: overrideTier || undefined,
        env,
        stage,
        comment,
        agent_spec: out, // optional
      };

      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Register failed (HTTP ${res.status})`);

      setOut(data);
      setChat([{ role: "assistant", text: `Registered. Ask: "what is ${data?.risk_tier}?" or "which rules matched?"` }]);
      await refreshRegistry();
    } catch (e: any) {
      setErr(e?.message || "Register failed");
    } finally {
      setBusy(false);
    }
  }

  async function ask(q: string) {
    const question = q.trim();
    if (!question) return;

    setChat((prev) => [...prev, { role: "user", text: question }]);
    setChatInput("");

    try {
      const r = await fetch("/api/spec-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, agentSpec: out }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Spec chat failed (HTTP ${r.status})`);

      const answer = j?.answer || "No answer returned.";
      setChat((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (e: any) {
      setChat((prev) => [...prev, { role: "assistant", text: `Error: ${e?.message || "spec chat failed"}` }]);
    }
  }

  const tier = out?.risk_tier;

  return (
    <>
      <p className="mt-2 text-sm text-zinc-600">Problem statement → policy classification → tier + controls.</p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide">Name</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Claims Triage Agent"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Problem statement</label>
          <textarea
            rows={6}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe what the agent does, what it can access, and the type of outcomes it produces…"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Override tier (optional)</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={overrideTier}
            onChange={(e) => setOverrideTier(e.target.value)}
          >
            <option value="">None</option>
            {["A1", "A2", "A3", "A4", "A5", "A6"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* ✅ Env/Stage/Comment (correct placement) */}
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Environment</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
          >
            {["test", "prod"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Stage</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {["poc", "pilot", "prod"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Comment / justification</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why does this agent need this access/tier? Any constraints?"
          />

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={classifyOnly}
              disabled={!canSubmit}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy ? "Working…" : "Classify"}
            </button>

            <button
              onClick={registerAfterClassify}
              disabled={busy || !out}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
              title={!out ? "Classify first" : "Register agent into registry"}
            >
              {busy ? "Working…" : "Register"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOut(null);
                setErr(null);
                setChat([{ role: "assistant", text: 'Ask me about the agent spec — e.g., "what is A4?" or "why A4?"' }]);
              }}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>

          {/* Registry */}
          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Registry</h2>
            <button onClick={refreshRegistry} className="rounded-xl border px-3 py-1 text-xs hover:bg-zinc-50">
              {loadingAgents ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <p className="mt-1 text-xs text-zinc-500">All registered agents and their governance state.</p>

          <div className="mt-3 space-y-2">
            {agents.length === 0 ? (
              <p className="text-sm text-zinc-600">No agents yet.</p>
            ) : (
              agents.map((a) => (
                <div key={a.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{a.name || "Unnamed agent"}</div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                        <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                          Tier: <span className="font-medium">{a.tier}</span>
                        </span>
                        <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                          Status: <span className="font-medium">{a.status}</span>
                        </span>
                        <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                          Approved: <span className="font-medium">{String(a.approved)}</span>
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-zinc-600">
                        <span className="font-mono break-all">{a.id}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                        {a.env ? (
                          <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                            Env: <span className="font-medium">{a.env}</span>
                          </span>
                        ) : null}

                        {a.stage ? (
                          <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                            Stage: <span className="font-medium">{a.stage}</span>
                          </span>
                        ) : null}

                        {a.requested_at || a.created_at ? (
                          <span className="rounded-md bg-zinc-50 px-2 py-0.5">
                            Requested:{" "}
                            <span className="font-medium">
                              {String(a.requested_at || a.created_at).slice(0, 19)}
                            </span>
                          </span>
                        ) : null}

                        {a.comment ? (
                          <span className="rounded-md bg-zinc-50 px-2 py-0.5" title={a.comment}>
                            Comment:{" "}
                            <span className="font-medium">
                              {String(a.comment).slice(0, 28)}
                              {String(a.comment).length > 28 ? "…" : ""}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      href={`/console/agents/${encodeURIComponent(a.id)}`}
                      className="shrink-0 rounded-xl border px-3 py-1 text-xs hover:bg-zinc-50"
                      title="View full agent details"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {!out ? (
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-zinc-600">Classification result will appear here.</p>
              <p className="mt-2 text-xs text-zinc-500">
                Click <b>Classify</b> first, then <b>Register</b> to persist into registry.
              </p>
            </div>
          ) : (
            <>
              {/* Explanation */}
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Explanation</div>
                <div className="mt-2 text-sm text-zinc-700">
                  <div>
                    <span className="text-zinc-600">Tier:</span>{" "}
                    <span className="font-medium">{tier}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-600">{explainTier(tier)}</div>

                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Key controls</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
                    {summarizeControls(out.controls).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>

                  {out?.tiering_explain?.matched_rule_ids?.length ? (
                    <>
                      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Matched rules
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {out.tiering_explain.matched_rule_ids.map((id: string) => (
                          <span key={id} className="rounded-full border bg-zinc-50 px-2 py-1 text-xs">
                            {id}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Chat */}
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Ask about this agent</div>
                  <button
                    className="rounded-xl border px-3 py-1 text-xs hover:bg-zinc-50"
                    onClick={() =>
                      setChat([{ role: "assistant", text: 'Ask me about the agent spec — e.g., "what is A4?" or "why A4?"' }])
                    }
                  >
                    Clear chat
                  </button>
                </div>

                <div className="mt-3 max-h-[260px] overflow-auto rounded-lg border bg-zinc-50 p-3 text-sm">
                  {chat.map((m, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {m.role === "user" ? "You" : "Console"}
                      </div>
                      <div className="whitespace-pre-wrap text-zinc-800">{m.text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder='Try: "what is A4?"'
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask(chatInput);
                    }}
                  />
                  <button
                    className="shrink-0 rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
                    onClick={() => ask(chatInput)}
                  >
                    Ask
                  </button>
                </div>
              </div>

              {/* Raw JSON */}
              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold">Raw response (JSON)</summary>
                <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg border bg-zinc-50 p-3 text-xs">
                  {JSON.stringify(out, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </>
  );
}
