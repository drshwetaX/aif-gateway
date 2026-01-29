// pages/console/index.tsx
import ConsoleShell from "@/components/ConsoleShell";
import Link from "next/link";

export default function ConsoleHome() {
  return (
    <ConsoleShell title="Home">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border p-5">
          <div className="text-sm font-semibold">Welcome</div>
          <p className="mt-2 text-sm text-zinc-600">
            This console lets you register agents, apply policy controls, and perform lifecycle actions
            (pause/kill) with auditable logs.
          </p>
          <div className="mt-4 flex gap-3">
            <Link className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50" href="/console/registry">
              Go to Registry
            </Link>
            <Link className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50" href="/console/agents">
              Monitoring
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm font-semibold">Quick status</div>
          <div className="mt-3 grid gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 p-3">Agents: (hook to /api/agents/list)</div>
            <div className="rounded-xl bg-zinc-50 p-3">Last audit: (hook to /api/logs)</div>
            <div className="rounded-xl bg-zinc-50 p-3">Policy engine: Ready</div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
