/**
 * Helper functions to build WB API request bodies and validate inputs
 */

import crypto from "node:crypto";

export function removeUndefined(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
}

export function daysBetween(dateFrom, dateTo) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffMs = to - from;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function buildPeriod(start, end) {
  return { start, end };
}

export function buildOrderBy(field, mode) {
  return { field, mode };
}

export function assertMaxPeriodDays(dateFrom, dateTo, maxDays, methodName) {
  const days = daysBetween(dateFrom, dateTo);
  if (days > maxDays) {
    throw new Error(
      `${methodName} supports only up to ${maxDays} days. Requested period: ${days} days (${dateFrom} to ${dateTo}).`
    );
  }
}

export function assertMinimumOneDayPeriod(dateFrom, dateTo, methodName) {
  const days = daysBetween(dateFrom, dateTo);
  if (days < 0) {
    throw new Error(`${methodName}: dateFrom must be before dateTo. Got ${dateFrom} to ${dateTo}.`);
  }
}

export const DEFAULT_AVAILABILITY_FILTERS = [
  "deficient",
  "actual",
  "balanced",
  "nonActual",
  "nonLiquid",
  "invalidData",
];

export function buildStocksBaseBody({
  nmIDs = [],
  subjectIDs = [],
  brandNames = [],
  tagIDs = [],
  dateFrom,
  dateTo,
  stockType = "",
  skipDeletedNm = true,
}) {
  return removeUndefined({
    nmIDs,
    subjectIDs,
    brandNames,
    tagIDs,
    currentPeriod: buildPeriod(dateFrom, dateTo),
    stockType: stockType || undefined,
    skipDeletedNm,
  });
}

/**
 * Builds request body for get_nm_report_detail
 */
export function buildNmReportDetailBody({
  selectedStart,
  selectedEnd,
  pastStart,
  pastEnd,
  nmIds = [],
  brandNames = [],
  subjectIds = [],
  tagIds = [],
  skipDeletedNm = true,
  orderByField = "ordersCount",
  orderByMode = "desc",
  limit = 1000,
  offset = 0,
}) {
  const body = {
    selectedPeriod: buildPeriod(selectedStart, selectedEnd),
    nmIds,
    brandNames,
    subjectIds,
    tagIds,
    skipDeletedNm,
    orderBy: buildOrderBy(orderByField, orderByMode),
    limit,
    offset,
  };

  if (pastStart && pastEnd) {
    body.pastPeriod = buildPeriod(pastStart, pastEnd);
  }

  return body;
}

/**
 * Builds request body for get_nm_report_detail_history
 */
export function buildNmReportDetailHistoryBody({
  dateFrom,
  dateTo,
  nmIds,
  skipDeletedNm = true,
  aggregationLevel = "day",
}) {
  return {
    selectedPeriod: buildPeriod(dateFrom, dateTo),
    nmIds,
    skipDeletedNm,
    aggregationLevel,
  };
}

/**
 * Builds request body for get_nm_report_grouped_history
 */
export function buildNmReportGroupedHistoryBody({
  dateFrom,
  dateTo,
  brandNames = [],
  subjectIds = [],
  tagIds = [],
  skipDeletedNm = true,
  aggregationLevel = "day",
}) {
  return {
    selectedPeriod: buildPeriod(dateFrom, dateTo),
    brandNames,
    subjectIds,
    tagIds,
    skipDeletedNm,
    aggregationLevel,
  };
}

/**
 * Builds request body for get_stocks_groups
 */
export function buildStocksGroupsBody({
  nmIDs = [],
  subjectIDs = [],
  brandNames = [],
  tagIDs = [],
  dateFrom,
  dateTo,
  stockType = "",
  skipDeletedNm = true,
  availabilityFilters = DEFAULT_AVAILABILITY_FILTERS,
  orderByField = "avgOrders",
  orderByMode = "desc",
  limit = 100,
  offset = 0,
}) {
  return {
    nmIDs,
    subjectIDs,
    brandNames,
    tagIDs,
    currentPeriod: buildPeriod(dateFrom, dateTo),
    stockType: stockType || undefined,
    skipDeletedNm,
    availabilityFilters,
    orderBy: buildOrderBy(orderByField, orderByMode),
    limit,
    offset,
  };
}

/**
 * Builds request body for get_stocks_products
 */
export function buildStocksProductsBody({
  nmIDs = [],
  subjectID,
  brandName,
  tagID,
  dateFrom,
  dateTo,
  stockType = "",
  skipDeletedNm = true,
  availabilityFilters = DEFAULT_AVAILABILITY_FILTERS,
  orderByField = "avgOrders",
  orderByMode = "desc",
  limit = 100,
  offset = 0,
}) {
  return removeUndefined({
    nmIDs,
    subjectID,
    brandName,
    tagID,
    currentPeriod: buildPeriod(dateFrom, dateTo),
    stockType: stockType || undefined,
    skipDeletedNm,
    orderBy: buildOrderBy(orderByField, orderByMode),
    availabilityFilters,
    limit,
    offset,
  });
}

/**
 * Builds request body for get_stocks_sizes
 */
export function buildStocksSizesBody({
  nmID,
  dateFrom,
  dateTo,
  stockType = "",
  orderByField = "avgOrders",
  orderByMode = "desc",
  includeOffice = true,
}) {
  return {
    nmID,
    currentPeriod: buildPeriod(dateFrom, dateTo),
    stockType: stockType || undefined,
    orderBy: buildOrderBy(orderByField, orderByMode),
    includeOffice,
  };
}

/**
 * Builds request body for get_stocks_offices
 */
export function buildStocksOfficesBody({
  nmIDs = [],
  subjectIDs = [],
  brandNames = [],
  tagIDs = [],
  dateFrom,
  dateTo,
  stockType = "",
  skipDeletedNm = true,
}) {
  return removeUndefined({
    nmIDs,
    subjectIDs,
    brandNames,
    tagIDs,
    currentPeriod: buildPeriod(dateFrom, dateTo),
    stockType: stockType || undefined,
    skipDeletedNm,
  });
}

/**
 * Builds request body for get_search_report
 */
export function buildSearchReportBody({
  dateFrom,
  dateTo,
  positionCluster = "all",
  includeSubstitutedSKUs = true,
  includeSearchTexts = true,
  orderByField = "avgPosition",
  orderByMode = "asc",
  limit = 100,
  offset = 0,
}) {
  return {
    currentPeriod: buildPeriod(dateFrom, dateTo),
    positionCluster,
    includeSubstitutedSKUs,
    includeSearchTexts,
    orderBy: buildOrderBy(orderByField, orderByMode),
    limit,
    offset,
  };
}

/**
 * Builds request body for get_search_report_table_groups
 */
export function buildSearchReportTableGroupsBody({
  dateFrom,
  dateTo,
  brandNames = [],
  subjectIds = [],
  tagIds = [],
  positionCluster = "all",
  includeSubstitutedSKUs = true,
  includeSearchTexts = true,
  orderByField = "avgPosition",
  orderByMode = "asc",
  limit = 100,
  offset = 0,
}) {
  return {
    currentPeriod: buildPeriod(dateFrom, dateTo),
    brandNames,
    subjectIds,
    tagIds,
    positionCluster,
    includeSubstitutedSKUs,
    includeSearchTexts,
    orderBy: buildOrderBy(orderByField, orderByMode),
    limit,
    offset,
  };
}

/**
 * Builds request body for get_search_report_product_orders
 */
export function buildSearchReportProductOrdersBody({
  dateFrom,
  dateTo,
  nmId,
  searchTexts,
}) {
  return {
    period: buildPeriod(dateFrom, dateTo),
    nmId,
    searchTexts,
  };
}

/**
 * Builds request body for create_csv_report
 */
export function buildCsvReportBody({
  reportType,
  userReportName = "WB report",
  dateFrom,
  dateTo,
  timezone = "Europe/Moscow",
  aggregationLevel = "day",
  nmIDs = [],
  subjectIds = [],
  brandNames = [],
  tagIds = [],
  skipDeletedNm = false,
}) {
  return {
    id: crypto.randomUUID(),
    reportType,
    userReportName,
    params: {
      nmIDs,
      subjectIds,
      brandNames,
      tagIds,
      startDate: dateFrom,
      endDate: dateTo,
      timezone,
      aggregationLevel,
      skipDeletedNm,
    },
  };
}
