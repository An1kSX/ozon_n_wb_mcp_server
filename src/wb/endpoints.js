export const WB_ENDPOINTS = {
  advertFullstats: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v3/fullstats",
  },
  advertCampaignsCount: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v1/promotion/count",
  },
  advertCampaignsInfo: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/api/advert/v2/adverts",
  },
  searchClusterList: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v0/normquery/list",
  },
  searchClusterDailyStats: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v1/normquery/stats",
  },
  autoStatWords: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v0/normquery/list",
  },
  campaignStatWords: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v1/normquery/stats",
  },
  nmReportDetail: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/analytics/v3/sales-funnel/products",
  },
  nmReportDetailHistory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/analytics/v3/sales-funnel/products/history",
  },
  nmReportGroupedHistory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/analytics/v3/sales-funnel/grouped/history",
  },
  wbWarehousesInventory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/analytics/v1/stocks-report/wb-warehouses",
  },
  searchReport: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/report",
  },
  searchReportTableGroups: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/table/groups",
  },
  searchReportTableDetails: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/table/details",
  },
  searchReportProductSearchTexts: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/product/search-texts",
  },
  searchReportProductOrders: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/product/orders",
  },
  stocksProducts: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/products/products",
  },
  stocksGroups: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/products/groups",
  },
  stocksSizes: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/products/sizes",
  },
  stocksOffices: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/offices",
  },
  csvReports: {
    method: "GET",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/downloads",
  },
  csvCreate: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/downloads",
  },
  csvRetry: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/downloads/retry",
  },
};
