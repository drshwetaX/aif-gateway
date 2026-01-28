/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: OpenAPI for Copilot Studio / Microsoft Foundry to import Gateway actions.
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host || "localhost:3000";
  const scheme = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${scheme}://${host}`;

  res.status(200).json({
    openapi: "3.0.1",
    info: { title: "AIF Gateway Demo", version: "1.0.0" },
    servers: [{ url: baseUrl }],

    components: {
      schemas: {
        AgentIntent: {
          type: "object",
          additionalProperties: true,
          properties: {
            actions: { type: "array", items: { type: "string" } },
            systems: { type: "array", items: { type: "string" } },
            dataSensitivity: { type: "string", enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII"] },
            crossBorder: { type: "boolean" },
          },
          required: ["actions", "systems"],
        },

        RegisterAgentRequest: {
          type: "object",
          additionalProperties: true,
          properties: {
            externalAgentId: {
              type: "string",
              description: "Foundry/Copilot agent identifier (or name). Used to map to AIF registry.",
            },
            name: { type: "string" },
            problem_statement: { type: "string" },

            // Prefer explicit intent for deterministic tiering
            actions: { type: "array", items: { type: "string" } },
            systems: { type: "array", items: { type: "string" } },
            dataSensitivity: { type: "string", enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII"] },
            crossBorder: { type: "boolean" },

            override_tier: { type: "string", enum: ["A1", "A2", "A3", "A4", "A5", "A6"] },
          },
          required: ["externalAgentId"],
        },

        RegisterAgentResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            ok: { type: "boolean" },
            agent_id: { type: "string" },
            status: { type: "string" },
            risk_tier: { type: "string" },
            controls: { type: "object", additionalProperties: true },
            allowed_tools: { type: "array", items: { type: "string" } },
            policy_version: { type: "string" },
            tiering_explain: { type: "object", additionalProperties: true },
          },
          required: ["agent_id", "risk_tier"],
        },

        RunRequest: {
          type: "object",
          additionalProperties: true,
          properties: {
            agent_id: {
              type: "string",
              description: "AIF registry agent_id returned by RegisterAgent (recommended).",
            },
            externalAgentId: {
              type: "string",
              description: "Optional: Foundry agent id/name if you want lookup by external id.",
            },

            // The intent for this run
            actions: { type: "array", items: { type: "string" } },
            systems: { type: "array", items: { type: "string" } },
            dataSensitivity: { type: "string", enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII"] },
            crossBorder: { type: "boolean" },

            env: { type: "string", description: "e.g., sandbox | prod" },
            approved: { type: "boolean", description: "Set true if an approval was granted." },

            problemStatement: { type: "string" },
          },
          required: ["actions", "systems"],
        },

        RunResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            ok: { type: "boolean" },
            decision: { type: "string", enum: ["ALLOWED", "DENIED"] },
            tier: { type: "string" },
            controls: { type: "object", additionalProperties: true },
            intent: { type: "object", additionalProperties: true },
            ts: { type: "string" },
            error: { type: "string" },
            rationale: { type: "string" },
          },
        },

        GenericObject: {
          type: "object",
          additionalProperties: true,
        },
      },
    },

    paths: {
      "/api/agents/register": {
        post: {
          operationId: "RegisterAgent",
          summary: "Classify + register agent (design-time governance).",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegisterAgentRequest" } },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterAgentResponse" } } },
            },
            "400": { description: "Bad Request" },
            "405": { description: "Method Not Allowed" },
          },
        },
      },

      "/api/run": {
        post: {
          operationId: "RunAction",
          summary: "Run an action through the gateway (runtime enforcement).",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RunRequest" } } },
          },
          responses: {
            "200": {
              description: "Allowed",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RunResponse" } } },
            },
            "403": {
              description: "Denied",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RunResponse" } } },
            },
            "400": { description: "Bad Request" },
          },
        },
      },

      "/api/approve": {
        post: {
          operationId: "ApproveAction",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/GenericObject" } } },
          },
          responses: { "200": { description: "OK" } },
        },
      },

      "/api/execute": {
        post: {
          operationId: "ExecuteAction",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/GenericObject" } } },
          },
          responses: { "200": { description: "OK" } },
        },
      },

      "/api/decisions/{decision_id}/approve": {
        post: {
          operationId: "ApproveDecision",
          parameters: [{ name: "decision_id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } },
        },
      },

      "/api/decisions/{decision_id}/deny": {
        post: {
          operationId: "DenyDecision",
          parameters: [{ name: "decision_id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } },
        },
      },
    },
  });
}
