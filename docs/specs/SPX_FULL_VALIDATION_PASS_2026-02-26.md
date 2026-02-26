# SPX Command Center — Full Production Validation Pass

**Date:** 2026-02-26
**Purpose:** Complete end-to-end validation of the SPX Command Center after a multi-session calibration, hardening, and audit cycle. This prompt should be pasted into a fresh session with working bash.

---

## Context

Over three sessions, the SPX Command Center underwent:

1. **Calibration Tuning** — WIN_RATE_BY_SCORE recalibration, stop tuning, coach tone, shadow gate, metadata persistence, ATR14 fix, per-setup-type pWin floor adjustment
2. **Pipeline Hardening** — 8 prompts (A through G) covering confluence hardening, contract selection, tick evaluator gap-bridging, levels pipeline, WebSocket reliability, frontend feed indicator, daily health check, entry zone rendering
3. **10-Domain Audit** — Trade lifecycle, P&L tracking, target management, optimizer loop, replay engine, cache staleness, Supabase RLS, chart annotations, mobile responsiveness, AI coach accuracy
4. **Fix Implementation** — All Phase 1 (safety-critical), Phase 2 (accuracy), and Phase 3 (quality/UX) fixes from the master audit

**Reference docs:**
- `docs/specs/SPX_COMMAND_CENTER_MASTER_AUDIT_2026-02-26.md` — Full audit findings
- `docs/specs/SPX_QA_VALIDATION_PROMPT_2026-02-26.md` — Previous QA pass (all items marked PASS)

---

## Instructions

You are running the FINAL production validation. Do not implement fixes — only audit, test, and report with evidence.

For each section below:
1. Read the relevant source files
2. Run validation commands (type check, lint, tests)
3. Mark each item with evidence-backed verdict
4. If anything fails, document exactly what and why

---

## STEP 1: Environment & Build Validation

Run these sequentially and report exact output:

```bash
# 1. Verify Node version (must be >= 22)
node --version

# 2. Verify pnpm
pnpm --version

# 3. Full type check
cd /path/to/ITM-gd && pnpm exec tsc --noEmit 2>&1 | tail -30

# 4. Full lint
pnpm exec eslint . 2>&1 | tail -30

# 5. Production build
pnpm run build 2>&1 | tail -30

# 6. Backend type check
cd backend && npx tsc --noEmit 2>&1 | tail -30
```

---

## STEP 2: Test Suite Execution

Run ALL test suites created during the hardening cycle:

```bash
# Unit tests (all SPX-related)
pnpm vitest run --reporter=verbose 2>&1

# If vitest config excludes backend, also run:
cd backend && npx vitest run --reporter=verbose 2>&1

# Count total tests
pnpm vitest run 2>&1 | grep -E "Tests|Test Files"
```

Report: total test count, pass count, fail count, skip count.

---

## STEP 3: Calibration Tuning Verification

### 3A — pWin Floor Configuration
Read `backend/src/services/spx/setupDetector.ts` and verify SETUP_SPECIFIC_GATE_FLOORS:

| Setup Type | Expected minPWinCalibrated | Expected minConfluenceScore |
|---|---|---|
| mean_reversion | 0.62 | 3 |
| trend_pullback | 0.62 | 3 |
| trend_continuation | 0.60 | 4 |
| orb_breakout | 0.58 | 3.5 |

### 3B — Confluence Hardening
Verify in `setupDetector.ts`:
- multiTF null default = 35 (not 50)
- Flow zero-event default = 0 (not 50)
- Stale timestamp decay uses half-life penalty

### 3C — ATR14 Fix
Verify in `setupDetector.ts`:
- `getIntradayAtr` fallback exists for live detection path
- ATR14 wired into stop geometry AND persisted Setup.atr14 field

### 3D — Stop Engine Metadata
Verify stop metadata (atr14, baseStop, stopContext) is populated in setup objects.

---

## STEP 4: Pipeline Hardening Verification

### 4A — Levels Pipeline
Verify in `backend/src/services/spx/levelEngine.ts` and `backend/src/services/levels/index.ts`:
- [ ] GEX, Fib, Basis wrapped in try/catch (silent failure won't crash pipeline)
- [ ] `dataQuality` field on LevelsResponse with `integrity` and `warnings`
- [ ] Fib validation: MIN_DAILY_30_BARS = 25, MIN_DAILY_90_BARS = 60

### 4B — Multi-TF Confluence
Verify in `backend/src/services/spx/multiTFConfluence.ts`:
- [ ] `emaReliable` flag on MultiTFFrameSnapshot
- [ ] Composite capped at 60% when any frame has unreliable EMA
- [ ] Timeframe-aware swing lookback (1h→4 bars, 15m→8 bars, 1m/5m→12 bars)

### 4C — Tick Evaluator
Verify in `backend/src/services/spx/tickEvaluator.ts`:
- [ ] Gap-bridging entry detection (direction-aware)
- [ ] Per-setup `previousTickPrice` tracking
- [ ] Redis persistence of setupStateById (Phase 2 fix)

### 4D — WebSocket Reliability
Verify in `backend/src/services/websocket.ts` and `hooks/use-price-stream.ts`:
- [ ] Critical tick bypass for prices within 0.5 points of setup levels
- [ ] `feed_health` broadcast message
- [ ] WS_FAILURE_THRESHOLD = 5, WS_RETRY_PAUSE_MS = 30_000

### 4E — Frontend Feed Indicator
Verify in `components/spx-command-center/spx-header.tsx`:
- [ ] Feed health indicator (green/yellow/red dot)
- [ ] connectionStatus propagated through context

---

## STEP 5: Audit Fix Verification (Phase 1 — Safety-Critical)

### 5A — EOD Cleanup Job
Verify `backend/src/workers/spxEodCleanupWorker.ts`:
- [ ] Polls every 30s, checks minute 961 (4:01 PM ET)
- [ ] Early close support at minute 781 (1:01 PM ET)
- [ ] Redis idempotency key prevents duplicate runs
- [ ] Invalidates forming/ready/triggered with `market_closed`
- [ ] Worker started in `backend/src/server.ts`
- [ ] `market_closed` is valid in Setup type union

### 5B — Optimizer Revert Endpoint
Verify `backend/src/routes/spx.ts`:
- [ ] POST `/analytics/optimizer/revert` route exists
- [ ] `revertSPXOptimizationProfile` in `optimizer.ts` reads history and restores profile
- [ ] Input validation (positive integer historyId)
- [ ] Frontend hook URL matches

### 5C — Cache TTL Fixes
Verify:
- [ ] `optionsChainFetcher.ts`: OPTIONS_CHAIN_CACHE_TTL = 20
- [ ] `optionsChainFetcher.ts`: OPTIONS_MATRIX_CACHE_TTL = 20
- [ ] `index.ts`: SNAPSHOT_MAX_FALLBACK_AGE_MS = 300000 (5 min)
- [ ] `index.ts`: SNAPSHOT_INFLIGHT_STALENESS_MS = 10000
- [ ] In-flight promise discarded after 10s, fresh build started

### 5D — Supabase RLS
Verify via SQL query:
```sql
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('spx_execution_active_states', 'spx_level_touches', 'spx_setup_execution_fills')
ORDER BY tablename, policyname;
```
Expected:
- `spx_execution_active_states`: user SELECT scoped to `auth.uid() = user_id`
- `spx_level_touches`: has service_role + authenticated policies
- `spx_setup_execution_fills`: SELECT scoped to own user

Also run:
- `get_advisors(type: "security")` — check no new SPX table warnings
- `get_advisors(type: "performance")` — check no missing indexes

### 5E — Chart Data Flow
Verify `levelEngine.ts`:
- [ ] VWAP extracted from `indicators.vwap`, synthesized as LevelItem
- [ ] `spx_zero_gamma` and `spy_zero_gamma` mapped in `buildGexDerivedLevels()`
- [ ] `labelFromSource()` in overlay maps `zero_gamma` → "Zero Gamma"

---

## STEP 6: Audit Fix Verification (Phase 2 — Accuracy)

### 6A — Optimizer Guardrails
Verify `optimizer.ts`:
- [ ] `minTradesPerCombo` = 30 (was 12)
- [ ] `minTrades` in scan config = 30
- [ ] Scorecard carries `replayFidelity` or equivalent quality tag
- [ ] `usedMassiveMinuteBars` / `fallbackSharePct` propagated
- [ ] Optimization blocked when fallback data dominates

### 6B — Trade Lifecycle Hardening
Verify:
- [ ] `tickEvaluator.ts`: Redis persist/restore helpers for setupStateById
- [ ] Startup restores state from Redis before processing ticks
- [ ] `SPXCommandCenterContext.tsx`: `enterTrade()` checks `inTradeSetupId !== null` and blocks with toast
- [ ] 30s TTL enforcement worker registered in server startup

### 6C — AI Coach Alignment
Verify:
- [ ] `chatkit/systemPrompt.ts`: Contains hallucination guardrail instruction
- [ ] Coach context includes snapshot freshness, regime, levels, pWin
- [ ] Coach response includes freshness metadata

### 6D — Chart Real-Time Updates
Verify:
- [ ] `spx-chart.tsx`: scenarioLanes memo depends on `spxPrice`
- [ ] `levelEngine.ts`: LEVEL_CACHE_TTL_SECONDS = 15 (was 30)
- [ ] `use-spx-api.ts` or `use-spx-snapshot.ts`: dedupingInterval = 500 (was 1500)
- [ ] SPY-derived level colors consistent between spx-chart.tsx and priority-level-overlay.tsx

### 6E — Cache Optimization
Verify:
- [ ] Server startup pre-fetches GEX + levels (cache warm-up)
- [ ] `tickCache.ts`: `isTickStreamHealthy()` function exists
- [ ] Snapshot level computation gates on tick freshness

---

## STEP 7: Audit Fix Verification (Phase 3 — Quality/UX)

### 7A — Mobile Responsiveness
Verify:
- [ ] `spx-header.tsx`: Header chips use responsive hiding (`hidden md:flex` or similar)
- [ ] `action-strip.tsx`: Stacks vertically on mobile
- [ ] Primary action buttons have min-height >= 44px

### 7B — Opening Range Calculation
Verify:
- [ ] `calculateOpeningRange()` exists in levels service
- [ ] OR-High / OR-Low levels added to resistance/support arrays
- [ ] `labelFromSource()` maps `opening_range_high` → "OR-High", `opening_range_low` → "OR-Low"

### 7C — Replay Engine Improvements
Verify in `winRateBacktest.ts` and/or `historicalReconstruction.ts`:
- [ ] Regime re-classified from historical bars (not using persisted regime)
- [ ] VWAP reconstructed from cumulative volume
- [ ] Ambiguous bars flagged with reduced confidence weight

### 7D — Optimizer Safety Features
Verify:
- [ ] Dry-run mode exists (preview without applying)
- [ ] Manual pause pinning (nightly optimizer cannot override)
- [ ] In-flight trade isolation (active setups excluded from optimization updates)

---

## STEP 8: Entry Zone Rendering
Verify `priority-level-overlay.tsx`:
- [ ] `RenderZone` interface with yTop, yBottom, label, color
- [ ] `RenderState` includes `zones` array
- [ ] `entryZones` memo extracts entry zone pairs
- [ ] Filled div rendered with `background: rgba(16,185,129,0.18)`
- [ ] Dashed borders at top/bottom
- [ ] Label centered horizontally and vertically (`left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`)

Verify `spx-chart.tsx`:
- [ ] Entry zone price lines at reduced opacity (0.35) and width (0.75)

---

## STEP 9: Daily Health Check
Verify `backend/src/scripts/spxDailyHealthCheck.ts`:
- [ ] 7 checks: metadata completeness, optimizer drift, gate distribution, confluence distribution, setup type health, resolved outcomes, data freshness
- [ ] CLI flags: `--date`, `--verbose`
- [ ] Run it: `cd backend && npx tsx src/scripts/spxDailyHealthCheck.ts --verbose 2>&1 | head -50`

---

## STEP 10: Test Suite Completeness Audit

List ALL test files created during the hardening cycle and their test counts:

```bash
find . -name "*.test.ts" -path "*/spx/*" -o -name "*.test.ts" -path "*/tests/*" | sort
```

Expected suites (verify each exists and passes):
1. `massiveDataValidation.test.ts` — 19 tests
2. `setupDetectionPipeline.test.ts` — 25 tests
3. `regimeClassifier.test.ts` — 30 tests
4. `confluenceHardening.test.ts` — 11 tests
5. `contractSelector.test.ts` — expanded
6. `contractSelectionExpanded.test.ts` — new
7. `optionsChainFetcher.test.ts` — expanded
8. `tickEvaluatorExpanded.test.ts` — 28 tests
9. `outcomeTracker.test.ts` — expanded
10. `websocketReliability.test.ts` — 10 tests
11. `levelsPipelineHardening.test.ts` — 24 tests

---

## Output Format

Produce a structured report with:

### Summary Table
| Step | Section | Verdict | Evidence |
|------|---------|---------|----------|
| 1 | Build | ✅/❌ | tsc exit code, build output |
| 2 | Tests | ✅/❌ | X/Y passing, failures listed |
| ... | ... | ... | ... |

### Failing Items (if any)
For each failure:
- **ID:** Step-Section (e.g., "6B-3")
- **Expected:** What should exist
- **Actual:** What was found
- **File:** Path and line number
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Recommended Fix:** Specific code change

### Confidence Score
Rate overall production readiness: 0-100%
- 95-100%: Ship it
- 85-94%: Ship with known caveats documented
- 70-84%: Needs targeted fixes before shipping
- Below 70%: Major gaps remain

### Final Checklist
- [ ] All type checks pass (zero errors in touched files)
- [ ] All lint passes (zero warnings in touched files)
- [ ] Production build succeeds
- [ ] All test suites pass
- [ ] Supabase RLS verified via live query
- [ ] No security advisors flagging SPX tables
- [ ] Cache TTLs verified at expected values
- [ ] Trade lifecycle guards verified
- [ ] Chart annotations complete (VWAP, Zero Gamma, OR, entry zones)
- [ ] Mobile responsive patterns in place
- [ ] AI Coach guardrails in place
- [ ] EOD cleanup worker registered
- [ ] Optimizer revert endpoint functional
- [ ] Daily health check runs successfully
