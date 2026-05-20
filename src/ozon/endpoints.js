export const OZON_SELLER_ENDPOINTS = {
  analyticsData: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v1/analytics/data",
  },
  postingFboList: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/posting/fbo/list",
  },
  postingFbsList: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/posting/fbs/list",
  },
  financeRealization: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v1/finance/realization",
  },
  financeTransactions: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/finance/transaction/list",
  },
  cashFlowStatementList: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v1/finance/cash-flow-statement/list",
  },
  stockOnWarehouses: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v2/analytics/stock_on_warehouses",
  },
  productList: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/product/list",
  },
  productInfoStocks: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v2/product/info/stocks",
  },
  productInfoPrices: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v4/product/info/prices",
  },
  returnsCompanyFbo: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/returns/company/fbo",
  },
  returnsCompanyFbs: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v3/returns/company/fbs",
  },
  searchTerms: {
    method: "POST",
    baseUrl: "https://api-seller.ozon.ru",
    path: "/v1/analytics/search_terms",
  },
};

export const OZON_PERFORMANCE_ENDPOINTS = {
  campaigns: {
    method: "GET",
    baseUrl: "https://api-performance.ozon.ru",
    path: "/api/client/campaign",
  },
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
