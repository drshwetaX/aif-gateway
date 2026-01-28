// pages/api/run.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveTier, controlsForTier } from "@/lib/policy/policyEngine";
import { buildIntent } from "@/lib/policy/intent";
import { writeAudit } from "@/lib/audit/audit";

function nowIso() {
  return new Date().toISOString();
}

type RunResponse =
  | {
      ok: true;
      ts: string;
      tier: string;
      controls: any;
      intent: any;
      decision: "ALLOWED";
      rationale: string;
      echo?: any;
    }
  | {
      ok: false;
      ts: string;
      tier: string;
      controls: any;
      intent: any;
      decision: "DENIED";
      error: "approval_required" | "sandbox_only" | "invalid_request" | "internal_error";
      rationale: string;
    };

export default async function handler(req: NextApiRequest, res: NextApiResponse<RunResponse>) {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      ok: false,
      ts: nowIso(),
      tier: "A1",
      controls: {},
      intent: {},
      decision: "DENIED",
      error: "invalid_request",
      rationale: "Method Not Allowed. Use POST.",
    });
  }

  try {
    // 1) Build intent from request payload
    const intent = buildIntent(req.body);

    // Basic payload sanity (prevents accidental “match everything”)
    if (!Array.isArray(intent.actions) || !Array.isArray(intent.systems)) {
      return res.status(400).json({
        ok: false,
        ts: nowIso(),
        tier: "A1",
        controls: {},
        intent,
        decision: "DENIED",
        error: "invalid_request",
        rationale: "Invalid payload: actions and systems must be arrays.",
      });
    }

    // 2) Resolve tier + controls
    const tier = resolveTier(intent);
    const controls = controlsForTier(tier);

    const user = (req.headers["x-demo-user"] as string | undefined) ?? undefined;
    const env = req.body?.env; // e.g., "sandbox" | "prod"
    const approved = !!req.body?.approved;

    // 3) Enforce controls
    if (controls?.approvalRequired && !approved) {
      writeAudit({
        ts: nowIso(),
        user,
        endpoint: "/api/run",
        intent,
        tier,
        controls,
        decision: "DENY",
        reason: "approval_required",
      });

      return res.status(403).json({
        ok: false,
        ts: nowIso(),
        tier,
        controls,
        intent,
        decision: "DENIED",
        error: "approval_required",
        rationale: "This request requires approval per policy controls.",
      });
    }

    if (controls?.sandboxOnly && env !== "sandbox") {
      writeAudit({
        ts: nowIso(),
        user,
        endpoint: "/api/run",
        intent,
        tier,
        controls,
        decision: "DENY",
        reason: "sandbox_only",
      });

      return res.status(403).json({
        ok: false,
        ts: nowIso(),
        tier,
        controls,
        intent,
        decision: "DENIED",
        error: "sandbox_only",
        rationale: "This request is restricted to the sandbox environment per policy controls.",
      });
    }

    // 4) ALLOW (replace this stub with your real execution later)
    writeAudit({
      ts: nowIso(),
      user,
      endpoint: "/api/run",
      intent,
      tier,
      controls,
      decision: "ALLOW",
    });

    return res.status(200).json({
      ok: true,
      ts: nowIso(),
      tier,
      controls,
      intent,
      decision: "ALLOWED",
      rationale: "Policy checks passed. (Execution stub response.)",
      echo: {
        problemStatement: req.body?.problemStatement ?? "",
        approved,
        env: env ?? "unspecified",
      },
    });
  } catch (e: any) {
    console.error("Error in /api/run:", e);

    return res.status(500).json({
      ok: false,
      ts: nowIso(),
      tier: "A1",
      controls: {},
      intent: {},
      decision: "DENIED",
      error: "internal_error",
      rationale: e?.message ?? "Internal error",
    });
  }
}
