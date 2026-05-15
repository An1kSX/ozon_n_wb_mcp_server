export const OZON_SELLER_ENDPOINTS = {
  financeTransactions: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/finance/transaction/list",
  },
  analyticsData: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v1/analytics/data",
  },
};

export const OZON_PERFORMANCE_ENDPOINTS = {
  token: {
    method: "POST",
    baseUrl: "https://api-performance.ozon.ru",
    path: "/api/client/token",
  },
  statistics: {
    method: "POST",
    baseUrl: "https://api-performance.ozon.ru",
    path: "/api/client/statistics",
  },
};
