# SPX Command Center Phase 15 Slice Report: P15-S6

**Date:** 2026-02-22
**Slice:** P15-S6
**Objective:** Run full promotion pipeline and compare against Gold Standard baseline.
**Status:** Completed (Promotion Blocked)

## 1) Scope
In scope:
1. Backfill historical data for strict replay window.
2. Run strict last-week replay backtest.
3. Run failure attribution to measure blocker elimination.
4. Compare vs Gold Standard baseline and record promotion decision.

Out of scope:
1. Code changes (measurement only).

## 2) Gate Commands and Results

### 2.1) Unit/Integration Confidence
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
- Result: **40/40 pass**

### 2.2) Static Compile
- `pnpm --dir backend exec tsc --noEmit`
- Result: **pass**

### 2.3) Historical Backfill
- `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-22`
- Result: **pass** (attemptedDays=5, successfulDays=5, failedDays=0)

### 2.4) Strict Replay
- `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
- Result:
  - `usedMassiveMinuteBars=false` ✓ (strict fidelity)
  - `setupCount=8`, `evaluatedSetupCount=8`
  - `triggeredCount=7`, `resolvedCount=7`
  - `t1WinRatePct=28.57` (target: >= 70%)
  - `t2WinRatePct=28.57` (target: >= 60%)
  - `expectancyR=-0.0932` (target: >= +0.8R)
  - All 7 triggered: `orb_breakout` in `breakout` regime
  - Notes: `Skipped 85 gate-blocked rows`, `Skipped 64 hidden-tier rows`

## 3) Blocker Elimination Audit

### Pre-Grace Baseline (P14-S5, last week):
| Blocker | Count |
|---------|-------|
| volume_regime_alignment_required | 42 |
| flow_confirmation_required | 30 |
| flow_alignment_unavailable | 30 |
| trend_orb_confluence_required | 23 |

### Post-Grace (P15, last week):
| Blocker | Count |
|---------|-------|
| pwin_below_floor | 56 |
| evr_below_floor | 37 |
| timing_gate_blocked | 36 |
| trend_orb_confluence_required | 23 |
| trend_timing_window | 17 |

**Eliminated blockers:** `flow_confirmation_required` (30→0), `flow_alignment_unavailable` (30→0), `volume_regime_alignment_required` (42→0). Total: **102 flow/volume blocks eliminated**.

**Remaining blockers** are quality hardblocks (pWin/EVR: 56+37=93, not targetable) and timing/confluence (36+23+17=76).

## 4) Promotion Parity Assessment

| Metric | Gold Standard | P14-S6 | P15 | Target |
|--------|--------------|--------|-----|--------|
| Triggered | 17 | 1 | 7 | >= 10 |
| T1 Win % | 76.47 | 100 | 28.57 | >= 70 |
| T2 Win % | 70.59 | 100 | 28.57 | >= 60 |
| Expectancy R | +1.128 | +3.406 | -0.093 | >= +0.8 |
| Fidelity | strict | strict | strict | strict |

## 5) Promotion Decision

**Decision: BLOCK production promotion.**

Rationale:
1. Throughput recovery succeeded (0→7 triggered), exceeding prior P14-S6 level (1).
2. Quality collapsed: T1=28.57% and expectancy=-0.093R are catastrophically below targets.
3. All triggered setups are ORB breakout in breakout regime — the lowest-conviction grace path.
4. Zero trend_pullback or trend_continuation setups triggered despite being the primary target.

## 6) Root Cause Analysis

1. **ORB sparse-flow grace is too permissive.** It admits ORB setups without flow confirmation in breakout regime, which historically has high false-positive rate. 5/7 stopped out.
2. **Trend pullback bottlenecked on `trend_orb_confluence_required` (23 blocks) and timing gates (17+17=34 blocks).** These are structural — trend setups need ORB confluence which is rare without actual ORB breaks, and timing gates constrain late-session setups.
3. **Week-specific regime**: All 7 triggered setups were `breakout` regime. ORB in breakout without flow is historically low-win-rate territory.

## 7) Recommended Next Steps

1. **Tighten ORB sparse-flow grace:** Require `confluenceScore >= 4` (instead of 3) and add additional quality floor (e.g., `pWinCalibrated >= 0.62`) for ORB sparse-flow grace.
2. **Relax `trend_orb_confluence_required`:** This is the biggest single recoverable blocker for trend_pullback (23 rows, 9 single-blocker). Consider relaxing to "ORB level near zone OR confirmed ORB break" instead of requiring full alignment.
3. **Widen trend timing windows:** `trend_timing_window` blocks 17 trend setups. Consider expanding by 30 min per regime bucket.
4. **Run YTD attribution** to confirm these patterns are stable and not week-specific.
5. **Consider regime-conditional ORB grace:** Only admit ORB sparse-flow grace in `trending` regime (not `breakout`).

## 8) Validation Summary

| Gate | Result |
|------|--------|
| Unit tests (40/40) | ✓ |
| Static compile (tsc) | ✓ |
| Historical backfill (5/5 days) | ✓ |
| Strict replay fidelity | ✓ |
| Throughput >= 10 triggered | ✗ (7) |
| T1 >= 70% | ✗ (28.57%) |
| Expectancy >= +0.8R | ✗ (-0.093R) |
| **Promotion** | **BLOCKED** |

## 9) Rollback
No code changes in this slice. If P15-S2/S3/S4 graces need rollback:
- `SPX_FLOW_UNAVAILABLE_GRACE_ENABLED=false`
- `SPX_VOLUME_GRACE_EXPANDED_ENABLED=false`
- Revert S4 ORB sparse-flow grace code
