import { describe, expect, it } from "vitest";
import nock from "nock";
import { createTestApp } from "./helpers/app.js";
import { createMarketplaceAccount } from "../src/accounts/repository.js";
import { callOzonSellerApi, requestOzonPerformanceReport } from "../src/ozon/client.js";
import { aggregateOzonMonthlyFinance } from "../src/ozon/finance.js";

describe("Ozon API clients and finance aggregation", () => {
  it("calls Ozon Seller API with Client-Id and Api-Key headers", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({
      db,
      config,
      id: "ozon-main",
      marketplace: "ozon",
      name: "Main Ozon",
      credentials: { sellerClientId: "client-id", sellerApiKey: "seller-secret" },
    });

    nock("https://api-seller.ozon.ru", {
      reqheaders: { "Client-Id": "client-id", "Api-Key": "seller-secret" },
    })
      .post("/v3/finance/transaction/list")
      .reply(200, { result: { operations: [] } });

    const data = await callOzonSellerApi({
      db,
      config,
      accountId: "ozon-main",
      endpointKey: "financeTransactions",
      input: { filter: { date: { from: "2026-05-01T00:00:00Z", to: "2026-05-31T23:59:59Z" } } },
    });

    expect(data).toEqual({ result: { operations: [] } });
    await cleanup();
  });

  it("requests Ozon Performance report with a bearer token from client credentials", async () => {
    const { db, config, cleanup } = await createTestApp();
    await createMarketplaceAccount({
      db,
      config,
      id: "ozon-main",
      marketplace: "ozon",
      name: "Main Ozon",
      credentials: {
        sellerClientId: "client-id",
        sellerApiKey: "seller-secret",
        performanceClientId: "perf-client",
        performanceClientSecret: "perf-secret",
      },
    });

    nock("https://api-performance.ozon.ru")
      .post("/api/client/token", { client_id: "perf-client", client_secret: "perf-secret", grant_type: "client_credentials" })
      .reply(200, { access_token: "perf-access-token", token_type: "Bearer" })
      .post("/api/client/statistics", { campaigns: ["123"], dateFrom: "2026-05-01", dateTo: "2026-05-31", groupBy: "SKU" })
      .matchHeader("authorization", "Bearer perf-access-token")
      .reply(200, { UUID: "report-uuid" });

    const data = await requestOzonPerformanceReport({
      db,
      config,
      accountId: "ozon-main",
      input: { campaigns: ["123"], dateFrom: "2026-05-01", dateTo: "2026-05-31", groupBy: "SKU" },
    });

    expect(data).toEqual({ UUID: "report-uuid" });
    await cleanup();
  });

  it("aggregates monthly Ozon sales, profit, and logistics share from finance operations", () => {
    const result = aggregateOzonMonthlyFinance([
      {
        operation_date: "2026-05-10T12:00:00Z",
        accruals_for_sale: 1000,
        amount: 760,
        services: [{ name: "MarketplaceServiceItemDirectFlowLogistic", price: -120 }],
      },
      {
        operation_date: "2026-05-20T12:00:00Z",
        accruals_for_sale: 500,
        amount: 350,
        services: [{ name: "delivery", price: -60 }],
      },
    ]);

    expect(result).toEqual([
      {
        month: "2026-05",
        sales: 1500,
        profit: 1110,
        logisticsCost: 180,
        logisticsShareOfSales: 0.12,
      },
    ]);
  });
});
