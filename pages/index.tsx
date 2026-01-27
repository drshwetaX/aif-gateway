import { useEffect, useState } from "react";
import Link from "next/link";

type DemoLog = {
  ts: string;
  action: string;
  outcome: string;
};

export default function Home() {
  const [logs, setLogs] = useState<DemoLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refreshLogs() {
    try {
      setErr(null);
      const res = await fetch("/api/demo/log");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch logs");
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch logs");
    }
  }

  async function call(endpoint: string, label: string) {
    try {
      setBusy(label);
      setErr(null);

      const res = await fetch(endpoint, { method: "POST" });
      // We EXPECT /write to be 403. Don't treat it as an error.
      await res.text().catch(() => null);

      await refreshLogs();
    } catch (e: any) {
      setErr(e?.message || "Request failed");
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
          <p className="mt-2 max-w-2xl text-zinc-600">
            Executive demo: controlled agent actions with policy enforcement and
            durable audit logging.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <button
            className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow"
            onClick={() => call("/api/demo/run", "run")}
            disabled={busy !== null}
          >
            <div className="text-sm font-medium text-zinc-500">Action</div>
            <div className="mt-1 text-lg font-semibold">Run agent</div>
            <div className="mt-2 text-sm text-zinc-600">
              Simulates an allowed execution path and records an audit entry.
            </div>
            <div className="mt-4 text-sm font-medium">
              {busy === "run" ? "Running…" : "Run demo"}
            </div>
          </button>

          <button
            className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow"
            onClick={() => call("/api/demo/write", "write")}
            disabled={busy !== null}
          >
            <div className="text-sm font-medium text-zinc-500">Action</div>
            <div className="mt-1 text-lg font-semibold">Attempt write</div>
            <div className="mt-2 text-sm text-zinc-600">
              Simulates a blocked action (expected 403) and logs the denial.
            </div>
            <div className="mt-4 text-sm font-medium">
              {busy === "write" ? "Attempting…" : "Attempt write"}
            </div>
          </button>

          <div className="rounded-2xl border bg-white p-5 text-left shadow-sm">
            <div className="text-sm font-medium text-zinc-500">View</div>
            <div className="mt-1 text-lg font-semibold">Audit trail</div>
            <div className="mt-2 text-sm text-zinc-600">
              Refresh the durable log store and show last entries.
            </div>

            <div className="mt-4 flex items-center gap-3">
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
            <span className="text-sm text-zinc-500">
              Showing {logs.length} entries
            </span>
          </div>

          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {err}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="grid grid-cols-12 gap-2 border-b bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <div className="col-span-3">Time</div>
              <div className="col-span-3">Action</div>
              <div className="col-span-6">Outcome</div>
            </div>

            {logs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-600">
                No logs yet. Click <b>Run agent</b> or <b>Attempt write</b>.
              </div>
            ) : (
              logs.map((l, idx) => (
                <div
                  key={`${l.ts}-${idx}`}
                  className="grid grid-cols-12 gap-2 border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="col-span-3 font-mono text-xs text-zinc-600">
                    {l.ts}
                  </div>
                  <div className="col-span-3 font-medium">{l.action}</div>
                  <div className="col-span-6 text-zinc-700">{l.outcome}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <footer className="mt-10 text-xs text-zinc-500">
          Tip: If logs don’t persist across refresh, check Vercel env vars for
          Upstash (REST URL + token).
        </footer>
      </main>
    </div>
  );
}
