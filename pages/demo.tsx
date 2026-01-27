import { useEffect, useState } from "react";

type LogEntry = {
  ts: string;
  action: string;
  outcome: string;
};

export default function DemoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function call(path: string) {
    setLoading(true);
    await fetch(path, { method: "POST" }).catch(() => {});
    await refreshLogs();
    setLoading(false);
  }

  async function refreshLogs() {
    const res = await fetch("/api/demo/log");
    const data = await res.json();
    setLogs(data.logs || []);
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1>AIF Gateway – Demo Control</h1>
      <p style={{ color: "#555" }}>
        Simulated agent actions with governance + audit trail.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button onClick={() => call("/api/demo/run")} disabled={loading}>
          ▶ Run Demo
        </button>

        <button onClick={() => call("/api/demo/write")} disabled={loading}>
          ✋ Attempt Write
        </button>

        <button onClick={refreshLogs}>
          📜 Refresh Audit Log
        </button>
      </div>

      <h2 style={{ marginTop: 32 }}>Audit Log</h2>
      <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Time</th>
            <th>Action</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td>{new Date(l.ts).toLocaleTimeString()}</td>
              <td>{l.action}</td>
              <td>{l.outcome}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "#777" }}>
                No activity yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
