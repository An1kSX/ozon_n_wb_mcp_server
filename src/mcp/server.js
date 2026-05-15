import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMarketplaceAccounts } from "../accounts/repository.js";
import { callWbApi } from "../wb/client.js";
import { callOzonSellerApi, requestOzonPerformanceReport } from "../ozon/client.js";
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
  registerWbTool(server, {
    name: "get_advert_fullstats",
    title: "Get advertising full statistics",
    description: "Gets Wildberries advertising campaign full statistics for a marketplace account.",
    endpointKey: "advertFullstats",
    inputSchema: {
      accountId: z.string().min(1),
      request: z.array(z.object({ id: z.number(), dates: z.array(z.string()) })),
    },
  }, deps);

  const wbReportInput = { accountId: z.string().min(1), request: z.record(z.any()).default({}) };
  registerWbTool(server, { name: "get_auto_stat_words", title: "Get automatic campaign words", description: "Gets Wildberries phrase-cluster statistics for an automatic campaign.", endpointKey: "autoStatWords", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_campaign_stat_words", title: "Get campaign phrase statistics", description: "Gets Wildberries keyword phrase statistics for a campaign.", endpointKey: "campaignStatWords", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail", title: "Get product sales funnel detail", description: "Gets Wildberries product card sales funnel statistics.", endpointKey: "nmReportDetail", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail_history", title: "Get product sales funnel history", description: "Gets Wildberries product card statistics grouped by day.", endpointKey: "nmReportDetailHistory", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_search_report", title: "Get search query report", description: "Gets Wildberries search query report data.", endpointKey: "searchReport", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "get_stocks_products", title: "Get stock product report", description: "Gets Wildberries stock report data by product.", endpointKey: "stocksProducts", inputSchema: wbReportInput }, deps);
  registerWbTool(server, { name: "list_csv_reports", title: "List CSV reports", description: "Lists generated Wildberries seller analytics CSV reports.", endpointKey: "csvReports", inputSchema: wbReportInput }, deps);

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
