import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";

type Me = { email: string } | null;

const NAV = [
  { href: "/console/registry", label: "Register agent" },
  { href: "/console/agents", label: "Registry" },
  { href: "/console/audit", label: "Audit trail" },
];

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.email ? { email: d.email } : null))
      .catch(() => setMe(null));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-[260px_1fr] gap-6">
          {/* LEFT NAV */}
          <aside className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Signed in
              </div>
              <div className="mt-1 text-sm font-medium">
                {me?.email || "—"}
              </div>
            </div>

            <nav className="space-y-1">
              {NAV.map((n) => {
                const active = router.pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`block rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? "bg-zinc-100 font-semibold"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 text-xs text-zinc-500">
              AURA demo console<br />
              Registry → Classification → Controls → Audit
            </div>
          </aside>

          {/* MAIN */}
          <main className="rounded-2xl border bg-white p-6 shadow-sm">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
