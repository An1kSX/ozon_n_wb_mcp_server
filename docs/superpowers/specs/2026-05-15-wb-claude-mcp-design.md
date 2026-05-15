# Marketplace Claude Remote MCP Server Design

## Goal

Build a public HTTPS remote MCP server that Claude can connect to as a custom connector. The server will expose selected Wildberries and Ozon cabinet data through MCP tools, support multiple marketplace accounts configured by an administrator, and require users to authenticate in our service during Claude connector setup.

## Current State

The repository originally contained a single Express application, `wb-api-mcp-server.js`, that proxied several Wildberries REST endpoints. It was not a real MCP server: it did not expose an MCP transport endpoint, did not implement JSON-RPC MCP tools, and used a direct `api-key` request header instead of Claude-compatible OAuth.

The README describes the existing REST proxy behavior, but its text appears mojibake-encoded in the local checkout. The implementation should replace this REST-proxy connection model with a Claude remote MCP connector model.

## Selected Approach

Use one Node/Express service that contains:

- The remote MCP endpoint, for example `https://example.com/mcp`.
- OAuth authorization server endpoints required by Claude/MCP.
- Admin-managed storage for marketplace account credentials.
- MCP tools that call Wildberries and Ozon APIs using stored credentials.

This keeps the deployment small and matches the current client need: a few WB cabinets and likely one primary Claude user.

## Claude Connection Flow

In Claude's "Add custom connector" dialog, the user should fill only:

- `Name`, for example `WB cabinets`.
- `Remote MCP server URL`, for example `https://example.com/mcp`.

The optional `OAuth Client ID` and `OAuth Client Secret` fields should remain empty. The server will advertise OAuth discovery metadata so Claude can identify/register itself without manual credentials.

When the user clicks `Connect`, Claude should start the OAuth flow:

1. Claude reaches the MCP endpoint.
2. Protected MCP tool calls without a valid bearer token receive `401 Unauthorized`.
3. The response includes `WWW-Authenticate: Bearer ...` with `resource_metadata`.
4. Claude fetches OAuth Protected Resource Metadata and Authorization Server Metadata.
5. Claude opens our service's authorization page.
6. The user logs in with our service credentials and approves access.
7. The server returns an authorization code.
8. Claude exchanges the code plus PKCE verifier for an access token and refresh token.
9. Claude calls `/mcp` with `Authorization: Bearer <access-token>`.
10. The server validates the token on every protected request.

## Authentication And Authorization

The service will implement OAuth for Claude-compatible remote MCP:

- Protected Resource Metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`.
- Authorization Server Metadata at `/.well-known/oauth-authorization-server`.
- Authorization endpoint at `/authorize`.
- Token endpoint at `/token`.
- Support for authorization code flow with PKCE S256.
- Support for refresh tokens.
- Support for Client ID Metadata Documents or Dynamic Client Registration so Claude does not require manually entered client credentials.

Access tokens must be short-lived and audience-bound to the MCP resource URL. Refresh tokens must be revocable and stored hashed server-side.

All marketplace data tools require a valid OAuth bearer token. Public unauthenticated access may allow only protocol bootstrap methods such as MCP initialization and tool listing if needed for Claude compatibility. No account data is returned without a validated token.

All authenticated users can access all configured WB cabinets. This is intentional for the current client scope. The design should avoid hard-coding this assumption deep in tool logic so cabinet-level access control can be added later if needed.

## Admin Marketplace Account Management

Only an administrator can add, edit, or remove marketplace account credentials.

For the initial implementation, admin operations can be exposed through simple authenticated HTTP endpoints or a minimal admin page protected by separate admin credentials. The exact UI can stay minimal; the core requirement is secure server-side storage of multiple account records:

- Account ID or slug.
- Marketplace: `wildberries` or `ozon`.
- Display name.
- Encrypted credentials.
- Optional notes.
- Created and updated timestamps.

Marketplace credentials must not be sent to Claude, logged, returned in API responses, or embedded in MCP tool output. Credentials should be encrypted at rest using an application secret from environment configuration.

Wildberries credentials contain an API token:

```json
{ "apiToken": "..." }
```

Ozon needs both API surfaces for the requested metrics:

- Ozon Seller API credentials for sales, finance, commissions, and logistics: `sellerClientId` and `sellerApiKey`.
- Ozon Performance API credentials for advertising spend: `performanceClientId` and `performanceClientSecret`, with an optional `performanceApiKey` field if the account uses an API-key based Performance setup.

Ozon credentials are stored as:

```json
{
  "sellerClientId": "...",
  "sellerApiKey": "...",
  "performanceClientId": "...",
  "performanceClientSecret": "...",
  "performanceApiKey": "..."
}
```

## MCP Tool Model

The server should expose focused MCP tools rather than a generic arbitrary HTTP proxy. Initial tools should be read-oriented:

- `list_marketplace_accounts`: list configured account IDs, marketplaces, and display names.
- `get_advert_fullstats`: get advertising campaign statistics for a selected cabinet.
- `get_auto_stat_words`: get automatic campaign phrase-cluster statistics.
- `get_campaign_stat_words`: get campaign keyword phrase statistics.
- `get_nm_report_detail`: get product card sales funnel statistics.
- `get_nm_report_detail_history`: get product card statistics by day.
- `get_search_report`: get search query report data.
- `get_stocks_products`: get stock report product data.
- `list_csv_reports`: list generated CSV reports.
- `get_ozon_monthly_sales`: get Ozon sales grouped by month for an account.
- `get_ozon_monthly_profit`: estimate Ozon monthly net profit from finance operations.
- `get_ozon_ad_expenses_by_sku`: get Ozon advertising expenses by SKU through Performance API.
- `get_ozon_logistics_share`: calculate Ozon logistics cost share for a period.

Potential state-changing or file-producing tools should be marked explicitly and may be added after the read-only base works:

- `create_csv_report`.
- `retry_csv_report`.
- `download_csv_report_file`.

Every tool must validate its input schema, require an explicit cabinet identifier, and call only an allowlisted Wildberries API endpoint.

## Security Requirements

The public server must follow these rules:

- Serve production traffic only over HTTPS.
- Do not accept marketplace API credentials from Claude request headers, URL query parameters, or MCP arguments.
- Do not expose a generic URL-fetch or arbitrary WB endpoint tool.
- Validate OAuth access token signature, issuer, audience, expiry, and scopes before protected MCP calls.
- Return transport-level `401` with `WWW-Authenticate` for missing or invalid tokens, not MCP-level "please log in" tool errors.
- Return `403` with `insufficient_scope` challenge for valid tokens that lack required scopes.
- Use strict JSON body size limits.
- Apply rate limiting to OAuth, admin, and MCP endpoints.
- Use secure HTTP headers.
- Configure CORS narrowly; do not use wildcard CORS for authenticated endpoints.
- Redact authorization headers, WB tokens, OAuth codes, and refresh tokens from logs.
- Keep tool descriptions factual and avoid embedding untrusted WB data into instructions.
- Treat all WB API response content as untrusted data.

## Data Storage

Use Postgres as the only persistent database. The app should use a connection pool and Docker Compose should include a `postgres:16-alpine` service for deployment.

Tables should cover:

- Users for OAuth login.
- OAuth clients if DCR is implemented.
- Authorization codes.
- Access token or JWT metadata if needed.
- Hashed refresh tokens.
- Marketplace accounts with encrypted credentials.
- Optional audit log entries for admin and MCP actions.

Indexes should be present on frequently filtered columns such as `users.email`, `oauth_clients.client_id`, authorization/refresh token hashes, and `marketplace_accounts.marketplace`.

All secrets must come from environment variables. Required production secrets include:

- Session/cookie secret.
- Token signing secret or key pair.
- Encryption key for WB API tokens.
- Admin bootstrap credentials or an initial user creation command.

## Error Handling

Errors returned to Claude should be safe and concise:

- Invalid login: generic authentication failure.
- Missing or invalid bearer token: OAuth-compliant `401`.
- Insufficient permissions: OAuth-compliant `403`.
- Marketplace API authentication failure: "Marketplace rejected the configured account credentials" without revealing token material.
- Marketplace rate limit: surface a retryable rate-limit message.
- Marketplace validation errors: return the marketplace error code/message when safe, without raw headers or secrets.

Server logs may include request IDs, account IDs, marketplace names, tool names, status codes, and durations. Logs must not include OAuth bearer tokens, marketplace API credentials, authorization codes, refresh tokens, or full request bodies containing secrets.

## Testing Strategy

Implementation should be test-driven. Key tests:

- OAuth metadata contains Claude/MCP-required fields.
- Protected MCP calls without bearer return `401` plus `WWW-Authenticate`.
- Login and authorization code flow requires PKCE S256.
- Token endpoint rejects missing or wrong PKCE verifier.
- Valid bearer token allows protected MCP calls.
- Invalid, expired, wrong-audience, or wrong-issuer bearer token is rejected.
- Admin-created marketplace credentials are encrypted at rest and never returned in responses.
- Tools require explicit valid account IDs.
- Tools call only allowlisted marketplace endpoints.
- Wildberries and Ozon API errors are translated safely.

## Deployment Notes

Production deployment needs:

- A public HTTPS domain.
- Docker-based deployment for the application process.
- Persistent Postgres storage through a Docker volume or a managed Postgres database.
- Environment variables for all secrets.
- Container runtime with restart policy.
- Backup plan for cabinet/token database.
- Logs with secret redaction.
- A TLS reverse proxy that terminates HTTPS and forwards traffic to the app container.

TLS deployment supports domain mode only: set `PUBLIC_HOST` and `BASE_URL=https://<domain>`. Caddy obtains and renews a public certificate automatically. HTTPS by server address is not supported because the attempted address-certificate flow produced invalid-certificate behavior; use a domain or subdomain that points to the server.

Claude custom connector setup should use the public `/mcp` URL. Localhost will not work from Claude's hosted connector UI unless exposed through a public HTTPS tunnel for testing.

## References

- Claude remote MCP connectors: https://claude.com/docs/connectors/custom/remote-mcp
- Claude connector authentication: https://claude.com/docs/connectors/building/authentication
- Claude lazy authentication pattern: https://claude.com/docs/connectors/building/lazy-authentication
- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- Ozon Seller API intro: https://docs.ozon.com/global/api/intro/
- Ozon Performance API: https://docs.ozon.com/global/api/perfomance-api/
