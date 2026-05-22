import { verifyAccessToken } from "../oauth/tokens.js";

export const PROTECTED_TOOLS = new Set([
  "list_marketplace_accounts",
  "list_cabinets",
  "get_advert_fullstats",
  "list_wb_ad_campaigns",
  "get_wb_ad_campaigns_info",
  "get_search_cluster_list",
  "get_search_cluster_daily_stats",
  "get_auto_stat_words",
  "get_campaign_stat_words",
  "get_nm_report_detail",
  "get_nm_report_detail_history",
  "get_nm_report_grouped_history",
  "get_search_report",
  "get_search_report_table_groups",
  "get_search_report_table_details",
  "get_search_report_product_search_texts",
  "get_search_report_product_orders",
  "get_wb_warehouses_inventory",
  "get_stocks_products",
  "get_stocks_groups",
  "get_stocks_sizes",
  "get_stocks_offices",
  "list_csv_reports",
  "create_csv_report",
  "retry_csv_report",
  "get_ozon_analytics_data",
  "list_ozon_fbo_postings",
  "list_ozon_fbs_postings",
  "get_ozon_finance_realization",
  "list_ozon_finance_transactions",
  "list_ozon_cash_flow_statements",
  "get_ozon_stock_on_warehouses",
  "list_ozon_products",
  "get_ozon_product_stocks",
  "get_ozon_product_prices",
  "list_ozon_fbo_returns",
  "list_ozon_fbs_returns",
  "get_ozon_search_terms",
  "get_ozon_sku_month_analytics",
  "get_ozon_monthly_sales",
  "get_ozon_monthly_profit",
  "list_ozon_ad_campaigns",
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
