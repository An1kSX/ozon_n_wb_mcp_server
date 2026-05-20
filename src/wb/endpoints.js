export const WB_ENDPOINTS = {
  advertFullstats: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v2/fullstats",
  },
  autoStatWords: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v2/auto/stat-words",
  },
  campaignStatWords: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v1/stat/words",
  },
  nmReportDetail: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/detail",
  },
  nmReportDetailHistory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/detail/history",
  },
  nmReportGroupedHistory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/grouped/history",
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
