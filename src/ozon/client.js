import axios from "axios";
import { getMarketplaceCredentials } from "../accounts/repository.js";
import { OZON_PERFORMANCE_ENDPOINTS, OZON_SELLER_ENDPOINTS } from "./endpoints.js";

export async function callOzonSellerApi({ db, config, accountId, endpointKey, input }) {
  const endpoint = OZON_SELLER_ENDPOINTS[endpointKey];
  if (!endpoint) throw new Error("Unknown Ozon Seller endpoint");
  const credentials = await getMarketplaceCredentials({ db, config, id: accountId, marketplace: "ozon" });
  const response = await axios({
    method: endpoint.method,
    url: `${endpoint.baseUrl}${endpoint.path}`,
    data: input,
    headers: {
      "Client-Id": credentials.sellerClientId,
      "Api-Key": credentials.sellerApiKey,
    },
    validateStatus: () => true,
    timeout: 30000,
  });
  return handleOzonResponse(response);
}

export async function requestOzonPerformanceReport({ db, config, accountId, input }) {
  const credentials = await getMarketplaceCredentials({ db, config, id: accountId, marketplace: "ozon" });
  const token = await getPerformanceAccessToken(credentials);
  const endpoint = OZON_PERFORMANCE_ENDPOINTS.statistics;
  const response = await axios({
    method: endpoint.method,
    url: `${endpoint.baseUrl}${endpoint.path}`,
    data: input,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    timeout: 30000,
  });
  return handleOzonResponse(response);
}

async function getPerformanceAccessToken(credentials) {
  if (credentials.performanceApiKey) {
    return credentials.performanceApiKey;
  }
  if (!credentials.performanceClientId || !credentials.performanceClientSecret) {
    const err = new Error("Ozon Performance credentials are not configured for this account");
    err.statusCode = 400;
    throw err;
  }
  const endpoint = OZON_PERFORMANCE_ENDPOINTS.token;
  const response = await axios({
    method: endpoint.method,
    url: `${endpoint.baseUrl}${endpoint.path}`,
    data: {
      client_id: credentials.performanceClientId,
      client_secret: credentials.performanceClientSecret,
      grant_type: "client_credentials",
    },
    validateStatus: () => true,
    timeout: 30000,
  });
  const data = handleOzonResponse(response);
  return data.access_token;
}

function handleOzonResponse(response) {
  if (response.status === 401 || response.status === 403) {
    const err = new Error("Marketplace rejected the configured account credentials");
    err.statusCode = 502;
    throw err;
  }
  if (response.status === 429) {
    const err = new Error("Marketplace rate limit exceeded");
    err.statusCode = 429;
    throw err;
  }
  if (response.status >= 400) {
    const err = new Error(safeOzonError(response.data) || "Ozon API request failed");
    err.statusCode = 502;
    throw err;
  }
  return response.data;
}

function safeOzonError(data) {
  if (!data || typeof data !== "object") return "";
  const message = data.message || data.error || data.error_description || "";
  return typeof message === "string" ? message.slice(0, 500) : "";
}
