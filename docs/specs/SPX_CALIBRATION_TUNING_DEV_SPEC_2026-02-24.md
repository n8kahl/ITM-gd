# SPX Command Center Calibration Tuning — Development Specification

**Document Version:** 1.0
**Date:** 2026-02-24
**Status:** Draft — Pending Multi-Agent Review
**Governing Surface:** SPX Command Center (`/members/spx-command-center`)
**Scope:** Backend calibration tuning across 4 workstreams — no frontend changes

---

## Executive Summary

Analysis of the SPX Command Center codebase by multiple AI agents identified that the system's core detection, visualization, and decision infrastructure is production-grade and architecturally sound. The reported "disjointed" trading experience traces not to UI deficiencies but to three calibration bottlenecks in the backend: stop-loss parameters that are too tight for SPX volatility, an execution coach tone that creates psychological pressure rather than informed confidence, and optimization gates that may be filtering out viable setups without visibility into what's being rejected.

This spec defines four workstreams to address these issues, ordered by dependency: (1) stop-loss heat analysis to establish empirical baselines, (2) regime-aware stop parameter tuning validated against those baselines, (3) phase-aware coach tone restructuring, and (4) shadow-gated A/B testing of optimization gate thresholds.

No frontend, database schema, or architecture changes are in scope.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Workstream 1: Stop-Loss Heat Analysis](#2-workstream-1-stop-loss-heat-analysis)
3. [Workstream 2: Regime-Aware Stop Parameter Tuning](#3-workstream-2-regime-aware-stop-parameter-tuning)
4. [Workstream 3: Phase-Aware Coach Tone](#4-workstream-3-phase-aware-coach-tone)
5. [Workstream 4: Shadow Gate A/B Testing](#5-workstream-4-shadow-gate-ab-testing)
6. [Perspective Reviews](#6-perspective-reviews)
7. [Validation Gates](#7-validation-gates)
8. [Risk Register](#8-risk-register)
9. [Rollback Plan](#9-rollback-plan)
10. [Success Criteria](#10-success-criteria)

---

## 1. Current State Analysis

### 1.1 Stop Engine Architecture (stopEngine.ts)

The adaptive stop calculation is a multi-factor composition chain, not a single constant:

```
effectiveRisk = max(baseRisk, atrFloor)
totalScale = clamp(geometry × vix × gexDirectional × gexMagnitude, 0.2, 5.0)
riskPoints = max(0.35, effectiveRisk × totalScale)
```

**Current base constants:**

| Parameter | Current Value | Concern |
|-----------|--------------|---------|
| `DEFAULT_ATR_STOP_MULTIPLIER` | 0.9 | Sub-1-ATR floor invites shakeouts in normal volatility |
| Mean reversion `maxPoints` — compression | 8 | ~0.16% of SPX at 5000; statistical noise |
| Mean reversion `maxPoints` — ranging | 9 | Marginal improvement, still tight |
| Mean reversion `maxPoints` — trending | 10 | Acceptable for trend entries |
| Mean reversion `maxPoints` — breakout | 12 | Reasonable for high-volatility regimes |

**Existing scale factors that compound with the base:**

| Factor | Conditions | Scale |
|--------|-----------|-------|
| VIX elevated | `vixRegime === 'elevated'` | 1.3× |
| VIX extreme | `vixRegime === 'extreme'` | 1.6× |
| GEX directional (positive) | `netGex > 0` | 0.9× (tighter — dealer hedging supports) |
| GEX directional (negative, mean reversion) | `netGex < 0` + mean reversion family | 1.1× (wider — negative gamma = volatility) |
| GEX magnitude (far from key level) | `distanceBp > 500` | 1.2× |
| GEX magnitude (near key level) | `distanceBp <= 200` | 0.7× |
| Geometry | Per-setup from optimizer profile | 0.2–4.0× |

**Key insight:** The 0.9 ATR multiplier is the *floor* that gets composed with 4 other scaling factors. Under elevated VIX with negative GEX far from a key level, the effective multiplier becomes: `0.9 × 1.3 × 1.1 × 1.2 = 1.54 ATR`. The problem isn't extreme conditions — it's normal conditions (VIX normal, GEX neutral, near key level) where all scales are ~1.0 and the floor of 0.9 ATR dominates.

### 1.2 Execution Coach Architecture (executionCoach.ts)

The coach maps setup phase transitions to messages:

| Phase Transition | Current Tone | Message Type |
|-----------------|-------------|--------------|
| `→ triggered` | "Execution command: ENTER BULLISH..." | `pre_trade` |
| `→ target1_hit` | "Execution command: TAKE 55% at T1..." | `in_trade` |
| `→ target2_hit` | "Execution command: EXIT remainder at T2..." | `post_trade` |
| `→ invalidated (stop)` | "Execution command: EXIT now. Stop condition confirmed..." | `alert` |

All phases use imperative "Execution command:" prefix. The structured data payload (`executionDirective`) is well-designed and should be preserved — only the `content` string needs tone adjustment.

### 1.3 Optimization Gate Architecture (setupDetector.ts)

`evaluateOptimizationGate()` is a comprehensive quality filter that evaluates:

- Score floor checks (per-setup-type minimums for confluence, pWin, EVR)
- Flow confirmation requirements with grace periods
- EMA alignment requirements
- Volume regime alignment
- Timing gates by setup type
- Late-session hard gate
- ORB range width validation
- VWAP directional filter

Each rejected setup receives an array of `gateReasons` explaining why it was blocked. These reasons are persisted in `spx_setup_instances.metadata` as `gateStatus` and `gateReasons`.

**Existing analysis infrastructure:**

- `spxFailureAttribution.ts`: Already analyzes blocker distributions, multi-blocker combos, flow availability by date, and failure rates by 10+ dimensions
- `spxResolveOutcomes.ts`: Backtests outcomes at second-level resolution with slippage modeling
- `spxBacktestWalkforward.ts`: Walk-forward validation with sliding 4-day windows
- `outcomeTracker.ts` / `persistSetupInstancesForWinRate()`: Persists all setup instances including blocked ones (`includeBlockedSetups: true`)

### 1.4 Frontend Visualization (Confirmed Existing — No Changes Needed)

The frontend already surfaces confluence data transparently:

- **Decision Context panel**: Cluster zones (fortress/defended/moderate/weak) with scores, test counts, hold rates, sources
- **Setup cards**: Confluence score (0–5), calibrated win probability, alignment score, confidence trend, decision drivers, risk callouts
- **Spatial HUD**: SetupLockOverlay (entry/risk/target bands + confluence rings), ProbabilityConeSVG, GammaTopographyOverlay, PriorityLevelOverlay, RiskRewardShadowOverlay, TopographicPriceLadder
- **Decision engine**: Multi-timeframe alignment (1m/5m/15m/1h weighted), driver/risk extraction, EV calculation

---

## 2. Workstream 1: Stop-Loss Heat Analysis

**Priority:** FIRST — this provides empirical data for all subsequent workstreams.
**Target file:** New script: `backend/src/scripts/spxStopHeatAnalysis.ts`
**Dependencies:** `spx_setup_instances` table, `runSPXWinRateBacktest()`, Massive API

### 2.1 Objective

Produce a histogram of stopped-out trades showing: (a) how close each stopped-out trade came to reaching T1 before reversing, and (b) the distribution of stop-to-reversal distances. This provides mathematical proof (or disproof) that the current 0.9 ATR base multiplier causes premature shakeouts.

### 2.2 Data Requirements

**Source:** `spx_setup_instances` where `final_outcome = 'stop_before_t1'`
**Date range:** Minimum 30 trading sessions (approximately 6 calendar weeks)
**Resolution:** Second-level bars from Massive API (matching existing backtest resolution)
**Required fields per stopped-out trade:**

| Field | Source | Purpose |
|-------|--------|---------|
| `entry_price` | Setup geometry (entryZone mid) | Reference point |
| `stop_price` | Setup stop level | Where the trade exited |
| `target1_price` | Setup target1.price | Where the trade "wanted" to go |
| `stop_hit_at` | Outcome timestamp | When the stop triggered |
| `post_stop_extreme` | Computed from bars after stop_hit_at | How far price traveled toward T1 after stopping out |
| `post_stop_t1_reached` | Boolean | Did price eventually reach T1 within the setup's original TTL window? |
| `distance_stop_to_t1_points` | `abs(stop_price - target1_price)` | Total risk-to-reward distance |
| `distance_stop_to_reversal_points` | `abs(stop_price - post_stop_extreme)` | How much "breathing room" was needed |
| `regime` | Setup metadata | For regime-stratified analysis |
| `setup_type` | Setup metadata | For type-stratified analysis |
| `effective_atr_multiplier` | Computed from stop distance / ATR14 | Actual multiplier used (after all scaling) |

### 2.3 Analysis Outputs

**Output 1: Shakeout Histogram**

For each stopped-out trade, compute `post_stop_t1_travel_pct = (post_stop_extreme - stop_price) / (target1_price - stop_price) × 100`. This measures what percentage of the stop-to-T1 distance price eventually covered after the stop was hit.

Bucket distribution:

| Bucket | Meaning |
|--------|---------|
| 0–10% | True failure — price continued against the trade |
| 10–25% | Minor bounce, stop was appropriate |
| 25–50% | Significant reversal — stop may have been premature |
| 50–75% | Strong reversal toward T1 — likely shakeout |
| 75–100%+ | Price reached or exceeded T1 — definitive shakeout |

**Output 2: Minimum Additional Stop Distance**

For trades in the 50–100%+ bucket (shakeouts), compute `min_additional_points = max_adverse_excursion_beyond_stop - 0`. This tells us exactly how many additional points of stop width would have survived the shakeout.

**Output 3: Regime-Stratified Shakeout Rates**

Break down shakeout rates (50%+ bucket) by regime:

| Regime | Total Stops | Shakeouts (50%+) | Shakeout Rate | Median Additional Points Needed |
|--------|------------|-------------------|---------------|-------------------------------|
| compression | — | — | — | — |
| ranging | — | — | — | — |
| trending | — | — | — | — |
| breakout | — | — | — | — |

**Output 4: ATR Multiplier Sensitivity Curve**

For each stopped-out trade, compute what ATR multiplier would have been needed to avoid the shakeout. Plot: X-axis = hypothetical ATR multiplier (0.5 to 3.0, step 0.1), Y-axis = % of shakeouts that would have been avoided at that multiplier. The "knee" of this curve identifies the optimal base multiplier.

### 2.4 Implementation Notes

- Reuse `runSPXWinRateBacktest()` infrastructure for bar fetching and entry detection
- Post-stop price tracking requires fetching bars for 30 minutes after `stop_hit_at` (configurable window)
- Use existing `evaluateSetupAgainstBars()` bar-path traversal logic as reference
- Output as JSON to stdout (consistent with `spxFailureAttribution.ts` pattern)
- Persist summary rows to a new `spx_stop_heat_analysis` table or append to existing `spx_setup_instances.metadata`

### 2.5 Acceptance Criteria

- Script runs against 30+ sessions of historical data without error
- Produces all 4 output types with non-zero sample sizes per regime bucket
- Shakeout rate per regime is calculable with statistical significance (minimum 15 stopped-out trades per regime)
- ATR sensitivity curve has clear knee point or documented reason why it doesn't

---

## 3. Workstream 2: Regime-Aware Stop Parameter Tuning

**Priority:** SECOND — depends on Workstream 1 results.
**Target file:** `backend/src/services/spx/stopEngine.ts`
**Dependencies:** Workstream 1 heat analysis results, `spxBacktestWalkforward.ts`

### 3.1 Objective

Replace the static `DEFAULT_ATR_STOP_MULTIPLIER = 0.9` with a regime-aware base multiplier, and adjust `MEAN_REVERSION_STOP_CONFIG.maxPoints` values — all calibrated to the empirical shakeout data from Workstream 1.

### 3.2 Proposed Changes

**Change 1: Regime-aware base ATR multiplier**

Add a new function and update `calculateAdaptiveStop()` to use it:

```typescript
// New function
function getRegimeBaseAtrMultiplier(regime: Regime | null | undefined): number {
  switch (regime) {
    case 'trending':    return 1.3;   // Subject to W1 calibration
    case 'breakout':    return 1.5;   // Subject to W1 calibration
    case 'ranging':     return 1.0;   // Subject to W1 calibration
    case 'compression': return 0.85;  // Tight stops valid in low-vol
    default:            return 1.0;
  }
}
```

The exact values above are *starting proposals*. They MUST be validated against Workstream 1's ATR sensitivity curve before committing. The curve's knee point per regime determines the actual values.

**Change 2: Update calculateAdaptiveStop() to accept regime**

The function already accepts `regime` in `AdaptiveStopInput`. The change is to use `getRegimeBaseAtrMultiplier(input.regime)` as the fallback when `input.atrStopMultiplier` is not explicitly provided, instead of the static `DEFAULT_ATR_STOP_MULTIPLIER`.

```typescript
// Current
const atrStopMultiplier = clamp(
  toFiniteNumber(input.atrStopMultiplier) ?? DEFAULT_ATR_STOP_MULTIPLIER,
  0.1, 3
);

// Proposed
const atrStopMultiplier = clamp(
  toFiniteNumber(input.atrStopMultiplier) ?? getRegimeBaseAtrMultiplier(input.regime),
  0.1, 3
);
```

**Change 3: Widen mean reversion maxPoints (calibrated)**

| Regime | Current maxPoints | Proposed maxPoints | Rationale |
|--------|------------------|--------------------|-----------|
| compression | 8 | 8–10 | Low-vol regime legitimately warrants tighter caps |
| ranging | 9 | 12–15 | W1 data will show if 9 is causing shakeouts |
| trending | 10 | 13–16 | Trend moves need room for pullback noise |
| breakout | 12 | 15–20 | High-volatility regime needs widest caps |

Final values depend on Workstream 1's regime-stratified "minimum additional points needed" data.

### 3.3 Composition Chain Ceiling Check

**Critical concern:** The regime-aware multiplier compounds with VIX, GEX directional, GEX magnitude, and geometry scales. Under worst-case stacking (breakout regime 1.5 × extreme VIX 1.6 × negative GEX mean reversion 1.1 × far-from-level 1.2 × geometry 2.0), the total scale could reach `1.5 × 1.6 × 1.1 × 1.2 × 2.0 = 6.34`. The existing `clamp(0.2, 5.0)` on `totalScale` handles geometry/VIX/GEX composition, but the ATR multiplier is applied *before* the composition chain (as the floor), not within it.

**Required safeguard:** Add a post-composition ceiling on final `riskPoints` relative to ATR:

```typescript
// After all scaling, cap final risk at a maximum ATR multiple
const MAX_EFFECTIVE_ATR_MULTIPLE = 3.0;
const atr = toFiniteNumber(input.atr14);
if (atr != null && atr > 0) {
  const maxRiskFromAtr = atr * MAX_EFFECTIVE_ATR_MULTIPLE;
  riskPoints = Math.min(riskPoints, maxRiskFromAtr);
}
```

This prevents pathological stacking from producing stops that are unreasonably wide.

### 3.4 Validation Protocol

1. Run `spxBacktestWalkforward.ts` with current parameters (baseline)
2. Apply proposed changes
3. Run `spxBacktestWalkforward.ts` with new parameters
4. Compare: win rate, T1 hit rate, stop hit rate, average R, cumulative R, expectancy R
5. Run per-regime breakdown to confirm improvement is targeted (not just globally wider stops)
6. Run replay engine on 5 recent sessions to verify visual behavior
7. If cumulative R or expectancy R decreases, do not ship — investigate per-regime

### 3.5 Acceptance Criteria

- Backtest T1 win rate improves by measurable margin (target: 3%+ absolute improvement)
- Stop hit rate decreases without proportional decrease in T2 rate
- Expectancy R is equal or improved
- No regime shows degraded performance vs baseline
- Post-composition ceiling prevents any trade from having >3.0 ATR effective stop
- All existing unit tests in `lib/spx/__tests__/` pass

---

## 4. Workstream 3: Phase-Aware Coach Tone

**Priority:** THIRD — independent of W1/W2 but lower urgency.
**Target file:** `backend/src/services/spx/executionCoach.ts`
**Dependencies:** None (can proceed in parallel with W1/W2)

### 4.1 Objective

Restructure coach message `content` strings to use phase-appropriate psychological framing: observational for pre-trade, commanding for in-trade, and reflective for post-trade. Preserve all structured data payloads unchanged.

### 4.2 Tone Framework

| Phase | Psychological Goal | Tone | Prefix |
|-------|-------------------|------|--------|
| Pre-trade (`triggered`) | Build informed confidence, not pressure | Observational | "Observation:" |
| In-trade (`target1_hit`) | Provide clarity under pressure | Commanding | "Action:" |
| In-trade (`target2_hit`) | Clean exit with closure | Commanding | "Action:" |
| Post-trade (stop hit) | Preserve discipline, no blame | Protective | "Risk protocol:" |
| Post-trade (new — after exit) | Compound learning | Reflective | "Review:" |

### 4.3 Proposed Message Rewrites

**Pre-trade (buildTriggeredDirective):**

```
// Current:
"Execution command: ENTER BULLISH Trend Pullback. Entry 5020.00-5021.50 (ref 5020.75),
 stop 5015.00, T1 5028.00, T2 5035.00."

// Proposed:
"Observation: SPX testing {setupType} zone at {entryLow}-{entryHigh}.
 {directionAdj} setup with {confluenceContext}. Favorable R:R at ref {entryMid},
 stop {stop}, T1 {target1}, T2 {target2}."
```

The `confluenceContext` should be derived from the setup's `decisionDrivers` if available — e.g., "bullish flow confirmed, GEX aligned, regime favorable." If drivers aren't available at this layer, use the setup's `confluenceScore` as a fallback: "confluence 4/5."

**In-trade (buildTarget1Directive) — NO CHANGE:**

```
// Keep exactly as-is:
"Execution command: TAKE 55% at T1 5028.00 and move stop to breakeven 5020.75."
```

The imperative tone is correct for active risk management. Traders need clarity, not prose, when managing live positions.

**In-trade (buildTarget2Directive) — MINOR TONE SHIFT:**

```
// Current:
"Execution command: EXIT remainder at T2 5035.00. Setup objective complete."

// Proposed:
"Action: EXIT remainder at T2 {target2}. Full objective reached."
```

**Stop hit (buildStopDirective) — TONE SHIFT:**

```
// Current:
"Execution command: EXIT now. Stop condition confirmed near 5015.00;
 stand down and preserve capital."

// Proposed:
"Risk protocol: Stop {stop} confirmed. Exit and preserve capital.
 Discipline held — review the setup post-session."
```

**New — Post-trade reflective message (new function):**

Add a `buildReflectiveDirective()` that fires after trade completion (both wins and losses). This requires a new transition event type or a delayed emission after `target2_hit` or `invalidated(stop)`.

```
// After T2 win:
"Review: Trade captured T2 at {target2}. {setupType} in {regime} regime —
 note conditions for future reference."

// After stop loss:
"Review: Stop hit at {stop}. Setup was {setupType} in {regime}.
 Check if entry timing or regime read can improve."
```

**Implementation note:** The reflective message is a new `CoachMessage.type = 'reflection'` that the frontend can render with lower visual priority (muted styling, no alert sound). It should fire 5–10 seconds after the exit event to avoid cluttering the decision moment.

### 4.4 Changes Required

| File | Change | Scope |
|------|--------|-------|
| `executionCoach.ts` | Rewrite `buildTriggeredDirective` content string | Content only |
| `executionCoach.ts` | Minor rewrite `buildTarget2Directive` content string | Content only |
| `executionCoach.ts` | Rewrite `buildStopDirective` content string | Content only |
| `executionCoach.ts` | Add `buildReflectiveDirective()` function | New function |
| `executionCoach.ts` | Update `buildExecutionCoachMessageFromTransition` to emit reflection | New case |
| Coach types (`types.ts`) | Add `'reflection'` to `CoachMessage['type']` union | Type extension |
| Frontend coach renderer | Handle `type: 'reflection'` with muted styling | Display only |

### 4.5 What Does NOT Change

- `ExecutionDirective` interface — untouched
- `structuredData` payloads — untouched
- `CoachMessage.structuredData.executionDirective` — untouched
- One-click execution card behavior — untouched
- `buildTarget1Directive` — untouched (commanding tone stays for active management)

### 4.6 Acceptance Criteria

- All existing coach message test assertions updated to match new content strings
- Structured data payloads are byte-identical before and after the change
- Frontend renders `'reflection'` type without errors (graceful fallback if not styled yet)
- No regressions in coach message emission timing or deduplication

---

## 5. Workstream 4: Shadow Gate A/B Testing

**Priority:** FOURTH — highest information value but lowest urgency.
**Target file:** `backend/src/services/spx/setupDetector.ts`, new script `backend/src/scripts/spxShadowGateAnalysis.ts`
**Dependencies:** `spx_setup_instances` table, `runSPXWinRateBacktest()`

### 5.1 Objective

Determine whether the current `evaluateOptimizationGate()` filters are rejecting setups that would have been profitable. Run parallel scoring: keep existing gates active for production UI, but log every setup that fails the gate with confluence >= 3 alongside its eventual price outcome.

### 5.2 Shadow Logging Design

**Current flow in `detectActiveSetups()`:**

```
zone → setup candidate → evaluateOptimizationGate() → pass/blocked → tier assignment
```

**Proposed flow:**

```
zone → setup candidate → evaluateOptimizationGate() → pass/blocked → tier assignment
                                                    ↘ if blocked && confluenceScore >= 3:
                                                       log to shadow_gate_instances[]
                                                       persist with gateStatus='shadow_blocked'
```

**What to log for shadow-blocked setups:**

| Field | Purpose |
|-------|---------|
| All standard setup instance fields | Enable identical backtest treatment |
| `gateStatus: 'shadow_blocked'` | Distinguish from production-blocked |
| `gateReasons: string[]` | The specific reasons for rejection |
| `confluenceScore` | The setup's confluence at time of rejection |
| `weightedConfluenceBreakdown` | Full breakdown (flow, EMA, zone, GEX, regime, multiTF, memory) |
| `pWinCalibrated` | Win probability at rejection |
| `evR` | Expected value at rejection |

### 5.3 Analysis Script

After 5+ trading sessions of shadow logging, run analysis:

**Query 1: Shadow setup outcome distribution**

```sql
SELECT
  final_outcome,
  COUNT(*) as count,
  AVG(realized_r) as avg_r
FROM spx_setup_instances
WHERE gate_status = 'shadow_blocked'
  AND final_outcome IS NOT NULL
GROUP BY final_outcome
```

**Query 2: Gate reason effectiveness**

For each unique `gateReason`, compute:
- How many setups it blocked
- Of those blocked setups, what percentage would have been T1 winners
- Of those blocked setups, what was the average realized R

If a gate reason blocks setups that would have been 65%+ T1 winners, that gate is destroying edge.

**Query 3: Comparison with production setups**

| Metric | Production Setups | Shadow-Blocked Setups | Delta |
|--------|------------------|----------------------|-------|
| T1 win rate | — | — | — |
| T2 win rate | — | — | — |
| Stop rate | — | — | — |
| Avg R | — | — | — |
| Expectancy R | — | — | — |

### 5.4 Implementation Notes

- Shadow logging should have negligible performance impact (one additional `persistSetupInstancesForWinRate` call per detection cycle for blocked setups)
- Shadow setups should NEVER appear in the production UI — `tier: 'shadow'` or `gateStatus: 'shadow_blocked'` must be filtered in all frontend queries
- Backtest resolution for shadow setups: run `spxResolveOutcomes.ts` with `includeBlockedSetups: true` (already supported)
- The analysis script should output JSON consistent with `spxFailureAttribution.ts` format

### 5.5 Gate Reasons to Watch

Based on current `evaluateOptimizationGate()` implementation, the most likely over-filtering candidates are:

| Gate Reason | Concern |
|-------------|---------|
| `flow_confirmation_required` | Flow data may be sparse/unavailable, not necessarily contra-directional |
| `ema_alignment_below_threshold` | EMA lags; short-term misalignment may precede valid setups |
| `volume_regime_not_aligned` | Volume regime is a weak signal for individual setup quality |
| `vwap_directional_filter` | VWAP position may be transitional at setup detection time |

### 5.6 Acceptance Criteria

- Shadow logging persists blocked setups without affecting production UI or setup feed
- Analysis script produces all 3 query outputs with per-gate-reason breakdown
- Minimum 5 full sessions of shadow data before drawing conclusions
- Any gate reason that blocks setups with >60% T1 win rate is flagged for parameter relaxation

---

## 6. Perspective Reviews

### 6.1 Developer Perspective

**Architecture impact:** Minimal. All changes are within existing service boundaries. No new tables (shadow logging reuses `spx_setup_instances` with a new `gateStatus` value). No new API endpoints. No frontend component changes (except optional `'reflection'` message styling).

**Code quality concerns:**

- The `getRegimeBaseAtrMultiplier()` function introduces a new branching point in the stop calculation. It must be unit tested for all 5 cases (4 regimes + null/undefined fallback).
- The post-composition ceiling (`MAX_EFFECTIVE_ATR_MULTIPLE = 3.0`) is a new constraint that could conflict with optimizer profile geometry policies that intentionally set wide stops. The optimizer's `geometryPolicy.stopScale` must be validated against this ceiling to ensure no existing profiles are silently capped.
- Shadow logging adds a write path to `persistSetupInstancesForWinRate()` that runs every detection cycle. While the function already handles bulk upserts efficiently, monitor for increased Supabase write latency during high-setup-count sessions.
- The reflective coach message requires a delayed emission mechanism. Options: (a) setTimeout in the transition handler (simple but loses message if process restarts), (b) queue with configurable delay (robust but adds complexity). Recommend (a) for v1 with a TODO for (b).

**Test coverage requirements:**

| File | New Tests Needed |
|------|-----------------|
| `stopEngine.ts` | `getRegimeBaseAtrMultiplier` — all regimes; post-composition ceiling; integration with existing scaling |
| `executionCoach.ts` | Updated content string assertions; new `buildReflectiveDirective` tests; `'reflection'` type emission |
| `setupDetector.ts` | Shadow logging path; blocked setup persistence; shadow setups excluded from production queries |
| `spxStopHeatAnalysis.ts` | Script execution; output format; edge cases (no stopped-out trades, single-regime data) |

**Dependency management:** No new npm packages. All work uses existing Supabase client, Massive API client, and TypeScript utilities.

### 6.2 User Experience Perspective

**The "feel" problem:** The current system issues commands ("Execution command: ENTER BULLISH...") which creates a master-subordinate dynamic. The trader feels like they're executing someone else's trades rather than making informed decisions with AI support. This is psychologically corrosive over time — it erodes confidence in one's own judgment and creates anxiety when the "command" conflicts with the trader's read.

**Pre-trade tone shift impact:** Changing to "Observation: SPX testing Trend Pullback zone..." reframes the AI as a co-pilot presenting data, not a commander issuing orders. The trader retains agency. The one-click execution card still provides the convenience of fast entry — but now the trader *chooses* to execute rather than *complying* with a command.

**In-trade tone preservation:** Keeping "TAKE 55% at T1..." as a direct imperative is correct. During active trade management, the trader is under cognitive load and needs clarity. Switching to observational language mid-trade would create dangerous ambiguity. The phase-aware split (observational before, commanding during, reflective after) maps to the natural psychological arc of a trade.

**Reflective post-trade messages:** This is the most underrated addition. Trading improvement compounds through post-trade review, not pre-trade analysis. A brief "Review: Trade captured T2. Note the conditions..." nudge after each trade seeds the habit of reflective practice without requiring the trader to journal every trade manually.

**Stop width impact on trader psychology:** Wider stops have a counterintuitive UX effect — they *reduce* anxiety. When stops are too tight, traders experience frequent small losses that feel like "death by a thousand cuts." This creates a negative reinforcement loop where the trader starts second-guessing entries. Appropriately-sized stops mean fewer stop-outs, which means the trader's experience of the system skews more positive, which reinforces trust and discipline.

**Risk:** If stops are widened without improving win rate (i.e., the shakeout thesis is wrong), the experience gets *worse* — the same number of losses but each one larger. This is why Workstream 1 (heat analysis) must come first.

### 6.3 Advanced Trader Perspective

**Stop calibration realism:** A 0.9 ATR stop on SPX is not viable for most intraday strategies. The ES/SPX market microstructure involves institutional algorithms that systematically probe liquidity within 1 ATR of recent pivots. Sub-1-ATR stops are essentially placing your exit at the exact level where market makers hunt liquidity. The proposed regime-aware approach (0.85 compression, 1.0 ranging, 1.3 trending, 1.5 breakout) aligns with how professional discretionary traders adjust their risk parameters.

**Mean reversion cap analysis:** The current 8-point cap for compression mean reversion is defensible — compression regimes genuinely exhibit narrow ranges. However, the 9-point cap for ranging is too close to compression. Ranging regimes on SPX regularly produce 12-15 point swings around VWAP. A 9-point stop on a ranging mean reversion setup means you're stopped out by normal range oscillation, not by the setup being wrong.

**Optimization gate concerns:** The most dangerous gate for an active trader is `flow_confirmation_required`. Options flow data has inherent latency (exchange reporting delays, aggregation windows) and coverage gaps (not all exchanges, filtered by premium thresholds). A gate that requires flow confirmation before allowing a setup effectively adds a random filter — setups pass or fail based partly on data availability, not signal quality. The shadow gate analysis should specifically track flow availability per session to distinguish "flow was contra-directional" (valid rejection) from "flow data was unavailable" (spurious rejection).

**Backtest methodology concern:** The existing backtest uses second-level bars, which is excellent for entry/stop/target hit detection. However, the shakeout analysis needs to account for *intrabar* behavior — price may touch the stop level and reverse within the same second. At second-level resolution, this appears as a stop hit followed by reversal, but in reality, the stop order may not have filled if it was a wick. The heat analysis should flag trades where the stop was hit by less than 0.5 points as "marginal stops" and analyze them separately.

**Expectancy vs win rate:** Widening stops will almost certainly improve win rate. The critical question is whether it improves *expectancy* (average R per trade). Wider stops mean each losing trade costs more R. If the shakeout prevention converts 10% of stops into T1 winners but the remaining 90% of losing trades now cost 1.5R instead of 1.0R, the net expectancy could be negative. The validation in Workstream 2 must track expectancy, not just win rate.

**Position sizing implication:** If stops widen from ~5 points to ~8 points on average, the trader's position size must decrease proportionally to maintain constant dollar risk. The system should surface the effective position size change somewhere visible — even a simple note in the coach message: "Note: wider stop — adjust size to maintain $X risk."

### 6.4 Data Accuracy Perspective

**ATR14 source validation:** The `atr14` value fed to `calculateAdaptiveStop()` comes from `buildIndicatorContextFromBars()` in `setupDetector.ts`. This computes ATR from the minute bars fetched from Massive API. Potential issues:

- **Bar completeness:** If Massive returns incomplete bars (missing sessions, gaps), ATR14 will be understated, making the 0.9 multiplier even more punishing.
- **Bar resolution mismatch:** ATR computed from 1-minute bars differs from ATR computed from 5-minute or daily bars. The stop engine uses 1-minute ATR, which has higher variance and may not represent the "true" volatility the stop needs to survive.
- **Recommendation:** The heat analysis script should log the ATR14 value alongside each stopped-out trade and compute the coefficient of variation across the dataset. If ATR14 varies by >30% between sessions, consider using a blended ATR (1-min + 5-min) for more stable stop floors.

**Outcome resolution accuracy:** The `evaluateSetupAgainstBars()` function in `winRateBacktest.ts` uses a 3-4 segment intrabar path to determine hit order (did stop or target get hit first within a bar). This is good practice, but at minute resolution, a bar that touches both stop and target is ambiguous. The backtest already counts these as `ambiguousBars`. The heat analysis should exclude trades with ambiguous bars from the shakeout calculation, or at minimum report the ambiguity rate.

**Flow data integrity:** `spxFailureAttribution.ts` already tracks flow availability by date (`flowAvailable%`, `flowSparse%`, `flowUnavailable%`). For the shadow gate analysis, this same tracking must be applied to understand whether gate rejections correlate with flow data gaps rather than genuine flow misalignment.

**GEX data freshness:** The GEX values (`netGex`, `gexDistanceBp`) used in stop scaling come from real-time options data via Massive. If GEX updates lag price by even 30 seconds, the stop scaling may use stale data. The heat analysis should log GEX update timestamps alongside stop calculations to verify data freshness.

**Win rate baseline tables:** The existing `WIN_RATE_BY_SCORE` in `setupDetector.ts` maps confluence scores to baseline win rates (score 1 → 35%, score 5 → 82%). These baselines must be re-validated after any stop parameter changes, since wider stops will mechanically improve win rates and the old baselines will no longer be accurate. After Workstream 2 ships, the win rate table should be recalculated from the new backtest results.

**Backtest look-ahead bias:** The heat analysis must avoid look-ahead bias in the "post-stop extreme" calculation. When computing how far price traveled toward T1 after stop hit, only use bars *after* the stop timestamp, and limit the forward window to the setup's original TTL (not the end of the session). Otherwise, price might reach T1 hours later in a completely different market regime, making the shakeout conclusion spurious.

---

## 7. Validation Gates

### 7.1 Per-Workstream Gates

| Workstream | Gate | Command |
|-----------|------|---------|
| W1: Heat Analysis | Script executes without error, output format valid | `npx tsx backend/src/scripts/spxStopHeatAnalysis.ts --from 2026-01-02 --to 2026-02-22` |
| W2: Stop Tuning | All unit tests pass | `pnpm vitest run lib/spx/__tests__/ backend/src/services/spx/__tests__/` |
| W2: Stop Tuning | Backtest expectancy equal or improved | `npx tsx backend/src/scripts/spxBacktestWalkforward.ts` |
| W2: Stop Tuning | TypeScript compiles | `pnpm exec tsc --noEmit` |
| W3: Coach Tone | All unit tests pass | `pnpm vitest run backend/src/services/spx/__tests__/executionCoach*` |
| W3: Coach Tone | Structured data unchanged | Diff test on `structuredData` payloads |
| W4: Shadow Gate | Shadow setups don't appear in production UI | Manual verification + query filter test |
| W4: Shadow Gate | Analysis script produces valid output | `npx tsx backend/src/scripts/spxShadowGateAnalysis.ts` |

### 7.2 Release Gates (All Workstreams)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wider stops reduce expectancy (larger losses per trade) | Medium | High | W1 heat analysis validates thesis before W2 commits changes |
| Shadow gate logging increases Supabase write load | Low | Medium | Monitor write latency; add batch interval if needed |
| Post-composition ceiling (3.0 ATR) silently caps optimizer profiles | Medium | Medium | Audit all active profiles against ceiling before shipping |
| Reflective coach messages feel patronizing | Low | Low | Make them optional via user preference toggle |
| Heat analysis has insufficient sample size per regime | Medium | Medium | Extend date range; report confidence intervals |
| Flow data gaps bias shadow gate results | Medium | High | Track and report flow availability alongside gate analysis |
| ATR14 computed from incomplete bars understates volatility | Low | High | Log and validate ATR source data in heat analysis |
| Look-ahead bias in post-stop analysis | Medium | High | Enforce strict TTL window and post-stop-only bar filtering |

---

## 9. Rollback Plan

All changes are behind the following rollback boundaries:

| Workstream | Rollback Method |
|-----------|----------------|
| W1: Heat Analysis | Delete script; no production code touched |
| W2: Stop Tuning | Revert `getRegimeBaseAtrMultiplier()` to static constant; revert `maxPoints` values; remove ceiling check |
| W3: Coach Tone | Revert `content` strings in 3 functions; remove `buildReflectiveDirective()`; remove `'reflection'` type |
| W4: Shadow Gate | Remove shadow logging branch; delete analysis script; shadow instances remain in DB but are inert |

No database migrations are required for any workstream. No schema changes. All changes are application-layer code.

---

## 10. Success Criteria

### Quantitative (after 20+ trading sessions with new parameters)

| Metric | Current Baseline | Target | Measurement |
|--------|-----------------|--------|-------------|
| T1 win rate (triggered setups) | TBD from backtest | +3% absolute | Walk-forward backtest |
| Stop hit rate | TBD from backtest | -5% absolute | Walk-forward backtest |
| Expectancy R | TBD from backtest | ≥ current | Walk-forward backtest |
| Shakeout rate (50%+ reversal after stop) | TBD from W1 | -50% relative | Heat analysis comparison |
| Shadow gate profitable rejection rate | TBD from W4 | Documented | Shadow gate analysis |

### Qualitative

- Trader reports reduced "stopped out then it reversed" frustration
- Pre-trade coach messages feel informational rather than pressuring
- Post-trade reflective messages are noticed and occasionally useful
- No increase in "the system told me to do X and it was wrong" sentiment

---

*End of specification. This document is designed for review by Developer, UX, Advanced Trader, and Data Accuracy agents. Each perspective section (6.1–6.4) contains domain-specific concerns and recommendations that should be evaluated independently.*
