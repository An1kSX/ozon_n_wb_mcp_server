import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { callsProtectedTool } from "../src/mcp/auth.js";

async function getAccessToken(app, config) {
  const client = await request(app).post("/register").send({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    token_endpoint_auth_method: "none",
  });
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const auth = await request(app).post("/authorize").type("form").send({
    email: "boss@example.com",
    password: "boss-password",
    client_id: client.body.client_id,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    response_type: "code",
    scope: "wb:read offline_access",
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: config.mcpResourceUrl,
  });
  const code = new URL(auth.headers.location).searchParams.get("code");
  const token = await request(app).post("/token").type("form").send({
    grant_type: "authorization_code",
    client_id: client.body.client_id,
    code,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    code_verifier: verifier,
    resource: config.mcpResourceUrl,
  });
  return token.body.access_token;
}

describe("MCP OAuth gate", () => {
  it("returns OAuth 401 for protected tool calls without bearer token", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_marketplace_accounts", arguments: {} } });

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(res.headers["www-authenticate"]).toContain(`resource_metadata="${config.baseUrl}/.well-known/oauth-protected-resource/mcp"`);
    expect(res.headers["www-authenticate"]).toContain('scope="wb:read"');
    await cleanup();
  });

  it("allows tools/list without bearer token for connector bootstrap", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain("list_marketplace_accounts");
    await cleanup();
  });

  it("allows protected tool calls with a valid bearer token", async () => {
    const { app, config, cleanup } = await createTestApp();
    const accessToken = await getAccessToken(app, config);

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_marketplace_accounts", arguments: {} } });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain("content");
    await cleanup();
  });

  it("protects expanded Ozon tools", () => {
    expect(callsProtectedTool({ method: "tools/call", params: { name: "get_ozon_analytics_data" } })).toBe(true);
    expect(callsProtectedTool({ method: "tools/call", params: { name: "list_ozon_ad_campaigns" } })).toBe(true);
    expect(callsProtectedTool({ method: "tools/call", params: { name: "get_ozon_finance_realization" } })).toBe(true);
  });
});
