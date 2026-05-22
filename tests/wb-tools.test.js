import { describe, expect, it } from "vitest";
import nock from "nock";
import { createTestApp } from "./helpers/app.js";
import { createMarketplaceAccount } from "../src/accounts/repository.js";
import { callWbApi } from "../src/wb/client.js";
import { WB_ENDPOINTS } from "../src/wb/endpoints.js";

describe("Wildberries API client", () => {
  it("calls only an allowlisted WB endpoint with the stored account token", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({ db, config, id: "main", marketplace: "wildberries", name: "Main WB", credentials: { apiToken: "wb-secret-token" } });

    nock("https://advert-api.wildberries.ru", {
      reqheaders: { Authorization: "wb-secret-token" },
    })
      .get("/adv/v3/fullstats")
      .query({ ids: "123", beginDate: "2026-05-15", endDate: "2026-05-15" })
      .reply(200, [{ advertId: 123, views: 10 }]);

    const data = await callWbApi({
      db,
      config,
      accountId: "main",
      endpointKey: "advertFullstats",
      input: { ids: "123", beginDate: "2026-05-15", endDate: "2026-05-15" },
    });

    expect(data).toEqual([{ advertId: 123, views: 10 }]);
    await cleanup();
  });

  it("rejects unknown endpoint keys instead of proxying arbitrary URLs", async () => {
    const { db, config, cleanup } = await createTestApp();

    await expect(callWbApi({
      db,
      config,
      accountId: "main",
      endpointKey: "https://evil.example",
      input: {},
    })).rejects.toThrow("Unknown WB endpoint");
    await cleanup();
  });

  it("calls newly allowlisted WB seller analytics endpoints", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({ db, config, id: "main", marketplace: "wildberries", name: "Main WB", credentials: { apiToken: "wb-secret-token" } });

    nock("https://seller-analytics-api.wildberries.ru", {
      reqheaders: { Authorization: "wb-secret-token" },
    })
      .post("/api/analytics/v3/sales-funnel/grouped/history", { period: { begin: "2026-04-01", end: "2026-04-30" } })
      .reply(200, { data: [] });

    const data = await callWbApi({
      db,
      config,
      accountId: "main",
      endpointKey: "nmReportGroupedHistory",
      input: { period: { begin: "2026-04-01", end: "2026-04-30" } },
    });

    expect(data).toEqual({ data: [] });
    await cleanup();
  });

  it("calls current WB advertising campaign list endpoint", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({ db, config, id: "main", marketplace: "wildberries", name: "Main WB", credentials: { apiToken: "wb-secret-token" } });

    nock("https://advert-api.wildberries.ru", {
      reqheaders: { Authorization: "wb-secret-token" },
    })
      .get("/adv/v1/promotion/count")
      .reply(200, { adverts: [] });

    const data = await callWbApi({
      db,
      config,
      accountId: "main",
      endpointKey: "advertCampaignsCount",
      input: {},
    });

    expect(data).toEqual({ adverts: [] });
    await cleanup();
  });

  it("does not keep deprecated WB API paths in the allowlist", () => {
    const paths = Object.values(WB_ENDPOINTS).map((endpoint) => endpoint.path);

    expect(paths).not.toContain("/adv/v2/fullstats");
    expect(paths).not.toContain("/api/v2/nm-report/detail");
    expect(paths).not.toContain("/api/v2/nm-report/detail/history");
    expect(paths).not.toContain("/api/v2/nm-report/grouped/history");
  });
});
