# Verification Checklist for WB MCP Server Fixes

## Pre-Deployment Checks

### 1. Code Syntax Verification
```bash
# Check for syntax errors
node --check src/mcp/server.js
node --check src/wb/client.js
node --check src/wb/builders.js
node --check src/wb/endpoints.js
```

### 2. Import Verification
- ✅ server.js imports all builders from src/wb/builders.js
- ✅ builders.js imports crypto from node:crypto
- ✅ No circular dependencies

### 3. Endpoint Changes
- ✅ advertCampaignsInfo: POST → GET
- ✅ Method used in client.js: GET params instead of POST body

## Deployment Steps

```bash
# 1. Build Docker container
docker compose up -d --build

# 2. Check logs
docker compose logs -f wb-mcp

# 3. Verify code is correct in container
docker compose exec -T wb-mcp grep -n "method: \"GET\"" src/wb/endpoints.js | grep advertCampaignsInfo
docker compose exec -T wb-mcp grep -n "buildNmReportDetailBody" src/mcp/server.js
```

## Manual Testing with Claude

### Test 1: List Accounts
```
Tool: list_marketplace_accounts
Expected: Returns configured WB accounts
```

### Test 2: Get Warehouse Inventory (Simple)
```
Tool: get_wb_warehouses_inventory
accountId: wb-main
Expected: List of warehouses with stock data
```

### Test 3: Get Stock Groups (Typed Input)
```
Tool: get_stocks_groups
accountId: wb-main
dateFrom: 2026-04-01
dateTo: 2026-04-30
Expected: Stock data grouped by product groups
Verify: Backend assembles with nmIDs, subjectIDs, currentPeriod, availabilityFilters
```

### Test 4: NM Report Detail - April vs March (With Comparison)
```
Tool: get_nm_report_detail
accountId: wb-main
selectedStart: 2026-04-01
selectedEnd: 2026-04-30
pastStart: 2026-03-01
pastEnd: 2026-03-31
Expected: Sales funnel data with period comparison
Verify: Body includes both selectedPeriod and pastPeriod
```

### Test 5: NM Report Detail History - 7 Days Max
```
Tool: get_nm_report_detail_history
accountId: wb-main
dateFrom: 2026-04-01
dateTo: 2026-04-07
nmIds: [12345]
Expected: Daily history data
Verify: Should work (exactly 7 days)

Then try:
dateFrom: 2026-04-01
dateTo: 2026-04-15
Expected Error: "supports only up to 7 days"
```

### Test 6: Create CSV Report - Long Period
```
Tool: create_csv_report
accountId: wb-main
reportType: DETAIL_HISTORY_REPORT
dateFrom: 2026-03-01
dateTo: 2026-04-30
Expected: CSV report ID generated
Verify: UUID generated and params structure correct
```

### Test 7: Search Report - No Subscription Error
```
Tool: get_search_report (if account doesn't have Jam)
accountId: wb-main
dateFrom: 2026-04-01
dateTo: 2026-04-30
Expected Error if no Jam: "this method requires Jam subscription"
```

### Test 8: Advertising Campaign Info - Query Parameters
```
Tool: get_wb_ad_campaigns_info
accountId: wb-main
ids: [123, 456]
statuses: ["ACTIVE"]
Expected: GET request with query parameters
Verify: Uses GET method instead of POST
```

### Test 9: Advert Fullstats - Period and ID Validation
```
Test A - Too many IDs:
Tool: get_advert_fullstats
ids: [1,2,3...52]
Expected Error: "maximum 50 campaign IDs"

Test B - Period too long:
Tool: get_advert_fullstats
ids: [1,2,3]
beginDate: 2026-04-01
endDate: 2026-06-01
Expected Error: "supports only up to 31 days"

Test C - Valid request:
ids: [1,2,3]
beginDate: 2026-04-01
endDate: 2026-04-30
Expected: Campaign statistics
```

### Test 10: Stocks Sizes - Single nmID
```
Tool: get_stocks_sizes
accountId: wb-main
nmID: 12345
dateFrom: 2026-04-01
dateTo: 2026-04-30
Expected: Size breakdown for single product
Verify: Body has single nmID, not array
```

## Error Handling Verification

### Check Error Messages Include:
- ✅ endpointKey (tool name)
- ✅ HTTP method (GET/POST)
- ✅ Endpoint path
- ✅ Status code
- ✅ Safe error message from WB API
- ❌ Never includes WB token

Example good error:
```
WB get_stocks_groups failed: POST /api/v2/stocks-report/products/groups returned 400: currentPeriod is required
```

## Unit Test Execution

```bash
npm test -- --run

# Or individually:
npm test -- wb-builders.test.js
npm test -- wb-mcp-validation.test.js
```

Expected results:
- All builder functions work correctly
- All period validations work
- All input transformations work
- UUID generation works for CSV reports

## Rollback Plan

If issues occur, revert these files:
- src/wb/endpoints.js (advertCampaignsInfo)
- src/wb/client.js (error handling)
- src/mcp/server.js (all tool definitions)

Deleted/added files that can be rolled back:
- src/wb/builders.js (can be deleted if reverting)
- tests/wb-builders.test.js (can be deleted if reverting)
- tests/wb-mcp-validation.test.js (can be deleted if reverting)
