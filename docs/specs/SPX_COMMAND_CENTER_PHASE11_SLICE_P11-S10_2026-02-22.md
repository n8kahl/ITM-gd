# SPX Command Center Phase 11 - Slice P11-S10

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: ORB/trend-pullback audit, gating rebalance, and 2026 YTD replay on Massive data.

## Objective

1. Explain why `orb_breakout` and `trend_pullback` were not producing expected actionable setups.
2. Improve trend-pullback actionability and target geometry without degrading strict live-parity win rate.
3. Keep ORB quality institutional-grade by preventing low-quality over-triggering.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
2. `/Users/natekahl/ITM-gd/backend/package.json`

## Root-Cause Findings

1. `trend_pullback` was detected but mostly blocked by strict flow/volume gates and tier suppression.
2. `orb_breakout` was not inferencing under prior opening momentum constraints.
3. When ORB constraints were relaxed too far, trigger rate increased but win rate collapsed (high false positives).
4. Trend-family targets were often too far from entry (`T1/T2` geometry too wide), suppressing realistic hit rates.

## Implementation Details

1. Added trend-family target geometry bounds in `setupDetector` so `trend_pullback`/`trend_continuation`/`orb_breakout` targets stay within bounded R-multiples.
2. Added triggered-setup visibility guard: non-blocked `triggered` setups cannot remain `hidden` tier.
3. Added trend-pullback-only gate grace (flow/volume) with time-bound windows to avoid blanket suppression.
4. Kept ORB strict quality floors (`confluence`, `pWin`, `EV`, flow/volume requirements) after testing showed relaxed ORB degraded win rate.
5. Improved ORB inference reachability (opening momentum allows `flat` volume early), while relying on strict gates to block weak ORB candidates.
6. Added script alias: `spx:sweep-geometry`.

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
2. `pnpm --dir backend build`

## Replay Evidence

### 1) Strict Last Week (2026-02-16 to 2026-02-20)

Command:

1. `pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
2. `pnpm --dir backend backtest:last-week instances second`

Final result (after ORB re-tightening):

1. `resolutionUsed=second`
2. `usedMassiveMinuteBars=false`
3. `triggered/resolved=18/18`
4. `T1/T2/failure=77.78% / 72.22% / 16.67%`
5. `expectancyR=+1.0735`

### 2) Strict YTD (2026-01-02 to 2026-02-20)

Command:

1. `pnpm --dir backend spx:backfill-historical 2026-01-02 2026-02-20`
2. `pnpm --dir backend exec tsx -e "...runSPXWinRateBacktest({ from:'2026-01-02', to:'2026-02-20', source:'spx_setup_instances', resolution:'second' })..."`

Final result:

1. `resolutionUsed=second`
2. `usedMassiveMinuteBars=false`
3. `triggered/resolved=117/117`
4. `T1/T2/failure=58.97% / 47.86% / 40.17%`
5. `expectancyR=+0.3397`

## ORB / Trend Status After Slice

1. `trend_pullback` is now actionable and contributes positively in strict last-week replay.
2. `orb_breakout` is inferenced but mostly blocked by strict flow/confluence quality gates, preventing low-quality activation.
3. ORB top block reasons remain flow-confirmation and flow-alignment-unavailable; this is intentional at current risk setting.

## Data Fidelity Notes (Massive)

1. Historical validation uses Massive second bars for SPX execution replay.
2. Historical options-flow confirmation is reconstructed from snapshots + contract minute aggregates.
3. Occasional Massive timeouts and zero-volume VWAP bars were observed during long replays; runs completed successfully with no failed days.
