// pages/console/index.tsx
import Link from "next/link";

export default function ConsoleHome() {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Welcome</h2>
          <p className="mt-2 text-sm text-zinc-600">
            This console lets you register agents, apply policy controls,
            and perform lifecycle actions (pause/kill) with auditable logs.
          </p>

          <div className="mt-4 flex gap-3">
            <Link href="/console/registry" className="rounded-xl border px-4 py-2 text-sm">
              Go to Registry
            </Link>
            <Link href="/console/agents" className="rounded-xl border px-4 py-2 text-sm">
              Monitoring
            </Link>
          </div>
        </div>

        <div className="rounded-xl border p-6">
          <h3 className="text-sm font-semibold">Quick status</h3>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li>Agents: (hook to /api/agents/list)</li>
            <li>Last audit: (hook to /api/logs)</li>
            <li>Policy engine: Ready</li>
          </ul>
        </div>
      </div>
    </>
  );
}
