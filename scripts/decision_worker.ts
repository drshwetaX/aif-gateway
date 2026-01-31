/**
 * ---------------------------------------------------------------------------
 * Author: Shweta Shah
 * Purpose:
 *   Decision plane worker for the AIF Gateway platform. Consumes requests from
 *   Redis stream (aif:requests), evaluates policy, and emits decisions to
 *   aif:decisions + audit stream. This is the "approve/deny/monitor" engine.
 *
 * Dependencies:
 *   - Redis client from: lib/redis
 *   - Node runtime (runs as a separate process)
 *   - Optional: existing policy functions from your gateway (if available)
 *
 * When is this file called?
 *   - Run as a long-lived worker:
 *       node scripts/decision_worker.ts
 *   - Consumes Redis stream entries continuously (blocking reads).
 *
 * Notes:
 *   - Start with a simple hard-coded decision to prove plumbing.
 *   - Then plug in your real evaluate/policy logic.
 * ---------------------------------------------------------------------------
 */

import { redis } from "../lib/redis";

const STREAM_REQUESTS = "aif:requests";
const STREAM_DECISIONS = "aif:decisions";
const STREAM_AUDIT = "aif:audit";

const GROUP = "policy-engine";
const CONSUMER = "worker-1";

// Minimal policy stub (replace with your actual policy engine)
function decide(req: Record<string, string>) {
  // Example: deny high sensitivity writes to demo_log
  const action = req.action;
  const system = req.system;
  const dataSensitivity = req.dataSensitivity;

  if (dataSensitivity === "high" && action === "write_log" && system === "demo_log") {
    return { decision: "DENY", reason: "high sensitivity write blocked", policy_version: "v1" };
  }
  return { decision: "ALLOW", reason: "ok", policy_version: "v1" };
}

async function ensureGroup() {
  try {
    // Create a consumer group starting at the beginning ($ = new only; 0 = all history)
    await redis.xgroup("CREATE", STREAM_REQUESTS, GROUP, "$", "MKSTREAM");
  } catch (e: any) {
    // BUSYGROUP means it already exists — safe to ignore
    if (!String(e?.message || "").includes("BUSYGROUP")) throw e;
  }
}

async function main() {
  await ensureGroup();
  console.log(`[decision_worker] listening on stream=${STREAM_REQUESTS} group=${GROUP} consumer=${CONSUMER}`);

  while (true) {
    // Block for up to 5 seconds waiting for new messages
    const resp = await redis.xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "COUNT",
      10,
      "BLOCK",
      5000,
      "STREAMS",
      STREAM_REQUESTS,
      ">"
    );

    if (!resp) continue;

    // resp format: [[streamName, [[id, [k1,v1,k2,v2...]], ...]]]
    for (const [, entries] of resp as any) {
      for (const [id, kv] of entries) {
        const obj: Record<string, string> = {};
        for (let i = 0; i < kv.length; i += 2) obj[kv[i]] = kv[i + 1];

        const request_id = obj.request_id || "(missing)";
        const decision = decide(obj);

        // Emit decision
        await redis.xadd(
          STREAM_DECISIONS,
          "*",
          "request_id",
          request_id,
          "decision",
          decision.decision,
          "reason",
          decision.reason,
          "policy_version",
          decision.policy_version,
          "decided_at",
          new Date().toISOString()
        );

        // Emit audit
        await redis.xadd(
          STREAM_AUDIT,
          "*",
          "event",
          "decision_made",
          "request_id",
          request_id,
          "decision",
          decision.decision,
          "system",
          obj.system || "",
          "action",
          obj.action || "",
          "agent_id",
          obj.agent_id || "",
          "ts",
          new Date().toISOString()
        );

        // Ack message
        await redis.xack(STREAM_REQUESTS, GROUP, id);
      }
    }
  }
}

main().catch((err) => {
  console.error("[decision_worker] fatal:", err);
  process.exit(1);
});
