import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

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
});
