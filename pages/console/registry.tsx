import { useMemo, useState } from "react";
import ConsoleShell from "@/components/ConsoleShell";

type RegisterResponse = any;

export default function RegisterAgentPage() {
  const [name, setName] = useState("Demo Agent");
  const [problem, setProblem] = useState(
    "Retrieve internal knowledge to answer customer questions."
  );
  const [overrideTier, setOverrideTier] = useState("");

  const [out, setOut] = useState<RegisterResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim() && problem.trim() && !busy);
  }, [name, problem, busy]);

  async function submit() {
    if (!name.trim() || !problem.trim() || busy) return;

    setBusy(true);
    setErr(null);
    setOut(null);

    const payload: Record<string, any> = {
      name: name.trim(),
      problem_statement: problem.trim(),
    };
    if (overrideTier) payload.override_tier = overrideTier;

    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          `Register failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setOut(data);
    } catch (e: any) {
      setErr(e?.message || "Register failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell title="Register agent" subtitle="Problem statement → policy classification → tier + controls.">
      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide">
            Name
          </label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Claims Triage Agent"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">
            Problem statement
          </label>
          <textarea
            rows={6}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe what the agent does, what it can access, and the type of outcomes it produces…"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">
            Override tier (optional)
          </label>
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

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy ? "Registering…" : "Register"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOut(null);
                setErr(null);
              }}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Tip: include data access + actions in the problem statement so your classifier can assign tighter controls.
          </p>
        </div>

        <div>
          {!out ? (
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-zinc-600">
                Classification result will appear here.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Returns whatever your <code>/api/agents/register</code> endpoint emits (tier, controls, policy hits, etc.).
              </p>
            </div>
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded-xl border bg-zinc-50 p-3 text-xs">
              {JSON.stringify(out, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}
