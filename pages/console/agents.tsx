import { useEffect, useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/agents/list")
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d) ? d : d?.agents || []));
  }, []);

  return (
    <ConsoleLayout>
      <h1 className="text-2xl font-semibold">Registry</h1>
      <p className="mt-2 text-sm text-zinc-600">
        All registered agents and their governance state.
      </p>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Agent</th>
            <th>Status</th>
            <th>Tier</th>
            <th>Approved</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="py-2 font-mono">{a.id}</td>
              <td>{a.status}</td>
              <td>{a.tier}</td>
              <td>{String(a.approved)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConsoleLayout>
  );
}
