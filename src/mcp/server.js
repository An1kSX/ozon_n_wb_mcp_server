import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMarketplaceAccounts } from "../accounts/repository.js";
import { callWbApi } from "../wb/client.js";
import { callOzonPerformanceApi, callOzonSellerApi, requestOzonPerformanceReport } from "../ozon/client.js";
import { aggregateOzonMonthlyFinance, extractFinanceOperations } from "../ozon/finance.js";

export function buildMcpServer({ db, config, user }) {
  const server = new McpServer({ name: "marketplace-claude-mcp", version: "1.0.0" });

  server.registerTool(
    "list_marketplace_accounts",
    {
      title: "List marketplace accounts",
      description: "Lists marketplace accounts configured by the service administrator.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      requireUser(user);
      return jsonContent(await listMarketplaceAccounts(db));
    },
  );

  server.registerTool(
    "list_cabinets",
    {
      title: "List marketplace accounts",
      description: "Backward-compatible alias for list_marketplace_accounts.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      requireUser(user);
      return jsonContent(await listMarketplaceAccounts(db));
    },
  );

  const deps = { db, config, user };
  server.registerTool(
    "get_advert_fullstats",
    {
      title: "Get advertising full statistics",
      description: "Gets Wildberries advertising campaign statistics from the current official GET /adv/v3/fullstats endpoint.",
      inputSchema: {
        accountId: z.string().min(1),
        ids: z.union([z.string(), z.array(z.number().int().positive())]),
        beginDate: z.string().min(10),
        endDate: z.string().min(10),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(user);
      const data = await callWbApi({
        db,
        config,
        accountId: args.accountId,
        endpointKey: "advertFullstats",
        input: {
          ids: Array.isArray(args.ids) ? args.ids.join(",") : args.ids,
          beginDate: args.beginDate,
          endDate: args.endDate,
        },
      });
      return jsonContent(data);
    },
  );

  const wbReportInput = { accountId: z.string().min(1), request: z.record(z.any()).default({}) };
  registerWbTool(server, { name: "list_wb_ad_campaigns", title: "List WB advertising campaigns", description: "Gets Wildberries advertising campaign lists grouped by type and status from the official promotion API.", endpointKey: "advertCampaignsCount", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_wb_ad_campaigns_info", title: "Get WB advertising campaign information", description: "Gets Wildberries advertising campaign information from the official promotion API.", endpointKey: "advertCampaignsInfo", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_cluster_list", title: "Get search cluster list", description: "Gets Wildberries active and inactive search clusters from the official promotion API.", endpointKey: "searchClusterList", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_cluster_daily_stats", title: "Get search cluster daily stats", description: "Gets Wildberries search cluster statistics detailed by day from the official promotion API.", endpointKey: "searchClusterDailyStats", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_auto_stat_words", title: "Get automatic campaign search clusters", description: "Backward-compatible alias for the current Wildberries search cluster list endpoint.", endpointKey: "autoStatWords", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_campaign_stat_words", title: "Get campaign search cluster daily stats", description: "Backward-compatible alias for the current Wildberries search cluster daily statistics endpoint.", endpointKey: "campaignStatWords", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail", title: "Get product sales funnel detail", description: "Gets Wildberries product card sales funnel statistics from the official analytics v3 endpoint.", endpointKey: "nmReportDetail", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail_history", title: "Get product sales funnel history", description: "Gets Wildberries product card statistics grouped by day or week from the official analytics v3 endpoint.", endpointKey: "nmReportDetailHistory", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_grouped_history", title: "Get grouped product sales funnel history", description: "Gets Wildberries grouped product card statistics from the official analytics v3 endpoint.", endpointKey: "nmReportGroupedHistory", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report", title: "Get search query report", description: "Gets Wildberries search query report data.", endpointKey: "searchReport", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report_table_groups", title: "Get search report table groups", description: "Gets Wildberries search report grouped table data.", endpointKey: "searchReportTableGroups", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report_table_details", title: "Get search report table details", description: "Gets Wildberries search report detailed table data.", endpointKey: "searchReportTableDetails", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report_product_search_texts", title: "Get product search texts", description: "Gets Wildberries search phrases that led customers to a product.", endpointKey: "searchReportProductSearchTexts", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report_product_orders", title: "Get product search orders", description: "Gets Wildberries product orders from search report data.", endpointKey: "searchReportProductOrders", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_wb_warehouses_inventory", title: "Get WB warehouses inventory", description: "Gets current Wildberries inventory in WB warehouses from the official analytics API.", endpointKey: "wbWarehousesInventory", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_stocks_products", title: "Get stock product report", description: "Gets Wildberries stock report data by product.", endpointKey: "stocksProducts", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_stocks_groups", title: "Get stock group report", description: "Gets Wildberries stock report data grouped by product groups.", endpointKey: "stocksGroups", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_stocks_sizes", title: "Get stock size report", description: "Gets Wildberries stock report data by product size.", endpointKey: "stocksSizes", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_stocks_offices", title: "Get stock office report", description: "Gets Wildberries stock report data by office or warehouse.", endpointKey: "stocksOffices", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "list_csv_reports", title: "List CSV reports", description: "Lists generated Wildberries seller analytics CSV reports.", endpointKey: "csvReports", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "create_csv_report", title: "Create CSV report", description: "Creates a Wildberries seller analytics CSV report.", endpointKey: "csvCreate", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "retry_csv_report", title: "Retry CSV report", description: "Retries generation of a Wildberries seller analytics CSV report.", endpointKey: "csvRetry", inputSchema: wbReportInput }, deps);

  const ozonRequestInput = { accountId: z.string().min(1), request: z.record(z.any()).default({}) };
  [
    { name: "get_ozon_analytics_data", title: "Get Ozon analytics data", description: "Calls Ozon Seller API analytics data with caller-provided dimensions, metrics, filters, limit, and offset.", endpointKey: "analyticsData" },
    { name: "list_ozon_fbo_postings", title: "List Ozon FBO postings", description: "Lists Ozon FBO postings and completed orders from Seller API.", endpointKey: "postingFboList" },
    { name: "list_ozon_fbs_postings", title: "List Ozon FBS postings", description: "Lists Ozon FBS postings and completed orders from Seller API.", endpointKey: "postingFbsList" },
    { name: "get_ozon_finance_realization", title: "Get Ozon realization report", description: "Gets the Ozon realization report with detailed SKU sales, returns, and commissions.", endpointKey: "financeRealization" },
    { name: "list_ozon_finance_transactions", title: "List Ozon finance transactions", description: "Lists Ozon finance transactions by type, including sales, returns, logistics, and commissions.", endpointKey: "financeTransactions" },
    { name: "list_ozon_cash_flow_statements", title: "List Ozon cash flow statements", description: "Lists Ozon cash flow statement reports from Seller API.", endpointKey: "cashFlowStatementList" },
    { name: "get_ozon_stock_on_warehouses", title: "Get Ozon warehouse stock analytics", description: "Gets Ozon stock by warehouse and product.", endpointKey: "stockOnWarehouses" },
    { name: "list_ozon_products", title: "List Ozon products", description: "Lists Ozon products with offer IDs and product IDs.", endpointKey: "productList" },
    { name: "get_ozon_product_stocks", title: "Get Ozon product stocks", description: "Gets Ozon stock quantities by SKU and warehouse.", endpointKey: "productInfoStocks" },
    { name: "get_ozon_product_prices", title: "Get Ozon product prices", description: "Gets current Ozon product prices and related price data.", endpointKey: "productInfoPrices" },
    { name: "list_ozon_fbo_returns", title: "List Ozon FBO returns", description: "Lists Ozon FBO company returns.", endpointKey: "returnsCompanyFbo" },
    { name: "list_ozon_fbs_returns", title: "List Ozon FBS returns", description: "Lists Ozon FBS company returns.", endpointKey: "returnsCompanyFbs" },
    { name: "get_ozon_search_terms", title: "Get Ozon search terms", description: "Gets Ozon search terms that led customers to products.", endpointKey: "searchTerms" },
  ].forEach((tool) => registerOzonSellerTool(server, { ...tool, inputSchema: ozonRequestInput }, deps));

  server.registerTool(
    "get_ozon_sku_month_analytics",
    {
      title: "Get Ozon SKU monthly analytics",
      description: "Gets Ozon analytics grouped by SKU and month for period comparisons such as April versus March.",
      inputSchema: {
        accountId: z.string().min(1),
        dateFrom: z.string().min(10),
        dateTo: z.string().min(10),
        metrics: z.array(z.string()).min(1).default(["revenue", "ordered_units", "returns", "cancellations"]),
        filters: z.array(z.record(z.any())).default([]),
        sort: z.array(z.record(z.any())).default([{ key: "revenue", order: "DESC" }]),
        limit: z.number().int().min(1).max(1000).default(1000),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(user);
      const data = await callOzonSellerApi({
        db,
        config,
        accountId: args.accountId,
        endpointKey: "analyticsData",
        input: {
          date_from: args.dateFrom,
          date_to: args.dateTo,
          metrics: args.metrics,
          dimension: ["sku", "month"],
          filters: args.filters,
          sort: args.sort,
          limit: args.limit,
          offset: args.offset,
        },
      });
      return jsonContent(data);
    },
  );

  const ozonFinanceInput = {
    accountId: z.string().min(1),
    dateFrom: z.string().min(10),
    dateTo: z.string().min(10),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().min(1).max(1000).default(1000),
  };

  registerOzonFinanceTool(server, {
    name: "get_ozon_monthly_sales",
    title: "Get Ozon monthly sales",
    description: "Gets Ozon sales grouped by month from Seller API finance transactions.",
    mode: "sales",
    inputSchema: ozonFinanceInput,
  }, deps);
  registerOzonFinanceTool(server, {
    name: "get_ozon_monthly_profit",
    title: "Get Ozon monthly profit",
    description: "Estimates Ozon monthly profit from Seller API finance transaction amounts.",
    mode: "profit",
    inputSchema: ozonFinanceInput,
  }, deps);
  registerOzonFinanceTool(server, {
    name: "get_ozon_logistics_share",
    title: "Get Ozon logistics share",
    description: "Calculates Ozon logistics cost share of sales from Seller API finance transactions.",
    mode: "logistics",
    inputSchema: ozonFinanceInput,
  }, deps);

  registerOzonPerformanceTool(server, {
    name: "list_ozon_ad_campaigns",
    title: "List Ozon advertising campaigns",
    description: "Lists Ozon Performance advertising campaigns. Use returned campaign IDs when requesting advertising statistics.",
    endpointKey: "campaigns",
    inputSchema: {
      accountId: z.string().min(1),
      request: z.record(z.any()).default({}),
    },
  }, deps);

  server.registerTool(
    "get_ozon_ad_expenses_by_sku",
    {
      title: "Get Ozon advertising expenses by SKU",
      description: "Requests an Ozon Performance API statistics report grouped by SKU.",
      inputSchema: {
        accountId: z.string().min(1),
        campaigns: z.array(z.string()).min(1),
        dateFrom: z.string().min(10),
        dateTo: z.string().min(10),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(user);
      const data = await requestOzonPerformanceReport({
        db,
        config,
        accountId: args.accountId,
        input: { campaigns: args.campaigns, dateFrom: args.dateFrom, dateTo: args.dateTo, groupBy: "SKU" },
      });
      return jsonContent(data);
    },
  );

  return server;
}

export function jsonContent(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function registerWbTool(server, { name, title, description, endpointKey, inputSchema }, deps) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(deps.user);
      const { accountId, ...input } = args;
      const data = await callWbApi({
        db: deps.db,
        config: deps.config,
        accountId,
        endpointKey,
        input: input.request ?? input,
      });
      return jsonContent(data);
    },
  );
}

function registerOzonSellerTool(server, { name, title, description, endpointKey, inputSchema }, deps) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(deps.user);
      const data = await callOzonSellerApi({
        db: deps.db,
        config: deps.config,
        accountId: args.accountId,
        endpointKey,
        input: args.request ?? {},
      });
      return jsonContent(data);
    },
  );
}

function registerOzonPerformanceTool(server, { name, title, description, endpointKey, inputSchema }, deps) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(deps.user);
      const data = await callOzonPerformanceApi({
        db: deps.db,
        config: deps.config,
        accountId: args.accountId,
        endpointKey,
        input: args.request ?? {},
      });
      return jsonContent(data);
    },
  );
}

function registerOzonFinanceTool(server, { name, title, description, mode, inputSchema }, deps) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(deps.user);
      const response = await callOzonSellerApi({
        db: deps.db,
        config: deps.config,
        accountId: args.accountId,
        endpointKey: "financeTransactions",
        input: {
          filter: {
            date: {
              from: args.dateFrom,
              to: args.dateTo,
            },
          },
          page: args.page,
          page_size: args.pageSize,
        },
      });
      const rows = aggregateOzonMonthlyFinance(extractFinanceOperations(response));
      if (mode === "sales") return jsonContent(rows.map(({ month, sales }) => ({ month, sales })));
      if (mode === "profit") return jsonContent(rows.map(({ month, profit }) => ({ month, profit })));
      return jsonContent(rows.map(({ month, sales, logisticsCost, logisticsShareOfSales }) => ({ month, sales, logisticsCost, logisticsShareOfSales })));
    },
  );
}

function requireUser(user) {
  if (!user) {
    throw new Error("Authentication required");
  }
}
