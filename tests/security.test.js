import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { buildConfig } from "../src/config.js";

describe("public security behavior", () => {
  it("does not allow wildcard CORS credentials on authenticated endpoints", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app).options("/mcp").set("Origin", "https://attacker.example");

    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    await cleanup();
  });

  it("redacts server errors from responses", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/accounts")
      .set("Authorization", `Basic ${Buffer.from("admin:admin-password").toString("base64")}`)
      .send({ id: "bad space", marketplace: "wildberries", name: "Bad", credentials: { apiToken: "wb-secret-token" } });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");
    await cleanup();
  });

  it("requires explicit admin credentials in production", () => {
    const productionEnv = {
      NODE_ENV: "production",
      BASE_URL: "https://mcp.example.test",
      DATABASE_URL: "postgres://postgres:postgres@postgres:5432/wb_mcp",
      TOKEN_SIGNING_SECRET: "token-signing-secret-with-at-least-32-bytes",
      SESSION_SECRET: "session-secret-with-at-least-32-bytes",
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };

    expect(() => buildConfig(productionEnv)).toThrow("ADMIN_USERNAME is required in production");
    expect(() => buildConfig({ ...productionEnv, ADMIN_USERNAME: "admin" })).toThrow("ADMIN_PASSWORD is required in production");
  });
});
