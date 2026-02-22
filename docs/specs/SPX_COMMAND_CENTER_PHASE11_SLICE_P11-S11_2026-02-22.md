# SPX Command Center Phase 11 - Slice P11-S11

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Failure attribution, trend-family optimization, ORB flow-quality gate, execution hardening, and promotion guardrails.

## Objectives

1. Identify where strict losses are concentrated by setup/regime/time bucket.
2. Apply conservative trend/mean/fade target refinements that improve strict T1/T2 without destabilizing expectancy.
3. Add ORB flow-quality gate to prevent low-information ORB entries.
4. Harden contract selection against late-day 0DTE/slippage decay.
5. Enforce institutional promotion gates in optimizer auto-apply logic.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
4. `/Users/natekahl/ITM-gd/backend/src/scripts/spxSweepGeometry.ts`
5. `/Users/natekahl/ITM-gd/backend/src/scripts/spxFailureAttribution.ts`
6. `/Users/natekahl/ITM-gd/backend/package.json`
7. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md`

## Implementation Summary

1. Added `spxFailureAttribution.ts` for strict triggered-trade failure breakdowns by regime/time/confluence/flow/EMA/volume.
2. Added ORB-specific flow quality gating (`flow_quality_low`, `flow_event_count_low`) in setup gating.
3. Added trend-pullback regime/time specialization (`trend_timing_window`) and maintained pullback-only grace controls.
4. Applied conservative target-distance scaling:
   - trend pullback: reduced target distance (improved practical hit rates)
   - mean reversion + fade: mild target tightening
5. Contract selector hardening:
   - stricter base spread/liquidity filters
   - stricter late-day quote checks
   - 0DTE rollover cutoff moved earlier to `13:00 ET`
6. Optimizer promotion gates upgraded:
   - require T1 +3pp, T2 +2pp, expectancy +0.10R, failure deterioration <= +1pp, conservative objective delta >= 0.
7. Geometry sweep script expanded for trend families and fast-mode support for operational use.

## Key Analysis Evidence

### Failure Attribution (Strict)

Command:

1. `pnpm --dir backend spx:failure-attribution 2026-01-02 2026-02-20 trend_pullback,orb_breakout,mean_reversion,fade_at_wall`

Highlights:

1. `trend_pullback` stop rate remained the highest among active strict families before refinements (`~51.72%` in analyzed sample).
2. Breakout regime was the highest-risk regime bucket.
3. Late trigger windows (`240+` minutes) showed weaker quality versus mid-session windows.

### Conservative Geometry Probe (Targeted)

Command:

1. `pnpm --dir backend exec tsx -e "<targeted geometry candidate comparison>"`

Result:

1. Combined conservative geometry outperformed baseline on conservative objective in test window (`2026-01-20..2026-02-20`).
2. Trend pullback improved from baseline in that comparison window.

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/winRateBacktest.test.ts`
2. `pnpm --dir backend build`
3. `pnpm --dir backend spx:optimizer-weekly`
4. `pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
5. `pnpm --dir backend backtest:last-week instances second`

## Current Strict Replay Snapshot

### Last Week (2026-02-16 to 2026-02-20)

1. `triggered=17`
2. `T1=76.47%`
3. `T2=70.59%`
4. `failure=17.65%`
5. `expectancyR=+1.0587`
6. `resolutionUsed=second`
7. `usedMassiveMinuteBars=false`

### YTD (2026-01-02 to 2026-02-20)

1. `triggered=114`
2. `T1=63.16%`
3. `T2=51.75%`
4. `failure=35.96%`
5. `expectancyR=+0.4823`

## EOD Lotto Position

1. No dedicated “end-of-day lotto” strategy is included in the strict system baseline.
2. Late-day 0DTE exposure is intentionally constrained via earlier rollover + tighter quote/liquidity filters.
3. Based on strict trigger bucket analysis, very-late entries reduce runner quality (`T2`) and increase variance; this is not favorable for baseline win-rate governance.
