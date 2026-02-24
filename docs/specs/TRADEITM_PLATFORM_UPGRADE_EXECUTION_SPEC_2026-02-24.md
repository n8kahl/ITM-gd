# TradeITM Platform Upgrade — Unified Execution Spec

**Codename:** Project Phoenix
**Date:** 2026-02-24
**Author:** Claude (Orchestrator Agent)
**Status:** PROPOSED — Awaiting Approval
**Approver:** Nate (Product Owner)

---

## Executive Summary

This spec unifies three interconnected workstreams into a single coordinated execution plan:

1. **SPX Command Center Phase 18** — Transform the setup detector from a scanner into a strategic coach using all paid Massive.com data
2. **AI Coach Simplification** — Collapse 14-view dashboard into chat + chart two-panel experience
3. **Trade Journal Intelligence** — Add behavioral analytics, smart capture, and workflow integration on top of existing solid infrastructure

These three features share data pipelines, state management, and user workflows. Executing them as independent projects would create integration debt. This spec sequences them to share infrastructure, avoid rework, and deliver a coherent product where the SPX Command Center generates setups, the AI Coach explains them, and the Journal tracks and learns from them.

### Scope Summary

| Metric | Before | After |
|--------|--------|-------|
| AI Coach center panel views | 14 | 3 |
| AI Coach components | 46 | ~28 |
| AI Coach functions | 37 | ~25 |
| Massive.com endpoints used | 10 of 27+ | 22 of 27+ |
| Setup detector false triggers | 38% | <12% |
| Win rate (0DTE, Massive bars) | 56% | 64%+ |
| R:R ratio | 1.28:1 | 1.6:1+ |
| Journal bias detection | None | 5 cognitive biases |
| Journal workflow integration | Standalone | Embedded (plan → execute → review) |
| Backend routes removed | 0 | 5 |
| Frontend files deleted | 0 | 13+ |
| Dead API client code removed | 0 | ~500 lines |
| Database tables archived | 0 | 6 |

### Timeline

| Phase | Name | Duration | Focus |
|-------|------|----------|-------|
| 1 | Foundation & Cleanup | 2 weeks | AI Coach strip-down, data pipeline scaffolding, DB migrations |
| 2 | SPX Intelligence Core | 3 weeks | Setup detector overhaul, Massive.com integration, environment gate |
| 3 | AI Coach Rebuild | 2 weeks | Chat cards, smart chart overlays, mobile simplification |
| 4 | Journal Intelligence | 2 weeks | Behavioral analytics, smart capture, workflow integration |
| 5 | Integration & Polish | 1 week | Cross-feature wiring, E2E testing, performance audit |

**Total: ~10 weeks (50 working days)**

---

## Phase 1: Foundation & Cleanup (Weeks 1-2)

**Objective:** Remove dead code from AI Coach, establish shared data pipelines, and create the database schema extensions needed by all three workstreams. This phase produces no user-visible changes but creates a clean foundation.

### PR 1.1: AI Coach — Soft Removal of Deleted Views
**Duration:** 2 days
**Agent:** Frontend Agent
**Risk:** Low (additive removal, no feature deletion yet)

**Changes:**
- Remove 9 view types from `TABS` array in `center-panel.tsx` (lines 236-254)
- Remove 9 entries from `ROUTABLE_VIEWS` set (lines 268-281)
- Remove 8 `onShow*` callbacks from WelcomeView props (lines 1137-1186)
- Redirect URL params for deleted views to `'chart'`
- Components still exist but are unreachable from UI

**Files touched:**
```
components/ai-coach/center-panel.tsx        (MODIFY — remove tab entries, routable views, welcome callbacks)
app/members/ai-coach/page.tsx               (MODIFY — remove search param handling for deleted views)
```

**Acceptance criteria:**
- [ ] No tab, button, or link navigates to any deleted view
- [ ] Direct URL `?view=alerts` redirects to chart view
- [ ] All existing chat functions still work
- [ ] `tsc --noEmit` passes

**Validation gate:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint components/ai-coach/center-panel.tsx app/members/ai-coach/page.tsx
```

---

### PR 1.2: AI Coach — Delete Frontend Components (13 files)
**Duration:** 2 days
**Agent:** Frontend Agent
**Risk:** Medium (many imports to clean)

**Changes:**
- Delete 13 component files:
  ```
  components/ai-coach/position-tracker.tsx
  components/ai-coach/position-form.tsx
  components/ai-coach/leaps-dashboard.tsx
  components/ai-coach/alerts-panel.tsx
  components/ai-coach/opportunity-scanner.tsx
  components/ai-coach/tracked-setups-panel.tsx
  components/ai-coach/watchlist-panel.tsx
  components/ai-coach/workflow-breadcrumb.tsx
  components/ai-coach/mobile-quick-access-bar.tsx
  components/ai-coach/widget-action-bar-v2.tsx
  components/ai-coach/earnings-dashboard.tsx
  components/ai-coach/macro-context.tsx
  components/ai-coach/morning-brief.tsx
  ```
- Remove 12 import statements from `center-panel.tsx` (lines 39-52)
- Remove 9 rendering blocks from view switch statement (lines 1232-1355)
- Simplify `CenterView` type union: 14 → 3 values (`'chart' | 'options' | 'journal'`)
- Remove `MobileQuickAccessBar` import and rendering from `page.tsx`
- Delete `components/ai-coach/trade-journal.tsx` (duplicate journal in AI Coach)

**Shared state cleanup:**
- Simplify `WorkflowCenterView` in `contexts/AICoachWorkflowContext.tsx`: remove 9 values
- Remove `pendingAlert: WorkflowAlertPrefill` from state
- Remove `createAlertAtLevel()`, `trackPosition()` callbacks
- Delete `WorkflowAlertPrefill` interface
- Remove breadcrumb trail logic from `workflowPath`

**Widget action cleanup:**
- Remove `alertAction()` from `widget-actions.ts`
- Remove deleted view cases from `viewAction()`
- Remove `loadTopSetup()` and "Next Best Setup" badge from `desktop-context-strip.tsx`

**Files touched:**
```
DELETE (15 files):
  components/ai-coach/position-tracker.tsx
  components/ai-coach/position-form.tsx
  components/ai-coach/leaps-dashboard.tsx
  components/ai-coach/alerts-panel.tsx
  components/ai-coach/opportunity-scanner.tsx
  components/ai-coach/tracked-setups-panel.tsx
  components/ai-coach/watchlist-panel.tsx
  components/ai-coach/workflow-breadcrumb.tsx
  components/ai-coach/mobile-quick-access-bar.tsx
  components/ai-coach/widget-action-bar-v2.tsx
  components/ai-coach/earnings-dashboard.tsx
  components/ai-coach/macro-context.tsx
  components/ai-coach/morning-brief.tsx
  components/ai-coach/trade-journal.tsx
  components/ai-coach/journal-insights.tsx

MODIFY (6 files):
  components/ai-coach/center-panel.tsx
  components/ai-coach/widget-actions.ts
  components/ai-coach/desktop-context-strip.tsx
  contexts/AICoachWorkflowContext.tsx
  app/members/ai-coach/page.tsx
  components/ai-coach/mobile-tool-sheet.tsx
```

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `pnpm exec eslint .` passes on all modified files
- [ ] `pnpm run build` succeeds
- [ ] AI Coach page loads with chart as default view
- [ ] Chat functions still work (earnings, macro, brief render as text responses for now)
- [ ] Mobile tool sheet only shows options and journal overlays

**Validation gate:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm run build
```

---

### PR 1.3: AI Coach — Delete Backend Routes, Schemas & API Client Dead Code
**Duration:** 1.5 days
**Agent:** Backend Agent

**Backend route deletion (5 files):**
```
DELETE:
  backend/src/routes/alerts.ts
  backend/src/routes/scanner.ts
  backend/src/routes/trackedSetups.ts
  backend/src/routes/watchlist.ts
  backend/src/routes/leaps.ts
```

**Route registration removal** (in `backend/src/index.ts` or `backend/src/app.ts`):
- Remove `app.use('/api/alerts', ...)`
- Remove `app.use('/api/scanner', ...)`
- Remove `app.use('/api/tracked-setups', ...)`
- Remove `app.use('/api/watchlist', ...)`
- Remove `app.use('/api/leaps', ...)`

**Schema deletion (4 files):**
```
DELETE:
  backend/src/schemas/alertsValidation.ts
  backend/src/schemas/alerts.ts
  backend/src/schemas/trackedSetupsValidation.ts
  backend/src/schemas/watchlistValidation.ts
```

**Service cleanup:**
```
DELETE:
  backend/src/services/leaps/     (entire directory)

MODIFY:
  backend/src/services/setupPushChannel.ts (remove publishSetupStatusUpdate if only tracked setups consumed it)
```

**ChatKit function registry cleanup:**
- Remove `set_alert` and `get_alerts` function definitions from `backend/src/chatkit/functions.ts`
- Remove corresponding handlers from `backend/src/chatkit/functionHandlers.ts`

**API client cleanup (`lib/api/ai-coach.ts`, ~500 lines removed):**
```
DELETE blocks:
  Alert types/interfaces/functions     (lines ~1913-2048)
  Scanner types/interfaces/functions   (lines ~2050-2113)
  Watchlist types/interfaces/functions (lines ~2116-2254)
  TrackedSetups types/interfaces/functions (lines ~2335-2490)
  setMorningBriefViewed()              (no panel to mark as viewed)
  getTrades(), createTrade(), deleteTrade(), getTradeAnalytics()  (AI Coach duplicates)

DELETE shared lib:
  lib/ai-coach/tracked-setups.ts       (only consumer was deleted panel)
```

**Test file cleanup:**
```
DELETE:
  backend/src/routes/__tests__/alerts.test.ts
  backend/src/routes/__tests__/scanner.test.ts
  backend/src/routes/__tests__/trackedSetups.test.ts
  backend/src/routes/__tests__/watchlist.test.ts

UPDATE:
  backend/src/schemas/__tests__/validation.test.ts   (remove deleted schema tests)
  backend/src/chatkit/__tests__/*                     (remove deleted handler tests)
  e2e/ai-coach-*.spec.ts                              (remove panel navigation tests)
```

**Acceptance criteria:**
- [ ] Backend `tsc --noEmit` passes
- [ ] Frontend `tsc --noEmit` passes (no broken imports from deleted API client code)
- [ ] `pnpm run build` succeeds
- [ ] Backend starts without errors
- [ ] Remaining chat functions (earnings, macro, brief, position analysis) still work

**Validation gate:**
```bash
cd backend && npx tsc --noEmit
cd .. && pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
```

---

### PR 1.4: Database — Archive Deleted Tables & Add New Schema Extensions
**Duration:** 1.5 days
**Agent:** Database Agent

**Migration 1: Archive AI Coach tables**
```sql
-- supabase/migrations/YYYYMMDD_archive_ai_coach_deleted_tables.sql

-- Archive (retain data 90 days before DROP)
ALTER TABLE IF EXISTS ai_coach_alerts RENAME TO archived_ai_coach_alerts;
ALTER TABLE IF EXISTS ai_coach_watchlists RENAME TO archived_ai_coach_watchlists;
ALTER TABLE IF EXISTS ai_coach_tracked_setups RENAME TO archived_ai_coach_tracked_setups;
ALTER TABLE IF EXISTS ai_coach_leaps_positions RENAME TO archived_ai_coach_leaps_positions;
ALTER TABLE IF EXISTS ai_coach_opportunities RENAME TO archived_ai_coach_opportunities;

-- Drop RLS policies on archived tables (they reference deleted application logic)
DROP POLICY IF EXISTS "Users can view own alerts" ON archived_ai_coach_alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON archived_ai_coach_alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON archived_ai_coach_alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON archived_ai_coach_alerts;
-- (repeat for all archived tables)
```

**Migration 2: Journal extensions for behavioral analytics**
```sql
-- supabase/migrations/YYYYMMDD_journal_setup_type_and_regime.sql

-- Add setup type linkage
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS setup_type TEXT,
  ADD COLUMN IF NOT EXISTS setup_id UUID;

-- Add structured regime tags (extracted from market_context JSONB)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS vix_at_entry NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS regime_trend TEXT,        -- 'trending_up' | 'trending_down' | 'ranging'
  ADD COLUMN IF NOT EXISTS regime_gex TEXT,           -- 'positive_gamma' | 'negative_gamma' | 'near_flip'
  ADD COLUMN IF NOT EXISTS time_bucket TEXT,          -- 'open' | 'mid_morning' | 'lunch' | 'power_hour' | 'close'
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Index for setup-type analytics
CREATE INDEX IF NOT EXISTS idx_journal_entries_setup_type
  ON journal_entries(user_id, setup_type) WHERE setup_type IS NOT NULL;

-- Index for regime analytics
CREATE INDEX IF NOT EXISTS idx_journal_entries_regime
  ON journal_entries(user_id, regime_trend, regime_gex) WHERE regime_trend IS NOT NULL;
```

**Migration 3: SPX level touch history (for cross-session memory)**
```sql
-- supabase/migrations/YYYYMMDD_spx_level_touches.sql

CREATE TABLE IF NOT EXISTS spx_level_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_price NUMERIC(10,2) NOT NULL,
  level_type TEXT NOT NULL,           -- 'support' | 'resistance' | 'pivot' | 'gex'
  touch_timestamp TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL,              -- 'held' | 'bounced' | 'broke'
  volume_on_test NUMERIC(12,2),
  candle_pattern TEXT,
  approach_speed NUMERIC(8,4),        -- points per second
  session_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_level_touches_price ON spx_level_touches(level_price, session_date DESC);
CREATE INDEX idx_level_touches_session ON spx_level_touches(session_date DESC);

-- RLS: read-only for authenticated users (system writes via service role)
ALTER TABLE spx_level_touches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read level touches"
  ON spx_level_touches FOR SELECT
  TO authenticated
  USING (true);
```

**Migration 4: Options flow aggregation cache**
```sql
-- supabase/migrations/YYYYMMDD_options_flow_cache.sql

CREATE TABLE IF NOT EXISTS spx_options_flow_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL DEFAULT 'SPX',
  timestamp TIMESTAMPTZ NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 5,
  total_premium NUMERIC(14,2),
  call_premium NUMERIC(14,2),
  put_premium NUMERIC(14,2),
  sweep_count INTEGER DEFAULT 0,
  block_count INTEGER DEFAULT 0,
  net_delta NUMERIC(12,4),
  dominant_direction TEXT,           -- 'bullish' | 'bearish' | 'neutral'
  flow_score INTEGER,                -- 0-100
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flow_cache_timestamp ON spx_options_flow_cache(symbol, timestamp DESC);

ALTER TABLE spx_options_flow_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read flow cache"
  ON spx_options_flow_cache FOR SELECT
  TO authenticated
  USING (true);
```

**Acceptance criteria:**
- [ ] All migrations apply cleanly via `npx supabase db push`
- [ ] `get_advisors(type: "security")` returns no new critical issues
- [ ] `get_advisors(type: "performance")` returns no new critical issues
- [ ] Archived tables still queryable (for data recovery if needed)
- [ ] New tables have proper RLS policies
- [ ] Existing journal functionality unaffected (new columns are nullable)

**Validation gate:**
```bash
npx supabase db push
# Then run advisors via MCP
```

---

### PR 1.5: Shared Data Pipeline Scaffolding
**Duration:** 2 days
**Agent:** Backend Agent

**New services (scaffolding only — implementations in Phase 2):**
```
CREATE (skeleton files with interfaces, no business logic yet):
  backend/src/services/spx/environmentGate.ts       (~50 lines scaffold)
  backend/src/services/spx/stopEngine.ts             (~50 lines scaffold)
  backend/src/services/spx/multiTFConfluence.ts      (~50 lines scaffold)
  backend/src/services/spx/priceActionEngine.ts      (~50 lines scaffold)
  backend/src/services/spx/memoryEngine.ts           (~50 lines scaffold)
  backend/src/services/spx/eventRiskGate.ts          (~50 lines scaffold)
  backend/src/services/spx/flowAggregator.ts         (~50 lines scaffold)
  backend/src/services/journal/biasDetector.ts       (~50 lines scaffold)
  backend/src/services/journal/regimeTagging.ts      (~50 lines scaffold)
  backend/src/services/journal/contextBuilder.ts     (~50 lines scaffold)
```

**Extend Massive.com WebSocket subscriptions:**
- Add VIX, VVIX, SKEW to `massiveTickStream.ts`:
  ```
  V.I:VIX, V.I:VVIX, V.I:SKEW
  ```
- Add SPX per-minute aggregates stream: `AM.I:SPX`
- Create event emitter interface for downstream consumers

**Extend Massive.com REST client (`backend/src/config/massive.ts`):**
- Add typed methods for new endpoints:
  ```typescript
  getOptionsTrades(ticker: string, params?: TradesParams): Promise<OptionsTrade[]>
  getSPYTrades(params?: TradesParams): Promise<Trade[]>
  getMarketStatus(): Promise<MarketStatus>
  getNewsSentiment(tickers: string[], limit?: number): Promise<NewsArticle[]>
  getNetOrderImbalance(ticker: string): Promise<NOISnapshot>
  getShortInterest(ticker: string): Promise<ShortInterest>
  ```
- These are typed but not yet called by any business logic

**Acceptance criteria:**
- [ ] All scaffold files compile (`tsc --noEmit`)
- [ ] WebSocket subscribes to VIX, VVIX, SKEW, AM.I:SPX without errors
- [ ] New REST methods resolve with proper types (can be tested with manual calls)
- [ ] No changes to existing setup detector behavior

---

### Phase 1 Totals

| Metric | Count |
|--------|-------|
| PRs | 5 |
| Files deleted | 20+ |
| Files created | 10+ scaffold |
| Files modified | 15+ |
| Dead code removed | ~500 lines API client + routes |
| Database tables archived | 5-6 |
| Database tables created | 2 (level_touches, flow_cache) |
| Duration | ~9 working days |

---

## Phase 2: SPX Intelligence Core (Weeks 3-5)

**Objective:** Implement the 13 setup detector gaps and full Massive.com data integration. This is the highest-impact phase for win rate improvement.

### PR 2.1: VIX/Volatility Regime Gate & ATR-Based Stops
**Duration:** 3 days
**Agent:** SPX Engine Agent
**Impact:** Eliminates trading in hostile environments; fixes zone-edge-relative stops

**New files:**
```
backend/src/services/spx/environmentGate.ts   (implement ~250 lines)
backend/src/services/spx/stopEngine.ts         (implement ~200 lines)
```

**Changes to `setupDetector.ts`:**
- Import and call `environmentGate.evaluate()` before setup generation
- When gate fails: return `{ status: 'STANDBY', guidance: { waiting_for: [...], nearest_setup: {...} } }`
- Replace zone-edge-relative stop calculation (lines 2109-2128) with `stopEngine.calculate()`
- Stop formula: `stop = max(structuralSupport - buffer, entryPrice - 1.5 * ATR(14))`
- VIX scaling: low (<18) = 1.0x, elevated (18-25) = 1.3x, extreme (>25) = 1.6x
- GEX magnitude scaling: distance >500bp = ±20%, 200-500bp = ±10%, <200bp = ±5%

**Consumes from Phase 1:**
- VIX real-time stream (WebSocket V.I:VIX)
- ATR from minute bars (already fetching, extend calculation)

**Acceptance criteria:**
- [ ] System returns STANDBY when VIX > 28 with clear guidance messaging
- [ ] Stops widen 30%+ when VIX moves from 15 to 25
- [ ] GEX magnitude affects stop width proportionally
- [ ] Unit tests: 10+ scenarios covering regime boundaries
- [ ] No regression in existing setup generation for normal VIX

**Validation gate:**
```bash
pnpm vitest run lib/spx/__tests__/environmentGate.test.ts
pnpm vitest run lib/spx/__tests__/stopEngine.test.ts
pnpm exec tsc --noEmit
```

---

### PR 2.2: Setup Identity Stability & Trigger Bar Capture
**Duration:** 2 days
**Agent:** SPX Engine Agent
**Impact:** Fixes UI flipping; gives users trigger bar visibility

**Changes to `setupDetector.ts`:**
- Implement hash-based stable ID: `setupId = hashStableId(setupType, entryLevelPrice, direction, targetLevelPrice, geometryBucket)`
- Implement morphing: when levels recalculate, check if existing `stableIdHash` still valid → update rather than recreate
- Add trigger bar capture: `triggerBarTimestamp`, `triggerBarPatternType`, `triggerBarVolume`, `penetrationDepth`
- Implement `detectCandlePattern()` function (engulfing, doji, hammer, inverted_hammer)
- Calculate `triggerLatencyMs` on every refresh

**Type extensions (`lib/spx/types.ts`):**
```typescript
interface Setup {
  stableIdHash: string;
  triggerContext?: {
    triggerBarTimestamp: string;
    triggerBarPatternType: CandlePattern;
    triggerBarVolume: number;
    penetrationDepth: number;
    triggerLatencyMs: number;
  };
}
```

**Acceptance criteria:**
- [ ] 95%+ of setups maintain same ID across 5-bar window
- [ ] Trigger bar shows timestamp, pattern, volume, latency
- [ ] UI displays "Triggered 45s ago at 10:14:32 AM (bullish engulfing, +120% vol)"
- [ ] Unit tests: ID stability across recalculation cycles

---

### PR 2.3: Multi-Timeframe Confluence & Weighted Scoring
**Duration:** 3 days
**Agent:** SPX Engine Agent
**Impact:** Replaces additive binary scoring with weighted quality model; adds higher-TF confirmation

**New file:**
```
backend/src/services/spx/multiTFConfluence.ts  (implement ~300 lines)
```

**Changes:**
- Fetch 5m, 15m, 1h aggregates via Massive.com alongside 1m bars
- Calculate EMA 21/55 + slope on each timeframe
- Replace `confluenceScore: number` (1-5 count) with weighted model:
  - Each factor: strength 0-100 (not binary)
  - Weights: flow 30%, EMA alignment 25%, zone quality 20%, GEX 25%
  - Conditional caps: `if (zone_quality < 40) then max_score = 50`
- Make ready threshold adaptive:
  - Base 3.0 + (VIX adjustment) + (time-of-day adjustment) + (trend clarity adjustment)
- Add `confluenceBreakdown` to Setup type for UI transparency

**Acceptance criteria:**
- [ ] Confluence score reflects weighted quality, not binary count
- [ ] 5 weak signals no longer equals 3 strong signals
- [ ] Higher timeframe alignment adds 15-25 confluence points
- [ ] Dynamic threshold gates out low-quality setups in choppy markets

---

### PR 2.4: Options Flow Aggregator (Tier 1 Massive.com Data)
**Duration:** 3 days
**Agent:** Backend Agent
**Impact:** Detects institutional sweeps/blocks; adds flow score to confluence

**New file:**
```
backend/src/services/spx/flowAggregator.ts     (implement ~400 lines)
```

**Implementation:**
- Poll `GET /v3/trades/{optionTicker}?limit=50000&order=desc` every 5 seconds for active SPX strikes
- Classify trades: sweep (multi-exchange), block (single large), print (standard)
- Aggregate into 5-minute windows:
  - Total premium (call/put split)
  - Sweep count, block count
  - Net delta
  - Dominant direction
  - Flow score (0-100)
- Persist to `spx_options_flow_cache` table
- Feed flow_score into confluence model (30% weight)

**Also integrates:**
- SPY tick trades (`GET /v3/trades/SPY`) for volume delta analysis
- Net Order Imbalance (`GET /v2/snapshot/.../noi`) for market-wide directional bias

**Acceptance criteria:**
- [ ] Flow aggregator produces flow_score 0-100 every 5 minutes during market hours
- [ ] Sweep/block classification matches manual validation on ≥10 known events
- [ ] Flow score integrated into confluence model
- [ ] Persists to Supabase for historical analysis

---

### PR 2.5: Price Action Engine & Cross-Session Memory
**Duration:** 3 days
**Agent:** SPX Engine Agent
**Impact:** Zone touch history, candle context, structural memory across sessions

**New files:**
```
backend/src/services/spx/priceActionEngine.ts  (implement ~250 lines)
backend/src/services/spx/memoryEngine.ts       (implement ~200 lines)
```

**Price Action Engine:**
- Track zone touch events in `spx_level_touches` table
- Record: timestamp, outcome (held/bounced/broke), volume, candle pattern, approach speed
- Score zone quality: first touch + doji + slow approach = high quality; 4th touch + volume decline = low quality
- Feed into confluence scoring

**Memory Engine:**
- Query `spx_level_touches` + `spx_setup_instances` for past 5 sessions
- Calculate historical win rate by level (±2.5 points)
- Feed into confluence: tested level with >60% win rate = +20 confluence points
- Surface in UI: "5890 tested 12 times in past 5 days; won 7 (58% strike rate)"

**Acceptance criteria:**
- [ ] Zone touches persisted with outcomes
- [ ] Historical win rate per level available within 100ms
- [ ] UI shows zone test history metadata
- [ ] Confluence scoring includes zone quality and memory factors

---

### PR 2.6: Event Risk Gate & Market Status Integration
**Duration:** 2 days
**Agent:** Backend Agent
**Impact:** Prevents trading through FOMC/CPI/NFP; adds session awareness

**New file:**
```
backend/src/services/spx/eventRiskGate.ts      (implement ~200 lines)
```

**Implementation:**
- Integrate economic calendar (FRED API or Massive.com news)
- Define blackout windows: 1 hour before major events (FOMC, CPI, NFP)
- Define caution windows: 2 hours before (require +1 confluence point)
- Market status API (`GET /v1/marketstatus`): detect pre/open/close/after-hours
- Session time gates: avoid last 15 minutes unless setup-specific override
- Post-event vol compression detection: if realized vol < (implied vol - 20%) → require +0.5 threshold

**Acceptance criteria:**
- [ ] STANDBY returned 1 hour before FOMC with explanation
- [ ] Caution-window setups require higher confluence
- [ ] Session time awareness prevents late-day false triggers
- [ ] Market status correctly classifies current session

---

### PR 2.7: Adaptive EV Formula & News Sentiment
**Duration:** 2 days
**Agent:** SPX Engine Agent
**Impact:** More accurate expected value; news risk awareness

**Changes:**
- Replace fixed 1R loss assumption with empirical loss distribution
- Regime-adjust T1/T2 hit rates (high VIX → more T1 exits, low VIX → more T2 holds)
- Time-decay adjustment: -0.05 pWin after 2pm ET
- Slippage model: use real bid-ask spreads from Massive.com options quotes
- Integrate news sentiment (`GET /v2/reference/news`) as risk flag
- Short interest/volume as squeeze context

**Acceptance criteria:**
- [ ] EV varies by ≥10% between low and high VIX regimes
- [ ] T1/T2 blend ratios adapt to volatility
- [ ] News flag surfaces when recent macro surprise detected
- [ ] Unit tests cover all regime/time combinations

---

### Phase 2 Totals

| Metric | Count |
|--------|-------|
| PRs | 7 |
| New backend services | 7 (fully implemented) |
| Setup detector gaps addressed | All 13 |
| Massive.com endpoints integrated | 12 new |
| Duration | ~18 working days |

---

## Phase 3: AI Coach Rebuild (Weeks 6-7)

**Objective:** Rebuild the AI Coach center panel as a permanent chart canvas with conversation-driven overlays, and enhance chat cards to replace deleted panels.

### PR 3.1: Enhanced Chat Cards (Replace Panel Views)
**Duration:** 3 days
**Agent:** Frontend Agent

**New/enhanced components:**
```
components/ai-coach/widget-cards.tsx     (ENHANCE — add 6 new card types)
```

**New card types:**
- `GamePlanCard` — SPX game plan with levels, bias, key zones, `[Show on Chart]` action
- `EarningsCard` — Earnings date, expected move, IV rank, historical context
- `MacroCard` — Key economic indicators, Fed stance, sector rotation
- `MorningBriefCard` — Overnight gaps, pre-market levels, what to watch
- `PositionAnalysisCard` — P&L, Greeks, risk metrics, management advice
- `ScanResultsCard` — Top 3 opportunities with entry/target/stop

Each card includes:
- `[Show on Chart]` action that sends levels/annotations to the chart
- Expandable sections for detailed data
- Mini inline charts where appropriate
- Consistent Emerald Standard styling

**Backend changes:**
- Update function handlers to return structured card data (not just text)
- Ensure `get_earnings_analysis`, `get_macro_context`, `get_morning_brief` return card-friendly payloads

**Acceptance criteria:**
- [ ] "morning brief" chat message renders MorningBriefCard inline
- [ ] "NVDA earnings" renders EarningsCard inline
- [ ] "macro context" renders MacroCard inline
- [ ] `[Show on Chart]` on any card paints relevant data onto chart
- [ ] Cards render correctly on mobile (full-width, no overflow)

---

### PR 3.2: Chart as Permanent Canvas with Smart Overlays
**Duration:** 3 days
**Agent:** Frontend Agent

**Changes to `center-panel.tsx`:**
- Chart is always rendered as base layer (never switches away)
- Options chain becomes slide-over panel (70% width, overlays chart)
- Journal becomes slide-over panel (reuses existing journal components)
- New `ChartOverlay` type: `'options' | 'journal' | null`
- Chart accepts conversation-driven annotations:
  - Key levels (horizontal lines at PDH, PDL, VWAP, pivots)
  - GEX zones (shaded regions)
  - Earnings date markers (vertical line with expected move range)
  - Position entry/exit markers (colored dots with P&L)
  - Journal entry markers (historical trades plotted on chart)

**New state model (`AICoachWorkflowContext`):**
```typescript
interface AICoachState {
  activeSymbol: string;
  chartTimeframe: ChartTimeframe;
  chartLevels: ChartLevel[];
  chartAnnotations: ChartAnnotation[];
  chartOverlay: 'options' | 'journal' | null;
  conversationContext: {
    lastTopic: string;
    mentionedSymbols: string[];
    activeAnalysis: 'gameplan' | 'earnings' | 'macro' | 'position' | null;
  };
}
```

**New components:**
```
components/ai-coach/chart-slide-over.tsx       (generic slide-over wrapper)
components/ai-coach/journal-slide-over.tsx      (journal slide-over, reuses journal components)
```

**Acceptance criteria:**
- [ ] Chart is always visible, never replaced by another view
- [ ] Options chain opens as slide-over, chart still visible behind
- [ ] Journal opens as slide-over, chart still visible behind
- [ ] Chat-driven annotations appear on chart within 500ms of AI response
- [ ] Slide-overs close with Escape key and outside click

---

### PR 3.3: Mobile Simplification
**Duration:** 2 days
**Agent:** Frontend Agent

**Changes:**
- Mobile: Chat (full screen, default) → tap chart icon → Chart (full screen) with mini-chat overlay
- Remove MobileQuickAccessBar (already deleted in Phase 1)
- Simplify MobileToolSheet to only handle 2 overlays (options, journal)
- Mini-chat overlay on chart view stays functional
- Swipe gesture between chat and chart

**Acceptance criteria:**
- [ ] Mobile has exactly 2 states: chat or chart
- [ ] Mini-chat overlay on chart is functional
- [ ] Options/journal open as bottom sheets on mobile
- [ ] No lost functionality vs current mobile experience

---

### Phase 3 Totals

| Metric | Count |
|--------|-------|
| PRs | 3 |
| New card types | 6 |
| New components | 2 (slide-overs) |
| Modified components | 5 |
| Duration | ~8 working days |

---

## Phase 4: Journal Intelligence (Weeks 8-9)

**Objective:** Add behavioral analytics, smart capture, and workflow integration to the Trade Journal. No existing journal components are deleted — this is additive.

### PR 4.1: Behavioral Analytics Engine
**Duration:** 4 days
**Agent:** Backend Agent + Frontend Agent

**New backend services (implement from Phase 1 scaffolds):**
```
backend/src/services/journal/biasDetector.ts     (implement ~350 lines)
backend/src/services/journal/regimeTagging.ts    (implement ~200 lines)
```

**Bias Detection (5 cognitive biases):**
- **Overconfidence:** Position size increases after consecutive wins (compare avg size in win streaks vs baseline)
- **Revenge trading:** Trade frequency spikes after losses (compare inter-trade intervals post-loss vs baseline)
- **Anchoring:** Entries cluster near round numbers or previous day's close (distribution analysis)
- **Disposition effect:** Winners closed too early, losers held too long (MFE/MAE ratio analysis)
- **Recency bias:** Setup selection correlates with most recent outcome (autocorrelation of setup_type → outcome)

Minimum 20 trades required before surfacing any bias score. Include confidence intervals.

**Regime Tagging:**
- Auto-tag every new journal entry with:
  - `vix_at_entry` (from engine state)
  - `regime_trend` ('trending_up' | 'trending_down' | 'ranging')
  - `regime_gex` ('positive_gamma' | 'negative_gamma' | 'near_flip')
  - `time_bucket` ('open' | 'mid_morning' | 'lunch' | 'power_hour' | 'close')
- Backfill existing entries where `market_context` JSONB contains the data

**New API endpoint:**
```
GET /api/members/journal/analytics/behavioral
  → { biases: BiasScore[], regimeBreakdown: RegimeStats[], setupPerformance: SetupStats[] }
```

**New frontend components:**
```
components/journal/bias-insights-card.tsx       (bias detection display with evidence)
components/journal/regime-breakdown.tsx          (regime-aware analytics charts)
components/journal/setup-performance.tsx         (setup-type breakdown table)
```

**Integrate into `analytics-dashboard.tsx`:**
- New section: "Coaching Insights" with bias scores
- New section: "Performance by Regime" with breakdown charts
- New section: "Setup Type Analysis" with win rate / R:R by setup

**Acceptance criteria:**
- [ ] Bias detector identifies at least 3 patterns in test dataset of 50+ trades
- [ ] Regime breakdowns show statistically meaningful differences
- [ ] Setup performance links journal entries to SPX setup types
- [ ] Analytics load within 2 seconds for 500+ trade history
- [ ] Confidence intervals shown for all metrics with <30 sample size

---

### PR 4.2: Smart Capture — Auto-Draft & Psychology Prompts
**Duration:** 3 days
**Agent:** Frontend Agent + Backend Agent

**Auto-Draft on Position Close:**
- When SPX Command Center detects position close (setup lifecycle event):
  - Create draft journal entry with pre-filled fields:
    - symbol, direction, contract_type, entry_price, exit_price, P&L, hold_duration
    - setup_type from setup detector
    - market_context (VWAP, ATR, regime, GEX state at entry and exit)
    - vix_at_entry, regime_trend, regime_gex, time_bucket
  - Set `is_draft: true`
  - Show notification: "Trade closed: SPX 5850P +$120. Tap to complete your journal entry."

**New components:**
```
components/journal/draft-notification.tsx       (toast/badge notification for drafts)
```

**Psychology Prompt:**
- 5-minute timer after draft creation
- Prompt: "How are you feeling about this trade?" with mood selector + single text field
- Captures psychology while fresh
- Respects "don't ask again this session" toggle

**Enhanced screenshot extraction:**
- Auto-detect broker from screenshot layout patterns
- Extract P&L, position size, Greeks from screenshot (not just symbol/direction)
- Pre-fill market_context from current engine state

**Acceptance criteria:**
- [ ] Draft created automatically when SPX CC reports position close
- [ ] Draft notification appears within 3 seconds of close
- [ ] Psychology prompt fires at 5-minute mark
- [ ] Pre-filled data is ≥80% accurate for SPX CC-originated trades
- [ ] Manual entry flow unchanged for non-SPX trades

---

### PR 4.3: Workflow Integration — Pre-Trade Context & AI Coach Wiring
**Duration:** 3 days
**Agent:** Frontend Agent + Backend Agent

**Pre-Trade Context Widget:**

New API endpoint:
```
GET /api/members/journal/context?setupType=bull_bounce&symbol=SPX
  → { recentTrades: 5, winRate: 40%, avgPnl: -$85, bestTimeOfDay: '10:30-11:00', streak: -2 }
```

New component:
```
components/journal/pre-trade-context.tsx        (compact widget for SPX CC)
```

Integrate into SPX Command Center setup cards: small "Journal Context" overlay showing historical performance for this setup type.

**AI Coach Journal Integration:**
- Update `get_journal_insights` function handler to include bias detection results
- Update `get_trade_history` function handler to accept setup_type filter
- Add `journal_context` function for pre-trade context lookups
- Enhance AI grading to use journal history:
  - Include user's recent history for this setup type in grading prompt
  - Enable contextual coaching: "I notice you consistently exit early on winners..."

**Chart Journal Markers:**
- Plot journal entries as markers on the trading chart
- Entry points (green up arrow for long, red down arrow for short)
- Exit points (connected with P&L color line)
- Hover shows entry details

**Acceptance criteria:**
- [ ] Pre-trade context widget appears on SPX CC setup cards
- [ ] AI Coach `get_journal_insights` includes bias detection
- [ ] AI grading references historical performance context
- [ ] Journal entries visible as chart markers in AI Coach
- [ ] Context widget loads within 200ms (cached)

---

### Phase 4 Totals

| Metric | Count |
|--------|-------|
| PRs | 3 |
| New backend services | 2 (fully implemented) + 1 API endpoint |
| New frontend components | 5 |
| Modified components | 4 (analytics dashboard, setup cards, AI grading, chart) |
| Duration | ~10 working days |

---

## Phase 5: Integration & Polish (Week 10)

**Objective:** Cross-feature testing, performance optimization, bundle audit, and release readiness.

### PR 5.1: End-to-End Integration Testing
**Duration:** 2 days
**Agent:** QA Agent

**Test scenarios:**
1. **Full trading loop:** SPX CC generates setup → User asks AI Coach about it → User enters trade → Position closes → Journal auto-drafts → User completes entry → AI grades with context → Analytics update
2. **AI Coach chat-first flow:** User types "morning brief" → Rich card renders → User clicks "Show on Chart" → Chart updates → User asks follow-up → AI responds with context
3. **Journal behavioral analytics:** Import 50+ test trades → Verify bias detection → Verify regime breakdowns → Verify setup performance
4. **Mobile flow:** Chat → Chart (swipe) → Options (bottom sheet) → Journal (bottom sheet) → Back to chat
5. **STANDBY mode:** Set VIX > 28 in test env → Verify SPX CC shows STANDBY with guidance → Verify AI Coach explains why

**New E2E specs:**
```
e2e/phoenix-trading-loop.spec.ts
e2e/phoenix-ai-coach-chat-first.spec.ts
e2e/phoenix-journal-analytics.spec.ts
e2e/phoenix-mobile-flow.spec.ts
```

**Acceptance criteria:**
- [ ] All 5 integration scenarios pass
- [ ] No accessibility violations (axe-core)
- [ ] Response times < 500ms p95 for all API endpoints
- [ ] WebSocket reconnection within 3 seconds

---

### PR 5.2: Performance Audit & Bundle Optimization
**Duration:** 2 days
**Agent:** Frontend Agent + Backend Agent

**Frontend:**
- `pnpm analyze` — compare before/after bundle sizes
- Target: AI Coach route chunk reduced by ≥15KB
- Verify no new client-side bundle increase > 10KB without justification
- Lighthouse audit on `/members/ai-coach` and `/members/journal` (target ≥90)
- Lazy-load new analytics components

**Backend:**
- Profile Massive.com API call latency
- Verify flow aggregator doesn't exceed rate limits
- Redis caching for journal context lookups
- Connection pooling for new Supabase queries

**Acceptance criteria:**
- [ ] AI Coach bundle size decreased vs baseline
- [ ] Lighthouse ≥90 on member-facing routes
- [ ] No API endpoint >500ms p95
- [ ] Massive.com rate limits respected with headroom

---

### PR 5.3: Final Cleanup & Documentation
**Duration:** 1 day
**Agent:** Docs Agent + Orchestrator

**Dead export scan:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint . --rule 'no-unused-vars: error'
```

**Documentation updates:**
- Update `CLAUDE.md` Section 5 (Feature Registry) with new architecture
- Write release notes: `docs/specs/PHOENIX_RELEASE_NOTES_2026-XX-XX.md`
- Write runbook: `docs/specs/PHOENIX_RUNBOOK_2026-XX-XX.md`
- Update AI Coach docs in `docs/ai-coach/`
- Archive superseded specs

**Acceptance criteria:**
- [ ] Zero dead exports or unused imports
- [ ] All documentation current
- [ ] Release notes cover all user-visible changes
- [ ] Runbook covers operational procedures for new services

---

### Phase 5 Totals

| Metric | Count |
|--------|-------|
| PRs | 3 |
| E2E test specs | 4 new |
| Documentation files | 3+ updated/created |
| Duration | ~5 working days |

---

## Release Gates (Must Pass Before Deploy)

```bash
# Full validation suite
pnpm exec eslint .                                  # Zero warnings
pnpm exec tsc --noEmit                              # Zero errors
pnpm run build                                       # Successful production build
pnpm vitest run                                      # All unit tests pass
pnpm vitest run lib/spx/__tests__                    # All SPX engine tests pass
pnpm exec playwright test --project=chromium --workers=1  # All E2E tests pass
pnpm analyze                                         # Bundle size within targets
```

**Runtime requirement:** All gates validated under Node >= 22.

**Security check:**
```
get_advisors(type: "security")   # No new critical issues
get_advisors(type: "performance") # No new critical issues
```

---

## Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R1 | Massive.com rate limits exceeded by flow aggregator | Medium | High | Implement backoff, reduce polling to 10s if near limit, cache aggressively | Backend Agent |
| R2 | Setup detector regression during overhaul | Medium | Critical | Feature flag all changes; A/B test old vs new detector; rollback plan | SPX Engine Agent |
| R3 | AI Coach chat card UX feels less powerful than panels | Medium | Medium | Invest in card interactivity (expand, mini-charts, one-click chart actions) | Frontend Agent |
| R4 | Journal bias detection false positives on small sample | High | Medium | Minimum 20 trades required; show confidence intervals; "experimental" label | Backend Agent |
| R5 | Cross-feature integration issues during Phase 5 | Medium | Medium | Integration tests per-PR (not just Phase 5); shared type contracts | QA Agent |
| R6 | Users upset about removed AI Coach panels | Low | Medium | Announce in release notes; ensure chat equivalents work before removal | Frontend Agent |
| R7 | WebSocket connection instability with 3 additional streams | Low | High | Separate reconnection logic per stream; circuit breaker pattern | Backend Agent |
| R8 | Bundle size increases despite component deletion (new cards) | Low | Low | Lazy-load all new components; code-split analytics | Frontend Agent |

---

## Decision Log

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| D1 | Archive AI Coach tables (not DROP) | Preserve user data for 90-day recovery window | 2026-02-24 |
| D2 | Keep earnings/macro/brief backend routes | Chat functions still call them; only frontend panels removed | 2026-02-24 |
| D3 | Phase 1 cleanup before Phase 2 intelligence | Clean codebase before adding complexity; avoid merge conflicts | 2026-02-24 |
| D4 | Journal enhancement, not rebuild | Existing V2 schema and validation are solid; additive approach faster | 2026-02-24 |
| D5 | Feature flag setup detector changes | Critical path; must be rollback-safe | 2026-02-24 |
| D6 | Minimum 20 trades for bias detection | Statistical validity; avoid alarming users with unreliable scores | 2026-02-24 |

---

## Appendix A: Complete File Manifest

### Files to DELETE (20+)

```
# AI Coach frontend components (15)
components/ai-coach/position-tracker.tsx
components/ai-coach/position-form.tsx
components/ai-coach/leaps-dashboard.tsx
components/ai-coach/alerts-panel.tsx
components/ai-coach/opportunity-scanner.tsx
components/ai-coach/tracked-setups-panel.tsx
components/ai-coach/watchlist-panel.tsx
components/ai-coach/workflow-breadcrumb.tsx
components/ai-coach/mobile-quick-access-bar.tsx
components/ai-coach/widget-action-bar-v2.tsx
components/ai-coach/earnings-dashboard.tsx
components/ai-coach/macro-context.tsx
components/ai-coach/morning-brief.tsx
components/ai-coach/trade-journal.tsx
components/ai-coach/journal-insights.tsx

# Backend routes (5)
backend/src/routes/alerts.ts
backend/src/routes/scanner.ts
backend/src/routes/trackedSetups.ts
backend/src/routes/watchlist.ts
backend/src/routes/leaps.ts

# Backend schemas (4)
backend/src/schemas/alertsValidation.ts
backend/src/schemas/alerts.ts
backend/src/schemas/trackedSetupsValidation.ts
backend/src/schemas/watchlistValidation.ts

# Backend services (1 directory)
backend/src/services/leaps/

# Shared libs (1)
lib/ai-coach/tracked-setups.ts

# Tests (4+)
backend/src/routes/__tests__/alerts.test.ts
backend/src/routes/__tests__/scanner.test.ts
backend/src/routes/__tests__/trackedSetups.test.ts
backend/src/routes/__tests__/watchlist.test.ts
```

### Files to CREATE (20+)

```
# SPX Intelligence services (7)
backend/src/services/spx/environmentGate.ts
backend/src/services/spx/stopEngine.ts
backend/src/services/spx/multiTFConfluence.ts
backend/src/services/spx/priceActionEngine.ts
backend/src/services/spx/memoryEngine.ts
backend/src/services/spx/eventRiskGate.ts
backend/src/services/spx/flowAggregator.ts

# Journal Intelligence services (3)
backend/src/services/journal/biasDetector.ts
backend/src/services/journal/regimeTagging.ts
backend/src/services/journal/contextBuilder.ts

# Journal API route (1)
app/api/members/journal/context/route.ts

# AI Coach new components (2)
components/ai-coach/chart-slide-over.tsx
components/ai-coach/journal-slide-over.tsx

# Journal new components (5)
components/journal/bias-insights-card.tsx
components/journal/regime-breakdown.tsx
components/journal/setup-performance.tsx
components/journal/pre-trade-context.tsx
components/journal/draft-notification.tsx

# Database migrations (4)
supabase/migrations/YYYYMMDD_archive_ai_coach_deleted_tables.sql
supabase/migrations/YYYYMMDD_journal_setup_type_and_regime.sql
supabase/migrations/YYYYMMDD_spx_level_touches.sql
supabase/migrations/YYYYMMDD_options_flow_cache.sql

# E2E tests (4)
e2e/phoenix-trading-loop.spec.ts
e2e/phoenix-ai-coach-chat-first.spec.ts
e2e/phoenix-journal-analytics.spec.ts
e2e/phoenix-mobile-flow.spec.ts

# Documentation (3+)
docs/specs/PHOENIX_RELEASE_NOTES_2026-XX-XX.md
docs/specs/PHOENIX_RUNBOOK_2026-XX-XX.md
docs/specs/TRADEITM_PLATFORM_UPGRADE_EXECUTION_SPEC_2026-02-24.md (this file)
```

### Files to MODIFY (15+)

```
# AI Coach
components/ai-coach/center-panel.tsx
components/ai-coach/widget-cards.tsx
components/ai-coach/widget-actions.ts
components/ai-coach/desktop-context-strip.tsx
components/ai-coach/mobile-tool-sheet.tsx
contexts/AICoachWorkflowContext.tsx
app/members/ai-coach/page.tsx
lib/api/ai-coach.ts

# SPX Command Center
backend/src/services/spx/setupDetector.ts
backend/src/config/massive.ts
backend/src/services/massiveTickStream.ts
lib/spx/types.ts

# Journal
components/journal/analytics-dashboard.tsx
components/journal/full-entry-form.tsx
components/journal/ai-grade-display.tsx
lib/types/journal.ts
lib/validation/journal-entry.ts

# Backend infrastructure
backend/src/index.ts (or app.ts — route registration)
backend/src/chatkit/functions.ts
backend/src/chatkit/functionHandlers.ts
```
