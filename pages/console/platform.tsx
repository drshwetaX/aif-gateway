/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Platform Dashboard UI for the AIF Gateway.
 *   Displays live-ish platform activity from Redis-backed REST endpoints:
 *   - Incoming requests (aif:requests)
 *   - Decisions (aif:decisions)
 *   - Audit trail (aif:audit)
 *
 * Dependencies:
 *   - React (useEffect/useState)
 *   - REST endpoints (must exist):
 *       GET /api/redis/requests?limit=50
 *       GET /api/redis/decisions?limit=50
 *       GET /api/redis/audit?limit=100
 *
 * When is this file called?
 *   - Rendered when a user visits:
 *       /console/platform
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

function fmtTs(v: any) {
  if (!v) return "";
  const s = String(v);
  return s.length > 19 ? s.slice(0, 19).replace("T", " ") : s;
}

function safeStr(v: any, max = 64) {
  const s = v == null ? "" : String(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

async function fetchJson(url: string): Promise<StreamResp> {
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    return {
      stream: data?.stream || "",
      count: 0,
      items: [],
      error: data?.error || `HTTP ${res.status}`,
      detail: data?.detail || "",
    };
  }
  return data as StreamResp;
}

export default function PlatformDashboard() {
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [agents, setAgents] = useState<StreamResp>({ stream: "aif:agents:*", count: 0, items: [] });
  const [reqs, setReqs] = useState<StreamResp>({ stream: "aif:requests", count: 0, items: [] });
  const [decs, setDecs] = useState<StreamResp>({ stream: "aif:decisions", count: 0, items: [] });
  const [audit, setAudit] = useState<StreamResp>({ stream: "aif:audit", count: 0, items: [] });

  async function refresh() {
    setLoading(true);
    try {
      const [r, d, a,g] = await Promise.all([
        fetchJson("/api/redis/requests?limit=50"),
        fetchJson("/api/redis/decisions?limit=50"),
        fetchJson("/api/redis/audit?limit=100"),
        fetchJson("/api/redis/agents?limit=200"),
      ]);
      setReqs(r);
      setDecs(d);
      setAudit(a);
      setAgents(g);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div style={{ padding: 12, border: "1px solid #f0c36d", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>Data source unavailable</div>
        <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>
          {safeStr(r.error, 120)} {r.detail ? `— ${safeStr(r.detail, 200)}` : ""}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Platform Dashboard</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Live view of requests, decisions, and audit events (read-only).</div>
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

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        {[
          ["Requests (latest)", reqs.items.length],
          ["Decisions (latest)", decs.items.length],
          ["Audit events (latest)", audit.items.length],
          ["Agents (latest)", agents.items.length],
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

      <div style={{ marginTop: 16 }}>
        <ErrorBanner r={reqs} />
        <ErrorBanner r={decs} />
        <ErrorBanner r={audit} />
        <ErrorBanner r={agents} />
      </div>
{/* Agents */}
<section style={{ marginTop: 22 }}>
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
    <h2 style={{ margin: 0 }}>Agents</h2>
    <div style={{ opacity: 0.7, fontSize: 12 }}>aif:agents:list</div>
  </div>

  <div style={{ overflowX: "auto", marginTop: 10 }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
          <th style={{ padding: 8 }}>created_at</th>
          <th style={{ padding: 8 }}>agent_id</th>
          <th style={{ padding: 8 }}>name</th>
          <th style={{ padding: 8 }}>owner</th>
          <th style={{ padding: 8 }}>tier</th>
          <th style={{ padding: 8 }}>status</th>
          <th style={{ padding: 8 }}>env</th>
          <th style={{ padding: 8 }}>stage</th>
        </tr>
      </thead>
      <tbody>
        {agents.items.map((x: any, idx: number) => (
          <tr key={x.id || x.agent_id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
            <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(x.created_at)}</td>
            <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(x.id || x.agent_id, 48)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.name, 48)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.owner, 48)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.tier || x.risk_tier, 8)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.status, 16)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.env, 12)}</td>
            <td style={{ padding: 8 }}>{safeStr(x.stage, 12)}</td>
          </tr>
        ))}
        {!agents.items.length && (
          <tr>
            <td style={{ padding: 12, opacity: 0.7 }} colSpan={8}>
              No agents found yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</section>

      {/* Requests */}
      <section style={{ marginTop: 18 }}>
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
                <th style={{ padding: 8 }}>action</th>
                <th style={{ padding: 8 }}>system</th>
                <th style={{ padding: 8 }}>decision</th>
              </tr>
            </thead>
            <tbody>
              {audit.items.map((x, idx) => (
                <tr key={x.id || idx} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{fmtTs(x.ts)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.event, 36)}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{safeStr(x.request_id, 40)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.agent_id, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.action, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.system, 32)}</td>
                  <td style={{ padding: 8 }}>{safeStr(x.decision, 24)}</td>
                </tr>
              ))}
              {!audit.items.length && (
                <tr>
                  <td style={{ padding: 12, opacity: 0.7 }} colSpan={7}>
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
