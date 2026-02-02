# Claude Code Implementation Prompt

**Copy this entire prompt and send it to Claude Code to begin implementation**

---

## 🎯 Task: Implement AI Coach Feature - Phase 1 (Levels Engine MVP)

I need you to implement the AI Coach feature for the TITM trading platform, following the comprehensive specifications in `/docs/ai-coach/`.

### 📚 Required Reading (Read These First)

**You MUST read these documents before writing any code** (in this order):

1. `/docs/ai-coach/DEVELOPER_HANDOFF.md` - Your primary implementation guide
2. `/docs/ai-coach/MASTER_SPEC.md` - Product vision and context
3. `/docs/ai-coach/data-models/DATABASE_SCHEMA.md` - Database structure
4. `/docs/ai-coach/architecture/API_CONTRACTS.md` - Exact API formats
5. `/docs/ai-coach/features/levels-engine/CALCULATIONS.md` - Mathematical formulas (when you write it)

### 🎬 Start with Phase 1: Infrastructure & Levels Engine

Follow the phases **exactly as documented** in DEVELOPER_HANDOFF.md:

**Phase 1: Infrastructure Setup (Week 1)**
- Create `/backend` folder structure
- Set up Express/Node.js server
- Configure Supabase database connection
- Configure Redis connection
- Create Massive.com API client wrapper
- Implement health check endpoint: `GET /health`

**Phase 2: Database Schema (Week 1)**
- Create all 7 tables from DATABASE_SCHEMA.md
- Implement Row Level Security (RLS) policies
- Create helper functions and triggers
- Test with sample data

**Phase 3: Levels Calculation Engine (Weeks 2-3)**
- Fetch historical data from Massive.com
- Implement calculators for: PDH, PMH, Standard Pivots, VWAP, ATR
- Cache results in Redis
- Create API endpoint: `GET /api/levels/:symbol`
- **Critical**: Levels MUST match TradingView within $0.50

### 🚨 Critical Rules

1. **Follow Specs Exactly**: Don't deviate from documented API formats, database schemas, or calculations
2. **Test Everything**: Each phase has acceptance criteria - meet them before moving on
3. **Validate Against TradingView**: All level calculations must match TradingView within $0.50
4. **No Skipping Phases**: Complete Phase 1 before Phase 2, Phase 2 before Phase 3, etc.
5. **Document Assumptions**: If anything is unclear, document your assumption in code comments

### ✅ Acceptance Criteria for Phase 1-3 (MVP)

**Infrastructure**:
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] Can connect to Supabase database
- [ ] Can connect to Redis
- [ ] Can successfully call Massive.com API (test with SPX historical data)

**Database**:
- [ ] All 7 tables created with correct columns
- [ ] RLS policies working (users can only see their own data)
- [ ] Can insert and query test data
- [ ] Foreign keys enforced

**Levels Engine**:
- [ ] Can fetch daily data from Massive.com for SPX and NDX
- [ ] PDH/PDL/PDC calculated correctly (compare to TradingView)
- [ ] PMH/PML calculated from 4am-9:30am ET extended hours data
- [ ] Standard pivots use correct formula: PP = (H+L+C)/3, R1 = (2*PP)-L, etc.
- [ ] VWAP calculated from cumulative volume/price since market open
- [ ] ATR(14) calculated from 14-period true range
- [ ] Results cached in Redis with appropriate TTL
- [ ] API endpoint returns JSON matching format in API_CONTRACTS.md
- [ ] Response time < 500ms (p95)

### 📝 API Format You Must Match

**Request**:
```
GET /api/levels/SPX?timeframe=intraday
Authorization: Bearer {jwt}
```

**Response** (exact format):
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
        "description": "Previous Day High",
        "testsToday": 3,
        "lastTest": "2026-02-03T11:52:00Z"
      }
    ],
    "support": [ /* same format */ ],
    "pivots": {
      "standard": {
        "pp": 5890.00,
        "r1": 5910.00,
        "r2": 5930.00,
        "r3": 5950.00,
        "s1": 5870.00,
        "s2": 5850.00,
        "s3": 5830.00
      }
    },
    "indicators": {
      "vwap": 5900.00,
      "atr14": 47.25
    }
  },
  "cached": true,
  "cacheExpiresAt": "2026-02-03T12:06:30Z"
}
```

### 🧮 Calculation Formulas (You Must Use These)

**Standard Pivots**:
```
Pivot Point (PP) = (High + Low + Close) / 3
R1 = (2 * PP) - Low
R2 = PP + (High - Low)
R3 = High + 2 * (PP - Low)
S1 = (2 * PP) - High
S2 = PP - (High - Low)
S3 = Low - 2 * (High - PP)
```
*Use previous day's High, Low, Close*

**Pre-Market High/Low (PMH/PML)**:
- Scan extended hours data from 4:00 AM ET to 9:30 AM ET
- PMH = highest price during this window
- PML = lowest price during this window

**VWAP**:
```
VWAP = Σ(Price × Volume) / Σ(Volume)
```
*Cumulative from market open (9:30 AM ET) to current time*

**ATR (Average True Range)**:
```
True Range = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
ATR = 14-period moving average of True Range
```

### 🗂️ File Structure to Create

```
/backend
  /src
    /config
      database.ts          # Supabase connection
      massive.ts          # Massive.com API client
      redis.ts            # Redis connection
    /services
      /levels
        fetcher.ts        # Fetch data from Massive.com
        /calculators
          pivots.ts       # Standard pivot calculations
          premarket.ts    # PMH/PML detection
          previousDay.ts  # PDH/PDL/PDC
          vwap.ts         # VWAP calculation
          atr.ts          # ATR calculation
        cache.ts          # Redis caching
        index.ts          # Main levels service
    /routes
      health.ts           # Health check
      levels.ts           # GET /api/levels/:symbol
    /middleware
      auth.ts             # JWT validation
    server.ts             # Express app entry
  package.json
  tsconfig.json

/supabase/migrations
  20260203000001_ai_coach_schema.sql    # Tables
  20260203000002_ai_coach_rls.sql       # RLS policies
  20260203000003_ai_coach_functions.sql # Functions
```

### 🔑 Environment Variables Needed

Create `.env.local` with:
```bash
# Massive.com
MASSIVE_API_KEY=your_api_key_here

# Supabase (from existing TITM project)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# App Config
NODE_ENV=development
PORT=3001
```

*Note: User will provide actual API keys*

### 🧪 Testing Requirements

**Unit Tests** (Write these):
```typescript
// Example: /backend/src/services/levels/__tests__/pivots.test.ts
describe('Standard Pivots Calculator', () => {
  it('calculates pivot point correctly', () => {
    const data = { high: 5920, low: 5880, close: 5900 };
    const pivots = calculateStandardPivots(data);
    expect(pivots.pp).toBe(5900); // (5920+5880+5900)/3
    expect(pivots.r1).toBe(5920); // (2*5900)-5880
  });
});
```

**Integration Tests**:
```bash
# Test health endpoint
curl http://localhost:3001/health
# Expected: {"status": "ok"}

# Test levels endpoint (after implementation)
curl -H "Authorization: Bearer test-jwt" \
  http://localhost:3001/api/levels/SPX
# Expected: Valid JSON matching format above
```

**Validation Tests**:
- Open TradingView → SPX chart
- Add "Previous Day High/Low" indicator
- Compare your API response to TradingView values
- **Must match within $0.50**

### 📋 Deliverables for Phase 1-3

1. **Working Backend Server**
   - Runs on `http://localhost:3001`
   - Health check responds
   - Can handle API requests

2. **Database Migrations**
   - All tables created
   - Sample data inserted successfully
   - RLS policies enforced

3. **Levels API Endpoint**
   - `GET /api/levels/SPX` returns valid JSON
   - `GET /api/levels/NDX` returns valid JSON
   - Response time < 500ms
   - Cached results (verify in Redis)

4. **Test Results**
   - Unit tests passing (>80% coverage)
   - Integration tests passing
   - TradingView validation passed (screenshot proof)

5. **Documentation**
   - Code comments explaining complex logic
   - README in `/backend` folder with setup instructions
   - Any deviations from spec documented with reasoning

### ⚠️ Common Pitfalls to Avoid

1. **Time Zones**: All times must be in Eastern Time (ET)
2. **Market Hours**: Regular = 9:30am-4pm, Extended = 4am-9:30am pre-market
3. **Data Granularity**: Use 1-minute or 1-day aggregates (not ticks)
4. **Caching**: Different TTLs for different data types:
   - Daily pivots: 24 hours
   - VWAP: 1 minute (updates frequently)
   - PMH/PML: Until market open (9:30am)
5. **Error Handling**: Massive.com API can fail - implement retries and fallbacks

### 🚦 When to Stop and Ask

**You should NOT need to ask questions** - everything is documented.

**But if you encounter**:
- Massive.com API endpoint not working as documented → Check their official docs
- Calculation doesn't match TradingView → Double-check formula, time zone, data source
- Database migration fails → Check Supabase console for errors
- Technical impossibility → Document issue and propose solution

**Flag issues in**: `/docs/ai-coach/IMPLEMENTATION_BLOCKERS.md`

### 🎯 Success Criteria (How You Know You're Done)

Phase 1-3 is COMPLETE when:

1. A user can open terminal and run:
   ```bash
   curl http://localhost:3001/health
   # Returns: {"status": "ok"}
   ```

2. A user can query levels:
   ```bash
   curl -H "Authorization: Bearer test-jwt" \
     http://localhost:3001/api/levels/SPX
   # Returns: Valid JSON with PDH at $5,930 (matching TradingView)
   ```

3. You can show screenshot of TradingView with PDH at $5,930
   AND your API response showing PDH at $5,930
   (values match within $0.50)

4. All unit tests pass:
   ```bash
   npm test
   # All tests green ✅
   ```

**If all 4 criteria met → Phase 1-3 is DONE ✅**

### 📞 Resources

- **Massive.com API Docs**: https://massive.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **TradingView** (for validation): https://tradingview.com

### 🏁 Start Here

1. Read `/docs/ai-coach/DEVELOPER_HANDOFF.md` (entire document)
2. Read `/docs/ai-coach/data-models/DATABASE_SCHEMA.md`
3. Read `/docs/ai-coach/architecture/API_CONTRACTS.md`
4. Create `/backend` folder structure
5. Begin Phase 1: Infrastructure Setup

**Let's build this! 🚀**

---

## After Phase 1-3 is Complete

Once you've successfully completed Phase 1-3 (Infrastructure + Database + Levels Engine), we'll proceed to:

- **Phase 4**: Basic AI Chat (ChatKit integration)
- **Phase 5**: Charts (TradingView Lightweight Charts)
- **Phase 6**: Card Widgets
- And so on...

But **DO NOT** start Phase 4 until Phase 1-3 is complete and tested.

---

**Questions?** Re-read the documentation. It's all there.

**Blockers?** Document in IMPLEMENTATION_BLOCKERS.md with proposed solution.

**Ready?** Start with Phase 1 infrastructure setup. Good luck! 💪
