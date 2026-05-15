import { verifyAccessToken } from "../oauth/tokens.js";

export const PROTECTED_TOOLS = new Set([
  "list_marketplace_accounts",
  "list_cabinets",
  "get_advert_fullstats",
  "get_auto_stat_words",
  "get_campaign_stat_words",
  "get_nm_report_detail",
  "get_nm_report_detail_history",
  "get_search_report",
  "get_stocks_products",
  "list_csv_reports",
  "get_ozon_monthly_sales",
  "get_ozon_monthly_profit",
  "get_ozon_ad_expenses_by_sku",
  "get_ozon_logistics_share",
]);

export function extractBearer(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function authenticateMcpRequest(config, req) {
  const token = extractBearer(req);
  if (!token) return null;
  try {
    return verifyAccessToken(config, token);
  } catch {
    return null;
  }
}

export function callsProtectedTool(body) {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((message) => {
    return message?.method === "tools/call" && PROTECTED_TOOLS.has(message?.params?.name);
  });
}

export function writeAuthChallenge(config, res) {
  res
    .status(401)
    .set(
      "WWW-Authenticate",
      `Bearer error="invalid_token", error_description="Authentication required", resource_metadata="${config.baseUrl}/.well-known/oauth-protected-resource/mcp", scope="wb:read"`,
    )
    .json({ error: "invalid_token", error_description: "Authentication required" });
}
