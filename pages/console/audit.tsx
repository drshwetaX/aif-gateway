import { useEffect, useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((d) => setLogs(d?.logs || []));
  }, []);

  return (
    <ConsoleLayout>
      <h1 className="text-2xl font-semibold">Audit trail</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Durable governance events.
      </p>

      <div className="mt-6 space-y-2">
        {logs.map((l, i) => (
          <pre
            key={i}
            className="overflow-auto rounded-xl border bg-zinc-50 p-3 text-xs"
          >
{JSON.stringify(l, null, 2)}
          </pre>
        ))}
      </div>
    </ConsoleLayout>
  );
}
