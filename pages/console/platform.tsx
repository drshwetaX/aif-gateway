/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Platform Dashboard UI for the AIF Gateway.
 *   Loads Redis-backed platform streams on page load:
 *     - GET /api/redis/requests?limit=50
 *     - GET /api/redis/decisions?limit=50
 *     - GET /api/redis/audit?limit=100
 *
 *   Also loads agent registry list (optional but useful):
 *     - GET /api/agents/list
 *
 * Dependencies:
 *   - React (useEffect/useState/useMemo)
 *
 * When is this file called?
 *   - Rendered when a user visits: /console/platform
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from "react";

type StreamResp = {
  stream: string;
  count: number;
  items: any[];
  error?: string;
  detail?: string;
};

type AgentsResp = {
  ok: boolean;
  agents: any[];
  error?: string;
};

function fmtTs(v: any) {
  if (!v) return "";
  const s = String(v);
  return s.length > 19 ? s.slice(0, 19).replace("T", " ") : s;
}

function safeStr(v: any, max = 64) {
  const s = v == null ? "" : String(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ✅ Robust fetch: includes cookies, avoids cache, detects HTML redirects
async function fetchJson(url: string) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      contentType: ct,
      textPreview: text.slice(0, 140),
      json: null as any,
    };
  }

  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, contentType: ct, json };
}

export default function PlatformDashboard() {
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);

  const [reqs, setReqs] = useState<StreamResp>({ stream: "aif:requests", count: 0, items: [] });
  const [decs, setDecs] = useState<StreamResp>({ stream: "aif:decisions", count: 0, items: [] });
  const [audit, setAudit] = useState<StreamResp>({ stream: "aif:audit", count: 0, items: [] });

  // optional: show registry agents on platform too
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsErr, setAgentsErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);

    try {
      const [r1, r2, r3, r4] = await Promise.all([
        fetchJson("/api/redis/requests?limit=50"),
        fetchJson("/api/redis/decisions?limit=50"),
        fetchJson("/api/redis/audit?limit=100"),
        fetchJson("/api/agents/list"),
      ]);

      // Requests
      if (!r1.ok || !r1.json) {
        setReqs({
          stream: "aif:requests",
          count: 0,
          items: [],
          error: `Non-JSON or error from /api/redis/requests (HTTP ${r1.status})`,
          detail: r1.json?.error
            ? String(r1.json.error)
            : `content-type=${r1.contentType}; preview=${r1.textPreview || ""}`,
        });
      } else {
        setReqs(r1.json as StreamResp);
      }

      // Decisions
      if (!r2.ok || !r2.json) {
        setDecs({
          stream: "aif:decisions",
          count: 0,
          items: [],
          error: `Non-JSON or error from /api/redis/decisions (HTTP ${r2.status})`,
          detail: r2.json?.error
            ? String(r2.json.error)
            : `content-type=${r2.contentType}; preview=${r2.textPreview || ""}`,
        });
      } else {
        setDecs(r2.json as StreamResp);
      }

      // Audit
      if (!r3.ok || !r3.json) {
        setAudit({
          stream: "aif:audit",
          count: 0,
          items: [],
          error: `Non-JSON or error from /api/redis/audit (HTTP ${r3.status})`,
          detail: r3.json?.error
            ? String(r3.json.error)
            : `content-type=${r3.contentType}; preview=${r3.textPreview || ""}`,
        });
      } else {
        setAudit(r3.json as StreamResp);
      }

      // Agents list (optional)
      if (!r4.ok || !r4.json) {
        setAgents([]);
        setAgentsErr(
          `Non-JSON or error from /api/agents/list (HTTP ${r4.status}) - content-type=${r4.contentType}; preview=${r4.textPreview || ""}`
        );
      } else {
        const j = r4.json as AgentsResp;
        setAgents(Array.isArray(j.agents) ? j.agents : []);
        setAgentsErr(null);
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ load on page load
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ auto refresh
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => refresh(), 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const counts = useMemo(() => {
    const allow = decs.items.filter((x) => String(x.decision || "").toUpperCase() === "ALLOW").length;
    const deny = decs.items.filter((x) => String(x.decision || "").toUpperCase() === "DENY").length;
    const pending = decs.items.filter((x) =>
      ["PENDING", "REQUIRE_APPROVAL", "REQUIRES_APPROVAL"].includes(String(x.decision || "").toUpperCase())
    ).length;
    return { allow, deny, pending };
  }, [decs.items]);

  function ErrorBanner({ r }: { r: StreamResp }) {
    if (!r.error) return null;
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="font-semibold">Data source unavailable</div>
        <div className="mt-1 font-mono text-xs">
          {safeStr(r.error, 240)}
          {r.detail ? ` — ${safeStr(r.detail, 300)}` : ""}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Platform Dashboard</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Loads Redis streams on page load. If you see “Non-JSON”, it usually means middleware redirected to /login.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-refresh (10s)
          </label>

          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: loading ? "#f6f6f6" : "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        {[
          ["Requests (latest)", reqs.items.length],
          ["Decisions (latest)", decs.items.length],
          ["Audit events (latest)", audit.items.length],
          ["Registry agents", agents.length],
          ["ALLOW", counts.allow],
          ["DENY", counts.deny],
          ["PENDING", counts.pending],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", minWidth: 160 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{String(value)}</div>
          </div>
        ))}
      </div>

      {/* Errors */}
      <div style={{ marginTop: 16 }}>
        <ErrorBanner r={reqs} />
        <ErrorBanner r={decs} />
        <ErrorBanner r={audit} />
        {agentsErr ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <div className="font-semibold">Registry list error</div>
            <div className="mt-1 font-mono text-xs">{agentsErr}</div>
          </div>
        ) : null}
      </div>

      {/* Registry agents (optional visibility on Platform) */}
      <section style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Agents (Registry)</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>/api/agents/list</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>id</th>
                <th style={{ padding: 8 }}>name</th>
                <th style={{ padding: 8 }}>tier</th>
                <th style={{ padding: 8 }}>status</th>
                <th style={{ padding: 8 }}>env</th>
                <th style={{ padding: 8 }}>stage</th>
                <th style={{ padding: 8 }}>created/requested</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, idx) => (
                <tr key={a.id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(a.id, 60)}</td>
                  <td style={{ padding: 8 }}>{safeStr(a.name, 48)}</td>
                  <td style={{ padding: 8 }}>{safeStr(a.tier, 10)}</td>
                  <td style={{ padding: 8 }}>{safeStr(a.status, 16)}</td>
                  <td style={{ padding: 8 }}>{safeStr(a.env, 12)}</td>
                  <td style={{ padding: 8 }}>{safeStr(a.stage, 12)}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(a.requested_at || a.created_at)}</td>
                </tr>
              ))}
              {!agents.length && (
                <tr>
                  <td style={{ padding: 12, opacity: 0.7 }} colSpan={7}>
                    No agents returned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Requests */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Requests</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{reqs.stream}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>Time</th>
                <th style={{ padding: 8 }}>request_id</th>
                <th style={{ padding: 8 }}>agent_id</th>
                <th style={{ padding: 8 }}>action</th>
                <th style={{ padding: 8 }}>system</th>
                <th style={{ padding: 8 }}>sensitivity</th>
                <th style={{ padding: 8 }}>source</th>
              </tr>
            </thead>
            <tbody>
              {reqs.items.map((x, idx) => (
                <tr key={x.id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(x.received_at)}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(x.request_id, 40)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.agent_id, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.action, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.system, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.dataSensitivity, 16)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.source, 16)}</td>
                </tr>
              ))}
              {!reqs.items.length && (
                <tr>
                  <td style={{ padding: 12, opacity: 0.7 }} colSpan={7}>
                    No request events found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Decisions */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Decisions</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{decs.stream}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>Time</th>
                <th style={{ padding: 8 }}>request_id</th>
                <th style={{ padding: 8 }}>decision</th>
                <th style={{ padding: 8 }}>reason</th>
                <th style={{ padding: 8 }}>policy_version</th>
              </tr>
            </thead>
            <tbody>
              {decs.items.map((x, idx) => (
                <tr key={x.id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(x.decided_at)}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(x.request_id, 40)}</td>
                  <td style={{ padding: 8, fontWeight: 700 }}>{safeStr(x.decision, 24)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.reason, 120)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.policy_version, 24)}</td>
                </tr>
              ))}
              {!decs.items.length && (
                <tr>
                  <td style={{ padding: 12, opacity: 0.7 }} colSpan={5}>
                    No decision events found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Audit</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{audit.stream}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>Time</th>
                <th style={{ padding: 8 }}>event</th>
                <th style={{ padding: 8 }}>request_id</th>
                <th style={{ padding: 8 }}>agent_id</th>
                <th style={{ padding: 8 }}>decision</th>
                <th style={{ padding: 8 }}>endpoint</th>
              </tr>
            </thead>
            <tbody>
              {audit.items.map((x, idx) => (
                <tr key={x.id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(x.ts)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.event, 36)}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(x.request_id, 40)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.agent_id, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.decision, 16)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.endpoint, 48)}</td>
                </tr>
              ))}
              {!audit.items.length && (
                <tr>
                  <td style={{ padding: 12, opacity: 0.7 }} colSpan={6}>
                    No audit events found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
