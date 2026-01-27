/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: OpenAPI definition for Copilot Studio import (Gateway endpoints).
 */

export function getOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "AIF Gateway Demo API",
      version: "1.0.0",
      description:
        "Demo-safe control plane API: agent registry, approvals (HITL/HOTL), simulated execution, and audit logs.",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/api/agents/register": {
        post: {
          operationId: "RegisterAgent",
          summary: "Register an agent (design-time governance)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["client_id", "purpose"],
                  properties: {
                    client_id: { type: "string", example: "copilot-studio" },
                    purpose: { type: "string", example: "Salesforce refund triage agent" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/approve": {
        post: {
          operationId: "ApproveAction",
          summary: "Approve an action (runtime gate)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["agent_id", "client_id", "action", "target"],
                  properties: {
                    agent_id: { type: "string" },
                    client_id: { type: "string" },
                    action: { type: "string" },
                    target: { type: "string" },
                    data_sensitivity: { type: "string", enum: ["public", "internal", "confidential"] },
                    payload: { type: "object", description: "Will be ignored/redacted in demo logs" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/decisions/notify": {
        post: {
          operationId: "NotifyApproverOrReviewer",
          summary: "Send approval/review link (HITL/HOTL)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decision_id", "email"],
                  properties: {
                    decision_id: { type: "string" },
                    email: { type: "string", example: "manager@sunlife.com" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/execute": {
        post: {
          operationId: "ExecuteAction",
          summary: "Execute an approved action (simulated)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decision_id"],
                  properties: {
                    decision_id: { type: "string" },
                    payload: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/agents/pause": { post: { operationId: "PauseAgent", summary: "Pause an agent", responses: { "200": { description: "OK" } } } },
      "/api/agents/kill": { post: { operationId: "KillAgent", summary: "Kill an agent", responses: { "200": { description: "OK" } } } },
      "/api/audit/logs": { get: { operationId: "GetAuditLogs", summary: "List audit events", responses: { "200": { description: "OK" } } } },
    },
  };
}
