# SPX Agent Task Map

Purpose: deterministic task picking for autonomous execution.

## EPIC-A: Execution Safety v2
Task A1: Wire order lifecycle polling
- Files: `backend/src/services/broker/tradier/orderLifecycleManager.ts`, `backend/src/services/broker/tradier/executionEngine.ts`
- Acceptance: partial fills detected and persisted
- Tests: integration lifecycle test with partial fill scenario

Task A2: Fill truth persistence
- Files: `backend/src/services/broker/tradier/executionEngine.ts`, `backend/src/services/spx/executionReconciliation.ts`
- Acceptance: fill records use option price/qty from Tradier order details
- Tests: unit + integration fill-source assertions

Task A3: Kill switch flatten and verify
- Files: `backend/src/routes/spx.ts`
- Acceptance: cancel all + flatten all + verification report
- Tests: integration test for cancellation and position flattening

## EPIC-B: Data Quality Contract
Task B1: Snapshot stage data quality payload
- Files: `backend/src/services/spx/index.ts`, `contexts/spx/SPXAnalyticsContext.tsx`
- Acceptance: stage-level freshness/source/ok/degradedReason exposed and rendered
- Tests: snapshot contract test + UI rendering test

Task B2: Cross-instance snapshot lock/cache
- Files: `backend/src/services/spx/index.ts`, Redis utility modules
- Acceptance: concurrent requests do not stampede upstream sources
- Tests: load/concurrency integration test

## EPIC-C: Setup Pipeline Correctness
Task C1: SPX-only tick transition gating
- Files: `backend/src/services/websocket.ts`, `backend/src/services/spx/tickEvaluator.ts`
- Acceptance: non-SPX ticks cannot mutate setup lifecycle
- Tests: unit tests with SPY/VIX fixture ticks

Task C2: Regime-dependent TTL
- Files: `backend/src/services/spx/setupDetector.ts`
- Acceptance: TTL policy branches by regime and is persisted
- Tests: unit tests for trending/compression TTL branches

## EPIC-D: Database and RLS Hardening
Task D1: VWAP setup type constraints
- Files: `supabase/migrations/*`, SetupType contract tests
- Acceptance: VWAP types persist without constraint violations
- Tests: migration + schema contract tests

Task D2: Execution table RLS restrictions
- Files: `supabase/migrations/*`
- Acceptance: users cannot read/write other users' execution rows
- Tests: RLS integration tests

Task D3: PDT schema correctness and fail-safe mode
- Files: `backend/src/services/spx/pdtTracker.ts`
- Acceptance: correct column usage and fail-closed behavior where required
- Tests: unit tests for unknown/error states

## EPIC-E: Optimizer Enforcement
Task E1: Gate enforcement in execution
- Files: `backend/src/services/broker/tradier/executionEngine.ts`
- Acceptance: blocked gate prevents order placement
- Tests: integration test for blocked gate rejection

Task E2: Multi-day 1h confluence reliability
- Files: `backend/src/services/spx/multiTFConfluence.ts`
- Acceptance: 1h reliability valid under adequate history
- Tests: confluence reliability unit tests

## EPIC-F: UX Persistence and Accessibility
Task F1: Panel layout persistence
- Files: command center shell and panel components
- Acceptance: layout restored across sessions
- Tests: frontend unit/e2e persistence checks

Task F2: Classic/spatial state retention
- Files: command center shell containers
- Acceptance: toggle does not lose state/scroll/selection
- Tests: E2E state-retention flow

Task F3: Command palette accessibility
- Files: `components/spx-command-center/command-palette.tsx`
- Acceptance: dialog semantics, focus trap, keyboard operation
- Tests: a11y checks and keyboard navigation tests

## EPIC-G: Test Harness and Runbooks
Task G1: Schema contract CI gate
- Files: `backend/src/services/spx/__tests__/schemaContract.test.ts`
- Acceptance: critical columns/constraints validated in CI
- Tests: CI pass/fail demonstrations

Task G2: SetupType alignment CI gate
- Files: backend/frontend type definitions + tests
- Acceptance: union/constraints mismatch fails CI
- Tests: alignment test

Task G3: Operations runbook
- Files: `docs/runbooks/spx-ops.md`
- Acceptance: outage/recovery procedures documented and validated
- Tests: tabletop verification checklist
