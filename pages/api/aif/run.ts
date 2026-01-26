import type { NextApiRequest, NextApiResponse } from "next";

type AgentStatus = "active" | "paused" | "killed";
type Risk = "low" | "med" | "high";

const REGISTRY: Record<string, { status: AgentStatus; risk: Risk }> = {
  "salesforce-triage": { status: "active", risk: "med" },
  "servicenow-incident": { status: "active", risk: "high" },
  "workday-onboarding": { status: "paused", risk: "med" },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ approved: false, error: "Method not allowed" });
  }

  const { agentId, input, action = "run" } = (req.body || {}) as {
    agentId?: string;
    input?: string;
    action?: string;
  };

  if (!agentId || !input) {
    return res.status(400).json({ approved: false, error: "agentId and input are required" });
  }

  // 1) Registry check
  const agent = REGISTRY[String(agentId)];
  if (!agent) {
    return res.status(403).json({
      approved: false,
      reason: "unregistered agent",
      auditId: `evt_${Date.now()}`,
    });
  }
  if (agent.status !== "active") {
    return res.status(403).json({
      approved: false,
      reason: `agent is ${agent.status}`,
      auditId: `evt_${Date.now()}`,
    });
  }

  // 2) Policy check (demo rule)
  const isWrite =
    String(action).toLowerCase().includes("write") ||
    String(input).toLowerCase().includes("write");

  if (agent.risk === "high" && isWrite) {
    return res.status(403).json({
      approved: false,
      reason: "high-risk write blocked",
      auditId: `evt_${Date.now()}`,
    });
  }

  // 3) Audit stub (demo)
  const auditId = `evt_${Date.now()}`;

  // 4) Approved execution (demo)
  return res.status(200).json({
    approved: true,
    auditId,
    result: `Approved by AIF Gateway. agent=${agentId}, action=${action}`,
  });
}
