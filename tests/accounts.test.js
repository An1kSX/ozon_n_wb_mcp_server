import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { createMarketplaceAccount, getMarketplaceCredentials } from "../src/accounts/repository.js";

function adminAuth() {
  return `Basic ${Buffer.from("admin:admin-password").toString("base64")}`;
}

function extractCsrfToken(html) {
  return html.match(/name="_csrf" value="([^"]+)"/)?.[1];
}

describe("admin marketplace account storage", () => {
  it("stores WB credentials encrypted and returns only safe account fields", async () => {
    const { app, db, config, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/accounts")
      .set("Authorization", adminAuth())
      .send({
        id: "wb-main",
        marketplace: "wildberries",
        name: "Main WB",
        credentials: { apiToken: "wb-secret-token" },
        notes: "Primary account",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "wb-main",
      marketplace: "wildberries",
      name: "Main WB",
      notes: "Primary account",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");

    const row = await db.one("SELECT encrypted_credentials FROM marketplace_accounts WHERE id = $1", ["wb-main"]);
    expect(row.encrypted_credentials).not.toContain("wb-secret-token");
    await expect(getMarketplaceCredentials({ db, config, id: "wb-main" })).resolves.toEqual({ apiToken: "wb-secret-token" });
    await cleanup();
  });

  it("stores Ozon Seller and Performance credentials encrypted", async () => {
    const { app, db, config, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/accounts")
      .set("Authorization", adminAuth())
      .send({
        id: "ozon-main",
        marketplace: "ozon",
        name: "Main Ozon",
        credentials: {
          sellerClientId: "seller-client-id",
          sellerApiKey: "seller-api-key-secret",
          performanceClientId: "performance-client-id",
          performanceClientSecret: "performance-client-secret",
        },
      });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain("seller-api-key-secret");
    const row = await db.one("SELECT encrypted_credentials FROM marketplace_accounts WHERE id = $1", ["ozon-main"]);
    expect(row.encrypted_credentials).not.toContain("seller-api-key-secret");
    await expect(getMarketplaceCredentials({ db, config, id: "ozon-main" })).resolves.toMatchObject({
      sellerClientId: "seller-client-id",
      sellerApiKey: "seller-api-key-secret",
      performanceClientId: "performance-client-id",
      performanceClientSecret: "performance-client-secret",
    });
    await cleanup();
  });

  it("lists accounts without credential material", async () => {
    const { app, db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({
      db,
      config,
      id: "wb-main",
      marketplace: "wildberries",
      name: "Main WB",
      credentials: { apiToken: "wb-secret-token" },
      notes: "",
    });

    const res = await request(app).get("/admin/accounts").set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { id: "wb-main", marketplace: "wildberries", name: "Main WB", notes: "", createdAt: expect.any(String), updatedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");
    await cleanup();
  });

  it("renders a minimal admin panel without credential material", async () => {
    const { app, db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({
      db,
      config,
      id: "ozon-main",
      marketplace: "ozon",
      name: "Main Ozon",
      credentials: { sellerClientId: "seller-client-id", sellerApiKey: "seller-api-key-secret" },
      notes: "Primary account",
    });

    const res = await request(app).get("/admin").set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.text).toContain("Marketplace Admin");
    expect(res.text).toContain("ozon-main");
    expect(res.text).not.toContain("seller-api-key-secret");
    expect(extractCsrfToken(res.text)).toBeTruthy();
    await cleanup();
  });

  it("creates WB and Ozon accounts from the admin panel forms", async () => {
    const { app, db, config, cleanup } = await createTestApp();
    const agent = request.agent(app);
    const panel = await agent.get("/admin").set("Authorization", adminAuth());
    const csrf = extractCsrfToken(panel.text);

    const wb = await agent
      .post("/admin/accounts/form")
      .set("Authorization", adminAuth())
      .type("form")
      .send({
        _csrf: csrf,
        marketplace: "wildberries",
        id: "wb-extra",
        name: "Extra WB",
        apiToken: "wb-extra-secret-token",
        notes: "Second WB account",
      });

    expect(wb.status).toBe(303);

    const ozon = await agent
      .post("/admin/accounts/form")
      .set("Authorization", adminAuth())
      .type("form")
      .send({
        _csrf: csrf,
        marketplace: "ozon",
        id: "ozon-extra",
        name: "Extra Ozon",
        sellerClientId: "ozon-client",
        sellerApiKey: "ozon-seller-secret",
        performanceApiKey: "ozon-performance-secret",
      });

    expect(ozon.status).toBe(303);
    await expect(getMarketplaceCredentials({ db, config, id: "wb-extra" })).resolves.toEqual({ apiToken: "wb-extra-secret-token" });
    await expect(getMarketplaceCredentials({ db, config, id: "ozon-extra" })).resolves.toMatchObject({
      sellerClientId: "ozon-client",
      sellerApiKey: "ozon-seller-secret",
      performanceApiKey: "ozon-performance-secret",
    });
    await cleanup();
  });

  it("rejects admin form submissions without the CSRF token", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/accounts/form")
      .set("Authorization", adminAuth())
      .type("form")
      .send({ marketplace: "wildberries", id: "wb-main", name: "Main WB", apiToken: "wb-secret-token" });

    expect(res.status).toBe(403);
    await cleanup();
  });

  it("rejects admin requests without admin credentials", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app).get("/admin/accounts");

    expect(res.status).toBe(401);
    await cleanup();
  });
});
