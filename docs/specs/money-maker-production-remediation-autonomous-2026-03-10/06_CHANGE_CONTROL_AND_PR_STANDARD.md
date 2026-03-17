# Change Control And PR Standard: Money Maker Production Remediation

Date: 2026-03-10

## 1. Purpose

Standardize how Money Maker remediation slices are proposed, implemented, validated, and approved.

## 2. Required Record Per Slice

Every slice must include:
1. Slice ID (`P<phase>-S<index>`)
2. Objective
3. Status
4. Scope
5. Out of scope
6. Files changed
7. Tests added
8. Tests run and results
9. Risks introduced
10. Mitigations
11. Rollback
12. Evidence links or artifact paths

## 3. Slice Entry Template

```md
### Slice: P?-S?
- Objective:
- Status: planned | in_progress | blocked | done
- Scope:
- Out of scope:
- Files:
  - /absolute/path/file1
  - /absolute/path/file2
- Tests added:
  - test name
  - contract covered
- Tests run:
  - `command`
  - Result:
- Risks introduced:
- Mitigations:
- Rollback:
- Evidence:
  - screenshot/log/test artifact
- Notes:
```

## 4. PR Standard

Every PR must include:
1. Why this slice exists now.
2. Defects or risks being closed.
3. Exact scope boundaries.
4. Test additions.
5. Test evidence.
6. Rollback plan.
7. Remaining follow-ups, if any.

## 5. PR Template

```md
## Objective
- 

## Defects Closed
- 

## Scope
- 

## Out Of Scope
- 

## Tests Added
- 

## Tests Run
- `...`
- `...`

## Results
- 

## Risks
- 

## Mitigations
- 

## Rollback
- 

## Evidence
- 
```

## 6. Drift Control Rules

1. If a slice touches a new contract surface, add tests in the same slice.
2. If scope expands materially, stop and split the work into a new slice.
3. If an earlier assumption is falsified, update the risk register before proceeding.
4. If deployed behavior differs from validated local behavior, open a blocking drift entry immediately.

## 7. Merge Conditions

A slice cannot merge unless:
1. All required tests for that slice are green.
2. The change-control entry is complete.
3. The slice did not leave a `P0/P1` gap behind.
4. Claims in the PR can be verified from recorded evidence.

## 8. Active Slice Plan

### Slice: P0-S1
- Objective: Freeze current failures with backend auth route tests and fixture-driven engine tests.
- Status: done
- Scope:
  - direct backend auth tests
  - `buildSnapshot()` fixture test harness
  - initial Playwright admin and non-admin spec skeletons
  - zero-signal snapshot UI contract test
- Out of scope:
  - production logic changes
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/__tests__/integration/money-maker-api.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts`
  - `/Users/natekahl/ITM-gd/components/money-maker/__tests__/setup-card.test.tsx`
  - `/Users/natekahl/ITM-gd/e2e/specs/members/money-maker.spec.ts`
- Tests added:
  - backend auth denial/allow tests
  - engine fixture contract tests
  - zero-signal snapshot render test
  - E2E smoke skeleton
- Tests run:
  - `pnpm exec vitest run components/money-maker/__tests__/setup-card.test.tsx`
  - Result: 1 passed / 0 failed
  - `pnpm --dir backend exec jest src/__tests__/integration/money-maker-api.test.ts --runInBand`
  - Result: 1 failed / 2 passed (`403` expected for non-admin, received `200`)
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts --runInBand`
  - Result: 3 failed / 0 passed (ORB session logic, confluence inputs, hourly target selection)
  - `pnpm exec playwright test e2e/specs/members/money-maker.spec.ts --project=chromium`
  - Result: 2 skipped (`fixme` baseline skeleton)
- Risks introduced:
  - None; baseline lock only
- Mitigations:
  - Failing tests document recovery scope before code changes
- Rollback:
  - Remove baseline-only test/docs additions if superseded
- Evidence:
  - backend auth baseline failure (`403` vs `200`)
  - snapshotBuilder baseline failures for ORB, confluence completeness, and hourly target selection
- Notes:
  - This slice is required before any release-claiming remediation work.

### Slice: P1-S1
- Objective: Restore admin-only enforcement at the backend route boundary.
- Status: done
- Scope:
  - backend authorization middleware or guard
  - route-level auth tests
- Out of scope:
  - signal-engine math changes
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/controllers/money-maker/index.ts`
  - `/Users/natekahl/ITM-gd/backend/src/__tests__/integration/money-maker-api.test.ts`
- Tests added:
  - non-admin direct backend denial test
- Tests run:
  - `pnpm --dir backend exec jest src/__tests__/integration/money-maker-api.test.ts --runInBand`
  - Result: 3 passed / 0 failed
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: passed
- Risks introduced:
  - auth resolution divergence between app and backend
- Mitigations:
  - reuse canonical admin-role logic where possible
- Rollback:
  - revert backend auth gate change set
- Evidence:
  - direct backend 401/403/200 test results
- Notes:
  - Release-blocking slice.

### Slice: P2-S1
- Objective: Replace placeholder target math and incomplete confluence inputs with spec-compliant engine logic.
- Status: done
- Scope:
  - ORB session calculation
  - open price
  - hourly support/resistance
  - Fibonacci repair
  - real target selection
- Out of scope:
  - UI redesign
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/snapshotBuilder.ts`
  - `/Users/natekahl/ITM-gd/backend/src/lib/money-maker/indicator-computer.ts`
  - `/Users/natekahl/ITM-gd/lib/money-maker/indicator-computer.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts`
- Tests added:
  - long/short/choppy/no-signal fixtures
- Tests run:
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts --runInBand`
  - Result: 3 passed / 0 failed
  - `pnpm exec vitest run lib/money-maker/__tests__/indicator-computer.test.ts`
  - Result: 6 passed / 0 failed
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: passed
  - `pnpm exec tsc --noEmit`
  - Result: passed
- Risks introduced:
  - signal volume changes after engine correction
- Mitigations:
  - fixture-based expectations and phase-level review of output changes
- Rollback:
  - revert engine correction slice as a unit
- Evidence:
  - fixture assertions and sample outputs

### Slice: P2-S2
- Objective: Harden the live setup detector so it evaluates real confluence zones, recent completed bars, and strategy-context gates instead of placeholder routing inputs.
- Status: done
- Scope:
  - active intraday detection-timeframe selection (`2m` -> `5m` -> `10m`)
  - completed-bar filtering so in-progress bars do not drive signals
  - patience-candle proximity detection against confluence zones instead of raw close price
  - recent-bar scan for the latest valid completed setup
  - live router context derivation for advanced VWAP, EMA bounce, fib, and hourly trend gating
  - Ripster 34/50 EMA cloud inputs on the afternoon 10-minute chart
  - deterministic trend-strength calculation
  - `2Min` fetch support and detector-context unit coverage
- Out of scope:
  - UI/execution-plan rendering changes
  - deployed-environment smoke verification
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/detectorContext.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/snapshotBuilder.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/symbolDataFetcher.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/detectorContext.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/symbolDataFetcher.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/lib/money-maker/patience-candle-detector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/lib/money-maker/kcu-strategy-router.ts`
  - `/Users/natekahl/ITM-gd/lib/money-maker/patience-candle-detector.ts`
  - `/Users/natekahl/ITM-gd/lib/money-maker/kcu-strategy-router.ts`
  - `/Users/natekahl/ITM-gd/lib/money-maker/patience-candle-detector.js`
  - `/Users/natekahl/ITM-gd/lib/money-maker/kcu-strategy-router.js`
- Tests added:
  - detector timeframe and context-helper unit tests
  - zone-aware patience-candle tests
  - router tests for hourly trend gating and advanced VWAP directionality
  - snapshot regression for scanning the most recent valid completed bar
  - snapshot regression for afternoon Ripster cloud inputs on 10-minute detection
  - fetcher regression for `2Min` timeframe coverage
- Tests run:
  - `pnpm exec vitest run lib/money-maker/__tests__/patience-candle-detector.test.ts lib/money-maker/__tests__/kcu-strategy-router.test.ts lib/money-maker/__tests__/confluence-detector.test.ts lib/money-maker/__tests__/rr-calculator.test.ts lib/money-maker/__tests__/signal-ranker.test.ts lib/money-maker/__tests__/orb-calculator.test.ts`
  - Result: 6 files passed / 37 tests passed / 0 failed
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/detectorContext.test.ts src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/symbolDataFetcher.test.ts --runInBand`
  - Result: 3 suites passed / 16 tests passed / 0 failed
  - `pnpm exec tsc --noEmit`
  - Result: passed
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: passed
  - `pnpm exec eslint --no-warn-ignored lib/money-maker/patience-candle-detector.ts lib/money-maker/kcu-strategy-router.ts lib/money-maker/__tests__/patience-candle-detector.test.ts lib/money-maker/__tests__/kcu-strategy-router.test.ts`
  - Result: passed
  - `pnpm exec eslint --no-warn-ignored backend/src/services/money-maker/snapshotBuilder.ts backend/src/services/money-maker/symbolDataFetcher.ts backend/src/services/money-maker/detectorContext.ts backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts backend/src/services/money-maker/__tests__/symbolDataFetcher.test.ts backend/src/services/money-maker/__tests__/detectorContext.test.ts backend/src/lib/money-maker/patience-candle-detector.ts backend/src/lib/money-maker/kcu-strategy-router.ts`
  - Result: passed
- Risks introduced:
  - signal volume and strategy mix can change after real context flags replace placeholders
  - timeframe rotation can produce different setup timing than the prior 5-minute-only baseline
- Mitigations:
  - helper-level deterministic tests lock the new routing inputs
  - snapshot regressions assert zone-aware patience detection and completed-bar scanning
  - snapshot regression asserts the 34/50 Ripster cloud inputs are present when afternoon 10-minute history exists
- Rollback:
  - revert the detector-context helper, snapshot-builder wiring, and associated tests as one slice
- Evidence:
  - green helper, snapshot, and fetcher suites
  - green root detector-unit suites
  - compile and lint gates
- Notes:
  - This slice closes the raw-close patience-candle defect, the hardcoded router-context defect, and the missing live cloud-input path.
  - live local snapshot sample returned `symbolSnapshotCount: 5` with current-session `lastCandleAt` and `orbRegime`
- Notes:
  - Release-blocking slice.

### Slice: P3-S1
- Objective: Harden polling and rendered-state behavior under slow/failing snapshot responses.
- Status: done
- Scope:
  - single-flight or abort protection
  - last-good-state retention
  - UI error/degraded-state tests
- Out of scope:
  - strategy logic
- Files:
  - `/Users/natekahl/ITM-gd/hooks/use-money-maker-polling.ts`
  - `/Users/natekahl/ITM-gd/components/money-maker/money-maker-shell.tsx`
  - `/Users/natekahl/ITM-gd/components/money-maker/__tests__/money-maker-polling.test.tsx`
  - `/Users/natekahl/ITM-gd/components/money-maker/__tests__/money-maker-shell.test.tsx`
- Tests added:
  - hook/component behavior tests
- Tests run:
  - `pnpm exec vitest run components/money-maker/__tests__/money-maker-polling.test.tsx components/money-maker/__tests__/money-maker-shell.test.tsx components/money-maker/__tests__/setup-card.test.tsx`
  - Result: 3 passed / 0 failed
  - `pnpm exec tsc --noEmit`
  - Result: passed
- Risks introduced:
  - state synchronization regressions
- Mitigations:
  - component tests and Playwright regression
- Rollback:
  - revert polling/UI hardening slice
- Evidence:
  - polling single-flight test output
  - degraded-state shell test output
- Notes:
  - Required before release.

### Slice: P4-S1
- Objective: Prove the complete admin flow in E2E and deployed environments.
- Status: in_progress
- Scope:
  - Playwright admin and non-admin flows
  - post-deploy smoke checklist
  - release note evidence update
- Out of scope:
  - new product capabilities
- Files:
  - `/Users/natekahl/ITM-gd/components/money-maker/money-maker-access-gate.tsx`
  - `/Users/natekahl/ITM-gd/lib/money-maker/access.ts`
  - `/Users/natekahl/ITM-gd/app/members/money-maker/page.tsx`
  - `/Users/natekahl/ITM-gd/components/money-maker/setup-grid.tsx`
  - `/Users/natekahl/ITM-gd/components/money-maker/setup-card.tsx`
  - `/Users/natekahl/ITM-gd/components/money-maker/__tests__/money-maker-access-gate.test.tsx`
  - `/Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx`
  - `/Users/natekahl/ITM-gd/e2e/specs/members/money-maker.spec.ts`
- Tests added:
  - direct-route access-gate unit tests
  - executable Playwright admin render and non-admin denial tests
- Tests run:
  - `pnpm exec vitest run components/money-maker/__tests__/money-maker-access-gate.test.tsx`
  - Result: 2 passed / 0 failed
  - `pnpm exec playwright test e2e/specs/members/money-maker.spec.ts --project=chromium`
  - Result: 2 passed / 0 failed
- Risks introduced:
  - E2E bypass admin override could diverge from real auth behavior if used outside Playwright
- Mitigations:
  - override is only read when `NEXT_PUBLIC_E2E_BYPASS_AUTH=true`
  - backend admin enforcement remains covered separately in integration tests
- Rollback:
  - revert member-surface gate and E2E-only auth override together
- Evidence:
  - Playwright run output for authorized and denied member flows
- Notes:
  - Local E2E proof is complete.
  - Slice remains open until deployed-environment smoke and release-note evidence are recorded.
