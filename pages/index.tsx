import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RunResponse =
  | {
      ok: true;
      decision: "ALLOWED";
      rationale: string;
      ts: string;
      tier: any;
      controls: any;
      intent: any;
    }
  | {
      ok: false;
      decision: "DENIED";
      error: string;
      rationale: string;
      ts: string;
      tier: any;
      controls: any;
      intent: any;
    };

type AuditRow = {
  ts: string;
  endpoint?: string;
  decision?: string;
  reason?: string;
  agentId?: string;
  tier?: any;
};

export default function Home() {
  // --- Inputs for AURA decisioning ---
  const [agentId, setAgentId] = useState("demo-agent-001");
  const [env, setEnv] = useState<"sandbox" | "prod">("sandbox");
  const [approved, setApproved] = useState(false);

  // Intent-ish fields (pass through to buildIntent(body))
  const [action, setAction] = useState("read");
  const [resource, setResource] = useState("case");
  const [channel, setChannel] = useState("web");
  const [containsPII, setContainsPII] = useState(false);

  // --- Output panels ---
  const [runOut, setRunOut] = useState<RunResponse | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canRun = useMemo(() => agentId.trim().length > 0, [agentId]);

  async function refreshLogs() {
    try {
      setErr(null);

      // ✅ Adjust this if your endpoint is /api/demo/log instead of /api/logs
      const res = await fetch("/api/logs");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Failed to fetch logs");

      // Expecting { logs: [...] } or { entries: [...] } — support both
      const arr = Array.isArray(data?.logs) ? data.logs : Array.isArray(data?.entries) ? data.entries : [];
      setLogs(arr);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch logs");
    }
  }

  async function registerAgent() {
    // Your /api/run requires agent to exist via getAgent(agentId).
    // You mentioned /api/agents/register in the /api/run denial rationale.
    // This assumes you have it. If your route name differs, tell me and I’ll adjust.
    try {
      setBusy("register");
      setErr(null);

      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          // Optional: choose a tier/controls or let policy compute
          // tier: "T2",
          // controls: { approvalRequired: true, sandboxOnly: true }
          status: "active",
          approved: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Register failed");

      await refreshLogs();
    } catch (e: any) {
      setErr(e?.message || "Register failed");
    } finally {
      setBusy(null);
    }
  }

  async function runDecision() {
    try {
      setBusy("run");
      setErr(null);
      setRunOut(null);

      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          env,
          approved,
          // pass-through fields for buildIntent(body)
          action,
          resource,
          channel,
          contains_pii: containsPII,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as RunResponse | any;

      // /api/run returns 403 with JSON when denied; still show payload
      setRunOut(data as RunResponse);

      await refreshLogs();
    } catch (e: any) {
      setErr(e?.message || "Run failed");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">AIF Gateway</h1>
          <p className="mt-2 max-w-3xl text-zinc-600">
            Policy decision simulator: tiering + controls + audit trail (executive-ready).
          </p>
        </header>

        {err ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-500">Setup</div>
            <div className="mt-1 text-lg font-semibold">Agent</div>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Agent ID
            </label>
            <input
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="demo-agent-001"
            />

            <button
              className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-50"
              onClick={registerAgent}
              disabled={!canRun || busy !== null}
            >
              {busy === "register" ? "Registering…" : "Register agent"}
            </button>

            <p className="mt-3 text-xs text-zinc-500">
              /api/run requires the agent to be registered first.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-500">Inputs</div>
            <div className="mt-1 text-lg font-semibold">Intent + Context</div>

            <div className="mt-3 grid gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Env
                </label>
                <select
                  value={env}
                  onChange={(e) => setEnv(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="sandbox">sandbox</option>
                  <option value="prod">prod</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Action
                  </label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="read">read</option>
                    <option value="write">write</option>
                    <option value="export">export</option>
                    <option value="delete">delete</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Resource
                  </label>
                  <select
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="case">case</option>
                    <option value="customer">customer</option>
                    <option value="hr_record">hr_record</option>
                    <option value="policy">policy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="web">web</option>
                  <option value="slack">slack</option>
                  <option value="email">email</option>
                  <option value="api">api</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={containsPII}
                  onChange={(e) => setContainsPII(e.target.checked)}
                />
                Contains PII
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                Approval provided (runtime)
              </label>
            </div>

            <button
              className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-50"
              onClick={runDecision}
              disabled={!canRun || busy !== null}
            >
              {busy === "run" ? "Evaluating…" : "Evaluate policy"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-500">Decision</div>
            <div className="mt-1 text-lg font-semibold">Result</div>

            {!runOut ? (
              <p className="mt-3 text-sm text-zinc-600">
                Run an evaluation to see decision, tier, controls, and intent.
              </p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Decision
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {runOut.decision}
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">{runOut.rationale}</div>
                  <div className="mt-1 text-xs text-zinc-500">{runOut.ts}</div>
                </div>

                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Tier + Controls
                  </summary>
                  <pre className="mt-2 overflow-auto text-xs">
                    {JSON.stringify({ tier: runOut.tier, controls: runOut.controls }, null, 2)}
                  </pre>
                </details>

                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Intent (computed)
                  </summary>
                  <pre className="mt-2 overflow-auto text-xs">
                    {JSON.stringify(runOut.intent, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
                onClick={refreshLogs}
                disabled={busy !== null}
              >
                Refresh logs
              </button>

              <Link
                className="text-sm font-medium text-zinc-900 underline underline-offset-4"
                href="/demo"
              >
                Open full demo page →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent audit entries</h2>
            <span className="text-sm text-zinc-500">Showing {logs.length} entries</span>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="grid grid-cols-12 gap-2 border-b bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <div className="col-span-3">Time</div>
              <div className="col-span-3">Decision</div>
              <div className="col-span-3">Reason</div>
              <div className="col-span-3">Agent</div>
            </div>

            {logs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-600">
                No logs yet. Click <b>Register agent</b>, then <b>Evaluate policy</b>.
              </div>
            ) : (
              logs.slice(0, 20).map((l, idx) => (
                <div
                  key={`${l.ts}-${idx}`}
                  className="grid grid-cols-12 gap-2 border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="col-span-3 font-mono text-xs text-zinc-600">
                    {l.ts}
                  </div>
                  <div className="col-span-3 font-medium">{l.decision || "-"}</div>
                  <div className="col-span-3 text-zinc-700">{l.reason || "-"}</div>
                  <div className="col-span-3 text-zinc-700">{l.agentId || "-"}</div>
                </div>
              ))
            )}
          </div>

          <footer className="mt-6 text-xs text-zinc-500">
            Tip: If logs don’t persist across refresh, ensure your log store env vars are set in Vercel.
          </footer>
        </section>
      </main>
    </div>
  );
}
