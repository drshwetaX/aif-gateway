import Link from "next/link";
import type { ReactNode } from "react";

export default function ConsoleLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div style={{ minHeight: "100vh", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title ?? "Console"}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Agent Console</div>
        </div>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/console/agents">Agents</Link>
          <Link href="/console/logs">Logs</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
