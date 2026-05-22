import { describe, expect, it, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { createTestApp } from "./helpers/app.js";
import { createMarketplaceAccount } from "../src/accounts/repository.js";
import { buildMcpServer, jsonContent } from "../src/mcp/server.js";

describe("WB MCP Tools Validation", () => {
  let server;
  let db;
  let config;
  let user;
  let cleanup;

  beforeEach(async () => {
    const testApp = await createTestApp();
    db = testApp.db;
    config = testApp.config;
    cleanup = testApp.cleanup;
    user = { id: "test-user" };
    server = buildMcpServer({ db, config, user });

    await createMarketplaceAccount({
      db,
      config,
      id: "main",
      marketplace: "wildberries",
      name: "Main WB",
      credentials: { apiToken: "wb-secret-token" },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("get_advert_fullstats", () => {
    it("validates that maximum 50 campaign IDs are allowed", async () => {
      const tool = server.tools.get("get_advert_fullstats");
      const ids = Array.from({ length: 51 }, (_, i) => i + 1);

      try {
        await tool.execute({
          accountId: "main",
          ids,
          beginDate: "2026-05-01",
          endDate: "2026-05-31",
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/maximum 50 campaign IDs/);
      }
    });

    it("validates that period does not exceed 31 days", async () => {
      const tool = server.tools.get("get_advert_fullstats");

      try {
        await tool.execute({
          accountId: "main",
          ids: [1, 2],
          beginDate: "2026-04-01",
          endDate: "2026-05-15",
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/supports only up to 31 days/);
      }
    });

    it("accepts up to 50 IDs and 31 days", async () => {
      nock("https://advert-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .get("/adv/v3/fullstats")
        .query((q) => q.ids && q.beginDate && q.endDate)
        .reply(200, []);

      const tool = server.tools.get("get_advert_fullstats");
      const ids = Array.from({ length: 50 }, (_, i) => i + 1);

      const result = await tool.execute({
        accountId: "main",
        ids,
        beginDate: "2026-04-01",
        endDate: "2026-05-01",
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("get_nm_report_detail_history", () => {
    it("validates that period does not exceed 7 days", async () => {
      const tool = server.tools.get("get_nm_report_detail_history");

      try {
        await tool.execute({
          accountId: "main",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-15",
          nmIds: [123],
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/supports only up to 7 days/);
      }
    });

    it("accepts up to 7 days", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/analytics/v3/sales-funnel/products/history", (body) => {
          return (
            body.selectedPeriod &&
            body.nmIds &&
            Array.isArray(body.nmIds)
          );
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_nm_report_detail_history");

      const result = await tool.execute({
        accountId: "main",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
        nmIds: [123],
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("get_nm_report_grouped_history", () => {
    it("validates that period does not exceed 7 days", async () => {
      const tool = server.tools.get("get_nm_report_grouped_history");

      try {
        await tool.execute({
          accountId: "main",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-20",
          brandNames: ["Brand"],
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/supports only up to 7 days/);
      }
    });
  });

  describe("get_search_report", () => {
    it("validates that at least one include flag must be true", async () => {
      const tool = server.tools.get("get_search_report");

      try {
        await tool.execute({
          accountId: "main",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-30",
          includeSubstitutedSKUs: false,
          includeSearchTexts: false,
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/at least one of includeSubstitutedSKUs or includeSearchTexts must be true/);
      }
    });

    it("accepts when at least one flag is true", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/v2/search-report/report", (body) => {
          return body.currentPeriod && typeof body.includeSubstitutedSKUs === "boolean";
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_search_report");

      const result = await tool.execute({
        accountId: "main",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        includeSubstitutedSKUs: true,
        includeSearchTexts: false,
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("get_search_report_table_groups", () => {
    it("validates that at least one filter is provided", async () => {
      const tool = server.tools.get("get_search_report_table_groups");

      try {
        await tool.execute({
          accountId: "main",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-30",
          brandNames: [],
          subjectIds: [],
          tagIds: [],
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/requires at least one filter: brandNames, subjectIds, or tagIds/);
      }
    });

    it("accepts when at least one filter is provided", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/v2/search-report/table/groups", (body) => {
          return body.brandNames && body.brandNames.length > 0;
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_search_report_table_groups");

      const result = await tool.execute({
        accountId: "main",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        brandNames: ["Brand1"],
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("get_search_report_product_orders", () => {
    it("validates that period does not exceed 7 days", async () => {
      const tool = server.tools.get("get_search_report_product_orders");

      try {
        await tool.execute({
          accountId: "main",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-15",
          nmId: 123,
          searchTexts: ["text"],
        });
        throw new Error("Expected validation error");
      } catch (err) {
        expect(err.message).toMatch(/supports only up to 7 days/);
      }
    });
  });

  describe("get_stocks_sizes", () => {
    it("builds body with single nmID", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/v2/stocks-report/products/sizes", (body) => {
          return (
            body.nmID === 123 &&
            body.currentPeriod &&
            typeof body.includeOffice === "boolean"
          );
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_stocks_sizes");

      const result = await tool.execute({
        accountId: "main",
        nmID: 123,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("get_nm_report_detail", () => {
    it("builds body with selectedPeriod and pastPeriod for comparison", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/analytics/v3/sales-funnel/products", (body) => {
          return (
            body.selectedPeriod &&
            body.selectedPeriod.start === "2026-04-01" &&
            body.selectedPeriod.end === "2026-04-30" &&
            body.pastPeriod &&
            body.pastPeriod.start === "2026-03-01" &&
            body.pastPeriod.end === "2026-03-31"
          );
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_nm_report_detail");

      const result = await tool.execute({
        accountId: "main",
        selectedStart: "2026-04-01",
        selectedEnd: "2026-04-30",
        pastStart: "2026-03-01",
        pastEnd: "2026-03-31",
      });

      expect(result.content[0].type).toBe("text");
    });

    it("builds body without pastPeriod when not provided", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/analytics/v3/sales-funnel/products", (body) => {
          return body.selectedPeriod && !body.pastPeriod;
        })
        .reply(200, { data: [] });

      const tool = server.tools.get("get_nm_report_detail");

      const result = await tool.execute({
        accountId: "main",
        selectedStart: "2026-04-01",
        selectedEnd: "2026-04-30",
      });

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("create_csv_report", () => {
    it("generates UUID and builds correct params", async () => {
      nock("https://seller-analytics-api.wildberries.ru", {
        reqheaders: { Authorization: "Bearer wb-secret-token" },
      })
        .post("/api/v2/nm-report/downloads", (body) => {
          return (
            body.id &&
            body.reportType === "DETAIL_HISTORY_REPORT" &&
            body.params &&
            body.params.startDate === "2026-04-01" &&
            body.params.endDate === "2026-04-30" &&
            body.params.timezone === "Europe/Moscow"
          );
        })
        .reply(200, { data: "report-id" });

      const tool = server.tools.get("create_csv_report");

      const result = await tool.execute({
        accountId: "main",
        reportType: "DETAIL_HISTORY_REPORT",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(result.content[0].type).toBe("text");
    });
  });
});
