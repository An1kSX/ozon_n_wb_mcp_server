# WB MCP Server API Fixes - Complete Summary

Date: May 22, 2026
Objective: Fix WB-methods to ensure Claude correctly calls Wildberries API through MCP tools with properly typed inputs

## Files Created

### 1. `src/wb/builders.js` (NEW)
**Purpose:** Helper functions to build WB API request bodies and validate inputs

**Key Functions:**
- `removeUndefined()` - Strips undefined properties from objects
- `daysBetween()` - Calculates days between two dates
- `assertMaxPeriodDays()` - Validates period doesn't exceed max days
- `buildPeriod()`, `buildOrderBy()` - Utility builders for common structures
- `buildNmReportDetailBody()` - Builds sales funnel detail requests with optional comparison period
- `buildNmReportDetailHistoryBody()` - Builds daily/weekly history requests
- `buildNmReportGroupedHistoryBody()` - Builds grouped history requests
- `buildStocksGroupsBody()` - Builds stocks grouped report requests
- `buildStocksProductsBody()` - Builds stocks product report requests (removes undefined singular fields)
- `buildStocksSizesBody()` - Builds stocks by size requests
- `buildStocksOfficesBody()` - Builds stocks by office requests
- `buildSearchReportBody()` - Builds search report requests
- `buildSearchReportTableGroupsBody()` - Builds search report grouped table requests
- `buildSearchReportProductOrdersBody()` - Builds search report product orders requests
- `buildCsvReportBody()` - Builds CSV report requests with UUID generation
- `DEFAULT_AVAILABILITY_FILTERS` - Constant with 6 stock availability filter types

**Key Feature:** All builders accept typed parameters from Claude and construct backend-compatible request bodies

### 2. `tests/wb-builders.test.js` (NEW)
**Purpose:** Unit tests for all builder functions

**Test Coverage:**
- `removeUndefined()` - removes undefined values correctly
- `daysBetween()` - calculates days between dates
- `buildNmReportDetailBody()` - includes pastPeriod when provided, omits when not
- `buildNmReportDetailHistoryBody()` - correct structure
- `buildNmReportGroupedHistoryBody()` - handles filters
- `buildStocksGroupsBody()` - includes all availability filters
- `buildStocksProductsBody()` - removes undefined singular fields (subjectID, brandName, tagID)
- `buildStocksSizesBody()` - builds body with nmID
- `buildStocksOfficesBody()` - removes undefined stockType
- `buildSearchReportBody()` - respects custom values
- `buildSearchReportTableGroupsBody()` - includes filters
- `buildSearchReportProductOrdersBody()` - correct period and searchTexts
- `buildCsvReportBody()` - generates unique UUIDs

### 3. `tests/wb-mcp-validation.test.js` (NEW)
**Purpose:** Integration tests for MCP tool validation

**Test Coverage:**
- `get_advert_fullstats` - max 50 IDs, max 31 days
- `get_nm_report_detail_history` - max 7 days
- `get_nm_report_grouped_history` - max 7 days
- `get_search_report` - at least one include flag must be true
- `get_search_report_table_groups` - requires at least one filter
- `get_search_report_product_orders` - max 7 days
- `get_stocks_sizes` - builds with single nmID
- `get_nm_report_detail` - handles pastPeriod for period comparison
- `create_csv_report` - generates UUID, correct params structure

## Files Modified

### 1. `src/wb/endpoints.js`
**Change:** advertCampaignsInfo endpoint method
- Before: `method: "POST"` at `/api/advert/v2/adverts`
- After: `method: "GET"` at `/api/advert/v2/adverts`
- Reason: WB API requires GET, not POST for this endpoint

### 2. `src/wb/client.js`
**Changes:** Enhanced error handling and diagnostics

**Before:**
- Generic error message: "Wildberries API request failed"
- No context about which tool or endpoint failed

**After:**
- Detailed error format: `WB {endpointKey} failed: {method} {path} returned {status}: {message}`
- Special handling for 401/403: Mentions credentials rejected
- Special handling for 402: Mentions subscription/Jam requirements
- Never includes WB token in error messages
- Example: `WB get_stocks_groups failed: POST /api/v2/stocks-report/products/groups returned 400: currentPeriod is required`

### 3. `src/mcp/server.js`
**Changes:** Replaced generic `z.record(z.any())` with typed inputSchema for all WB tools

**Imports Added:**
- 14 builder functions from `src/wb/builders.js`
- daysBetween, assertMaxPeriodDays, DEFAULT_AVAILABILITY_FILTERS

**Tools Updated with Typed Inputs:**

1. **get_advert_fullstats**
   - Added: Max 50 IDs validation
   - Added: Max 31 days period validation
   - Remaining: ids, beginDate, endDate

2. **get_wb_ad_campaigns_info** (was get_wb_ad_campaigns_info)
   - Changed from generic request to typed parameters
   - New inputs: ids, statuses, payment_type (optional)
   - Uses GET method with query parameters

3. **get_nm_report_detail**
   - New inputs: selectedStart, selectedEnd, pastStart, pastEnd (optional), nmIds, brandNames, subjectIds, tagIds, skipDeletedNm, orderByField, orderByMode, limit, offset
   - Supports period comparison: April vs March
   - Backend: Uses buildNmReportDetailBody()

4. **get_nm_report_detail_history**
   - New inputs: dateFrom, dateTo, nmIds (required), skipDeletedNm, aggregationLevel
   - Validation: Max 7 days
   - Backend: Uses buildNmReportDetailHistoryBody()

5. **get_nm_report_grouped_history**
   - New inputs: dateFrom, dateTo, brandNames, subjectIds, tagIds, skipDeletedNm, aggregationLevel
   - Validation: Max 7 days
   - Backend: Uses buildNmReportGroupedHistoryBody()

6. **get_search_report**
   - New inputs: dateFrom, dateTo, positionCluster, includeSubstitutedSKUs, includeSearchTexts, orderByField, orderByMode, limit, offset
   - Validation: At least one include flag must be true
   - Description: Now mentions Jam subscription requirement

7. **get_search_report_table_groups**
   - New inputs: dateFrom, dateTo, brandNames, subjectIds, tagIds, positionCluster, includeSubstitutedSKUs, includeSearchTexts, orderByField, orderByMode, limit, offset
   - Validation: At least one filter required
   - Description: Now mentions Jam subscription requirement

8. **get_search_report_product_orders**
   - New inputs: dateFrom, dateTo, nmId (required), searchTexts (1-30 items required)
   - Validation: Max 7 days
   - Description: Now mentions Jam subscription requirement

9. **get_stocks_products**
   - New inputs: nmIDs, subjectID, brandName, tagID, dateFrom, dateTo, stockType, skipDeletedNm, availabilityFilters, orderByField, orderByMode, limit, offset
   - Special: Singular field names (subjectID, not subjectIds)
   - Backend: Removes undefined singular fields before sending

10. **get_stocks_groups**
    - New inputs: nmIDs, subjectIDs, brandNames, tagIDs, dateFrom, dateTo, stockType, skipDeletedNm, availabilityFilters, orderByField, orderByMode, limit, offset
    - Backend: Uses buildStocksGroupsBody()

11. **get_stocks_sizes**
    - New inputs: nmID (required single ID), dateFrom, dateTo, stockType, orderByField, orderByMode, includeOffice
    - Backend: Uses buildStocksSizesBody()

12. **get_stocks_offices**
    - New inputs: nmIDs, subjectIDs, brandNames, tagIDs, dateFrom, dateTo, stockType, skipDeletedNm
    - Backend: Uses buildStocksOfficesBody()

13. **create_csv_report**
    - New inputs: reportType (enum), userReportName, dateFrom, dateTo, timezone, aggregationLevel, nmIDs, subjectIds, brandNames, tagIds, skipDeletedNm
    - Backend: Generates UUID inside backend (crypto.randomUUID())
    - Backend: Constructs params object with correct field names

## Validation Rules Added

### Period Validation
- `get_advert_fullstats`: Max 31 days, max 50 campaign IDs
- `get_nm_report_detail_history`: Max 7 days
- `get_nm_report_grouped_history`: Max 7 days
- `get_search_report_product_orders`: Max 7 days

### Input Validation
- `get_search_report`: At least one of includeSubstitutedSKUs or includeSearchTexts must be true
- `get_search_report_table_groups`: At least one of brandNames, subjectIds, or tagIds required
- `create_csv_report`: Generates UUID internally (no Claude input needed)

### Data Transformation
- `get_stocks_products`: Removes undefined singular fields (subjectID, brandName, tagID)
- All tools: Use `removeUndefined()` to clean up objects before sending to WB API
- All tools: Use builders to construct proper request body structure

## Backward Compatibility
- Tool names remain unchanged (old names preserved)
- Tool functionality remains same, just with better validation
- No breaking changes to existing integrations

## Description Updates
- `get_nm_report_detail`: Now explains it supports period comparison (April vs March)
- `get_nm_report_detail_history`: Now mentions 7-day limit and suggests CSV report for longer periods
- `get_stocks_sizes`: Now mentions it requires single nmID
- Search report tools: All now mention Jam subscription requirement

## Key Improvements
1. ✅ Typed inputs instead of generic `z.record(z.any())`
2. ✅ Backend assembles correct WB request bodies
3. ✅ Clear validation messages before API calls
4. ✅ Period validation prevents unnecessary API failures
5. ✅ Better error messages with context
6. ✅ UUID generated server-side for CSV reports
7. ✅ Field name transformations handled server-side (nmIDs vs nmIds)
8. ✅ Comprehensive unit and integration tests
9. ✅ No token leakage in error messages

## Testing

### Run All Tests
```bash
npm test -- --run
```

### Run Specific Tests
```bash
npm test -- wb-builders.test.js
npm test -- wb-mcp-validation.test.js
npm test -- --run --reporter=verbose
```

## Deployment Notes
1. All changes are backward compatible
2. No database migrations needed
3. No env var changes needed
4. No secrets/credentials modified
5. Ready for immediate deployment via Docker
