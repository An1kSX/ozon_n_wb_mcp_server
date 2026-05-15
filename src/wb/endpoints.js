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
  searchReport: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/report",
  },
  stocksProducts: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/products/products",
  },
  csvReports: {
    method: "GET",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/downloads",
  },
};
