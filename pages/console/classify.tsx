// pages/console/classify.tsx
import { useMemo, useState } from "react";
import ConsoleShell from "@/components/ConsoleShell";

type AnyObj = any;

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

export default function ClassifyAgentPage() {
  const [name, setName] = useState("Demo Agent");
  const [problem, setProblem] = useState("Retrieve internal knowledge to answer customer questions.");
  const [overrideTier, setOverrideTier] = useState("");

  // NEW: metadata
  const [env, setEnv] = useState<"prod" | "test" | "sandbox">("test");
  const [stage, setStage] = useState<"poc" | "pilot" | "prod">("poc");
  const [reviewNotes, setReviewNotes] = useState("");

  const [out, setOut] = useState<AnyObj | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canClassify = useMemo(() => Boolean(name.trim() && problem.trim() && !busy), [name, problem, busy]);

  async function classifyOnly() {
    if (!canClassify) return;

    setBusy(true);
    setErr(null);
    setOut(null);

    // NOTE: we reuse /api/agents/register for now, because it already returns tier/controls/explain.
    // If you later add /api/agents/classify, swap endpoint here.
    const payload: Record<string, any> = {
      name: name.trim(),
      problem_statement: problem.trim(),
      env,
      stage,
      review_notes: reviewNotes.trim() || null,
    };
    if (overrideTier) payload.override_tier = overrideTier;

    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Classify failed (HTTP ${res.status})`);

      setOut(j);
    } catch (e: any) {
      setErr(e?.message || "Classify failed");
    } finally {
      setBusy(false);
    }
  }

  async function approveAgent() {
    const agentId = out?.agent_id;
    if (!agentId) return;

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/approve?id=${encodeURIComponent(agentId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: reviewNotes.trim() || undefined }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Approve failed (HTTP ${res.status})`);

      // keep previous out but update key fields
      setOut((prev: any) => ({ ...(prev || {}), status: j?.status, approved: j?.approved }));
    } catch (e: any) {
      setErr(e?.message || "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  const tier = out?.risk_tier || out?.tier;

  return (
    <ConsoleShell title="Agent classification">
      <p className="mt-2 text-sm text-zinc-600">
        Classify an agent spec and (optionally) submit for approval with comments.
      </p>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide">Name</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Problem statement</label>
          <textarea rows={6} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={problem} onChange={(e) => setProblem(e.target.value)} />

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide">Env</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={env} onChange={(e) => setEnv(e.target.value as any)}>
                <option value="test">test</option>
                <option value="sandbox">sandbox</option>
                <option value="prod">prod</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide">Stage</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={stage} onChange={(e) => setStage(e.target.value as any)}>
                <option value="poc">poc</option>
                <option value="pilot">pilot</option>
                <option value="prod">prod</option>
              </select>
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Comments (for approver)</label>
          <textarea rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Why this agent is needed, constraints, known risks, etc." />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">Override tier (optional)</label>
          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={overrideTier} onChange={(e) => setOverrideTier(e.target.value)}>
            <option value="">None</option>
            {["A1", "A2", "A3", "A4", "A5", "A6"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={classifyOnly} disabled={!canClassify} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60">
              {busy ? "Working…" : "Classify + Submit request"}
            </button>

            <button
              onClick={approveAgent}
              disabled={busy || !out?.agent_id}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
              title={!out?.agent_id ? "Run classification first" : "Approve this agent request"}
            >
              Approve
            </button>

            <button
              type="button"
              onClick={() => {
                setErr(null);
                setOut(null);
              }}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>

          {out?.agent_id ? (
            <p className="mt-3 text-xs text-zinc-600">
              Request created in registry as <span className="font-mono">{out.agent_id}</span> (status:{" "}
              <span className="font-medium">{String(out.status)}</span>, approved:{" "}
              <span className="font-medium">{String(out.approved)}</span>)
            </p>
          ) : null}
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {!out ? (
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-zinc-600">Classification result will appear here.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Explanation</div>
                <div className="mt-2 text-sm text-zinc-700">
                  <div>
                    <span className="text-zinc-600">Tier:</span> <span className="font-medium">{tier}</span>
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
                      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Matched rules</div>
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

              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold">Raw response (JSON)</summary>
                <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg border bg-zinc-50 p-3 text-xs">{JSON.stringify(out, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}
