# Developer Handoff Guide - AI Coach Implementation

**Status**: Ready for Implementation
**Last Updated**: 2026-02-03
**Version**: 1.0

---

## 🎯 Purpose of This Document

This guide enables a developer (or AI agent like Claude Code) to implement the AI Coach **completely autonomously** without needing to ask the product owner (Nate) any questions during development.

**Everything you need to build this is documented. If you find a gap, it's a bug in the documentation - flag it.**

---

## 📋 Prerequisites - What You Need Before Starting

### 1. Accounts & Access
- [ ] TITM repository access (you have this)
- [ ] Massive.com account ($597/month subscription - Options + Stocks + Indices Advanced)
- [ ] OpenAI API account with ChatKit access
- [ ] Supabase project (already have for TITM)
- [ ] Vercel account (for frontend deployment, free tier OK initially)
- [ ] Railway/AWS account (for backend, ~$50/month to start)

### 2. Development Environment
- [ ] Node.js 20+ installed
- [ ] PostgreSQL client (for database work)
- [ ] Redis (can use Docker locally, or Upstash free tier)
- [ ] Git configured
- [ ] Code editor (VS Code recommended)

### 3. API Keys & Credentials
You'll need these environment variables (create `.env.local`):
```bash
# Massive.com
MASSIVE_API_KEY=your_api_key_here

# OpenAI
OPENAI_API_KEY=your_api_key_here
OPENAI_CHATKIT_BACKEND_ID=your_chatkit_backend_id

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# App Config
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📚 Documentation You Must Read (In Order)

### Phase 0: Understanding (Read These First - 2-3 hours)

1. **[MASTER_SPEC.md](./MASTER_SPEC.md)** (30 min) - Understand what you're building
2. **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** (45 min) - See the full journey
3. **[CENTER_COLUMN_DESIGN.md](./ui-ux/CENTER_COLUMN_DESIGN.md)** (60 min) - Understand the primary UI
4. **[DATABASE_SCHEMA.md](./data-models/DATABASE_SCHEMA.md)** (30 min) - See all tables/columns

### Phase 1: Technical Specs (Read Before Building)

5. **[SYSTEM_OVERVIEW.md](./architecture/SYSTEM_OVERVIEW.md)** - Architecture decisions
6. **[API_CONTRACTS.md](./architecture/API_CONTRACTS.md)** - Exact API request/response formats
7. **[LEVELS_ENGINE_SPEC.md](./features/levels-engine/SPEC.md)** - First feature to build
8. **[LEVELS_CALCULATIONS.md](./features/levels-engine/CALCULATIONS.md)** - Exact math formulas

### Reference as Needed

9. **[MASSIVE_API_GUIDE.md](./integrations/MASSIVE_API_REFERENCE.md)** - How to call Massive.com APIs
10. **[CHATKIT_SETUP.md](./integrations/OPENAI_CHATKIT_SETUP.md)** - ChatKit configuration
11. **[TEST_CHECKLIST.md](./testing/TEST_CHECKLIST.md)** - How to verify it works

---

## 🏗️ Implementation Order - Build in This Exact Sequence

**Critical**: Each phase MUST be completed and tested before moving to the next. Do not skip ahead.

### Phase 1: Infrastructure Setup (Week 1)

**Goal**: Get basic backend running, database migrated, able to call Massive.com API

**What to Build**:
1. Backend server (Node.js/Express) in `/backend` folder
2. Database migrations (PostgreSQL via Supabase)
3. Massive.com API client wrapper
4. Basic health check endpoint

**Files to Create**:
```
/backend
  /src
    /config
      database.ts          # Supabase connection
      massive.ts          # Massive.com client
      redis.ts            # Redis connection
    /routes
      health.ts           # GET /health endpoint
    server.ts             # Express app entry point
  package.json
  tsconfig.json
  .env.local
```

**Acceptance Criteria**:
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] Can connect to Supabase database
- [ ] Can connect to Redis
- [ ] Can call Massive.com API: `GET /v2/aggs/ticker/I:SPX/range/1/day/2024-01-01/2024-01-31` (test)
- [ ] All environment variables loaded

**Test Command**: `curl http://localhost:3001/health`

**Reference Docs**:
- [SYSTEM_OVERVIEW.md](./architecture/SYSTEM_OVERVIEW.md) - Tech stack
- [DATABASE_SCHEMA.md](./data-models/DATABASE_SCHEMA.md) - Tables to create
- [MASSIVE_API_REFERENCE.md](./integrations/MASSIVE_API_REFERENCE.md) - API endpoints

---

### Phase 2: Database Schema (Week 1)

**Goal**: All tables created, RLS policies set, ready for data

**What to Build**:
Create these tables (exact schema in [DATABASE_SCHEMA.md](./data-models/DATABASE_SCHEMA.md)):
1. `ai_coach_users` - User profiles, subscription tier, usage tracking
2. `ai_coach_sessions` - Chat sessions
3. `ai_coach_messages` - Chat message history
4. `ai_coach_positions` - User positions (from screenshots or manual entry)
5. `ai_coach_trades` - Trade journal entries
6. `ai_coach_alerts` - User-configured alerts
7. `ai_coach_levels_cache` - Cached level calculations

**Files to Create**:
```
/supabase/migrations/
  20260203000001_ai_coach_schema.sql    # Create all tables
  20260203000002_ai_coach_rls.sql       # Row Level Security policies
  20260203000003_ai_coach_functions.sql # Helper functions
```

**Acceptance Criteria**:
- [ ] All 7 tables created with correct columns
- [ ] RLS policies enforced (users can only see their own data)
- [ ] Foreign key constraints working
- [ ] Indexes created on frequently queried columns
- [ ] Can insert test data and query it back

**Test Command**:
```sql
-- Insert test user
INSERT INTO ai_coach_users (user_id, subscription_tier, query_count)
VALUES ('test-user-id', 'pro', 0);

-- Query back
SELECT * FROM ai_coach_users WHERE user_id = 'test-user-id';
```

**Reference Docs**:
- [DATABASE_SCHEMA.md](./data-models/DATABASE_SCHEMA.md) - Complete schema

---

### Phase 3: Levels Calculation Engine (Weeks 2-3)

**Goal**: Can calculate PDH, PMH, pivots, VWAP, ATR for SPX/NDX

**What to Build**:
1. Service to fetch historical data from Massive.com
2. Calculate all level types (formulas in CALCULATIONS.md)
3. Cache results in Redis (5-60 min TTL depending on level type)
4. API endpoint to retrieve levels

**Files to Create**:
```
/backend/src/services
  /levels
    fetcher.ts              # Fetch data from Massive.com
    calculators/
      pivots.ts             # Standard, Camarilla, Fib pivots
      premarket.ts          # PMH/PML calculation
      previousDay.ts        # PDH/PDL/PDC
      vwap.ts               # Real-time VWAP
      atr.ts                # ATR calculation
    cache.ts                # Redis caching layer
    index.ts                # Main levels service

/backend/src/routes
  levels.ts                 # GET /api/levels/:symbol endpoint
```

**API Contract** (exact format in [API_CONTRACTS.md](./architecture/API_CONTRACTS.md)):

Request:
```
GET /api/levels/SPX?timeframe=intraday
Authorization: Bearer {user_jwt}
```

Response:
```json
{
  "symbol": "SPX",
  "timestamp": "2026-02-03T12:05:00Z",
  "currentPrice": 5912.50,
  "levels": {
    "resistance": [
      {
        "type": "PWH",
        "price": 5950.00,
        "distance": 37.50,
        "distancePct": 0.64,
        "distanceATR": 0.8,
        "strength": "strong",
        "description": "Previous Week High"
      },
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
    "support": [
      {
        "type": "PMH",
        "price": 5885.00,
        "distance": -27.50,
        "distancePct": -0.46,
        "distanceATR": -0.6,
        "strength": "strong",
        "description": "Pre-Market High",
        "testsToday": 2
      }
    ],
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
  "cacheExpiresAt": "2026-02-03T12:10:00Z"
}
```

**Acceptance Criteria**:
- [ ] Can fetch daily data from Massive.com (last 5 days for ATR)
- [ ] PDH/PDL/PDC calculated correctly (match TradingView within $0.50)
- [ ] PMH/PML detected from 4am-9:30am ET extended hours data
- [ ] Standard pivots calculated using correct formula
- [ ] VWAP calculated from cumulative volume/price (market open to now)
- [ ] ATR(14) calculated from 14-period true range
- [ ] Results cached in Redis (TTL: pivots 24h, VWAP 1min)
- [ ] API endpoint returns correct JSON format
- [ ] Handles errors gracefully (market closed, missing data)

**Test Command**:
```bash
curl -H "Authorization: Bearer test-jwt" \
  http://localhost:3001/api/levels/SPX?timeframe=intraday
```

**Compare against TradingView**:
- Open TradingView, load SPX
- Add indicator: "Previous Day High/Low"
- Add indicator: "VWAP"
- Compare values - must match within $0.50

**Reference Docs**:
- [LEVELS_ENGINE_SPEC.md](./features/levels-engine/SPEC.md)
- [CALCULATIONS.md](./features/levels-engine/CALCULATIONS.md) - Exact formulas
- [MASSIVE_API_REFERENCE.md](./integrations/MASSIVE_API_REFERENCE.md)

---

### Phase 4: Basic AI Chat Interface (Weeks 4-5)

**Goal**: User can open AI Coach tab, type "Where's PDH?" and get answer

**What to Build**:
1. AI Coach tab in member dashboard (Next.js frontend)
2. OpenAI ChatKit integration
3. Backend function to handle AI requests
4. Session management

**Files to Create**:
```
/app/dashboard/ai-coach
  page.tsx                  # Main AI Coach page
  components/
    ChatInterface.tsx       # ChatKit wrapper
    CenterPanel.tsx         # Right side content area
  hooks/
    useAICoach.ts          # State management

/backend/src/chatkit
  config.ts                 # ChatKit backend setup
  functions.ts              # Function calling handlers
  prompts.ts                # System prompt

/backend/src/routes
  chatkit.ts                # POST /api/chatkit/message endpoint
```

**Frontend Component Structure**:
```tsx
// /app/dashboard/ai-coach/page.tsx
export default function AICoachPage() {
  return (
    <div className="flex h-screen">
      {/* Left: Chat (30%) */}
      <div className="w-[30%] border-r">
        <ChatInterface />
      </div>

      {/* Right: Center Panel (70%) */}
      <div className="w-[70%]">
        <CenterPanel />
      </div>
    </div>
  );
}
```

**ChatKit Function Calling** (implement in `/backend/src/chatkit/functions.ts`):

```typescript
// When AI says "get_key_levels", this gets called
async function get_key_levels(symbol: string, timeframe: string) {
  // Call your levels API
  const response = await fetch(`http://localhost:3001/api/levels/${symbol}?timeframe=${timeframe}`);
  return await response.json();
}

// Register with ChatKit
const tools = [
  {
    name: "get_key_levels",
    description: "Get key support/resistance levels for a symbol",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol (e.g. SPX, NDX)"
        },
        timeframe: {
          type: "string",
          enum: ["intraday", "daily", "weekly"],
          description: "Timeframe for levels"
        }
      },
      required: ["symbol"]
    }
  }
];
```

**System Prompt** (exact text in [SYSTEM_PROMPT.md](./ai-prompts/SYSTEM_PROMPT.md)):
```
You are the TITM AI Coach, an expert options trading assistant specializing in SPX and NDX.

Your personality: Professional, concise, data-driven, educational.
You explain complex concepts simply.
You NEVER give financial advice - you present data and let the trader decide.

Available tools:
- get_key_levels(symbol, timeframe) - Get PDH, PMH, pivots, VWAP, ATR

When a user asks "Where's PDH?", you:
1. Call get_key_levels("SPX", "intraday")
2. Extract PDH from response
3. Reply: "PDH is at $5,930 (+$18 from current / 0.30% / 0.4 ATR). It's been tested 3 times today and held as resistance each time."

Be specific with numbers. Use dollar amounts, percentages, and ATR distances.
```

**Acceptance Criteria**:
- [ ] AI Coach tab visible in dashboard navigation
- [ ] ChatKit UI renders correctly
- [ ] Can send message "Where's PDH for SPX?"
- [ ] AI calls `get_key_levels` function correctly
- [ ] AI responds with accurate level data
- [ ] Response time <3 seconds end-to-end
- [ ] Chat history persists in session
- [ ] Usage count increments (for tier limits)
- [ ] Tier limits enforced (Lite: 100/mo, Pro: 500/mo)

**Test Steps**:
1. Open http://localhost:3000/dashboard/ai-coach
2. Type: "Where's PDH?"
3. Verify AI responds with correct price
4. Compare to your /api/levels/SPX response (should match)
5. Type: "What's the ATR?"
6. Verify AI responds correctly
7. Type 101 messages (if Lite tier) - should get "limit reached" error

**Reference Docs**:
- [CHATKIT_SETUP.md](./integrations/OPENAI_CHATKIT_SETUP.md)
- [SYSTEM_PROMPT.md](./ai-prompts/SYSTEM_PROMPT.md)
- [API_CONTRACTS.md](./architecture/API_CONTRACTS.md)

---

### Phase 5: Center Panel - Charts (Weeks 6-7)

**Goal**: When AI says "Here's the chart", a chart appears in center panel

**What to Build**:
1. Chart component using TradingView Lightweight Charts
2. Fetch historical data from Massive.com (for candles)
3. Overlay levels on chart
4. Real-time updates via WebSocket (later phase - start with polling)

**Files to Create**:
```
/app/dashboard/ai-coach/components
  /charts
    CandlestickChart.tsx    # Main chart component
    LevelsOverlay.tsx       # Draw levels on chart
    ChartControls.tsx       # Timeframe selector
  /center-panel
    ChartView.tsx           # Wrapper for chart in center panel

/backend/src/routes
  charts.ts                 # GET /api/charts/:symbol/candles endpoint
```

**Chart Data API Contract**:

Request:
```
GET /api/charts/SPX/candles?timeframe=5m&bars=100
Authorization: Bearer {jwt}
```

Response:
```json
{
  "symbol": "SPX",
  "timeframe": "5m",
  "candles": [
    {
      "time": "2026-02-03T09:35:00Z",
      "open": 5890.00,
      "high": 5895.50,
      "low": 5888.25,
      "close": 5892.75,
      "volume": 1200000
    },
    // ... 99 more candles
  ]
}
```

**Chart Implementation**:
```tsx
// Simplified example - full code in CENTER_COLUMN_DESIGN.md
import { createChart } from 'lightweight-charts';

export function CandlestickChart({ symbol, levels }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = createChart(chartRef.current, {
      width: 800,
      height: 600,
    });

    const candlestickSeries = chart.addCandlestickSeries();

    // Fetch and set candle data
    fetch(`/api/charts/${symbol}/candles?timeframe=5m`)
      .then(r => r.json())
      .then(data => {
        candlestickSeries.setData(data.candles);
      });

    // Overlay levels
    levels.resistance.forEach(level => {
      candlestickSeries.createPriceLine({
        price: level.price,
        color: 'red',
        lineWidth: 1,
        lineStyle: 2, // dashed
        title: level.type,
      });
    });

    return () => chart.remove();
  }, [symbol, levels]);

  return <div ref={chartRef} />;
}
```

**Acceptance Criteria**:
- [ ] Chart renders with SPX 5-minute candles
- [ ] Can switch timeframes (1m, 5m, 15m, 1h, daily)
- [ ] Levels overlaid as horizontal lines (red resistance, green support)
- [ ] Level labels show on right side
- [ ] Zoom and pan work smoothly (60fps)
- [ ] Volume bars below price chart
- [ ] Loads 100 bars in <1 second

**Test Steps**:
1. In AI chat, type: "Show me SPX chart"
2. AI should trigger chart display in center panel
3. Verify candles render correctly
4. Verify PDH line appears at correct price
5. Click timeframe buttons - chart updates
6. Try to zoom/pan - should be smooth

**Reference Docs**:
- [CENTER_COLUMN_DESIGN.md](./ui-ux/CENTER_COLUMN_DESIGN.md) - Section 1A
- [MASSIVE_API_REFERENCE.md](./integrations/MASSIVE_API_REFERENCE.md) - Aggregates endpoint
- [TradingView Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)

---

### Phase 6-10: Additional Features (Weeks 8-40)

Continue following [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) for:
- Phase 6: Card Widgets
- Phase 7: Options Analysis (Greeks, options chains)
- Phase 8: Screenshot Analysis (Vision API)
- Phase 9: Trade Journal
- Phase 10: Real-Time Alerts
- Phase 11: Opportunity Scanner
- Phase 12: Swing/LEAPS Module
- Phase 13: Beta Launch

Each phase has detailed specs in the roadmap document.

---

## 🧪 Testing Strategy

### Unit Tests
Every calculation must have unit tests:
```typescript
// Example: /backend/src/services/levels/__tests__/pivots.test.ts
describe('Standard Pivots Calculator', () => {
  it('calculates pivot point correctly', () => {
    const data = {
      high: 5920,
      low: 5880,
      close: 5900
    };

    const pivots = calculateStandardPivots(data);

    expect(pivots.pp).toBe(5900); // (H + L + C) / 3
    expect(pivots.r1).toBe(5920); // (2 * PP) - L
    // ... more assertions
  });
});
```

Run: `npm test`

### Integration Tests
Test API endpoints:
```bash
# Test levels endpoint
curl -H "Authorization: Bearer test-jwt" \
  http://localhost:3001/api/levels/SPX | jq

# Should return valid JSON with all levels
```

### Validation Against Real Data
**Critical**: Compare your calculations to TradingView:
1. Open TradingView → SPX chart
2. Add indicators: PDH/PDL, Pivots, VWAP
3. Compare values to your API response
4. Must match within $0.50

If they don't match, your calculation is WRONG. Fix it.

---

## 🚀 Deployment Guide

### Phase 1 Deployment (MVP - Levels Engine Only)

**Frontend** (Vercel):
```bash
# From root directory
vercel --prod

# Set environment variables in Vercel dashboard
```

**Backend** (Railway):
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy
railway up

# Set environment variables
railway variables set MASSIVE_API_KEY=xxx
railway variables set OPENAI_API_KEY=xxx
# ... etc
```

**Database** (Supabase):
- Already hosted, just run migrations:
```bash
npx supabase db push
```

**Redis** (Upstash):
- Sign up at upstash.com
- Create Redis database
- Copy REDIS_URL to environment variables

### Smoke Test After Deployment
```bash
# Health check
curl https://your-backend.railway.app/health

# Levels API
curl -H "Authorization: Bearer prod-jwt" \
  https://your-backend.railway.app/api/levels/SPX

# Should return valid data
```

---

## 📊 Monitoring & Alerts

### What to Monitor (Use Sentry + Datadog)

**Errors**:
- API failures (Massive.com down)
- OpenAI rate limits
- Database connection errors

**Performance**:
- API response times (target: p95 <500ms for levels, <3sec for AI chat)
- Cache hit rate (target: >80%)
- Database query times

**Usage**:
- Requests per user per day
- OpenAI API costs per user
- Massive.com API call count

**Alerts**:
- Error rate >1% for 5 minutes → Page on-call
- Response time p95 >2 seconds → Warning
- API cost per user >$50/month → Warning

---

## 🐛 Troubleshooting Common Issues

### "Massive.com API returns 401 Unauthorized"
- Check API key is correct in `.env.local`
- Verify account is active and paid
- Try API call in Postman first to isolate issue

### "Levels don't match TradingView"
- Check your calculation formulas in CALCULATIONS.md
- Verify you're using correct high/low/close (previous day)
- PMH/PML: Make sure you're using extended hours data (4am-9:30am)
- Time zones: All times must be in ET (Eastern Time)

### "ChatKit function calling not working"
- Check function is registered in ChatKit backend config
- Verify function signature matches schema
- Look at OpenAI API logs in dashboard
- Test function directly (bypass ChatKit) first

### "Charts not rendering"
- Check browser console for errors
- Verify chart data format matches TradingView Lightweight Charts schema
- Test with simple static data first, then add real-time

### "User hit query limit but can still query"
- Check tier enforcement middleware
- Verify `query_count` incrementing in database
- Check tier limits defined in code match SUBSCRIPTION_TIERS.md

---

## ✅ Definition of Done (Per Phase)

A phase is NOT done until:
- [ ] All acceptance criteria met
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Manually tested (smoke test checklist)
- [ ] Compared against TradingView (for levels)
- [ ] Deployed to staging environment
- [ ] Product owner (Nate) signed off

Do NOT move to next phase until current phase is DONE.

---

## 📞 When to Ask for Help

**You should NOT need to ask questions if docs are complete.**

But if you encounter:
- **Ambiguous requirements** - "I don't know if X should do Y or Z"
  - Flag in docs: "DECISION NEEDED: [describe issue]"
  - Continue with best guess, note assumption

- **Missing API documentation** - "Massive.com endpoint not documented"
  - Check their official docs: https://massive.com/docs
  - Test endpoint, document in our MASSIVE_API_REFERENCE.md

- **Technical impossibility** - "This spec says to do X but the API doesn't support it"
  - Flag as blocker
  - Propose alternative approach
  - Get approval before changing spec

**How to flag issues**:
Create `/docs/ai-coach/IMPLEMENTATION_BLOCKERS.md`:
```markdown
## Blocker #1: Massive.com doesn't provide extended hours data
**Spec**: LEVELS_ENGINE_SPEC.md says to calculate PMH from 4am-9:30am
**Reality**: Massive.com API only provides regular hours (9:30am-4pm)
**Proposed Fix**: Use regular market open price as proxy for PMH
**Status**: Awaiting product owner approval
```

---

## 🎯 Success Criteria - How You Know You're Done

### Phase 1-3 (Levels Engine MVP) Success:
1. User opens AI Coach tab
2. User types: "Where is PDH for SPX?"
3. AI responds within 3 seconds with correct price (matches TradingView)
4. User types: "Show me the chart"
5. Chart appears in center panel with PDH line overlaid
6. PDH line is at correct price
7. User can zoom/pan chart smoothly

**If all 7 steps work, Phase 1-3 is DONE.**

### Full MVP (Phase 1-5) Success:
Same as above, PLUS:
8. User types: "What's my net Delta?" (with test position loaded)
9. AI responds with correct portfolio Greeks
10. Greeks card widget appears in chat with live P&L
11. Click card → Expands to full view in center panel

**If all 11 steps work, MVP is DONE.**

---

## 📁 File Structure After Implementation

```
/TITM-gd
├── /app
│   ├── /dashboard
│   │   └── /ai-coach
│   │       ├── page.tsx                    # Main AI Coach page
│   │       └── /components
│   │           ├── ChatInterface.tsx       # ChatKit wrapper
│   │           ├── CenterPanel.tsx         # Right side content
│   │           ├── /charts
│   │           │   ├── CandlestickChart.tsx
│   │           │   └── LevelsOverlay.tsx
│   │           └── /cards
│   │               ├── LevelsCard.tsx
│   │               └── PositionCard.tsx
│
├── /backend                                # NEW FOLDER
│   ├── /src
│   │   ├── /config
│   │   │   ├── database.ts
│   │   │   ├── massive.ts
│   │   │   └── redis.ts
│   │   ├── /services
│   │   │   ├── /levels
│   │   │   │   ├── fetcher.ts
│   │   │   │   ├── /calculators
│   │   │   │   │   ├── pivots.ts
│   │   │   │   │   ├── premarket.ts
│   │   │   │   │   ├── previousDay.ts
│   │   │   │   │   ├── vwap.ts
│   │   │   │   │   └── atr.ts
│   │   │   │   ├── cache.ts
│   │   │   │   └── index.ts
│   │   │   └── /options
│   │   │       └── greeks.ts
│   │   ├── /chatkit
│   │   │   ├── config.ts
│   │   │   ├── functions.ts
│   │   │   └── prompts.ts
│   │   ├── /routes
│   │   │   ├── health.ts
│   │   │   ├── levels.ts
│   │   │   ├── charts.ts
│   │   │   └── chatkit.ts
│   │   ├── /middleware
│   │   │   ├── auth.ts
│   │   │   └── rateLimiting.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
│
├── /supabase
│   └── /migrations
│       ├── 20260203000001_ai_coach_schema.sql
│       ├── 20260203000002_ai_coach_rls.sql
│       └── 20260203000003_ai_coach_functions.sql
│
├── /docs
│   └── /ai-coach
│       └── [all the docs you already have]
│
└── .env.local                             # Environment variables (gitignored)
```

---

## 🎓 Learning Resources (If Stuck)

- **Node.js/Express**: https://expressjs.com/en/starter/hello-world.html
- **TypeScript**: https://www.typescriptlang.org/docs/handbook/intro.html
- **Next.js**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Massive.com API**: https://massive.com/docs
- **OpenAI ChatKit**: https://platform.openai.com/docs/guides/chatkit
- **TradingView Charts**: https://tradingview.github.io/lightweight-charts/
- **Redis**: https://redis.io/docs/getting-started/

---

## 📝 Implementation Checklist

Before you start, print this and check off as you go:

### Pre-Development
- [ ] Read MASTER_SPEC.md
- [ ] Read IMPLEMENTATION_ROADMAP.md
- [ ] Read DATABASE_SCHEMA.md
- [ ] Read CENTER_COLUMN_DESIGN.md
- [ ] Read API_CONTRACTS.md
- [ ] Massive.com account created and paid
- [ ] OpenAI API account created
- [ ] All environment variables set
- [ ] Development environment ready

### Phase 1: Infrastructure
- [ ] Backend server running
- [ ] Database connected
- [ ] Redis connected
- [ ] Massive.com API test call works
- [ ] Health endpoint returns 200

### Phase 2: Database
- [ ] All 7 tables created
- [ ] RLS policies working
- [ ] Can insert and query test data
- [ ] Foreign keys enforced

### Phase 3: Levels Engine
- [ ] Fetch historical data from Massive.com
- [ ] Calculate PDH/PDL/PDC correctly
- [ ] Calculate PMH/PML correctly
- [ ] Calculate standard pivots correctly
- [ ] Calculate VWAP correctly
- [ ] Calculate ATR correctly
- [ ] Results cached in Redis
- [ ] API endpoint returns correct JSON
- [ ] Levels match TradingView (validated manually)

### Phase 4: AI Chat
- [ ] AI Coach tab visible
- [ ] ChatKit renders
- [ ] Can send messages
- [ ] AI calls get_key_levels function
- [ ] AI responds with correct data
- [ ] Response time <3 seconds
- [ ] Usage count increments
- [ ] Tier limits enforced

### Phase 5: Charts
- [ ] Chart component renders
- [ ] Candles display correctly
- [ ] Levels overlaid on chart
- [ ] Can switch timeframes
- [ ] Zoom/pan smooth
- [ ] Loads in <1 second

### Deployment
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway
- [ ] Database migrations run on Supabase
- [ ] Redis connected (Upstash)
- [ ] Environment variables set in production
- [ ] Smoke tests passing
- [ ] Monitoring configured

---

## 🚦 You're Ready to Start When...

- [x] You've read this entire document
- [ ] You've read MASTER_SPEC.md
- [ ] You've read IMPLEMENTATION_ROADMAP.md
- [ ] You have all required accounts (Massive.com, OpenAI, etc.)
- [ ] You have access to TITM repository
- [ ] Your development environment is set up
- [ ] You understand you'll follow phases in order, no skipping

**Once all checkboxes are checked, you can start Phase 1 - Infrastructure Setup.**

---

**Remember**: The goal is autonomous implementation. If you need to ask Nate a question, it means the docs are incomplete. Flag it, make a best guess, and continue. Document your assumptions.

Good luck! 🚀

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Initial developer handoff guide with 5-phase implementation plan |
