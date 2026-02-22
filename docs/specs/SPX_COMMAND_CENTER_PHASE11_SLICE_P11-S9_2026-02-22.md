# SPX Command Center Phase 11 - Slice P11-S9

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Live-parity win-rate backtest fidelity for paused setup families.

## Objective

1. Ensure SPX win-rate backtests represent the currently active live trading policy.
2. Exclude optimizer-paused setup types and setup/regime combos from default backtest reporting.
3. Preserve optimizer and historical reconstruction research integrity by allowing explicit include of paused setups.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`

## Implementation Details

### 1) Backtest paused-setup filtering (default on)

1. Added optimizer-state lookup in backtest loader (`spx_setup_optimizer_state.id='active'`).
2. Parsed `profile.driftControl.pausedSetupTypes` and `profile.regimeGate.pausedCombos` into runtime filters.
3. Excluded matching rows from `spx_setup_instances` during default backtest loading.
4. Added explicit notes in backtest output with counts for skipped paused rows.

### 2) Controlled override for research paths

1. Added `includePausedSetups?: boolean` option to `runSPXWinRateBacktest`.
2. Default behavior: `includePausedSetups=false` (live-parity reporting).
3. Set `includePausedSetups=true` in `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts` (`loadOutcomeOverridesFromBacktest`).
4. Set `includePausedSetups=true` in `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts` (row persistence replay).

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/setupDetector.test.ts`
2. `pnpm --dir backend build`

## Massive Replay Evidence (Strict, second bars)

### A) Last completed week (2026-02-16 to 2026-02-20)

Command:

1. `pnpm --dir backend backtest:last-week instances second`

Result:

1. `resolutionUsed=second`
2. `usedMassiveMinuteBars=false`
3. `triggered/resolved=13/13`
4. `T1/T2/failure=69.23% / 61.54% / 23.08%`
5. `expectancyR=+0.5474`
6. Notes include: `Skipped 1 paused-setup-type rows via optimizer profile.`

### B) YTD replay (2026-01-01 to 2026-02-20)

Command:

1. `pnpm --dir backend exec tsx -e "...runSPXWinRateBacktest({ from:'2026-01-01', to:'2026-02-20', source:'spx_setup_instances', resolution:'second' })..."`

Result:

1. `resolutionUsed=second`
2. `usedMassiveMinuteBars=false`
3. `triggered/resolved=107/107`
4. `T1/T2/failure=60.75% / 48.60% / 38.32%`
5. `expectancyR=+0.2576`
6. Notes include: `Skipped 3 paused-setup-type rows via optimizer profile.`

## Outcome

1. Backtest win-rate outputs now match live deployment policy by default.
2. Optimizer training and historical replay retain complete data access through explicit paused-setup inclusion.
3. Reported T1/T2/expectancy metrics are now better aligned with true deployable strategy behavior.
