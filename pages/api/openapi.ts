/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: OpenAPI for Microsoft Foundry / Copilot tool import (stable endpoint without dot-path).
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    openapi: "3.0.1",
    info: { title: "AIF Gateway Demo", version: "1.0.0" },
    paths: {
      "/api/agents/register": {
        post: {
          operationId: "RegisterAgent",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/approve": {
        post: {
          operationId: "ApproveAction",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/execute": {
        post: {
          operationId: "ExecuteAction",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/decisions/{decision_id}/approve": {
        post: {
          operationId: "ApproveDecision",
          parameters: [{ name: "decision_id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/decisions/{decision_id}/deny": {
        post: {
          operationId: "DenyDecision",
          parameters: [{ name: "decision_id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } }
        }
      }
    }
  });
}
