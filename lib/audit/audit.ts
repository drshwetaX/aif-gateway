export type AuditEvent = {
  ts: string;
  user?: string;
  endpoint: string;
  intent: any;
  tier: string;
  controls: any;
  decision: "ALLOW" | "DENY";
  reason?: string;
  [k: string]: any;

};

export function writeAudit(event: AuditEvent) {
  // For now: console log (shows in Vercel/Azure logs)
  console.log("[AUDIT]", JSON.stringify(event));
}
