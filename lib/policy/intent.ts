import type { AgentIntent } from "./policyEngine";

/**
 * Normalizes incoming request fields into a clean AgentIntent.
 * Keeps your policy layer stable even if UI/tool payloads change.
 */
export function buildIntent(body: any): AgentIntent {
  const actions = Array.isArray(body?.actions) ? body.actions : [];
  const systems = Array.isArray(body?.systems) ? body.systems : [];

  const dataSensitivity = body?.dataSensitivity;
  const crossBorder = !!body?.crossBorder;

  return {
    actions,
    systems,
    dataSensitivity,
    crossBorder,
  };
}
