# SPX E2E Test Suites — Agent Session Prompts

**Date:** 2026-02-25
**Purpose:** Fill critical test coverage gaps identified during the calibration tuning audit. Each section is a standalone prompt for a fresh Claude Code session.

**Context:** During calibration tuning (2026-02-24/25), we discovered that agent-implemented code had undetected issues because E2E integration tests were missing. Specifically: live metadata wasn't persisting (only backfill had it), shadow gate float comparison silently failed, WIN_RATE_BY_SCORE was inflated by 10-27pp, and coach tone changes weren't applied on first attempt. All were caught by manual inspection, not tests.

**Execution Order:**
1. Suite 1 (Massive Data Validation) can run independently
2. Suite 2 (Setup Detection Pipeline) can run independently
3. Suite 3 (Regime Classifier Expansion) can run independently
4. Suite 1 QA runs after Suite 1 completes
5. Suite 2 QA runs after Suite 2 completes
6. Suite 3 QA runs after Suite 3 completes

All three suites touch ONLY test files — zero production code changes.

---

## SUITE 1: Massive.com API Data Validation Tests

```
You are writing integration tests that validate market data quality from the Massive.com API. These tests ensure the data pipeline delivers complete, consistent, correctly-structured bars to all downstream consumers (setup detection, regime classification, stop engine, backtest).

## WHY THIS EXISTS
During calibration tuning, we discovered that data quality issues silently propagated through the system. The regime classifier, stop engine, and backtest all consume Massive API data but none validate it at the boundary. Missing bars, timestamp gaps, or malformed aggregates cause silent miscalculations downstream.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/config/massive.ts` — the Massive API client. Key functions:
   - getAggregates(ticker, multiplier, timespan, from, to) at line ~356 — core bar-fetching function
   - getMinuteAggregates(ticker, date) at line ~481 — minute-level bars for a single day
   - getDailyAggregates(ticker, from, to) at line ~471 — daily bars
   - MassiveAggregate interface (find it — has o, h, l, c, v, t, vw, n fields)
   - MassiveAggregatesResponse interface
   - Rate limiting and retry logic

2. `backend/src/services/spx/regimeClassifier.ts` — calls getMinuteAggregates for trend/volume analysis
3. `backend/src/services/spx/winRateBacktest.ts` — calls getAggregates for second-level replay bars
4. `backend/src/services/spx/historicalReconstruction.ts` — calls getAggregates for historical backfill
5. `backend/src/services/spx/__tests__/` — existing test patterns, use same vitest + mock setup

## TEST FILE LOCATION
Create: `backend/src/services/spx/__tests__/massiveDataValidation.test.ts`

## TEST GROUPS TO WRITE

### Group 1: Bar Structure Validation (unit tests with mocked API)
Mock the Massive API responses with realistic SPX data. Test that:

a. Each MassiveAggregate bar has all required fields: o (open), h (high), l (low), c (close), v (volume), t (timestamp ms), vw (volume-weighted avg price), n (number of trades)
b. h >= o and h >= c for every bar (high is the highest price)
c. l <= o and l <= c for every bar (low is the lowest price)
d. h >= l for every bar
e. t (timestamp) is a valid Unix millisecond timestamp within the requested date range
f. v (volume) >= 0 for every bar
g. Bars with v = 0 are flagged (SPX should always have volume during market hours)

### Group 2: Minute Bar Completeness (unit tests with mocked API)
Simulate a full trading day of minute bars (9:30 AM - 4:00 PM ET = 390 minutes).

a. Test: A complete response contains exactly 390 minute bars for a regular session
b. Test: Detect gaps — if bars jump from 10:15 to 10:18 (missing 10:16, 10:17), the gap is identified
c. Test: Detect duplicates — if two bars share the same timestamp, flag it
d. Test: Bars are sorted by timestamp ascending
e. Test: First bar timestamp is within 60 seconds of 09:30:00 ET
f. Test: Last bar timestamp is within 60 seconds of 15:59:00 ET
g. Test: Early close days (half days) are handled — expect ~210 bars ending at 13:00 ET

### Group 3: Second-Level Bar Validation (unit tests with mocked API)
These are the bars used by the backtest engine for second-level replay.

a. Test: Second-level bars within a 1-minute window should number roughly 60 (allow 50-70)
b. Test: Second-level bar timestamps are monotonically increasing
c. Test: The OHLC range of second-level bars is bounded by the enclosing minute bar's high/low
d. Test: No second-level bar has a negative spread (h < l)

### Group 4: Data Pipeline Integration (integration-style with mocked API)
Test the data flow from API response through to consumer. Use realistic mock data.

a. Test: regimeClassifier.classifyCurrentRegime receives well-formed bars when calling through with mocked API
   - Mock getMinuteAggregates to return 390 bars
   - Call classifyCurrentRegime with volumeTrend and trendStrength NOT provided (forces API call)
   - Verify the function completes without error and returns a valid RegimeState
b. Test: When getMinuteAggregates returns an empty array, classifyCurrentRegime falls back gracefully (no crash, returns a regime with low confidence)
c. Test: When getMinuteAggregates returns bars with gaps, downstream calculations still produce valid (non-NaN, non-null) outputs

### Group 5: Write a reusable validation utility
Create a helper function `validateMassiveBars(bars: MassiveAggregate[], options?: { expectedCount?: number, timespan?: string })` that:
- Checks all structural invariants from Group 1
- Checks completeness against expectedCount
- Checks timestamp continuity
- Returns `{ valid: boolean, errors: string[], warnings: string[], gapCount: number, duplicateCount: number }`

Write tests for this utility itself, then use it in Groups 2-4.

## CRITICAL RULES
- Mock ALL Massive API calls. Do NOT make real API requests.
- Use realistic SPX price data (5000-6000 range, ~5-15 point daily ranges, volume in millions)
- Generate timestamps that respect ET market hours (9:30-16:00)
- Do NOT modify any production files. Only create the test file.
- Follow existing vitest patterns from backend/src/services/spx/__tests__/

## VALIDATION
1. pnpm exec tsc --noEmit — must compile
2. pnpm exec eslint backend/src/services/spx/__tests__/massiveDataValidation.test.ts
3. pnpm vitest run backend/src/services/spx/__tests__/massiveDataValidation.test.ts — ALL tests must PASS
4. git diff --name-only — only the new test file should appear

## WHAT NOT TO DO
- Do NOT modify massive.ts, regimeClassifier.ts, or any production file
- Do NOT add npm dependencies
- Do NOT make real HTTP requests
- Do NOT test Polygon-branded endpoints (the provider is Massive.com, see CLAUDE.md)
```

---

## SUITE 1 QA: Verify Massive Data Validation Tests

```
You are a QA agent verifying a newly created test suite. You did NOT write these tests.

## WHAT WAS IMPLEMENTED
New test file: backend/src/services/spx/__tests__/massiveDataValidation.test.ts

## YOUR TASKS

1. Read the test file completely
2. Read backend/src/config/massive.ts to verify the tests reference correct interfaces and function signatures

3. CRITICAL CHECKS:

   a. [PASS/FAIL] All API calls are mocked — search for any real HTTP request, fetch, or unmocked Massive client usage
   b. [PASS/FAIL] MassiveAggregate field validation covers: o, h, l, c, v, t, vw, n
   c. [PASS/FAIL] OHLC invariants tested: h >= max(o,c), l <= min(o,c), h >= l
   d. [PASS/FAIL] Minute bar completeness test expects ~390 bars for full session
   e. [PASS/FAIL] Gap detection test includes at least one simulated gap
   f. [PASS/FAIL] Duplicate detection test includes at least one simulated duplicate
   g. [PASS/FAIL] Timestamp ordering is verified (ascending)
   h. [PASS/FAIL] Second-level bar tests verify bounds against enclosing minute bar
   i. [PASS/FAIL] validateMassiveBars utility exists and is tested independently
   j. [PASS/FAIL] No production files were modified (git diff --name-only)

4. Run:
   pnpm vitest run backend/src/services/spx/__tests__/massiveDataValidation.test.ts --reporter=verbose
   All tests must pass.

5. Run:
   pnpm exec tsc --noEmit
   pnpm exec eslint backend/src/services/spx/__tests__/massiveDataValidation.test.ts

## CONSTRAINTS
- Do NOT fix any issues. Report them only with exact line numbers.
- Do NOT modify any files.
```

---

## SUITE 2: Setup Detection Pipeline Integration Tests

```
You are writing integration tests that verify the complete setup detection pipeline end-to-end: from raw market data inputs through zone detection, confluence scoring, probability calibration, gate evaluation, and final output field correctness.

## WHY THIS EXISTS
During calibration tuning, we discovered multiple silent failures in the pipeline:
1. WIN_RATE_BY_SCORE was inflated by 10-27 percentage points — no test validated empirical accuracy
2. toTrackedRow() wasn't persisting stop-engine metadata (atr14, baseStop, etc.) in live mode — only backfill had it
3. Shadow gate float comparison (confluenceScore >= 3) silently failed because confluenceScore was stored as 2.998 — no test caught this
4. evaluateOptimizationGate had 22 parameters but no integration test verified realistic inputs

These tests would have caught every one of those bugs.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/setupDetector.ts` — the main pipeline:
   - detectActiveSetups() at line ~2628 — orchestration function
   - evaluateOptimizationGate() at line ~2092 — quality gate with 22 params
   - WIN_RATE_BY_SCORE at line ~349 — probability lookup table
   - SETUP_TYPE_WIN_ADJUSTMENT at line ~356 — per-type probability adjustment
   - SHADOW_GATE_MIN_CONFLUENCE_SCORE — threshold for shadow logging
2. `backend/src/services/spx/outcomeTracker.ts` — toTrackedRow() function, persistSetupInstancesForWinRate
3. `backend/src/services/spx/stopEngine.ts` — calculateAdaptiveStop, AdaptiveStopInput/Output
4. `backend/src/services/spx/types.ts` — Setup interface, Regime, SetupType, gateStatus
5. `backend/src/services/spx/regimeClassifier.ts` — classifyCurrentRegime, RegimeState
6. `backend/src/services/spx/confluenceDecay.ts` — confluence score calculation
7. `backend/src/services/spx/__tests__/setupDetector.test.ts` — existing test patterns to match
8. `backend/src/services/spx/__tests__/outcomeTracker.test.ts` — existing outcome tracker tests

## TEST FILE LOCATION
Create: `backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts`

## TEST GROUPS TO WRITE

### Group 1: WIN_RATE_BY_SCORE Integrity
Test the probability calibration chain from confluence score to final pWinCalibrated.

a. Test: For each confluenceScore 1-5, verify WIN_RATE_BY_SCORE returns the expected baseline:
   Score 1 → 40, Score 2 → 50, Score 3 → 55, Score 4 → 57, Score 5 → 60
   (If these values differ from what's in the code, UPDATE THE TEST to match current code and flag the discrepancy)
b. Test: SETUP_TYPE_WIN_ADJUSTMENT applies correctly — a fade_at_wall setup at score 3 should have a higher baseline than a trend_pullback at score 3
c. Test: pWinCalibrated is clamped between 0.05 and 0.95 — construct an input that would push it above 0.95 and verify clamping
d. Test: pWinCalibrated is clamped below — construct an input that would push it below 0.05 and verify clamping
e. Test: Regression guard — pWinCalibrated for score 5 with no adjustments must NOT exceed 0.65 (prevents re-inflation)

### Group 2: evaluateOptimizationGate Realistic Scenarios
Test the gate function with realistic parameter combinations.

a. Test: A high-quality setup (score 5, pWin 0.60, EV > 0.5, flow confirmed, no event risk) passes the gate — returns empty string array
b. Test: A low-pWin setup (pWin 0.30) is blocked — returns array containing a pWin-related reason
c. Test: A setup during event risk is blocked — returns array containing event-risk reason
d. Test: A setup with score 2 but high EV still gets blocked by the quality gate — verify the gate isn't EV-only
e. Test: Gate reasons array never contains null or undefined entries
f. Test: Gate returns predictable results for boundary values (pWin exactly at threshold, confluenceScore exactly at minimum)

### Group 3: Shadow Gate Threshold
Verify the shadow gate logging trigger.

a. Test: A blocked setup with confluenceScore = 3.0 is shadow-logged (meets threshold)
b. Test: A blocked setup with confluenceScore = 2.99 is NOT shadow-logged (below threshold)
c. Test: A blocked setup with confluenceScore = 2.995 IS shadow-logged (at the float-safe threshold)
d. Test: An eligible setup (gateReasons.length = 0) is NOT shadow-logged regardless of confluenceScore
e. Test: SHADOW_GATE_MIN_CONFLUENCE_SCORE is 2.995 (verify the constant value directly)

### Group 4: toTrackedRow Metadata Completeness
Verify that toTrackedRow persists all required fields for downstream analysis.

a. Test: toTrackedRow output includes metadata.atr14 when the setup has ATR data
b. Test: toTrackedRow output includes metadata.baseStop
c. Test: toTrackedRow output includes metadata.geometryStopScale
d. Test: toTrackedRow output includes metadata.vixRegime
e. Test: toTrackedRow output includes metadata.gexNet or metadata.netGex
f. Test: toTrackedRow output includes stopContext or stopEngine JSONB fields
g. Test: When setup has no ATR data (atr14 = 0 or undefined), metadata.atr14 is 0 or null (not silently omitted)
h. Test: gateStatus field is correctly set ('eligible', 'blocked', or 'shadow_blocked')
i. Test: gateReasons array is persisted in metadata when present

### Group 5: Pipeline Output Shape Validation
Create a synthetic setup and verify all output fields exist and are the correct types.

a. Test: Setup object from detectActiveSetups contains these required fields with correct types:
   - type: string (one of the valid SetupType values)
   - direction: 'bullish' | 'bearish'
   - entryZone: { low: number, high: number } (both finite, low < high)
   - stop: number (finite, positive)
   - target1: { price: number } (finite, positive)
   - target2: { price: number } (finite, positive)
   - confluenceScore: number (1-5 integer)
   - pWinCalibrated: number (0.05-0.95)
   - regime: string (one of 'trending', 'ranging', 'compression', 'breakout')
   - gateStatus: 'eligible' | 'blocked' | 'shadow_blocked'
b. Test: For a bullish setup, stop < entryZone.low and target1.price > entryZone.high
c. Test: For a bearish setup, stop > entryZone.high and target1.price < entryZone.low
d. Test: target2 is further from entry than target1 (for both bullish and bearish)
e. Test: confluenceScore is an integer (not 3.5 or 2.998)

## HOW TO MOCK
- Mock ALL external dependencies: Supabase, Massive API, Redis, OpenAI
- For Group 1-3: You can test the functions directly with controlled inputs — no need to run the full pipeline
- For Group 4: Construct a realistic Setup object and pass it to toTrackedRow, then inspect the output
- For Group 5: If detectActiveSetups requires too many mocks, test the output shape contract by constructing a Setup that matches the interface and validating it against the schema. Or mock detectActiveSetups's dependencies and call it with a minimal but realistic input set.

## CRITICAL RULES
- Do NOT modify any production files. Only create the test file.
- Do NOT add npm dependencies.
- Match existing vitest patterns from the __tests__ directory.
- Use realistic SPX values: price ~5000-6000, ATR ~5-15, volume in thousands/millions.
- Every test must have a clear name that describes what invariant it protects.

## VALIDATION
1. pnpm exec tsc --noEmit — must compile
2. pnpm exec eslint backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts
3. pnpm vitest run backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts — ALL tests must PASS
4. git diff --name-only — only the new test file should appear

## WHAT NOT TO DO
- Do NOT modify setupDetector.ts, outcomeTracker.ts, stopEngine.ts, or any production file
- Do NOT change WIN_RATE_BY_SCORE values (if they don't match what you expect, test against current values and flag the discrepancy)
- Do NOT add external test data files to the repo
```

---

## SUITE 2 QA: Verify Setup Detection Pipeline Tests

```
You are a QA agent verifying a newly created test suite. You did NOT write these tests.

## WHAT WAS IMPLEMENTED
New test file: backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts

## YOUR TASKS

1. Read the test file completely
2. Read these production files to verify the tests reference correct values:
   - backend/src/services/spx/setupDetector.ts (WIN_RATE_BY_SCORE, SETUP_TYPE_WIN_ADJUSTMENT, SHADOW_GATE_MIN_CONFLUENCE_SCORE, evaluateOptimizationGate)
   - backend/src/services/spx/outcomeTracker.ts (toTrackedRow)
   - backend/src/services/spx/types.ts (Setup interface, gateStatus type)

3. CRITICAL CHECKS:

   a. [PASS/FAIL] WIN_RATE_BY_SCORE test values match actual values in setupDetector.ts
   b. [PASS/FAIL] SETUP_TYPE_WIN_ADJUSTMENT test values match actual values in setupDetector.ts
   c. [PASS/FAIL] pWinCalibrated regression guard tests that score 5 cannot exceed 0.65
   d. [PASS/FAIL] evaluateOptimizationGate tests cover at least: pass case, pWin block, event risk block
   e. [PASS/FAIL] Shadow gate tests verify the 2.995 float-safe threshold specifically
   f. [PASS/FAIL] toTrackedRow tests check for: atr14, baseStop, geometryStopScale, vixRegime, gexNet/netGex, gateStatus, gateReasons
   g. [PASS/FAIL] Output shape tests verify both bullish and bearish setups
   h. [PASS/FAIL] All external deps are mocked (Supabase, Massive, Redis)
   i. [PASS/FAIL] No production files were modified (git diff --name-only)

4. Verify test quality:
   a. Are there any tests that would pass even if the production code was wrong? (i.e., tests that test the mock, not the code)
   b. Are there any hardcoded values that could silently become wrong if production values change? If so, flag them — the test should import or reference the production constant.

5. Run:
   pnpm vitest run backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts --reporter=verbose
   All tests must pass.

6. Run:
   pnpm exec tsc --noEmit
   pnpm exec eslint backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts

## CONSTRAINTS
- Do NOT fix any issues. Report them only with exact line numbers.
- Do NOT modify any files.
```

---

## SUITE 3: Regime Classifier Expansion Tests

```
You are expanding test coverage for the regime classifier. Currently there is only 1 test case (verifying that pre-supplied trend inputs skip the API call). The classifier is a critical upstream dependency — it feeds into setup detection, stop engine multiplier selection, probability calibration, and coach messaging. It needs comprehensive coverage.

## WHY THIS EXISTS
The regime classifier determines whether the market is in trending, ranging, compression, or breakout state. This single classification drives:
- Which setups are detected (some setups are type-gated by regime)
- Stop multiplier selection (getRegimeBaseAtrMultiplier)
- Probability adjustments (regimeBonus in pWinCalibrated)
- Coach messaging context ("trending regime", "compression regime")
With only 1 test, any regression in classification logic goes undetected.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/regimeClassifier.ts` — the full classifier:
   - classifyCurrentRegime() at line ~131 — main entry point
   - getSessionTrendContext() at line ~70 — fetches minute bars from Massive
   - volumeTrendFromBars() at line ~55 — classifies volume as rising/flat/falling
   - trendStrengthFromBars() at line ~36 — EMA-based strength (0-1)
   - computeDirectionProbability() at line ~92 — direction bias
   - classifyRegimeFromSignals() at line ~203 — core regime decision
   - RegimeState interface (find it — has regime, direction, probability, magnitude, confidence, timestamp)

2. `backend/src/services/spx/__tests__/regimeClassifier.test.ts` — existing single test
3. `backend/src/services/spx/types.ts` — Regime = 'trending' | 'ranging' | 'compression' | 'breakout'
4. `backend/src/services/spx/setupDetector.ts` — how regime is consumed (classifyCurrentRegime call at ~line 2712)
5. `backend/src/services/spx/stopEngine.ts` — getRegimeBaseAtrMultiplier (regime consumer)

## TEST FILE LOCATION
Extend the existing file: `backend/src/services/spx/__tests__/regimeClassifier.test.ts`
(Add new describe blocks after the existing test. Do NOT delete or modify the existing test.)

## TEST GROUPS TO WRITE

### Group 1: classifyRegimeFromSignals — Core Classification Logic
This is the pure function that decides the regime from signal inputs. Test it directly.

a. Test: Strong positive netGex + rising volume + high trendStrength → 'trending'
b. Test: Near-zero netGex + flat volume + low trendStrength → 'ranging'
c. Test: Very low rangeCompression (tight range) + flat/falling volume → 'compression'
d. Test: High breakoutStrength + rising volume → 'breakout'
e. Test: Ambiguous signals (moderate everything) → returns one of the 4 valid regimes (not null, not error)
f. Test: All zero inputs → returns a valid regime with low confidence
g. Test: Extreme positive inputs (netGex = 1e9, trendStrength = 1.0) → returns regime without crash
h. Test: Extreme negative inputs (netGex = -1e9) → returns regime without crash

### Group 2: volumeTrendFromBars — Volume Classification
a. Test: Bars with strictly increasing volume → 'rising'
b. Test: Bars with strictly decreasing volume → 'falling'
c. Test: Bars with fluctuating but roughly constant volume → 'flat'
d. Test: Empty bars array → returns 'flat' (or whatever the default is — verify and test)
e. Test: Single bar → returns 'flat'
f. Test: Bars with zero volume mixed in → doesn't crash, classifies reasonably

### Group 3: trendStrengthFromBars — Trend Strength Calculation
a. Test: Strongly uptrending bars (each close higher than last) → strength > 0.7
b. Test: Strongly downtrending bars → strength > 0.7 (strength measures magnitude, not direction)
c. Test: Flat bars (all closes equal) → strength < 0.3
d. Test: Alternating up/down bars (choppy) → strength < 0.5
e. Test: Empty bars array → returns 0 (or default)
f. Test: Return value is always between 0 and 1

### Group 4: Regime Transition Scenarios
Test that the classifier produces sensible regime transitions for realistic market scenarios.

a. Test: Morning compression (tight range, low volume, pre-breakout) — feed bars that simulate 9:30-10:00 tight range
   Expect: 'compression' regime
b. Test: Post-breakout trending — feed bars that simulate a directional breakout with expanding volume
   Expect: 'breakout' or 'trending' (depending on how far post-breakout)
c. Test: Afternoon ranging — feed bars with no trend, moderate volume, wide-ish range
   Expect: 'ranging'
d. Test: End-of-day compression — volume falling, range tightening
   Expect: 'compression' or 'ranging'

### Group 5: RegimeState Output Shape
a. Test: classifyCurrentRegime returns an object with all required fields:
   - regime: one of 'trending', 'ranging', 'compression', 'breakout'
   - direction: 'bullish' | 'bearish' | 'neutral' (or whatever valid values exist — read the code)
   - probability: number between 0 and 1
   - magnitude: number >= 0
   - confidence: number between 0 and 1
   - timestamp: valid Date or number
b. Test: regime is never null or undefined when the function returns successfully
c. Test: confidence and probability are not NaN

### Group 6: Setup Type Gating by Regime (Consumer Integration)
Verify that regime classification correctly influences downstream setup detection.

a. Test: Identify which setup types are valid in each regime by reading setupDetector.ts
   - Find any regime-based filtering or gating in the setup detection code
   - Write tests that verify: in 'compression' regime, certain setup types are filtered/allowed
   - In 'trending' regime, different setup types are filtered/allowed
b. Test: If setupDetector does NOT regime-gate setup types, document this as a finding (it means any setup type can fire in any regime, which may be intentional or a gap)

## HOW TO MOCK
- Mock Massive API (getMinuteAggregates, getAggregates)
- Mock Redis (regime cache)
- Mock GEX engine (computeUnifiedGEXLandscape)
- Mock level engine (getMergedLevels)
- For Groups 1-3: Call the helper functions directly with controlled inputs
- For Groups 4-5: Call classifyCurrentRegime with mocked dependencies
- For Group 6: Read setupDetector.ts to understand the regime-setup-type relationship, then write targeted tests

## CRITICAL RULES
- Do NOT delete or modify the existing test case in regimeClassifier.test.ts
- Do NOT modify any production files
- Do NOT add npm dependencies
- Match the existing mock setup pattern from the current test
- Use realistic SPX bar data (price ~5000-6000, volume in millions for minute bars)

## VALIDATION
1. pnpm exec tsc --noEmit — must compile
2. pnpm exec eslint backend/src/services/spx/__tests__/regimeClassifier.test.ts
3. pnpm vitest run backend/src/services/spx/__tests__/regimeClassifier.test.ts --reporter=verbose — ALL tests must PASS (including the original test)
4. git diff --name-only — only the test file should appear

## WHAT NOT TO DO
- Do NOT modify regimeClassifier.ts, setupDetector.ts, or any production file
- Do NOT delete the existing test
- Do NOT create a separate test file — extend the existing one
- Do NOT make real API calls
```

---

## SUITE 3 QA: Verify Regime Classifier Tests

```
You are a QA agent verifying expanded regime classifier tests. You did NOT write these tests.

## WHAT WAS IMPLEMENTED
Modified test file: backend/src/services/spx/__tests__/regimeClassifier.test.ts (expanded from 1 test to many)

## YOUR TASKS

1. Read the test file completely
2. Read backend/src/services/spx/regimeClassifier.ts to verify tests match actual function signatures and logic

3. CRITICAL CHECKS:

   a. [PASS/FAIL] The original existing test ("does not fetch current-session minute bars when trend inputs are provided") is UNCHANGED
   b. [PASS/FAIL] classifyRegimeFromSignals is tested with at least 4 distinct input combos covering all 4 regimes
   c. [PASS/FAIL] volumeTrendFromBars is tested for rising, falling, flat, and edge cases (empty, single bar)
   d. [PASS/FAIL] trendStrengthFromBars is tested for trending, flat, choppy, and edge cases
   e. [PASS/FAIL] Output shape validation checks regime, direction, probability, confidence, timestamp
   f. [PASS/FAIL] All API calls are mocked — no real HTTP requests
   g. [PASS/FAIL] Tests use realistic SPX price/volume data
   h. [PASS/FAIL] No production files were modified (git diff --name-only)

4. Verify test function signatures match production code:
   - Do the test imports match actual exports from regimeClassifier.ts?
   - Are helper functions (volumeTrendFromBars, trendStrengthFromBars, classifyRegimeFromSignals) actually exported? If not, flag this — the tests need a different approach.

5. Run:
   pnpm vitest run backend/src/services/spx/__tests__/regimeClassifier.test.ts --reporter=verbose
   All tests must pass.

6. Run:
   pnpm exec tsc --noEmit
   pnpm exec eslint backend/src/services/spx/__tests__/regimeClassifier.test.ts

## CONSTRAINTS
- Do NOT fix any issues. Report them only with exact line numbers.
- Do NOT modify any files.
```

---

## CLOSING VERIFICATION: Post-Test-Suite Validation

```
You are running the closing validation after all 3 test suites have been implemented. This verifies the test suites work together and don't break anything.

## TASKS

1. Run full validation gates:
   pnpm exec tsc --noEmit
   pnpm exec eslint .
   pnpm vitest run

   ALL must pass. If any fail, report the exact error and stop.

2. Run ONLY the new test files individually to confirm isolation:
   pnpm vitest run backend/src/services/spx/__tests__/massiveDataValidation.test.ts --reporter=verbose
   pnpm vitest run backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts --reporter=verbose
   pnpm vitest run backend/src/services/spx/__tests__/regimeClassifier.test.ts --reporter=verbose

   Report pass/fail count for each.

3. Verify no production files were touched:
   git diff --name-only
   Expected files (ALL should be test files only):
   - backend/src/services/spx/__tests__/massiveDataValidation.test.ts (new)
   - backend/src/services/spx/__tests__/setupDetectionPipeline.test.ts (new)
   - backend/src/services/spx/__tests__/regimeClassifier.test.ts (modified — expanded)

   If ANY production file appears, flag it immediately.

4. Test coverage report:
   pnpm vitest run --coverage 2>&1 | grep -A5 'setupDetector\|regimeClassifier\|massive\|outcomeTracker\|stopEngine'

   Report the coverage numbers for these files.

5. Summary report:
   - Suite 1 (Massive Data Validation): X tests, all pass/fail
   - Suite 2 (Setup Detection Pipeline): X tests, all pass/fail
   - Suite 3 (Regime Classifier): X tests, all pass/fail
   - Total new tests added: X
   - Production files modified: 0 (verify this)
   - Coverage improvement: before → after for key files

## CONSTRAINTS
- Do NOT modify any files.
- This is a read-only verification session.
- If ANY test fails, do NOT attempt to fix it. Report and stop.
```
