# SPX Command Center Gold Standard Configuration

Date: 2026-02-22  
Status: Active baseline for SPX setup detection, backtest, and optimizer safety gates.

## Scope

This document defines the current production-grade baseline for:

1. Setup detection and gating
2. Backtest methodology and execution assumptions
3. Optimizer guardrails and pause policy
4. Reproducible performance baselines

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

### Tier Visibility Rule

1. Non-blocked `triggered` setups cannot remain `hidden`.
2. Triggered visibility defaults to at least `watchlist`.

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

1. `setupCount=189`
2. `triggered=114`
3. `T1=61.40%`
4. `T2=50.88%`
5. `failure=37.72%`
6. `expectancyR=+0.4268`
7. `resolutionUsed=second`
8. `usedMassiveMinuteBars=false`

YTD strict setup-family outcomes:

1. `mean_reversion`: T1 `64.58%`, T2 `47.92%`, failure `35.42%`
2. `fade_at_wall`: T1 `65.71%`, T2 `57.14%`, failure `34.29%`
3. `trend_pullback`: T1 `51.61%`, T2 `48.39%`, failure `45.16%`

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
