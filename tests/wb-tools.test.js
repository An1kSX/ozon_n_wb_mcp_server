import { describe, expect, it } from "vitest";
import nock from "nock";
import { createTestApp } from "./helpers/app.js";
import { createMarketplaceAccount } from "../src/accounts/repository.js";
import { callWbApi } from "../src/wb/client.js";

describe("Wildberries API client", () => {
  it("calls only an allowlisted WB endpoint with the stored account token", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({ db, config, id: "main", marketplace: "wildberries", name: "Main WB", credentials: { apiToken: "wb-secret-token" } });

    nock("https://advert-api.wildberries.ru", {
      reqheaders: { Authorization: "wb-secret-token" },
    })
      .post("/adv/v2/fullstats", [{ id: 123, dates: ["2026-05-15"] }])
      .reply(200, [{ advertId: 123, views: 10 }]);

    const data = await callWbApi({
      db,
      config,
      accountId: "main",
      endpointKey: "advertFullstats",
      input: [{ id: 123, dates: ["2026-05-15"] }],
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
      .post("/api/v2/nm-report/grouped/history", { period: { begin: "2026-04-01", end: "2026-04-30" } })
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
});
