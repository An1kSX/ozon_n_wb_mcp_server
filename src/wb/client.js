import axios from "axios";
import { getMarketplaceCredentials } from "../accounts/repository.js";
import { WB_ENDPOINTS } from "./endpoints.js";

export async function callWbApi({ db, config, accountId, endpointKey, input }) {
  const endpoint = WB_ENDPOINTS[endpointKey];
  if (!endpoint) {
    throw new Error("Unknown WB endpoint");
  }
  const credentials = await getMarketplaceCredentials({ db, config, id: accountId, marketplace: "wildberries" });
  const response = await axios({
    method: endpoint.method,
    url: `${endpoint.baseUrl}${endpoint.path}`,
    data: endpoint.method === "GET" ? undefined : input,
    params: endpoint.method === "GET" ? input : undefined,
    headers: { Authorization: credentials.apiToken },
    validateStatus: () => true,
    timeout: 30000,
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Marketplace rejected the configured account credentials");
    err.statusCode = 502;
    throw err;
  }
  if (response.status === 429) {
    const err = new Error("Wildberries rate limit exceeded");
    err.statusCode = 429;
    throw err;
  }
  if (response.status >= 400) {
    const err = new Error(safeWbError(response.data) || "Wildberries API request failed");
    err.statusCode = 502;
    throw err;
  }
  return response.data;
}

function safeWbError(data) {
  if (!data || typeof data !== "object") return "";
  const message = data.message || data.errorText || data.error || "";
  return typeof message === "string" ? message.slice(0, 500) : "";
}
