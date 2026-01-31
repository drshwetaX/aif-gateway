// pages/console/agent-inventory.tsx
/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   AgentInventory UI for the AIF Gateway.
 *   One page that pulls from Redis-backed endpoints + agent registry:
 *     - GET /api/redis/requests?limit=50
 *     - GET /api/redis/decisions?limit=50
 *     - GET /api/redis/audit?limit=100
 *     - GET /api/agents/list
 *
 *   Shows ALL columns from the agent JSON (including nested intent/controls/etc).
 *
 * Dependencies:
 *   - React (useEffect/useMemo/useState)
 *   - ConsoleShell layout component
 *   - The API routes above must return JSON (not a login redirect HTML)
 *
 * When is this file called?
 *   - Rendered when a user visits:
 *       /console/agent-inventory
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from "react";
import ConsoleShell from "@/components/ConsoleShell";

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

async function fetchStream(url: string): Promise<StreamResp> {
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
      stream: "",
      count: 0,
      items: [],
      error: `Non-JSON response (${ct || "unknown content-type"})`,
      detail: text.slice(0, 160),
    };
  }

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

async function fetchAgents(): Promise<{ ok: boolean; agents: any[]; error?: string; detail?: string }> {
  const res = await fetch("/api/agents/list", {
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
      agents: [],
      error: `Non-JSON response (${ct || "unknown content-type"})`,
      detail: text.slice(0, 160),
    };
  }

  const j = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    return { ok: false, agents: [], error: j?.error || `HTTP ${res.status}`, detail: j?.detail || "" };
  }

  return { ok: true, agents: Array.isArray(j?.agents) ? j.agents : [] };
}

export default function AgentInventoryPage() {
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);

  const [reqs, setReqs] = useState<StreamResp>({ stream: "aif:requests", count: 0, items: [] });
  const [decs, setDecs] = useState<StreamResp>({ stream: "aif:decisions", count: 0, items: [] });
  const [audit, setAudit] = useState<StreamResp>({ stream: "aif:audit", count: 0, items: [] });

  const [agents, setAgents] = useState<any[]>([]);
  const [agentsErr, setAgentsErr] = useState<string | null>(null);
  const [agentsDetail, setAgentsDetail] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [r, d, a, g] = await Promise.all([
        fetchStream("/api/redis/requests?limit=50"),
        fetchStream("/api/redis/decisions?limit=50"),
        fetchStream("/api/redis/audit?limit=100"),
        fetchAgents(),
      ]);

      setReqs(r);
      setDecs(d);
      setAudit(a);

      if (!g.ok) {
        setAgents([]);
        setAgentsErr(g.error || "Failed to load agents");
        setAgentsDetail(g.detail || null);
      } else {
        setAgentsErr(null);
        setAgentsDetail(null);
        setAgents(g.agents || []);
      }
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
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="font-semibold">Data source unavailable</div>
        <div className="mt-1 font-mono text-xs">
          {safeStr(r.error, 160)}
          {r.detail ? ` — ${safeStr(r.detail, 220)}` : ""}
        </div>
      </div>
    );
  }

  return (
    <ConsoleShell title="AgentInventory" subtitle="/console/agent-inventory">
      <div className="px-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">AgentInventory</div>
            <div className="mt-1 text-sm text-zinc-600">
              Loads Redis streams + agent registry on page load. If you see “Non-JSON”, middleware likely redirected to
              /login.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Auto-refresh (10s)
            </label>

            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {[
            ["Requests (latest)", reqs.items.length],
            ["Decisions (latest)", decs.items.length],
            ["Audit events (latest)", audit.items.length],
            ["Registry agents", agents.length],
            ["ALLOW", counts.allow],
            ["DENY", counts.deny],
            ["PENDING", counts.pending],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="min-w-[160px] rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="mt-1 text-xl font-extrabold">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <ErrorBanner r={reqs} />
          <ErrorBanner r={decs} />
          <ErrorBanner r={audit} />

          {agentsErr ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="font-semibold">Agents list unavailable</div>
              <div className="mt-1 font-mono text-xs">
                {safeStr(agentsErr, 160)}
                {agentsDetail ? ` — ${safeStr(agentsDetail, 220)}` : ""}
              </div>
            </div>
          ) : null}
        </div>

        {/* Agents (ALL COLUMNS) */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-lg font-semibold">Agents (Registry)</h2>
            <div className="text-xs text-zinc-500">/api/agents/list</div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  {/* top-level */}
                  <th className="p-2">id</th>
                  <th className="p-2">name</th>
                  <th className="p-2">owner</th>
                  <th className="p-2">status</th>
                  <th className="p-2">approved</th>
                  <th className="p-2">created_at</th>
                  <th className="p-2">requested_at</th>
                  <th className="p-2">approved_at</th>
                  <th className="p-2">env</th>
                  <th className="p-2">stage</th>
                  <th className="p-2">comment</th>
                  <th className="p-2">review_notes</th>
                  <th className="p-2">problem_statement</th>

                  {/* intent */}
                  <th className="p-2">intent.actions</th>
                  <th className="p-2">intent.systems</th>
                  <th className="p-2">intent.dataSensitivity</th>
                  <th className="p-2">intent.crossBorder</th>

                  {/* tier + policy */}
                  <th className="p-2">tier</th>
                  <th className="p-2">policy_version</th>

                  {/* controls */}
                  <th className="p-2">controls.logging</th>
                  <th className="p-2">controls.piiRedaction</th>
                  <th className="p-2">controls.humanInLoop</th>
                  <th className="p-2">controls.rateLimitPerMin</th>
                  <th className="p-2">controls.approvalRequired</th>
                  <th className="p-2">controls.auditLevel</th>
                  <th className="p-2">controls.sandboxOnly</th>
                  <th className="p-2">controls.killSwitchRequired</th>

                  {/* allowed_tools */}
                  <th className="p-2">allowed_tools</th>

                  {/* tiering_explain */}
                  <th className="p-2">tiering.finalTier</th>
                  <th className="p-2">tiering.matched_rule_ids</th>
                  <th className="p-2">tiering.matched_rules</th>

                  {/* review */}
                  <th className="p-2">review.decision</th>
                  <th className="p-2">review.decidedAt</th>
                  <th className="p-2">review.decidedBy</th>
                  <th className="p-2">review.notes</th>
                </tr>
              </thead>

              <tbody>
                {agents.map((a, idx) => {
                  const intent = a?.intent || {};
                  const controls = a?.controls || {};
                  const tiering = a?.tiering_explain || {};
                  const review = a?.review || {};

                  const intentActions = Array.isArray(intent.actions) ? intent.actions.join(", ") : "";
                  const intentSystems = Array.isArray(intent.systems) ? intent.systems.join(", ") : "";
                  const allowedTools = Array.isArray(a?.allowed_tools) ? a.allowed_tools.join(", ") : "";
                  const matchedRuleIds = Array.isArray(tiering.matched_rule_ids)
                    ? tiering.matched_rule_ids.join(", ")
                    : "";
                  const matchedRules =
                    Array.isArray(tiering.matched_rules) && tiering.matched_rules.length
                      ? JSON.stringify(tiering.matched_rules)
                      : "";

                  return (
                    <tr key={a.id || idx} className="border-t border-zinc-100 align-top">
                      {/* top-level */}
                      <td className="p-2 font-mono">{safeStr(a.id, 120)}</td>
                      <td className="p-2">{safeStr(a.name, 80)}</td>
                      <td className="p-2">{safeStr(a.owner, 80)}</td>
                      <td className="p-2">{safeStr(a.status, 24)}</td>
                      <td className="p-2">{String(!!a.approved)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTs(a.created_at)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTs(a.requested_at)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTs(a.approved_at)}</td>
                      <td className="p-2">{safeStr(a.env, 12)}</td>
                      <td className="p-2">{safeStr(a.stage, 12)}</td>
                      <td className="p-2">{safeStr(a.comment, 120)}</td>
                      <td className="p-2">{safeStr(a.review_notes, 120)}</td>
                      <td className="p-2">{safeStr(a.problem_statement, 200)}</td>

                      {/* intent */}
                      <td className="p-2">{safeStr(intentActions, 120)}</td>
                      <td className="p-2">{safeStr(intentSystems, 120)}</td>
                      <td className="p-2">{safeStr(intent.dataSensitivity, 24)}</td>
                      <td className="p-2">{String(!!intent.crossBorder)}</td>

                      {/* tier + policy */}
                      <td className="p-2 font-semibold">{safeStr(a.tier, 8)}</td>
                      <td className="p-2">{safeStr(a.policy_version, 64)}</td>

                      {/* controls */}
                      <td className="p-2">{String(!!controls.logging)}</td>
                      <td className="p-2">{String(!!controls.piiRedaction)}</td>
                      <td className="p-2">{String(!!controls.humanInLoop)}</td>
                      <td className="p-2">{controls.rateLimitPerMin ?? ""}</td>
                      <td className="p-2">{String(!!controls.approvalRequired)}</td>
                      <td className="p-2">{safeStr(controls.auditLevel, 16)}</td>
                      <td className="p-2">{String(!!controls.sandboxOnly)}</td>
                      <td className="p-2">{String(!!controls.killSwitchRequired)}</td>

                      {/* allowed_tools */}
                      <td className="p-2">{safeStr(allowedTools, 160)}</td>

                      {/* tiering_explain */}
                      <td className="p-2">{safeStr(tiering.finalTier, 8)}</td>
                      <td className="p-2">{safeStr(matchedRuleIds, 160)}</td>
                      <td className="p-2">
                        {matchedRules ? (
                          <details>
                            <summary className="cursor-pointer text-zinc-600">view</summary>
                            <pre className="mt-2 max-w-[520px] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-[11px]">
                              {matchedRules}
                            </pre>
                          </details>
                        ) : (
                          ""
                        )}
                      </td>

                      {/* review */}
                      <td className="p-2 font-semibold">{safeStr(review.decision, 16)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTs(review.decidedAt)}</td>
                      <td className="p-2">{safeStr(review.decidedBy, 80)}</td>
                      <td className="p-2">{safeStr(review.notes, 160)}</td>
                    </tr>
                  );
                })}

                {!agents.length && (
                  <tr className="border-t border-zinc-100">
                    <td className="p-3 text-zinc-500" colSpan={34}>
                      No agents returned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Requests */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-lg font-semibold">Requests</h2>
            <div className="text-xs text-zinc-500">{reqs.stream}</div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="p-2">Time</th>
                  <th className="p-2">request_id</th>
                  <th className="p-2">agent_id</th>
                  <th className="p-2">action</th>
                  <th className="p-2">system</th>
                  <th className="p-2">sensitivity</th>
                  <th className="p-2">source</th>
                </tr>
              </thead>
              <tbody>
                {reqs.items.map((x, idx) => (
                  <tr key={x.id || idx} className="border-t border-zinc-100">
                    <td className="p-2 whitespace-nowrap">{fmtTs(x.received_at)}</td>
                    <td className="p-2 font-mono">{safeStr(x.request_id, 60)}</td>
                    <td className="p-2">{safeStr(x.agent_id, 40)}</td>
                    <td className="p-2">{safeStr(x.action, 40)}</td>
                    <td className="p-2">{safeStr(x.system, 40)}</td>
                    <td className="p-2">{safeStr(x.dataSensitivity, 24)}</td>
                    <td className="p-2">{safeStr(x.source, 24)}</td>
                  </tr>
                ))}

                {!reqs.items.length && (
                  <tr className="border-t border-zinc-100">
                    <td className="p-3 text-zinc-500" colSpan={7}>
                      No request events found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Decisions */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-lg font-semibold">Decisions</h2>
            <div className="text-xs text-zinc-500">{decs.stream}</div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="p-2">Time</th>
                  <th className="p-2">request_id</th>
                  <th className="p-2">decision</th>
                  <th className="p-2">reason</th>
                  <th className="p-2">policy_version</th>
                </tr>
              </thead>
              <tbody>
                {decs.items.map((x, idx) => (
                  <tr key={x.id || idx} className="border-t border-zinc-100">
                    <td className="p-2 whitespace-nowrap">{fmtTs(x.decided_at)}</td>
                    <td className="p-2 font-mono">{safeStr(x.request_id, 60)}</td>
                    <td className="p-2 font-semibold">{safeStr(x.decision, 24)}</td>
                    <td className="p-2">{safeStr(x.reason, 160)}</td>
                    <td className="p-2">{safeStr(x.policy_version, 48)}</td>
                  </tr>
                ))}

                {!decs.items.length && (
                  <tr className="border-t border-zinc-100">
                    <td className="p-3 text-zinc-500" colSpan={5}>
                      No decision events found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-lg font-semibold">Audit</h2>
            <div className="text-xs text-zinc-500">{audit.stream}</div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="p-2">Time</th>
                  <th className="p-2">event</th>
                  <th className="p-2">request_id</th>
                  <th className="p-2">agent_id</th>
                  <th className="p-2">decision</th>
                  <th className="p-2">endpoint</th>
                </tr>
              </thead>
              <tbody>
                {audit.items.map((x, idx) => (
                  <tr key={x.id || idx} className="border-t border-zinc-100">
                    <td className="p-2 whitespace-nowrap">{fmtTs(x.ts)}</td>
                    <td className="p-2">{safeStr(x.event, 48)}</td>
                    <td className="p-2 font-mono">{safeStr(x.request_id, 60)}</td>
                    <td className="p-2">{safeStr(x.agent_id, 40)}</td>
                    <td className="p-2 font-semibold">{safeStr(x.decision, 24)}</td>
                    <td className="p-2">{safeStr(x.endpoint, 60)}</td>
                  </tr>
                ))}

                {!audit.items.length && (
                  <tr className="border-t border-zinc-100">
                    <td className="p-3 text-zinc-500" colSpan={6}>
                      No audit events found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}
