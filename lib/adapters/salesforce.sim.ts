/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Simulated Salesforce adapter for exec demo (no real external calls).
 */
export async function salesforceSimExecute(action: string, payload: any) {
  return {
    system: "salesforce",
    action,
    simulated: true,
    result: "ok",
    echo: { safe_fields_only: true }
  };
}
