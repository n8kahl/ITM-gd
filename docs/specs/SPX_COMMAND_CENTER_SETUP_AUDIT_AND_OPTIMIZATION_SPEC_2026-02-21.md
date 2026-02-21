# SPX Command Center Setup Audit + Optimization Spec

Date: February 21, 2026  
Scope: `/Users/natekahl/ITM-gd/backend/src/services/spx/*`, `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/*`, `/Users/natekahl/ITM-gd/backend/src/services/positions/*`, `/Users/natekahl/ITM-gd/backend/src/config/massive.ts`

## 1) Discovery + Drift (Last 5 Hours)

Reviewed commits since `2026-02-21 12:00:00 -0600`:

1. `257ec4e` (`2026-02-21 15:04:31 -0600`) - SPX overlay readability/anchor semantics (UI only).
2. `43878cd` (`2026-02-21 14:11:18 -0600`) - SPX overlay pan sync/setup-lock anchor (UI only).

Conclusion: no backend strategy logic drift in last 5 hours; win-rate behavior is driven by current SPX engine/data implementation, not recent commit regression.

## 2) Baseline Accuracy Run (Strict Massive Backtest)

Executed:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
2. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Observed:

1. Backfill succeeded for all 5 sessions (`attemptedDays=5`, `successfulDays=5`).
2. Backtest source is `spx_setup_instances`, resolution `second`.
3. `usedMassiveMinuteBars=false` and `resolutionFallbackSessions=[]`.
4. Last-week metrics (`2026-02-16` to `2026-02-20`):
   1. `setupCount=32`
   2. `triggeredCount=9`
   3. `T1 win rate=33.33%`
   4. `T2 win rate=0.00%`
   5. `failure rate=66.67%`
   6. `expectancy=+0.1355R`
5. Triggered setups were exclusively `fade_at_wall` in that week.

## 3) Phase Audit Findings

### Phase 1: Massive Data Pipeline + Fidelity

Current strengths:

1. Full snapshot pagination now configurable and expanded via `MASSIVE_OPTIONS_SNAPSHOT_MAX_PAGES` in `/Users/natekahl/ITM-gd/backend/src/config/massive.ts`.
2. Historical replay uses Massive SPX 1-second bars in `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`.
3. Historical reconstruction uses Massive options snapshots (`as_of`) and intervalized contract bars in `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`.

Gaps:

1. Tick payload currently normalizes only `price/size/timestamp/sequence` in `/Users/natekahl/ITM-gd/backend/src/services/massiveTickStream.ts` and loses quote microstructure fields.
2. Tick cache dedupe/order rules may suppress informative micro-events in `/Users/natekahl/ITM-gd/backend/src/services/tickCache.ts`.
3. Microbar model stores OHLCV only, with no bid/ask imbalance or aggressor proxy in `/Users/natekahl/ITM-gd/backend/src/services/spx/microbarAggregator.ts`.

### Phase 2: Setup Logic Optimization (Win Rate)

Current strengths:

1. SPX engine includes regime/flow/EMA/volume gating and lifecycle invalidation in `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`.
2. Historical reconstruction includes time-sliced EMA/volume/ORB/fib confluence at each bar in `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`.

Gaps:

1. Strike-level options volume/OI confluence is not integrated into level-test signals in `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/levelTest.ts` or `/Users/natekahl/ITM-gd/backend/src/services/levels/confluenceDetector.ts`.
2. `volumeClimax` and `vwap` do not use bid/ask spread dynamics or aggressor direction in `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/volumeClimax.ts` and `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/vwap.ts`.
3. `gammaSqueeze` remains OI-dominant (gamma*OI) and does not fuse intraday OI deltas/flow pressure directly at trigger time in `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/gammaSqueeze.ts`.
4. Strategy mix is weak: recent triggered outcomes are concentrated in `fade_at_wall` with poor fail profile.

### Phase 3: Contract Selection + Execution

Current strengths:

1. Contract selection filters liquidity/spread/risk and scores delta/gamma/theta in `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`.

Gaps:

1. Delta targeting is setup-type based only, not regime-conditioned.
2. No hard late-day 0DTE cutoff to force 1DTE roll.
3. Spread filtering uses static max spread only; no quote persistence or spread-volatility checks.

### Phase 4: R:R and Trade Management

Current strengths:

1. Backtest execution model already accounts for slippage/fees/partials in `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`.

Gaps:

1. `tradeBuilder` still emits static ATR/range stop-target templates, without structure-based stop anchors or hard min R:R gate in `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/tradeBuilder.ts`.
2. `exitAdvisor` uses coarse PnL/theta thresholds only; no mechanical 1R/2R scale-out + pivot trailing in `/Users/natekahl/ITM-gd/backend/src/services/positions/exitAdvisor.ts`.
3. `risk-envelope` does not enforce ADR-feasibility-adjusted target realism in `/Users/natekahl/ITM-gd/lib/spx/risk-envelope.ts`.

### Phase 5: Measurement + Ops

Current strengths:

1. Canonical transition persistence and analytics pipeline exists in `/Users/natekahl/ITM-gd/backend/src/services/spx/outcomeTracker.ts`.
2. Backtest endpoint + optimizer scorecard + scan endpoint are live in `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`.
3. UI includes scan trigger and scorecard panel in `/Users/natekahl/ITM-gd/components/spx-command-center/optimizer-scorecard-panel.tsx`.

Gaps:

1. Denominator uses `resolved_triggered`; this is valid but must be reported with pending sample explicitly in UI to avoid misread.
2. No explicit confidence intervals on small N in backend response contract.

## 4) Strategy Decisions (Add/Update/Remove)

Based on current Massive-backed evidence:

1. **Remove/Pause now**:
   1. `mean_reversion|ranging` combo (already flagged by optimizer) due sustained underperformance.
2. **Update now**:
   1. `fade_at_wall` entry criteria: require stronger flow/EMA confirmation and tighter time-of-day constraints.
3. **Add now**:
   1. `orb_breakout`, `trend_pullback`, `flip_reclaim` variants with strict flow/structure confluence to diversify away from fade-only trigger mix.

## 5) Is Current Backtest Live-Representative?

Partial yes:

1. Uses Massive historical SPX second bars with no minute fallback in strict run.
2. Uses historical options snapshots + intervalized contract bars for confluence reconstruction.

Not fully institutional yet:

1. Does not replay full options tick tape and full depth/quote microstructure.
2. Detector microstructure features are still bar-centric and miss bid/ask imbalance dynamics.

## 6) Gated Implementation Plan (Production)

### Slice A - Tick + Quote Fidelity

1. Extend normalized tick schema with quote fields (`bid/ask/bidSize/askSize`) and aggressor-side proxy.
2. Upgrade microbar aggregator with imbalance features.
3. Add tests for sequence/order handling and microbar imbalance metrics.

Gate:

1. `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts`

### Slice B - Setup Quality Uplift

1. Inject strike-level options confluence into level and breakout gating.
2. Add global macro kill-switch scoring in SPX setup detector.
3. Enable regime-aware setup-mix caps to avoid single-strategy concentration.

Gate:

1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`
2. `pnpm --dir backend test -- src/services/setupDetector/__tests__/levelTest.test.ts`

### Slice C - Execution + R:R Discipline

1. Regime-aware delta targeting in contract selector.
2. Hard 0DTE cutoff (ET clock) with mandatory 1DTE roll.
3. Hard min R:R gate (`>=2.0`) plus ADR feasibility check before setup promotion.

Gate:

1. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`

### Slice D - Trade Management Mechanics

1. Add deterministic 1R/2R scale-out and pivot-based trailing in exit advisor.
2. Persist realized-R path attributes for post-trade calibration.

Gate:

1. `pnpm --dir backend test -- src/services/positions/__tests__/exitAdvisor.test.ts`

### Slice E - Validation + Release

1. Replay backfill + second-resolution backtest for rolling 20-session window.
2. Compare baseline vs optimized with sample-size and confidence metadata.
3. Promote only if:
   1. `T1` improves with equal/better `T2`.
   2. failure rate drops.
   3. objective score improves on validation window.

Gate:

1. `pnpm --dir backend spx:backfill-historical <from> <to>`
2. `pnpm --dir backend backtest:last-week instances second`
3. `pnpm --dir backend spx:optimizer-weekly`

