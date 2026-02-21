# SPX Command Center Optimizer Execution (Spec-Driven)

Date: February 21, 2026
Owner: Autonomous implementation run
Scope: Setup-detection gating, strict Massive backtest fidelity, optimizer scan + UI trigger/scorecard.

## 1. Objective

Deliver production-grade SPX setup optimization with measurable outcomes:

1. Keep strict Massive historical replay for win-rate truth.
2. Add optimizer-driven gates (quality/flow/regime/drift) and trade management policy.
3. Add a UI trigger (`Scan & Optimize`) and scorecard surface in Command Center.
4. Produce concrete setup add/update/remove recommendations.

## 2. Constraints

1. No source fallback for canonical backtest population (`spx_setup_instances` default).
2. No minute fallback when strict second-resolution is requested.
3. Follow repository spec-first process (`claude.md`) with implementation + validation evidence.

## 3. Discovery + Drift

Recent 5-hour commits were UI/process focused (spatial HUD stabilization + process codification), not win-rate measurement fixes. Win-rate trust and optimization required backend replay + persistence + gating work.

## 4. Implementation Slices

### Slice A: Optimizer service and profile persistence

Implemented:

1. `backend/src/services/spx/optimizer.ts`
2. `supabase/migrations/20260323020000_spx_setup_optimizer_state.sql`

Key behaviors:

1. Active optimization profile (quality/flow/regime/drift/trade-management) with cache + DB persistence.
2. Walk-forward threshold search and scorecard generation.
3. Setup action recommendations (`add`, `update`, `remove`).
4. Regime combo pause and drift controls.

### Slice B: Detection + trade-management integration

Implemented:

1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/tickEvaluator.ts`
3. `backend/src/services/spx/winRateBacktest.ts`
4. `backend/src/services/spx/outcomeTracker.ts`
5. `backend/src/services/spx/types.ts`
6. `lib/types/spx-command-center.ts`

Key behaviors:

1. Quality/flow/regime/drift gate evaluation attached to setups.
2. Gate metadata persisted (`gateStatus`, `gateReasons`, alignment/flow/tradeManagement).
3. T1 partial policy support via stop-to-breakeven handling in tick runtime and backtest replay.

### Slice C: Optimizer API + UI trigger/scorecard

Implemented:

1. API routes:
   - `GET /api/spx/analytics/optimizer/scorecard`
   - `POST /api/spx/analytics/optimizer/scan`
2. Hook:
   - `hooks/use-spx-optimizer.ts`
3. UI component:
   - `components/spx-command-center/optimizer-scorecard-panel.tsx`
4. UI surfaces:
   - `components/spx-command-center/spx-command-center-shell-sections.tsx`
   - `components/spx-command-center/spx-mobile-surface-orchestrator.tsx`

### Slice D: Backtest-to-optimizer fidelity fix

Issue found:

1. Historical reconstruction intentionally leaves `triggered_at/final_outcome` empty in `spx_setup_instances`.
2. Optimizer originally read those fields directly, resulting in zero eligible trades.

Fix:

1. `runSPXWinRateBacktest` now supports `includeRows`.
2. Optimizer scan derives outcome overrides from strict backtest rows and merges with setup feature rows.
3. Candidate search updated for sparse validation windows:
   - includes confluence `>= 3` candidates
   - fallback validation minimum trade requirement for 5-day windows
   - baseline-insufficient-trade handling

### Slice E: Historical confluence parity + optimizer gate expansion

Implemented:

1. `backend/src/services/spx/fibEngine.ts`
2. `backend/src/services/spx/historicalReconstruction.ts`
3. `backend/src/services/spx/setupDetector.ts`
4. `backend/src/services/spx/outcomeTracker.ts`
5. `backend/src/services/spx/optimizer.ts`
6. `backend/src/services/spx/types.ts`

Key behaviors:

1. Historical reconstruction now loads date-scoped fib levels (`asOfDate`) and uses them during replay detection (no empty fib placeholder).
2. Setup detection now computes/accepts EMA + volume indicator context and applies explicit confluence sources:
   - `ema_alignment`
   - `volume_regime_alignment`
3. Indicator context fields are persisted into `spx_setup_instances.metadata` for optimizer training.
4. Optimizer candidate search now tests both flow-gated and non-flow-gated candidates plus indicator gates.
5. Flow gating selection logic now permits `requireFlowConfirmation=false` when it improves walk-forward objective.
6. Validation promotion no longer accepts lower-objective candidates solely because baseline had sparse trades.

### Slice F: Setup diversification + intervalized flow + weekly guardrails

Implemented:

1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/historicalReconstruction.ts`
3. `backend/src/services/spx/optimizer.ts`
4. `backend/src/scripts/spxWeeklyOptimizerScan.ts`
5. `backend/package.json`

Key behaviors:

1. Setup type inference now supports non-singleton mapping by context (regime + EMA/volume + GEX), enabling non-`fade_at_wall` setup generation when conditions warrant.
2. Historical flow reconstruction now uses intervalized options contract minute bars (top premium/volume contracts) instead of only end-of-day snapshots.
3. Weekly auto-scan mode added with promotion guardrails:
   - minimum validation trade count
   - minimum objective improvement
   - non-negative T1 delta
   - bounded T2 degradation

## 5. Validation Gates

Executed and passed:

1. `pnpm --dir backend build`
2. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/__tests__/integration/spx-api.test.ts`
3. `pnpm exec eslint components/spx-command-center/optimizer-scorecard-panel.tsx components/spx-command-center/spx-command-center-shell-sections.tsx components/spx-command-center/spx-mobile-surface-orchestrator.tsx hooks/use-spx-optimizer.ts`
4. `pnpm --dir backend build` (post Slice E)
5. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/__tests__/integration/spx-api.test.ts src/services/spx/__tests__/fibEngine.test.ts`
6. `pnpm exec tsc --noEmit`

## 6. Massive Historical Execution Evidence

### 6.1 Backfill (optimizer window)

Command:

`LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-01-27 2026-02-20`

Result:

1. attemptedDays: `25`
2. successfulDays: `25`
3. failedDays: `0`

### 6.2 Strict last-week backtest

Command:

`LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Range:

1. from: `2026-02-16`
2. to: `2026-02-20`

Result:

1. sourceUsed: `spx_setup_instances`
2. resolutionUsed: `second`
3. usedMassiveMinuteBars: `false`
4. triggeredCount: `6`
5. t1WinRatePct: `16.67`
6. t2WinRatePct: `16.67`
7. failureRatePct: `66.67`
8. bySetupType:
   - `fade_at_wall`: T1 `0%` (N=5)
   - `mean_reversion`: T1 `100%` (N=1, low sample)

### 6.3 Strict extended backtest (optimizer analysis range)

Command:

`runSPXWinRateBacktest({ from: '2026-01-27', to: '2026-02-20', source: 'spx_setup_instances', resolution: 'second' })`

Result:

1. triggeredCount: `26`
2. t1WinRatePct: `26.92`
3. t2WinRatePct: `11.54`
4. failureRatePct: `57.69`
5. bySetupType:
   - `fade_at_wall`: T1 `15.00%` (N=20)
   - `mean_reversion`: T1 `66.67%` (N=6)

## 7. Optimizer Scan Outcome

Command:

`runSPXOptimizerScan({ from: '2026-01-27', to: '2026-02-20' })`

Applied profile:

1. minConfluenceScore: `3`
2. minPWinCalibrated: `0.62`
3. minEvR: `0.20`
4. requireFlowConfirmation: `false`
5. minAlignmentPct: `0`
6. regime paused combo: `fade_at_wall|ranging`
7. trade management: `50%` at T1 + stop-to-breakeven remainder

Validation scorecard:

1. baseline: `6` trades, T1 `16.67%`, T2 `16.67%`, failure `66.67%`, objective `-13.33`
2. optimized candidate did not beat baseline objective in current validation window
3. optimizationApplied: `false` (baseline retained)

Setup recommendations generated:

1. `update`: trade management policy (and flow/pWin updates when candidate materially improves objective)
2. `remove`: pause `fade_at_wall|ranging` (T1 below regime floor)
3. `add`: none with sufficient robust sample (mean-reversion improving but low N)

Weekly auto scan:

1. Command: `pnpm --dir backend spx:optimizer-weekly`
2. Guardrails enforced in `weekly_auto` mode:
   - validation trades `>= 12`
   - objective delta `>= 0.5`
   - T1 delta `>= 0`
   - T2 delta `>= -2`
3. Result: profile retained (`optimizationApplied=false`) for latest weekly run.

## 8. Answer: Is this using Massive historical bars for real win rate?

Yes.

1. Backfill uses Massive SPX/SPY minute bars + Massive options snapshots (`as_of`) to reconstruct setup inputs.
2. Backtest uses Massive SPX 1-second bars for entry/stop/target outcome replay.
3. Strict runs above confirm `usedMassiveMinuteBars=false`.

## 9. Current Fidelity Gaps (Known)

1. Options-flow reconstruction now uses intervalized contract minute bars, but does not yet replay tick-level options tape.
2. Non-fade setup diversity is improved but still limited sample (`mean_reversion` N=6 in current analysis window).

## 10. Maintenance/Optimization Operating Mode

1. Nightly: backfill previous session + optimizer scan.
2. Weekly: full-range audit replay + drift review.
3. Promote profile only when validation/trade-count gates pass.
4. Keep strict second-resolution reporting as default for win-rate truth.
