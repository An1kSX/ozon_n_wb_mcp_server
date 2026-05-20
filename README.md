# Marketplace Claude Remote MCP Server

Public remote MCP server for connecting Claude to administrator-configured Wildberries and Ozon accounts.

## Security Model

- Claude connects to `/mcp` over public HTTPS.
- Marketplace API credentials are stored only on this server.
- Claude never receives Wildberries or Ozon credentials.
- Users authenticate through this service during Claude connector setup.
- OAuth access tokens are required for all marketplace data tools.
- All authenticated users can access all configured marketplace accounts.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

For local Claude testing, expose the local server through a public HTTPS tunnel and use the tunnel URL ending in `/mcp`.

## Docker Deployment

Create `.env` from `.env.example`, fill every secret, then build and start:

```bash
docker compose up -d --build
```

The app listens only inside Docker on port `3000`. The public entrypoint is the `tls-proxy` service on ports `80` and `443`.

Configure the public domain:

```env
PUBLIC_HOST=marketplace-mcp.example.com
BASE_URL=https://marketplace-mcp.example.com
ACME_EMAIL=admin@example.com
```

Caddy automatically obtains and renews a public certificate for `PUBLIC_HOST`. HTTPS by server address is not supported; use a domain or subdomain that points to the server. Ports `80` and `443` must be reachable from the internet.

Postgres runs as a separate Compose service and stores data in the `postgres-data` Docker volume. Redis runs as a separate Compose service with append-only persistence enabled and stores cache data in the `redis-data` Docker volume.

Check health:

```bash
docker compose ps
docker compose logs -f wb-mcp
curl "$BASE_URL/health"
```

## Claude Connector Setup

In Claude, open Settings -> Connectors -> Add custom connector.

- Name: `Marketplace accounts`
- Remote MCP server URL: `https://your-domain.example/mcp`
- OAuth Client ID: leave empty
- OAuth Client Secret: leave empty

After adding the connector, click Connect. Claude will open the authorization page served by this app. Sign in with the configured service user.

## Admin Account Setup

Open the browser admin panel:

```text
https://your-domain.example/admin
```

The browser panel redirects to `/admin/login`. Sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then use logout when finished. The panel can add, update, and delete multiple Wildberries and Ozon accounts. Use a unique `Account ID` for every cabinet; Claude tools use that ID as `accountId`.

Create or update a Wildberries account:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"id":"wb-main","marketplace":"wildberries","name":"Main WB","credentials":{"apiToken":"<WB_API_TOKEN>"},"notes":"Primary WB account"}' \
  https://your-domain.example/admin/accounts
```

Create or update an Ozon account:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"id":"ozon-main","marketplace":"ozon","name":"Main Ozon","credentials":{"sellerClientId":"<OZON_CLIENT_ID>","sellerApiKey":"<OZON_API_KEY>","performanceClientId":"<PERFORMANCE_CLIENT_ID>","performanceClientSecret":"<PERFORMANCE_CLIENT_SECRET>"}}' \
  https://your-domain.example/admin/accounts
```

List accounts:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" https://your-domain.example/admin/accounts
```

Delete an account:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" -X DELETE https://your-domain.example/admin/accounts/wb-main
```

Admin responses never include marketplace credentials.

## MCP Tools

- `list_marketplace_accounts`
- `get_advert_fullstats`
- `get_auto_stat_words`
- `get_campaign_stat_words`
- `get_nm_report_detail`
- `get_nm_report_detail_history`
- `get_nm_report_grouped_history`
- `get_search_report`
- `get_search_report_table_groups`
- `get_search_report_table_details`
- `get_search_report_product_search_texts`
- `get_search_report_product_orders`
- `get_stocks_products`
- `get_stocks_groups`
- `get_stocks_sizes`
- `get_stocks_offices`
- `list_csv_reports`
- `create_csv_report`
- `retry_csv_report`
- `get_ozon_analytics_data`
- `get_ozon_sku_month_analytics`
- `list_ozon_fbo_postings`
- `list_ozon_fbs_postings`
- `get_ozon_finance_realization`
- `list_ozon_finance_transactions`
- `list_ozon_cash_flow_statements`
- `get_ozon_stock_on_warehouses`
- `list_ozon_products`
- `get_ozon_product_stocks`
- `get_ozon_product_prices`
- `list_ozon_fbo_returns`
- `list_ozon_fbs_returns`
- `get_ozon_search_terms`
- `get_ozon_monthly_sales`
- `get_ozon_monthly_profit`
- `list_ozon_ad_campaigns`
- `get_ozon_ad_expenses_by_sku`
- `get_ozon_logistics_share`

## Verification

```bash
npm test -- --run
docker compose build
```
