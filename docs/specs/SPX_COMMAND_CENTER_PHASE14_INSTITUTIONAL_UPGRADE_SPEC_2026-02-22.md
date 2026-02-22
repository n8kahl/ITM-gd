# SPX Command Center Phase 14: Institutional Upgrade & Tradier Readiness

**Date:** 2026-02-22
**Owner:** Autonomous Implementation Run
**Status:** Approved for implementation (spec-first)

## 1) Objective
Promote SPX Command Center from current Gold Standard setup detection to institutional execution readiness by:
1. Standardizing microstructure telemetry contracts from Massive tick/quote data.
2. Upgrading setup-quality signals to directional, quote-aware validation.
3. Adding broker execution reconciliation and live slippage calibration loops.
4. Preserving strict replay parity (`spx_setup_instances`, second bars, Massive-backed options replay).

## 2) Discovery (Last 48h Drift)
Recent production-impact commits observed:
1. `345463b` ORB+pullback fusion and optimizer throughput fix.
2. `07f51b2` baseline snapshot for optimizer governance.
3. `0fc0e1b`, `d70365b` reliability and level-hardening changes.
4. `c3876f1`, `98b036d`, `5088bb5` nightly optimizer fail-closed governance and profile history/revert controls.

Drift implications:
1. Setup quality filters are now richer, but microstructure features need explicit canonical definitions to avoid detector inconsistency.
2. Optimizer throughput collapse risk is reduced, but execution slippage feedback is still mostly proxy-backed.
3. Live-vs-replay parity remains strong on bar fidelity, weaker on broker fill realism.

## 3) Gap Review Against Proposed Spec (Resolved)
### G1: Bid/ask imbalance definition ambiguity
- Gap: proposed spec mixes two concepts: normalized imbalance and raw ratio threshold (`> 3.0` / `< 0.33`).
- Resolution: support both forms.
  - Keep normalized `bidAskImbalance` in `[-1, 1]` for existing gates.
  - Add `askBidSizeRatio` and close-quote fields for institutional pressure checks.

### G2: "Dropped before setup logic" overstatement
- Gap: current setup path already reads tick-cache microstructure directly; not fully dropped.
- Resolution: formalize microbar telemetry contract for downstream detectors/UI/replay tooling so all paths share deterministic fields.

### G3: Intraday OI expectation
- Gap: true intraday open-interest updates are not guaranteed as a continuous feed.
- Resolution: model intraday gamma pressure as OI-baseline + real-time volume/flow delta proxy, and label the source in metadata.

### G4: Broker credential security
- Gap: plain-text token schema in proposed SQL is not production-safe.
- Resolution: use encrypted-at-rest secret storage pattern (or KMS envelope), service-role-only access, and never expose tokens to client reads.

### G5: Promotion KPI over-constraint
- Gap: fixed hard KPI floor (`T1 >= 64`, `Expectancy >= 0.50R`) can block valid incremental improvements in low-trade windows.
- Resolution: keep absolute floors as targets, but promote using confidence-aware deltas + throughput guardrails already present in optimizer governance.

## 4) Phase/Slice Plan
### P14-S1: Canonical microstructure telemetry (this slice)
1. Extend `microbarAggregator` with close-quote pressure and quote-coverage stats.
2. Preserve existing fields and add new fields for compatibility.
3. Propagate fields through websocket microbar updates.

### P14-S2: Detector integration
1. Wire `askBidSizeRatio`, `avgSpreadBps`, and coverage into `volumeClimax`/`vwap` gating.
2. Add gate-reason telemetry for microstructure insufficiency.

### P14-S3: Tradier adapter foundation
1. Add broker adapter interfaces and sandbox routing worker.
2. Add portfolio snapshot sync and DTBP-aware contract sizing.

### P14-S4: Execution reconciliation loop
1. Diff internal position state against broker positions.
2. Compute rolling realized slippage and feed optimizer EV floor adjustments.

### P14-S5: Release gates and parity report
1. Run strict replay/backtest windows and compare against baseline confidence intervals.
2. Record production guardrail decision with rollback path.

## 5) Acceptance Criteria
1. Microbar payload includes: `deltaVolume`, `bidAskImbalance`, `askBidSizeRatio`, `quoteCoveragePct`, `avgSpreadBps`, `bidSizeAtClose`, `askSizeAtClose`.
2. Existing consumers remain backward compatible.
3. Targeted slice tests pass and `backend` typecheck is green.
4. Change-control, tracker, and risk/decision logs are updated for this slice.

## 6) Validation Gates
1. `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts`
2. `pnpm --dir backend exec tsc --noEmit`
3. Optional lint note: repo eslint currently ignores backend sources unless run with explicit backend config.

## 7) Rollback
1. Revert P14-S1 commit(s).
2. Restart websocket workers to clear in-memory microbar state.
3. If needed, disable downstream consumption of new fields while retaining existing microbar contract fields.
