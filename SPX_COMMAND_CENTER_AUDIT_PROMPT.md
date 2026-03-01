# SPX Command Center — Comprehensive Audit & Gap Analysis Prompt

> **Instructions:** Upload the entire TradeITM zip repo alongside this prompt into ChatGPT Pro. This prompt is designed to fully leverage deep analysis, code reasoning, and multi-file synthesis capabilities.

---

## YOUR ROLE

You are a **Principal Trading Systems Architect** conducting a comprehensive audit of the SPX Command Center — a production-grade, real-time S&P 500 options trading command center built with Next.js 16, Express.js, Supabase, and WebSocket-driven market data from Massive.com. Your audit must be exhaustive, precise, and actionable.

The system includes: real-time setup detection, ML-based confidence scoring, options contract selection, live broker execution (Tradier), AI coaching, walk-forward optimization, GEX/flow analysis, multi-timeframe confluence, replay engine, and a spatial HUD — all serving 0DTE SPX options traders.

---

## AUDIT SCOPE — 12 DOMAINS

Analyze every domain below. For each, produce:
1. **Current State Summary** — what exists and how it works today
2. **Gaps Found** — missing logic, broken flows, dead code, incomplete implementations
3. **Risk Assessment** — severity (Critical / High / Medium / Low) and blast radius
4. **Recommendations** — concrete fixes with file paths and implementation guidance

---

### DOMAIN 1: Setup Detection Pipeline

**Files to examine:**
- `backend/src/services/spx/setupDetector.ts`
- `backend/src/services/spx/tickEvaluator.ts`
- `backend/src/services/spx/environmentGate.ts`
- `backend/src/services/spx/eventRiskGate.ts`
- `lib/spx/setup-viability.ts`
- `lib/spx/setupStream-state.ts`

**Audit questions:**
- Are all 9 setup types (fade_at_wall, breakout_vacuum, mean_reversion, trend_continuation, orb_breakout, trend_pullback, flip_reclaim, vwap_reclaim, vwap_fade_at_band) fully implemented with entry zone, stop, T1, T2 logic?
- Does each setup type have proper invalidation conditions (stop breach, regime conflict, flow divergence, TTL expiry)?
- Is the TTL regime-dependent (trending 15-25m, compression 30-50m) and correctly enforced?
- Are environment gates (quality, regime, flow, timing, VIX, FOMC/earnings) all wired in and tested?
- Does tickEvaluator correctly handle concurrent setup evaluation without race conditions?
- Is the Redis state persistence throttled properly (30s interval)?
- Are there any setup types declared in types but never actually detected?
- Does the late-session hard gate (>4:30 PM ET) account for timezone edge cases and DST?

---

### DOMAIN 2: Decision Engine & Confidence Scoring

**Files to examine:**
- `lib/spx/decision-engine.ts`
- `lib/spx/confidence-model.ts`
- `lib/spx/tier-classifier.ts`
- `lib/spx/feature-extractor.ts`
- `lib/spx/mtf-confluence-model.ts`
- `backend/src/services/spx/multiTFConfluence.ts`

**Audit questions:**
- Does the confidence scoring formula (base 20 + alignment 0-52 + confluence 0-22 + probability 0-20 + flow -8 to +8 + regime -18 to 0) actually sum correctly, and is the 0-95 cap enforced?
- Are ML model weights loaded or hardcoded? Is there a training pipeline or are they static?
- Does the tier classifier (sniper_primary >= 3.5 confluence / 58% pWin / 0.35 EV/R, sniper_secondary >= 3.0/54%/0.20, watchlist >= 2.0/50%) correctly gate all three thresholds conjunctively?
- Is multi-timeframe confluence (1m, 5m, 15m, 1h) pulling real data for each timeframe or approximating?
- Does the feature extractor produce all 50+ features, and are any features computed but never consumed?
- Is the ML-backed vs rule-based scoring path correctly selected, and what triggers the fallback?
- Are there edge cases where confidence can exceed 95 or go negative?

---

### DOMAIN 3: Market Data Pipeline & Feed Health

**Files to examine:**
- `hooks/use-price-stream.ts`
- `backend/src/services/massiveTickStream.ts` (or similar WebSocket handler)
- `lib/spx/market-data-orchestrator.ts`
- `backend/src/services/spx/gexEngine.ts`
- `backend/src/services/spx/flowEngine.ts`
- `backend/src/services/spx/levelEngine.ts`
- `backend/src/services/spx/fibEngine.ts`
- `backend/src/services/spx/regimeClassifier.ts`
- `backend/src/services/spx/atrService.ts`
- `backend/src/config/massive.ts`
- `contexts/spx/SPXPriceContext.tsx`
- `contexts/spx/SPXAnalyticsContext.tsx`

**Audit questions:**
- Does the WebSocket reconnection use proper exponential backoff with jitter?
- Is the single-process Massive WebSocket constraint enforced via Redis advisory lock when `MASSIVE_TICK_LOCK_ENABLED=true`?
- Are all data fetch timeouts (GEX 12s, Flow 4s, Levels 5s, etc.) appropriate, and what happens when they fire?
- Does the snapshot fallback (last good snapshot, max 5m old) correctly invalidate stale data?
- Is there a cache stampede risk when multiple clients request a snapshot simultaneously?
- Are Massive.com API rate limits handled (429 responses, backoff)?
- Does the GEX engine correctly combine SPX + SPY using basis adjustment?
- Does the flow engine filter correctly (volume >= 10, premium >= 10k, 7-day expiry window, max 80 events)?
- Is the regime classifier pulling enough bar history to make accurate classifications?
- Are any data pipelines silently failing and returning empty/default data that downstream consumers treat as valid?
- Is the feed health indicator on the frontend accurately reflecting actual data quality?
- Is there a gap between the 15-second GEX cache and 10-second level cache causing desync?

---

### DOMAIN 4: Options & Greeks

**Files to examine:**
- `backend/src/services/spx/contractSelector.ts`
- `backend/src/services/options/blackScholes.ts`
- `lib/spx/evCalculator.ts`
- `lib/spx/iv-forecast-model.ts`
- `backend/src/services/spx/stopEngine.ts`

**Audit questions:**
- Does the contract selector correctly rank by delta, spread %, open interest, and health?
- Is the IV timing signal (tailwind/headwind/neutral) calibrated against actual IV percentile data?
- Does the zero-DTE rollover logic handle the 3:45-4:00 PM ET window correctly?
- Are late-day stricter filters actually enforced (what time, what changes)?
- Does the EV calculator account for commissions, slippage, and bid-ask spread?
- Is the Black-Scholes implementation using proper dividend yield and risk-free rate?
- Does the stop engine's GEX influence (negative GEX → wider stop, positive → tighter) have reasonable bounds?
- Is there a disconnect between the contract recommendation on the frontend and what the broker actually receives?
- Are Greeks refreshed frequently enough for 0DTE where theta decay is non-linear?

---

### DOMAIN 5: Execution & Broker Integration

**Files to examine:**
- `backend/src/services/broker/tradier/client.ts`
- `backend/src/services/broker/tradier/executionEngine.ts`
- `backend/src/services/broker/tradier/orderLifecycleManager.ts`
- `backend/src/services/broker/tradier/orderRouter.ts`
- `backend/src/services/broker/tradier/occFormatter.ts`
- `backend/src/services/spx/executionStateStore.ts`
- `backend/src/services/spx/executionReconciliation.ts`
- `lib/spx/execution-gating.ts`
- `lib/spx/execution-reconciliation.ts`
- `lib/spx/risk-envelope.ts`
- `components/spx-command-center/broker-*.tsx`
- `components/spx-command-center/kill-switch-button.tsx`
- `hooks/use-tradier-broker.ts`

**Audit questions:**
- Does the 3-leg order (entry limit + T1 profit target + stop loss) handle partial fills correctly?
- What happens if the broker rejects an order mid-execution (network failure, buying power issue)?
- Is the kill switch truly atomic — does it cancel all open orders AND close positions in one operation?
- Does the OCC formatter handle all SPX contract formats (SPXW weeklies, AM/PM settlement)?
- Is the execution state store's Redis + Supabase fallback consistent (no split-brain)?
- Does execution reconciliation handle fills that arrive out of order?
- Is Pattern Day Trader (PDT) tracking accurate for accounts under $25k?
- Is there a race condition between the frontend "enter trade" action and the backend creating orders?
- What happens to in-flight trades if the backend restarts?
- Does the risk envelope (max entry zone 8pts, max stop 18pts, min confluence 3.0, min confidence 40%) enforce at both frontend and backend?
- Is there a "paper trading" mode, and if so, does it correctly simulate fills with realistic latency?

---

### DOMAIN 6: Optimizer & Walk-Forward Testing

**Files to examine:**
- `backend/src/services/spx/optimizer.ts`
- `backend/src/services/spx/winRateBacktest.ts`
- `backend/src/services/spx/geometrySweep.ts`
- `backend/src/services/spx/outcomeTracker.ts`
- `hooks/use-spx-optimizer.ts`

**Audit questions:**
- Does the walk-forward test correctly split training (20 days) and validation (5 days)?
- Is the objective function (T1 win 30%, T2 win 20%, failure penalty 40%, expectancy 10%) producing actionable profiles?
- Does the geometry sweep test realistic stop/T1/T2 combinations by setup family?
- Is the drift control (5-day short window, 20-day long window, 15% max drop) too aggressive or too lenient?
- Does auto-quarantine actually prevent trades, or just warn?
- Is the nightly scan scheduled correctly and does it persist results to Supabase?
- Does the profile revert flow (user clicks "revert") correctly restore the prior profile and re-enable paused combos?
- Is there an optimizer history/audit trail visible to the user?
- Does the backtest use strict Massive historical bars or interpolated data? Is this clearly reported?
- Are backtest results including realistic slippage and commissions?
- Is there a survivorship bias in the outcome tracker (only tracking triggered setups vs all detected)?

---

### DOMAIN 7: AI Coach & Explainability

**Files to examine:**
- `backend/src/services/spx/aiCoach.ts`
- `backend/src/services/spx/coachDecisionEngine.ts`
- `backend/src/services/spx/executionCoach.ts`
- `lib/spx/coach-context.ts`
- `lib/spx/coach-explainability.ts`
- `lib/spx/coach-message-dedupe.ts`
- `lib/spx/coach-decision-policy.ts`
- `contexts/spx/SPXCoachContext.tsx`
- `hooks/use-spx-coach.ts`
- `components/spx-command-center/coach-*.tsx`
- `components/spx-command-center/ai-coach-feed.tsx`

**Audit questions:**
- Does the coach provide actionable guidance at each decision stage (scan → entry → T1 → T2 → exit)?
- Is the execution coach's advice (move stop to breakeven, take T1 profit) correctly timed based on price action?
- Does the message deduplication actually prevent spam without suppressing critical warnings?
- Is the explainability layer translating numerical scores into human-readable rationale?
- Does the coach's confidence gating prevent low-confidence advice from reaching the user?
- Is there a feedback loop where the user can rate coach advice and improve it?
- Does the coach handle conflicting signals gracefully (e.g., flow says bearish, regime says bullish)?
- Is the coach's streaming response correctly chunked and rendered in the UI?
- Does the spatial coach layer position markers correctly relative to price levels?
- Is the coach's screenshot analysis integration functional and useful?

---

### DOMAIN 8: Frontend UX & Interaction Design

**Files to examine:**
- `app/members/spx-command-center/page.tsx`
- `components/spx-command-center/` (all 60+ components)
- `hooks/use-spx-command-controller.ts`
- `lib/spx/commands.ts`
- `components/spx-command-center/command-palette.tsx`
- `components/spx-command-center/action-strip.tsx`
- `components/spx-command-center/mobile-*.tsx`
- `components/spx-command-center/spx-desktop-spatial-canvas.tsx`

**Audit questions:**
- Do all 33 commands work across all 4 surfaces (keyboard shortcut, command palette, action strip, mobile CTA)?
- Is the classic ↔ spatial view toggle seamless, preserving state (selected setup, overlays, scroll position)?
- Does the mobile layout properly stack all panels without overlapping or clipping?
- Is the responsive breakpoint (`hidden md:flex`) correctly applied to all panels?
- Are loading states using the "Pulsing Logo" skeleton everywhere, with no browser spinners?
- Does the panel resize (react-resizable-panels) persist user preferences across sessions?
- Is the command palette (Cmd/Ctrl+K) accessible and does it properly filter and execute all registered commands?
- Are there any dead toggle states (overlay turned on but component not rendering)?
- Is the execution mode toggle (scan vs in-trade) correctly locking/unlocking relevant panels?
- Does the post-trade panel capture all necessary fields for the trade journal?
- Are there accessibility issues (missing aria-labels, keyboard traps, focus management)?
- Is the flow ticker/ribbon showing real-time data or stale cached data?
- Does the chart (lightweight-charts) handle gaps in data (market close, weekends)?
- Are all emerald/champagne theme variables applied consistently (no `#D4AF37` gold)?

---

### DOMAIN 9: State Management & Context Architecture

**Files to examine:**
- `contexts/spx/SPXCommandCenterContext.tsx`
- `contexts/spx/SPXSetupContext.tsx`
- `contexts/spx/SPXPriceContext.tsx`
- `contexts/spx/SPXAnalyticsContext.tsx`
- `contexts/spx/SPXFlowContext.tsx`
- `contexts/spx/SPXCoachContext.tsx`
- All hooks in `hooks/use-spx-*.ts`

**Audit questions:**
- Are there unnecessary re-renders caused by context value changes propagating to unrelated components?
- Is the context hierarchy correct (which contexts depend on which)?
- Are WebSocket events correctly dispatched to the right context without event leakage?
- Is there a single source of truth for setup state, or do multiple contexts hold divergent copies?
- Are hooks properly memoizing expensive computations (useMemo/useCallback)?
- Is there a memory leak risk from uncleared intervals/timeouts/subscriptions in any hook?
- Does the price context correctly handle the tick → poll → snapshot fallback chain?
- Are there any circular dependencies between contexts?

---

### DOMAIN 10: Database & Persistence Layer

**Files to examine:**
- `supabase/migrations/` (all SPX-related migrations)
- `supabase/` (edge functions related to SPX)
- `backend/src/services/spx/executionStateStore.ts`
- `backend/src/services/spx/outcomeTracker.ts`
- `backend/src/services/spx/memoryEngine.ts`

**Audit questions:**
- Do all SPX-related tables have RLS policies?
- Are there missing indexes on frequently queried columns (setup lookups by user, date range queries)?
- Is the execution state store's dual-write (Redis + Supabase) atomic or eventually consistent?
- Is historical trade data being archived or will the table grow unbounded?
- Are optimizer profiles versioned in the database for audit trail?
- Does the memory engine's historical performance data survive cache eviction?
- Are there any orphaned records (setups without outcomes, trades without journal entries)?
- Is the schema normalized appropriately, or are there denormalized fields causing update anomalies?

---

### DOMAIN 11: Testing & Quality Assurance

**Files to examine:**
- `e2e/` (all spx-*.spec.ts files)
- `lib/spx/__tests__/` (unit tests)
- `backend/src/services/spx/__tests__/` (backend unit tests if they exist)

**Audit questions:**
- What is the current E2E test count and are there gaps in critical user journeys?
- Are there unit tests for the decision engine, setup detector, tick evaluator, and optimizer?
- Do the E2E tests use realistic mocks that match actual API response shapes?
- Are there flaky tests (timing-dependent, non-deterministic selectors)?
- Is there test coverage for error paths (API failures, WebSocket disconnects, broker rejections)?
- Are the mock factories in test helpers kept in sync with production type changes?
- Is there any dead test code (skipped tests, commented-out assertions)?
- Are there load/stress tests for the snapshot endpoint under concurrent requests?
- Are there tests for the broker execution flow end-to-end?

---

### DOMAIN 12: Configuration, Feature Flags & Operational Readiness

**Files to examine:**
- `lib/spx/flags.ts`
- `backend/src/config/massive.ts`
- `.env.example`
- `lib/spx/telemetry.ts`
- `lib/spx/alert-suppression.ts`
- `backend/src/services/spx/pdtTracker.ts`
- `backend/src/services/spx/marketSessionService.ts`

**Audit questions:**
- Are all feature flags (keyboardShortcuts, spatialHudV1, brokerIntegration, etc.) wired to both UI and backend?
- Can feature flags be toggled per-user or only globally?
- Is there a runbook for common operational issues (WebSocket disconnects, Massive API outage, optimizer failure)?
- Does the market session service handle all US market holidays for the current year?
- Does the PDT tracker correctly count round trips across multiple days?
- Is telemetry capturing enough to debug production issues (latency percentiles, error rates, data freshness)?
- Are there any hardcoded magic numbers that should be configurable?
- Is alert suppression too aggressive (hiding important signals) or too lenient (noise)?
- Are environment variables validated at startup with clear error messages for missing ones?
- Is there a health check endpoint that verifies all upstream dependencies (Massive, Redis, Supabase, Tradier)?

---

## OUTPUT FORMAT

Produce your audit as a structured report with these sections:

### Executive Summary
- Overall system maturity rating (1-10)
- Top 5 critical gaps that must be fixed before scaling
- Top 5 high-value improvements that would increase win rate or UX quality

### Domain-by-Domain Findings
For each of the 12 domains:
1. **Status:** ✅ Solid | ⚠️ Gaps Found | ❌ Critical Issues
2. **What works well** (be specific with file paths and line references)
3. **Gaps & issues** (severity-tagged, with exact file paths)
4. **Missing implementations** (logic that's referenced but not built)
5. **Dead code** (implemented but unreachable or unused)
6. **Recommendations** (prioritized, with effort estimates: S/M/L)

### Confluence Detector
Identify places where multiple domains interact and there are **seam gaps**:
- Frontend expects data the backend doesn't provide
- Types defined but never populated
- UI components rendered but receiving empty/default props
- Commands registered but not functional
- Feature flags defined but never checked
- API endpoints defined but never called from the frontend
- Mock data in tests that doesn't match production shapes
- Cached data with mismatched TTLs causing desync

### Cross-Cutting Concerns
- **Type Safety:** Any `any` types, missing generics, or type assertions hiding bugs
- **Error Handling:** Silent failures, swallowed exceptions, missing error boundaries
- **Performance:** N+1 queries, unnecessary re-renders, unoptimized bundle size
- **Security:** Missing auth checks, exposed secrets, injection vectors
- **Observability:** Missing logging, metrics, or alerting for critical paths

### Implementation Roadmap
Produce a prioritized backlog of 20-30 items:

| Priority | Domain | Issue | Effort | Impact | Description |
|----------|--------|-------|--------|--------|-------------|
| P0 | ... | ... | S/M/L | Critical/High/Med | ... |

### Architecture Recommendations
- What structural changes would improve maintainability?
- Where should caching be added or removed?
- What should be extracted into separate services?
- Where are the scaling bottlenecks?

---

## IMPORTANT CONTEXT

- **Market data provider is Massive.com** — never reference "Polygon.io" or "Polygon"
- **Design system:** Emerald Green (#10B981) + Champagne (#F3E5AB), dark mode only, glass-card-heavy surfaces
- **Fonts:** Playfair Display (headings), Inter (body), Geist Mono (data/prices)
- **The system trades 0DTE SPX options** — latency, data freshness, and execution speed are critical
- **Single-process WebSocket constraint** — only one backend instance can hold the Massive upstream socket
- **Broker is Tradier** — REST API for orders, WebSocket for streaming quotes
- **This is a production system** — the audit should focus on real-world reliability, not theoretical concerns
- **The CLAUDE.md file in the repo root contains the full project codex** — reference it for architecture details

---

## FINAL INSTRUCTION

Be exhaustive. Read every file in the SPX-related paths. Cross-reference frontend components against backend endpoints. Trace data from Massive.com API → backend service → context → hook → component → user's screen. Find every gap, every dead end, every silent failure. This audit will drive the next 90 days of development.
