import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

describe("OAuth metadata for Claude remote MCP", () => {
  it("serves protected resource metadata for the MCP resource", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app).get("/.well-known/oauth-protected-resource/mcp");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      resource: config.mcpResourceUrl,
      authorization_servers: [config.baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["wb:read"],
    });
    await cleanup();
  });

  it("serves authorization server metadata with PKCE and DCR", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app).get("/.well-known/oauth-authorization-server");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      issuer: config.baseUrl,
      authorization_endpoint: `${config.baseUrl}/authorize`,
      token_endpoint: `${config.baseUrl}/token`,
      registration_endpoint: `${config.baseUrl}/register`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
    await cleanup();
  });

  it("registers a public Claude OAuth client with an allowed redirect URI", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/register")
      .send({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toEqual(expect.any(String));
    expect(res.body.token_endpoint_auth_method).toBe("none");
    expect(res.body.redirect_uris).toEqual(["https://claude.ai/api/mcp/auth_callback"]);
    await cleanup();
  });

  it("rejects dynamic clients with untrusted redirect hosts", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/register")
      .send({
        client_name: "Bad Client",
        redirect_uris: ["https://attacker.example/callback"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_redirect_uri");
    await cleanup();
  });
});
