import { useRouter } from "next/router";
import { useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const nextPath = useMemo(() => {
    const raw =
      router.isReady && typeof router.query.next === "string"
        ? router.query.next.trim()
        : "";

    // only allow internal relative paths
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/console/registry";
  }, [router.isReady, router.query.next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Login failed (HTTP ${res.status})`);
        return;
      }

      router.replace(nextPath);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 px-6 py-10 md:grid-cols-2 md:items-center">
        {/* Left panel */}
        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight">AIF Gateway</h1>
          <p className="mt-3 text-zinc-600">
            Policy decision simulator: tiering + controls + audit trail (executive-ready).
          </p>

          <div className="mt-6 space-y-3 text-sm text-zinc-700">
            <div className="rounded-xl border bg-zinc-50 p-4">
              <div className="font-medium text-zinc-900">What you’ll see</div>
              <div className="mt-2">
                <b>Agent Registry</b> → <b>Classification</b> → <b>Controls</b> →{" "}
                <b>Override</b> → <b>Audit</b>
              </div>
            </div>

            <div className="rounded-xl border bg-zinc-50 p-4">
              <div className="font-medium text-zinc-900">After login</div>
              <div className="mt-2">
                You’ll be redirected to: <span className="font-mono">{nextPath}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right panel (login) */}
        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="text-sm font-medium text-zinc-500">Sign in</div>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-400"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (allowlisted)"
              autoComplete="email"
            />

            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-400"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Demo password"
              autoComplete="current-password"
            />

            <button
              className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading || !password || !email}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {err && <p className="mt-4 text-sm text-red-700">{err}</p>}
        </section>
      </div>
    </main>
  );
}
