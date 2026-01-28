import { useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";

export default function RegisterAgentPage() {
  const [name, setName] = useState("Demo Agent");
  const [externalAgentId, setExternalAgentId] = useState("");
  const [problem, setProblem] = useState(
    "Retrieve internal knowledge to answer customer questions."
  );
  const [overrideTier, setOverrideTier] = useState("");
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    setOut(null);

    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          externalAgentId: externalAgentId || undefined,
          problem_statement: problem,
          override_tier: overrideTier || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Register failed");
      setOut(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleLayout>
      <h1 className="text-2xl font-semibold">Register agent</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Problem statement → policy classification → tier + controls.
      </p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide">
            Name
          </label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">
            External agent id (Foundry)
          </label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={externalAgentId}
            onChange={(e) => setExternalAgentId(e.target.value)}
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">
            Problem statement
          </label>
          <textarea
            rows={5}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
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
            {["A1","A2","A3","A4","A5","A6"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            onClick={submit}
            disabled={busy}
            className="mt-6 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            {busy ? "Registering…" : "Register"}
          </button>
        </div>

        <div>
          {!out ? (
            <p className="text-sm text-zinc-600">
              Classification result will appear here.
            </p>
          ) : (
            <pre className="overflow-auto rounded-xl border bg-zinc-50 p-3 text-xs">
{JSON.stringify(out, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </ConsoleLayout>
  );
}
