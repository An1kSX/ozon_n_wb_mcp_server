import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { verifyAccessToken } from "../src/oauth/tokens.js";

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClaudeClient(app) {
  const res = await request(app).post("/register").send({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  return res.body.client_id;
}

describe("OAuth authorization flow", () => {
  it("issues an authorization code after service login and exchanges it with PKCE", async () => {
    const { app, config, cleanup } = await createTestApp();
    const agent = request.agent(app);
    const clientId = await registerClaudeClient(app);
    const { verifier, challenge } = pkcePair();

    const authorizeRes = await agent
      .post("/authorize")
      .type("form")
      .send({
        email: "boss@example.com",
        password: "boss-password",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        response_type: "code",
        scope: "wb:read offline_access",
        state: "state-123",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: config.mcpResourceUrl,
      });

    expect(authorizeRes.status).toBe(302);
    const location = new URL(authorizeRes.headers.location);
    expect(location.origin + location.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
    expect(location.searchParams.get("state")).toBe("state-123");
    const code = location.searchParams.get("code");
    expect(code).toEqual(expect.any(String));

    const tokenRes = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: verifier,
        resource: config.mcpResourceUrl,
      });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 900,
      scope: "wb:read offline_access",
    });
    expect(tokenRes.body.access_token).toEqual(expect.any(String));
    expect(tokenRes.body.refresh_token).toEqual(expect.any(String));
    expect(verifyAccessToken(config, tokenRes.body.access_token).sub).toBe("1");
    await cleanup();
  });

  it("rejects token exchange with the wrong PKCE verifier", async () => {
    const { app, config, cleanup } = await createTestApp();
    const clientId = await registerClaudeClient(app);
    const { challenge } = pkcePair();

    const authorizeRes = await request(app)
      .post("/authorize")
      .type("form")
      .send({
        email: "boss@example.com",
        password: "boss-password",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        response_type: "code",
        scope: "wb:read",
        state: "state-123",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: config.mcpResourceUrl,
      });
    const code = new URL(authorizeRes.headers.location).searchParams.get("code");

    const tokenRes = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: "wrong-verifier",
        resource: config.mcpResourceUrl,
      });

    expect(tokenRes.status).toBe(400);
    expect(tokenRes.body.error).toBe("invalid_grant");
    await cleanup();
  });
});
