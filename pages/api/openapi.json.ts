import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "AIF Gateway - Foundry Tool API",
      version: "1.0.0",
    },
    servers: [{ url: "" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        FoundryRunRequest: {
          type: "object",
          required: ["externalAgentId", "problem_statement"],
          properties: {
            externalAgentId: { type: "string" },
            name: { type: "string" },
            problem_statement: { type: "string" },
            requestedTier: { type: "string", description: "Optional tier hint A1-A6" },
          },
        },
        FoundryRunResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            decision: { type: "string" },
            rationale: { type: "string" },
            agent_id: { type: "string" },
            tier: { type: "string" },
            controls: { type: "object" },
            policy_version: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/foundry/run": {
        post: {
          summary: "Run a Foundry agent through AIF Gateway policy enforcement",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FoundryRunRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Allowed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/FoundryRunResponse" },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Denied (approval required / policy gating)" },
          },
        },
      },
    },
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).send(JSON.stringify(spec, null, 2));
}
