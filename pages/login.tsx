import { useRouter } from "next/router";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const nextPath =
    typeof router.query.next === "string" && router.query.next.trim()
      ? (router.query.next as string)
      : "/console/registry";

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
        setLoading(false);
        return;
      }

      router.replace(nextPath);
    } catch {
      setErr("Network error");
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>AIF Gateway</h1>
        <p style={{ marginTop: 8, color: "#555", lineHeight: 1.4 }}>
          This demo shows: <b>Agent Registry</b> → <b>Classification</b> → <b>Controls</b> → <b>Override</b> → <b>Audit</b>.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (allowlisted)"
            autoComplete="email"
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Demo password"
            autoComplete="current-password"
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            disabled={loading || !password || !email}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {err && <p style={{ marginTop: 12, color: "#b00020" }}>{err}</p>}
      </div>
    </main>
  );
}
