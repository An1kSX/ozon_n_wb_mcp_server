import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticateMcpRequest, callsProtectedTool, writeAuthChallenge } from "./auth.js";
import { buildMcpServer } from "./server.js";

export function buildMcpRouter({ config, db }) {
  const router = express.Router();

  router.post("/mcp", async (req, res, next) => {
    try {
      const user = authenticateMcpRequest(config, req);
      if (!user && callsProtectedTool(req.body)) {
        writeAuthChallenge(config, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const server = buildMcpServer({ config, db, user });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      next(err);
    }
  });

  router.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "method_not_allowed" });
  });

  return router;
}
