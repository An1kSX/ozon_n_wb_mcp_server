import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

describe("health endpoint", () => {
  it("returns service status without requiring OAuth", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "wb-claude-mcp",
      cache: { enabled: false, status: "disabled" },
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
    await cleanup();
  });
});
