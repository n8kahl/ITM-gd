# AI Coach - Phase 1-3 Testing & Validation Guide

**Status**: Implementation Complete - Ready for Testing
**Date**: 2026-02-03
**Branch**: `claude/prepare-cloud-session-wnVF5`

---

## Testing Checklist

Before proceeding to Phase 4 (AI Chat), these tests MUST pass:

### ✅ Phase 1: Infrastructure Tests

#### Test 1.1: Backend Server Starts
```bash
cd backend
npm install
npm run dev
```

**Expected Output**:
```
✓ Redis connected
✓ Server running on http://localhost:3001
✓ Health check: http://localhost:3001/health
✓ Detailed health check: http://localhost:3001/health/detailed
```

**Pass Criteria**: No errors, server runs on port 3001

---

#### Test 1.2: Health Check - Basic
```bash
curl http://localhost:3001/health
```

**Expected Response**:
```json
{
  "status": "ok"
}
```

**Pass Criteria**: Status 200, returns `{"status":"ok"}`

---

#### Test 1.3: Health Check - Detailed
```bash
curl http://localhost:3001/health/detailed
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T12:00:00Z",
  "services": {
    "database": true,
    "redis": true,
    "massive": true
  }
}
```

**Pass Criteria**:
- ✅ Status 200
- ✅ All services return `true`
- ✅ Database connection working
- ✅ Redis connection working
- ✅ Massive.com API connection working

---

### ✅ Phase 2: Database Tests

#### Test 2.1: Migrations Applied
```bash
cd /home/user/ITM-gd
npx supabase db push
```

**Expected Output**:
```
✓ Migrations applied successfully
✓ 3 migrations completed
```

**Pass Criteria**: All 3 migration files applied without errors

---

#### Test 2.2: Tables Exist
```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'ai_coach_%';
```

**Expected Output**:
```
ai_coach_users
ai_coach_sessions
ai_coach_messages
ai_coach_positions
ai_coach_trades
ai_coach_alerts
ai_coach_levels_cache
```

**Pass Criteria**: All 7 tables exist

---

#### Test 2.3: RLS Policies Active
```sql
-- Run in Supabase SQL Editor
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'ai_coach_%';
```

**Expected Output**: Multiple policies for each table

**Pass Criteria**: RLS enabled on all tables

---

#### Test 2.4: Functions Exist
```sql
-- Run in Supabase SQL Editor
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%coach%';
```

**Expected Output**:
```
reset_query_counts
calculate_portfolio_greeks
position_to_trade
update_position_metrics
increment_session_message_count
clean_expired_cache
```

**Pass Criteria**: All 6 functions exist

---

### ✅ Phase 3: Levels Engine Tests

#### Test 3.1: Unit Tests Pass
```bash
cd backend
npm test
```

**Expected Output**:
```
PASS src/services/levels/__tests__/pivots.test.ts
PASS src/services/levels/__tests__/atr.test.ts

Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        1.845 s
```

**Pass Criteria**: All 23 tests pass, no failures

---

#### Test 3.2: Get JWT Token

First, login to get a valid JWT token:

```bash
# Option 1: Via Supabase dashboard
# Go to: https://your-project.supabase.co/auth/users
# Create a test user, get JWT from session

# Option 2: Via existing TITM login
# Login to https://www.tradeinthemoney.com
# Open browser dev tools → Application → Local Storage
# Find 'sb-*-auth-token' → Copy access_token
```

Save token as environment variable:
```bash
export TEST_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

#### Test 3.3: Levels API - SPX
```bash
curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/SPX?timeframe=intraday"
```

**Expected Response** (truncated):
```json
{
  "symbol": "SPX",
  "timestamp": "2026-02-03T12:05:30.123Z",
  "currentPrice": 5912.50,
  "levels": {
    "resistance": [
      {
        "type": "PDH",
        "price": 5930.00,
        "distance": 17.50,
        "distancePct": 0.30,
        "distanceATR": 0.4,
        "strength": "strong",
        "description": "Previous Day High"
      }
    ],
    "support": [...],
    "pivots": {
      "standard": {
        "pp": 5890.00,
        "r1": 5910.00,
        ...
      }
    },
    "indicators": {
      "vwap": 5900.00,
      "atr14": 47.25
    }
  },
  "marketContext": {
    "marketStatus": "open",
    "sessionType": "regular"
  },
  "cached": false
}
```

**Pass Criteria**:
- ✅ Status 200
- ✅ JSON response matches API_CONTRACTS.md format
- ✅ All required fields present
- ✅ Response time <2000ms (first call)
- ✅ Response time <100ms (second call, cached)

---

#### Test 3.4: Levels API - NDX
```bash
curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/NDX?timeframe=intraday"
```

**Pass Criteria**: Same as Test 3.3, but for NDX symbol

---

#### Test 3.5: Caching Works
```bash
# First call (fresh calculation)
time curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/SPX"

# Second call (cached)
time curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/SPX"
```

**Expected**:
- First call: 1-2 seconds
- Second call: <100ms
- Response includes: `"cached": true`

**Pass Criteria**: Second call significantly faster

---

#### Test 3.6: Check Redis Cache
```bash
redis-cli KEYS "levels:*"
```

**Expected Output**:
```
1) "levels:SPX:intraday"
2) "levels:NDX:intraday"
```

**Pass Criteria**: Cache keys exist in Redis

---

#### Test 3.7: Invalid Symbol Returns 404
```bash
curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/INVALID"
```

**Expected Response**:
```json
{
  "error": "Symbol not found",
  "message": "Symbol 'INVALID' is not supported. Supported symbols: SPX, NDX"
}
```

**Pass Criteria**: Status 404, proper error message

---

#### Test 3.8: Missing Auth Returns 401
```bash
curl "http://localhost:3001/api/levels/SPX"
```

**Expected Response**:
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

**Pass Criteria**: Status 401, proper error message

---

### ✅ Critical Validation: TradingView Comparison

**MOST IMPORTANT TEST** - Calculations must match TradingView

#### Step 1: Get API Response
```bash
curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/SPX" | jq
```

Note down these values:
- PDH: _______
- PDL: _______
- PDC: _______
- Pivot Point (PP): _______
- VWAP: _______
- ATR(14): _______

#### Step 2: Compare to TradingView

1. Open TradingView: https://www.tradingview.com/chart/
2. Load SPX chart
3. Add indicators:
   - **"Previous Day High/Low"**
   - **"Pivot Points Standard"**
   - **"VWAP"**
   - **"ATR"** (set period to 14)
4. Compare values

#### Step 3: Validation

**Pass Criteria**:
```
API Value       TradingView     Difference   Status
PDH: 5930.00   vs 5930.00    = $0.00      ✅ PASS
PDL: 5880.00   vs 5880.25    = $0.25      ✅ PASS (within $0.50)
PDC: 5900.00   vs 5900.00    = $0.00      ✅ PASS
PP:  5900.00   vs 5900.08    = $0.08      ✅ PASS
VWAP: 5902.50  vs 5902.45    = $0.05      ✅ PASS
ATR: 47.25     vs 47.30      = $0.05      ✅ PASS
```

**All values MUST be within $0.50 of TradingView**

**❌ FAIL**: If any value differs by more than $0.50, investigate formula

---

### ✅ Performance Tests

#### Test P.1: Response Time (Uncached)
```bash
for i in {1..5}; do
  time curl -H "Authorization: Bearer $TEST_JWT" \
    "http://localhost:3001/api/levels/SPX" > /dev/null 2>&1
done
```

**Pass Criteria**: Average response time <2000ms

---

#### Test P.2: Response Time (Cached)
```bash
# Prime the cache first
curl -H "Authorization: Bearer $TEST_JWT" \
  "http://localhost:3001/api/levels/SPX" > /dev/null

# Test cached performance
for i in {1..10}; do
  time curl -H "Authorization: Bearer $TEST_JWT" \
    "http://localhost:3001/api/levels/SPX" > /dev/null 2>&1
done
```

**Pass Criteria**: Average response time <100ms

---

#### Test P.3: Concurrent Requests
```bash
# Test 10 concurrent requests
for i in {1..10}; do
  curl -H "Authorization: Bearer $TEST_JWT" \
    "http://localhost:3001/api/levels/SPX" > /dev/null 2>&1 &
done
wait
```

**Pass Criteria**: No errors, all requests complete successfully

---

## Test Results Summary

Record your test results:

```
Phase 1: Infrastructure
  [  ] Test 1.1: Server starts
  [  ] Test 1.2: Health check basic
  [  ] Test 1.3: Health check detailed

Phase 2: Database
  [  ] Test 2.1: Migrations applied
  [  ] Test 2.2: Tables exist
  [  ] Test 2.3: RLS policies active
  [  ] Test 2.4: Functions exist

Phase 3: Levels Engine
  [  ] Test 3.1: Unit tests pass
  [  ] Test 3.2: JWT token obtained
  [  ] Test 3.3: Levels API - SPX
  [  ] Test 3.4: Levels API - NDX
  [  ] Test 3.5: Caching works
  [  ] Test 3.6: Redis cache verified
  [  ] Test 3.7: Invalid symbol 404
  [  ] Test 3.8: Missing auth 401

Critical Validation:
  [  ] TradingView comparison (all within $0.50)

Performance:
  [  ] Test P.1: Uncached <2000ms
  [  ] Test P.2: Cached <100ms
  [  ] Test P.3: Concurrent requests OK
```

---

## Troubleshooting Common Issues

### Issue: "Redis connection failed"
**Solution**:
```bash
# Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

### Issue: "Massive.com API returns 401"
**Solution**:
- Check `MASSIVE_API_KEY` in `.env.local`
- Verify subscription at https://massive.com/dashboard
- Test API key:
```bash
curl "https://api.massive.com/v2/aggs/ticker/I:SPX/range/1/day/2024-01-01/2024-01-31?apiKey=YOUR_KEY"
```

### Issue: "Database connection failed"
**Solution**:
- Check Supabase credentials in `.env.local`
- Verify project URL and keys in Supabase dashboard
- Test connection in Supabase SQL Editor

### Issue: "Calculations don't match TradingView"
**Solution**:
1. Check time zone (all times must be ET)
2. Verify using previous day's data (not current day)
3. Check formulas in `/docs/ai-coach/features/levels-engine/CALCULATIONS.md`
4. For PMH/PML: Ensure using 4:00 AM - 9:30 AM ET data

---

## Sign-Off

Once ALL tests pass, you're ready for Phase 4 (AI Chat Interface).

**Tester**: _________________
**Date**: _________________
**Status**: ⬜ PASS / ⬜ FAIL

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Next**: After all tests pass → Proceed to Phase 4 (AI Chat)
