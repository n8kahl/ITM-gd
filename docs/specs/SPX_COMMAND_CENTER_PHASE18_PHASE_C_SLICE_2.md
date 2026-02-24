# SPX Command Center Phase 18 — Phase C Slice 2

Date: 2026-02-23  
Owner: Codex autonomous implementation  
Status: Implemented (feature-flagged rollout)

## Scope delivered

- Added adaptive EV calculation engine for regime/time-aware expectancy.
- Integrated adaptive EV into setup scoring and quality-gate evaluation path.
- Preserved legacy EV path with a feature flag for controlled activation.

## Backend changes

- `backend/src/services/spx/evCalculator.ts` (new)
  - Calculates EV with:
    - VIX-aware T1/T2 weighting
    - post-2pm ET pWin decay
    - non-1R loss distribution
    - configurable slippage deduction
- `backend/src/services/spx/setupDetector.ts`
  - Added env gates:
    - `SPX_ADAPTIVE_EV_ENABLED`
    - `SPX_EV_SLIPPAGE_R`
  - Uses adaptive EV output when enabled:
    - `evR`
    - effective `pWinCalibrated` for optimization gating/tiering
  - Emits `evContext` metadata in setup payloads.
  - Adds decision telemetry strings for adaptive EV activation and pWin decay.
- `backend/src/services/spx/types.ts`
  - Added `Setup.evContext`.
- `lib/types/spx-command-center.ts`
  - Added shared `evContext` shape.
- `backend/src/config/env.ts`
  - Added schema for `SPX_ADAPTIVE_EV_ENABLED`, `SPX_EV_SLIPPAGE_R`.
- `backend/.env.example`
  - Added example entries for both vars.

## Tests

- Added: `backend/src/services/spx/__tests__/evCalculator.test.ts`
  - high-VIX weighting behavior
  - post-2pm pWin decay behavior
  - custom loss distribution normalization
- Updated: `backend/src/services/spx/__tests__/setupDetector.test.ts`
  - adaptive EV integration path coverage

## Validation run

- `pnpm --dir backend exec tsc --noEmit`
- `pnpm exec tsc --noEmit`
- `pnpm --dir backend test -- --runInBand src/services/spx/__tests__/multiTFConfluence.test.ts src/services/spx/__tests__/evCalculator.test.ts src/services/spx/__tests__/setupDetector.test.ts`

All commands passed.

## Rollout guidance

- Default is off (`SPX_ADAPTIVE_EV_ENABLED=false`).
- Enable with:
  1. `SPX_ADAPTIVE_EV_ENABLED=true`
  2. `SPX_EV_SLIPPAGE_R=0.05` (or tuned value from live spread observations)
- Monitor delta in:
  - `pWinCalibrated`
  - `evR`
  - setup tier distribution by regime and time bucket.
