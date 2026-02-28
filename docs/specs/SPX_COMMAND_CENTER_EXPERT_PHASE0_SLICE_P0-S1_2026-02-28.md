# SPX Command Center Expert — Phase 0 Slice P0-S1
Date: 2026-02-28
Slice: `P0-S1` (Session 1)
Status: Completed with open regression baseline
Owner: Codex
Baseline Commit: `b7fd209`

## 1. Slice Objective
Freeze current SPX Command Center selector/API contracts before Expert Trade Stream implementation so subsequent slices can detect regressions immediately.

## 2. Scope
1. Create a single baseline contract document for SPX frontend selectors and backend route contracts.
2. Record current snapshot payload shape contract.
3. Capture targeted SPX validation evidence for baseline confidence.

## 3. Out of Scope
1. Any SPX behavior changes.
2. New backend routes.
3. UI redesign or component refactors.

## 4. Files Touched
1. `docs/specs/SPX_COMMAND_CENTER_EXPERT_CONTRACT_BASELINE_2026-02-28.md`
2. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S1_2026-02-28.md`

## 5. Deliverables
1. Baseline contract reference doc with selector matrix and API route matrix.
2. Slice report with validation command outputs and risks.

## 6. Validation Gates

### 6.1 Planned commands
```bash
pnpm exec tsc --noEmit
pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1
```

### 6.2 Results
1. `pnpm exec tsc --noEmit`: pass
2. `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`: fail (`8 passed`, `1 failed`)
3. Failure case:
   - Spec: `e2e/spx-setup-interaction.spec.ts`
   - Test: `trade focus locks setup selection until trade is exited`
   - Failure: `getByTestId('spx-action-primary-cta')` resolves but is not visible at click time, then test times out at 30s.
4. Determinism check:
   - Reran only failing test with `-g "trade focus locks setup selection until trade is exited"` and it failed again with the same visibility timeout.
5. Environment noise observed during E2E run:
   - Massive entitlement warnings (`NOT_AUTHORIZED`).
   - WebSocket connection-limit warning.
   - These did not prevent 8 tests from passing but may increase execution noise.

## 7. Risks and Notes
1. Baseline captured on Node `v20.19.5`; final release gate evidence must be re-run under Node `>=22`.
2. `spx-action-primary-cta` visibility contract is currently unstable in `spx-setup-interaction` flow and is now a tracked baseline regression.
3. External market-data entitlement/connection warnings appear during test startup and should remain isolated from selector-contract assertions.

## 8. Rollback
No runtime rollback required. This slice is documentation-only and can be reverted by deleting the two documents.

## 9. Next Slice
`P0-S2`: add explicit Expert Trade Stream selector contract and fixture payload set, including new lifecycle order assertions.
