# SPX Command Center Gold Standard Configuration

Date: 2026-02-22  
Status: Active baseline for SPX setup detection, backtest, and optimizer safety gates.

## Scope

This document defines the current production-grade baseline for:

1. Setup detection and gating
2. Backtest methodology and execution assumptions
3. Optimizer guardrails and pause policy
4. Reproducible performance baselines
5. Contract execution safety and late-day risk controls

## Data Fidelity Standard (Massive)

1. Live detection path uses Massive real-time aggregates/snapshots through the SPX engine.
2. Historical execution replay uses Massive `I:SPX` second bars (`resolution=second`) for setup outcome simulation.
3. Options-flow confirmation in replay is reconstructed from options snapshots plus option-contract minute aggregates.
4. Known limits:
   - No full historical L2/order-book aggressor-tape parity.
   - Occasional Massive timeout/zero-volume intervals may appear during long replays.

## Active Optimization Profile (Live)

Profile source: `scan`  
Profile generated at: `2026-02-22T03:01:24.493Z`

### Quality Gate

1. `minConfluenceScore=3`
2. `minPWinCalibrated=0.62`
3. `minEvR=0.2`
4. `actionableStatuses=["ready","triggered"]`

### Flow / Indicator / Timing Gates

1. Flow gate: `requireFlowConfirmation=false`, `minAlignmentPct=0`
2. Indicator gate: `requireEmaAlignment=false`, `requireVolumeRegimeAlignment=false`
3. Timing gate: enabled with max first-seen minute ET:
   - `fade_at_wall=300`
   - `breakout_vacuum=360`
   - `mean_reversion=330`
   - `trend_continuation=390`
   - `orb_breakout=180`
   - `trend_pullback=360`
   - `flip_reclaim=360`

### Regime / Drift Control

1. Regime gate: `minTradesPerCombo=12`, `minT1WinRatePct=48`, `pausedCombos=[]`
2. Drift control:
   - `enabled=true`
   - `shortWindowDays=5`
   - `longWindowDays=20`
   - `maxDropPct=12`
   - `minLongWindowTrades=20`
   - `autoQuarantineEnabled=true`
   - `triggerRateWindowDays=20`
   - `minQuarantineOpportunities=20`
   - `minTriggerRatePct=3`
   - `pausedSetupTypes=["breakout_vacuum"]`

### Trade Management Policy

1. `partialAtT1Pct=0.65`
2. `moveStopToBreakeven=true`

### Promotion Guardrails

Optimizer promotion now requires all of:

1. `T1 delta >= +3.0pp`
2. `T2 delta >= +2.0pp`
3. `expectancy delta >= +0.10R`
4. `failure-rate delta <= +1.0pp`
5. `conservative objective delta >= 0`

## Setup Detector Gold Rules

Source: `backend/src/services/spx/setupDetector.ts`

### Trend-Family Target Geometry Bounds

1. Added bounded `T1/T2` R-multipliers for:
   - `trend_pullback`
   - `trend_continuation`
   - `orb_breakout`
2. Goal: avoid unrealistic target distances that suppress true hit probability.

### ORB Inference and Quality Discipline

1. ORB inference reachability improved:
   - larger ORB edge tolerance
   - opening range break confirmation
   - early-session `flat` volume permitted for momentum confirmation
2. ORB remains hard quality-gated:
   - strict confluence/pWin/EVR
   - flow/alignment and volume confirmation
3. Practical effect: ORB can be inferred but weak ORB candidates are blocked.

### Trend Pullback Actionability Guard

1. Controlled grace windows for `trend_pullback` only:
   - flow-confirmation/alignment grace (time-bound)
   - volume-regime grace (time-bound)
2. Goal: reduce false suppression while retaining quality controls.

### ORB Flow-Quality Gate

1. ORB now requires minimum flow-quality score/event count before triggering.
2. This prevents low-information ORB activations even when inference conditions are met.

### Tier Visibility Rule

1. Non-blocked `triggered` setups cannot remain `hidden`.
2. Triggered visibility defaults to at least `watchlist`.

### Mean/Fade + Trend Target Refinement

1. Applied conservative target tightening for:
   - `trend_pullback` (distance scaling)
   - `mean_reversion` and `fade_at_wall` (distance scaling)
2. Goal: improve practical T1/T2 capture while preserving positive expectancy.

## Contract Execution Gold Rules

Source: `backend/src/services/spx/contractSelector.ts`

1. Increased base liquidity requirements (`OI`, volume) and tightened spread filters.
2. Tightened 0DTE rollover cutoff to `13:00 ET` (previously later).
3. Added stricter late-day quote quality checks (spread %, absolute spread, OI floor).
4. Effect: reduces slippage/theta decay exposure in late-session contract selection.

## Backtest Gold Methodology

Source: `backend/src/services/spx/winRateBacktest.ts`

1. Default source: `spx_setup_instances`
2. Default strict policy excludes:
   - gate-blocked rows
   - hidden tiers
   - paused setup types/combos
3. Execution model assumptions:
   - `entrySlipPoints=0.2`
   - `targetSlipPoints=0.25`
   - `stopSlipPoints=0.15`
   - `commissionPerTradeR=0.04`
   - setup-level trade management overrides honored

## Reproducible Baseline Benchmarks

As of 2026-02-22, strict replay on current config:

### Last Week (2026-02-16 to 2026-02-20)

1. `setupCount=22`
2. `triggered=17`
3. `T1=76.47%`
4. `T2=70.59%`
5. `failure=17.65%`
6. `expectancyR=+1.128`
7. `resolutionUsed=second`
8. `usedMassiveMinuteBars=false`

### YTD (2026-01-02 to 2026-02-20)

1. `setupCount=187`
2. `triggered=114`
3. `T1=63.16%`
4. `T2=51.75%`
5. `failure=35.96%`
6. `expectancyR=+0.4823`
7. `resolutionUsed=second`
8. `usedMassiveMinuteBars=false`

YTD strict setup-family outcomes:

1. `mean_reversion`: T1 `63.27%`, T2 `46.94%`, failure `36.73%`
2. `fade_at_wall`: T1 `67.65%`, T2 `55.88%`, failure `32.35%`
3. `trend_pullback`: T1 `58.06%`, T2 `54.84%`, failure `38.71%`

Late-session behavior snapshot (strict YTD trigger buckets):

1. `240-299 min since open`: T1 `55.56%`, T2 `55.56%`, stop `44.44%`
2. `300+ min since open`: T1 `58.82%`, T2 `35.29%`, stop `35.29%`
3. Interpretation: very-late entries degrade runner quality (`T2`), supporting strict late-day contract safeguards.

## ORB / Trend Diagnostics Snapshot (YTD)

1. `orb_breakout`: `rows=117`, `triggered=0`, `blocked=103`, `eligible=14`
2. Top ORB block reasons:
   - `flow_confirmation_required`
   - `flow_alignment_unavailable`
   - `confluence_below_floor:3<4`
   - `volume_regime_alignment_required`
3. `trend_pullback`: `rows=211`, `triggered=42`, `blocked=72`, `eligible=139`

Interpretation:

1. Trend pullback is active and tradable under strict policy.
2. ORB is currently quality-quarantined by gate logic rather than disabled by type.

## Gold Standard Validation Commands

1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
2. `pnpm --dir backend build`
3. `pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
4. `pnpm --dir backend backtest:last-week instances second`
5. `pnpm --dir backend spx:backfill-historical 2026-01-02 2026-02-20`
6. `pnpm --dir backend exec tsx -e "import { runSPXWinRateBacktest } from './src/services/spx/winRateBacktest'; (async()=>{ const r=await runSPXWinRateBacktest({from:'2026-01-02',to:'2026-02-20',source:'spx_setup_instances',resolution:'second'}); console.log(JSON.stringify(r.analytics,null,2)); })();"`
