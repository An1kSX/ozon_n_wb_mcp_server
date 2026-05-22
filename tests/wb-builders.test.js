import { describe, expect, it } from "vitest";
import {
  buildNmReportDetailBody,
  buildNmReportDetailHistoryBody,
  buildNmReportGroupedHistoryBody,
  buildStocksGroupsBody,
  buildStocksProductsBody,
  buildStocksSizesBody,
  buildStocksOfficesBody,
  buildSearchReportBody,
  buildSearchReportTableGroupsBody,
  buildSearchReportProductOrdersBody,
  buildCsvReportBody,
  removeUndefined,
  daysBetween,
  DEFAULT_AVAILABILITY_FILTERS,
} from "../src/wb/builders.js";

describe("WB builders", () => {
  describe("removeUndefined", () => {
    it("removes undefined values from object", () => {
      const result = removeUndefined({
        a: 1,
        b: undefined,
        c: "test",
        d: undefined,
      });
      expect(result).toEqual({ a: 1, c: "test" });
    });

    it("handles empty objects", () => {
      expect(removeUndefined({})).toEqual({});
    });

    it("handles null input", () => {
      expect(removeUndefined(null)).toBe(null);
    });
  });

  describe("daysBetween", () => {
    it("calculates days between two dates", () => {
      const days = daysBetween("2026-04-01", "2026-04-30");
      expect(days).toBe(29);
    });

    it("handles same day", () => {
      const days = daysBetween("2026-04-01", "2026-04-01");
      expect(days).toBe(0);
    });

    it("returns negative for reversed dates", () => {
      const days = daysBetween("2026-04-30", "2026-04-01");
      expect(days).toBeLessThan(0);
    });
  });

  describe("buildNmReportDetailBody", () => {
    it("builds body with selectedPeriod", () => {
      const body = buildNmReportDetailBody({
        selectedStart: "2026-04-01",
        selectedEnd: "2026-04-30",
        nmIds: [123, 456],
        limit: 100,
      });

      expect(body).toEqual({
        selectedPeriod: { start: "2026-04-01", end: "2026-04-30" },
        nmIds: [123, 456],
        brandNames: [],
        subjectIds: [],
        tagIds: [],
        skipDeletedNm: true,
        orderBy: { field: "ordersCount", mode: "desc" },
        limit: 100,
        offset: 0,
      });
    });

    it("includes pastPeriod when provided", () => {
      const body = buildNmReportDetailBody({
        selectedStart: "2026-04-01",
        selectedEnd: "2026-04-30",
        pastStart: "2026-03-01",
        pastEnd: "2026-03-31",
      });

      expect(body.pastPeriod).toEqual({ start: "2026-03-01", end: "2026-03-31" });
      expect(body.selectedPeriod).toEqual({ start: "2026-04-01", end: "2026-04-30" });
    });

    it("omits pastPeriod when not provided", () => {
      const body = buildNmReportDetailBody({
        selectedStart: "2026-04-01",
        selectedEnd: "2026-04-30",
      });

      expect(body.pastPeriod).toBeUndefined();
    });
  });

  describe("buildNmReportDetailHistoryBody", () => {
    it("builds body with correct structure", () => {
      const body = buildNmReportDetailHistoryBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
        nmIds: [123, 456],
        aggregationLevel: "day",
      });

      expect(body).toEqual({
        selectedPeriod: { start: "2026-04-01", end: "2026-04-07" },
        nmIds: [123, 456],
        skipDeletedNm: true,
        aggregationLevel: "day",
      });
    });
  });

  describe("buildNmReportGroupedHistoryBody", () => {
    it("builds body with filters", () => {
      const body = buildNmReportGroupedHistoryBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
        brandNames: ["Brand1", "Brand2"],
        subjectIds: [100, 200],
      });

      expect(body).toEqual({
        selectedPeriod: { start: "2026-04-01", end: "2026-04-07" },
        brandNames: ["Brand1", "Brand2"],
        subjectIds: [100, 200],
        tagIds: [],
        skipDeletedNm: true,
        aggregationLevel: "day",
      });
    });
  });

  describe("buildStocksGroupsBody", () => {
    it("includes all default availability filters", () => {
      const body = buildStocksGroupsBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body.availabilityFilters).toEqual(DEFAULT_AVAILABILITY_FILTERS);
    });

    it("builds complete body with all fields", () => {
      const body = buildStocksGroupsBody({
        nmIDs: [123],
        subjectIDs: [456],
        brandNames: ["Brand"],
        tagIDs: [789],
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        stockType: "wb",
        skipDeletedNm: false,
        orderByField: "avgOrders",
        orderByMode: "asc",
        limit: 50,
        offset: 10,
      });

      expect(body.currentPeriod).toEqual({ start: "2026-04-01", end: "2026-04-30" });
      expect(body.nmIDs).toEqual([123]);
      expect(body.subjectIDs).toEqual([456]);
      expect(body.brandNames).toEqual(["Brand"]);
      expect(body.tagIDs).toEqual([789]);
      expect(body.stockType).toBeUndefined();
      expect(body.skipDeletedNm).toBe(false);
      expect(body.orderBy).toEqual({ field: "avgOrders", mode: "asc" });
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(10);
    });
  });

  describe("buildStocksProductsBody", () => {
    it("removes undefined singular fields", () => {
      const body = buildStocksProductsBody({
        nmIDs: [123],
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body.subjectID).toBeUndefined();
      expect(body.brandName).toBeUndefined();
      expect(body.tagID).toBeUndefined();
    });

    it("includes singular fields when provided", () => {
      const body = buildStocksProductsBody({
        nmIDs: [123],
        subjectID: 456,
        brandName: "Brand",
        tagID: 789,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body.subjectID).toBe(456);
      expect(body.brandName).toBe("Brand");
      expect(body.tagID).toBe(789);
    });
  });

  describe("buildStocksSizesBody", () => {
    it("builds body with nmID", () => {
      const body = buildStocksSizesBody({
        nmID: 123,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body).toEqual({
        nmID: 123,
        currentPeriod: { start: "2026-04-01", end: "2026-04-30" },
        stockType: undefined,
        orderBy: { field: "avgOrders", mode: "desc" },
        includeOffice: true,
      });
    });
  });

  describe("buildStocksOfficesBody", () => {
    it("removes undefined stockType", () => {
      const body = buildStocksOfficesBody({
        nmIDs: [123],
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body.stockType).toBeUndefined();
    });
  });

  describe("buildSearchReportBody", () => {
    it("builds body with default values", () => {
      const body = buildSearchReportBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body).toEqual({
        currentPeriod: { start: "2026-04-01", end: "2026-04-30" },
        positionCluster: "all",
        includeSubstitutedSKUs: true,
        includeSearchTexts: true,
        orderBy: { field: "avgPosition", mode: "asc" },
        limit: 100,
        offset: 0,
      });
    });

    it("respects custom values", () => {
      const body = buildSearchReportBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        positionCluster: "top10",
        includeSubstitutedSKUs: false,
        includeSearchTexts: false,
        orderByMode: "desc",
        limit: 50,
      });

      expect(body.positionCluster).toBe("top10");
      expect(body.includeSubstitutedSKUs).toBe(false);
      expect(body.includeSearchTexts).toBe(false);
      expect(body.orderBy.mode).toBe("desc");
      expect(body.limit).toBe(50);
    });
  });

  describe("buildSearchReportTableGroupsBody", () => {
    it("builds body with filters", () => {
      const body = buildSearchReportTableGroupsBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        brandNames: ["Brand"],
        subjectIds: [123],
        tagIds: [456],
      });

      expect(body.brandNames).toEqual(["Brand"]);
      expect(body.subjectIds).toEqual([123]);
      expect(body.tagIds).toEqual([456]);
    });
  });

  describe("buildSearchReportProductOrdersBody", () => {
    it("builds body with period and search texts", () => {
      const body = buildSearchReportProductOrdersBody({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-07",
        nmId: 123,
        searchTexts: ["text1", "text2"],
      });

      expect(body).toEqual({
        period: { start: "2026-04-01", end: "2026-04-07" },
        nmId: 123,
        searchTexts: ["text1", "text2"],
      });
    });
  });

  describe("buildCsvReportBody", () => {
    it("generates UUID and builds correct params structure", () => {
      const body = buildCsvReportBody({
        reportType: "DETAIL_HISTORY_REPORT",
        userReportName: "My Report",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        timezone: "Europe/Moscow",
        aggregationLevel: "day",
        nmIDs: [123, 456],
        subjectIds: [789],
        brandNames: ["Brand"],
        tagIds: [999],
        skipDeletedNm: true,
      });

      expect(body.id).toBeDefined();
      expect(body.id).toMatch(/^[\w-]+$/); // UUID format check
      expect(body.reportType).toBe("DETAIL_HISTORY_REPORT");
      expect(body.userReportName).toBe("My Report");
      expect(body.params).toEqual({
        nmIDs: [123, 456],
        subjectIds: [789],
        brandNames: ["Brand"],
        tagIds: [999],
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        timezone: "Europe/Moscow",
        aggregationLevel: "day",
        skipDeletedNm: true,
      });
    });

    it("uses default values", () => {
      const body = buildCsvReportBody({
        reportType: "GROUPED_HISTORY_REPORT",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body.userReportName).toBe("WB report");
      expect(body.params.timezone).toBe("Europe/Moscow");
      expect(body.params.aggregationLevel).toBe("day");
      expect(body.params.skipDeletedNm).toBe(false);
    });

    it("generates unique UUIDs for each call", () => {
      const body1 = buildCsvReportBody({
        reportType: "DETAIL_HISTORY_REPORT",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      const body2 = buildCsvReportBody({
        reportType: "DETAIL_HISTORY_REPORT",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      });

      expect(body1.id).not.toBe(body2.id);
    });
  });

  describe("DEFAULT_AVAILABILITY_FILTERS", () => {
    it("includes all expected filter types", () => {
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("deficient");
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("actual");
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("balanced");
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("nonActual");
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("nonLiquid");
      expect(DEFAULT_AVAILABILITY_FILTERS).toContain("invalidData");
    });
  });
});
