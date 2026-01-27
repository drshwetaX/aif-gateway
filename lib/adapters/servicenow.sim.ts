/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Simulated ServiceNow adapter for exec demo (no real external calls).
 */
export async function servicenowSimExecute(action: string, payload: any) {
  return {
    system: "servicenow",
    action,
    simulated: true,
    result: "ok",
    echo: { safe_fields_only: true }
  };
}
