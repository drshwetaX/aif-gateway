// components/ConsoleShell.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type Item = { href: string; label: string };

const NAV: Item[] = [
  { href: "/console", label: "Home" },
  { href: "/console/platform", label: "Platform" },
  { href: "/console/registry", label: "Agent Registry" },
  { href: "/console/agents", label: "Agent Monitoring" },
  { href: "/console/logs", label: "Logs" },
  { href: "/console/user", label: "User Info" },
];

export default function ConsoleShell({ title, children }: { title?: string; children: ReactNode }) {
  const router = useRouter();
  const path = router.asPath.split("?")[0];

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="flex min-h-screen">
        {/* Left nav */}
        <aside className="w-64 border-r bg-zinc-50">
          <div className="px-5 py-4">
            <div className="text-sm font-semibold tracking-tight">AIF Gateway</div>
            <div className="mt-1 text-xs text-zinc-500">Enterprise Agent Console</div>
          </div>

          <nav className="px-2 pb-4">
            {NAV.map((it) => {
              const active = path === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm",
                    active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200/60",
                  ].join(" ")}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-5 py-4 text-xs text-zinc-500">
            Tip: use left nav to switch modules.
          </div>
        </aside>

        {/* Right content */}
        <main className="flex-1">
          <header className="flex items-center justify-between border-b px-8 py-4">
            <div>
              <div className="text-lg font-semibold">{title || "Console"}</div>
              <div className="text-xs text-zinc-500">{path}</div>
            </div>

            <div className="flex items-center gap-3">
              <Link className="text-sm text-zinc-700 hover:underline" href="/api/auth/logout">
                Logout
              </Link>
            </div>
          </header>

          <div className="px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
