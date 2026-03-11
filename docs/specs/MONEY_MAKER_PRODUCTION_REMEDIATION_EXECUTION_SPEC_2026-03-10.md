# Money Maker Production Remediation Execution Spec

**Date:** 2026-03-10
**Status:** Proposed
**Scope:** Money Maker security, engine correctness, test coverage, rollout discipline
**Supersedes:** `MONEY_MAKER_STRATEGY_PHASE4_SLICE_PRODUCTION_HARDENING_2026-03-10.md` as the release-driving document

## 1. Objective

Restore Money Maker to a state that can be credibly called production-ready for an admin-only trading workflow.

This remediation is not a polish pass. It is a controlled recovery program for:
- access-control defects
- signal-engine correctness gaps
- incomplete strategy-level computations
- missing integration and end-to-end coverage
- weak deployment verification that allowed a stale or incomplete build to pass as "done"

Production-ready means all release gates in this spec are satisfied with attached evidence. "Known gaps" are not allowed for any P0/P1 area.

## 2. Why The Prior Process Failed

The prior CLAUDE-driven slice process was necessary but not sufficient. It allowed release claims based on:
- lint and typecheck
- helper-level unit tests
- one fetcher test
- no backend route coverage
- no `buildSnapshot()` integration coverage
- no frontend render/polling coverage
- no Playwright admin flow
- no post-deploy verification proving the live environment matched the validated branch

For Money Maker, that process is inadequate because the feature is a trading decision surface. Correctness must be proven at the contracts between:
- admin auth -> app route -> backend route
- backend route -> engine output
- engine output -> rendered UI
- deployed code -> production behavior

## 3. Quality Principles

1. No release claim without direct evidence from the highest-risk layer.
2. Engine correctness beats implementation velocity.
3. "Residual risk" cannot be used to waive missing tests for security, signal math, or deployment verification.
4. Every user-visible fix must be traced to a failing test, fixture, or reproducible defect.
5. Every deployment must be verified in the environment that users will actually hit.

## 4. In Scope

- Enforce admin-only access at the backend boundary, not only in the Next.js proxy.
- Bring the signal engine into conformance with the Money Maker strategy spec for V1-required level sources and R:R calculation.
- Replace placeholder/implicit computations with deterministic session-aware logic.
- Add missing automated coverage across backend, frontend, and E2E layers.
- Add deployment verification and rollback gates that prevent stale builds from being mistaken for complete releases.

## 5. Out Of Scope

- New strategies beyond the original V1 strategy set.
- Options-contract recommendations.
- Immersive in-trade experience.
- Large visual redesign unrelated to correctness or operator clarity.
- Backtesting UI.

## 6. Validated Problems Driving This Remediation

| ID | Severity | Problem | Evidence |
|---|---|---|---|
| MM-001 | P1 | Backend `/api/money-maker/*` routes accept any authenticated Supabase user and do not enforce admin-only access. | `backend/src/controllers/money-maker/index.ts` |
| MM-002 | P1 | R:R target uses a placeholder +/-1% move instead of next hourly support/resistance. | `backend/src/services/money-maker/snapshotBuilder.ts` |
| MM-003 | P1 | Confluence inputs are incomplete; ORB levels, open price, hourly S/R are absent. | `backend/src/services/money-maker/snapshotBuilder.ts` |
| MM-004 | P1 | Fibonacci wiring is broken because the engine reads keys that the calculator does not return. | `backend/src/lib/money-maker/indicator-computer.ts`, `backend/src/services/money-maker/snapshotBuilder.ts` |
| MM-005 | P2 | Polling can overlap with long-running snapshots and increase stale-race risk and upstream load. | `hooks/use-money-maker-polling.ts`, live run timing |
| MM-006 | P1 | Release evidence is too shallow to justify production-readiness. | Existing release notes and test surface |
| MM-007 | P1 | No deployed-environment smoke gate exists to prove the live UI matches the validated code path. | Missing from current process |

## 7. Target Outcome

After remediation, Money Maker must satisfy all of the following:
- only admins can reach the backend route and consume snapshot/watchlist data
- a snapshot contains session-correct indicators and required confluence inputs
- any emitted signal is computed from real hourly targets, not placeholders
- the UI renders valid symbol snapshots even when signal count is zero
- the admin flow is covered by backend tests, component/integration tests, and Playwright
- the deployed environment is smoke-checked after rollout and the evidence is recorded

## 8. Required Deliverables

1. Code fixes for all in-scope defects.
2. A new slice report for every implementation slice.
3. Updated release notes and runbook after remediation lands.
4. The quality-control packet in:
   - `docs/specs/money-maker-production-remediation-autonomous-2026-03-10/03_QUALITY_PROTOCOL_AND_TEST_GATES.md`
   - `docs/specs/money-maker-production-remediation-autonomous-2026-03-10/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
   - `docs/specs/money-maker-production-remediation-autonomous-2026-03-10/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
   - `docs/specs/money-maker-production-remediation-autonomous-2026-03-10/08_AUTONOMOUS_EXECUTION_TRACKER.md`

## 9. Workstreams

### 9.1 Workstream A: Security Boundary Restoration

Objective:
- Make the backend enforce the same admin requirement as the app route.

Required changes:
- Introduce backend admin authorization middleware or controller guard.
- Reuse canonical role resolution where possible instead of inventing a separate admin model.
- Add negative tests proving:
  - unauthenticated request -> `401`
  - authenticated non-admin request -> `403`
  - authenticated admin request -> `200`
- Add direct-backend test coverage, not only app-proxy coverage.

Target files:
- `backend/src/controllers/money-maker/index.ts`
- `backend/src/routes/money-maker/index.ts`
- backend auth helper or middleware surface
- new backend route tests

Acceptance criteria:
- Backend route access policy matches product intent: admin only.
- A non-admin token cannot bypass the app route by calling the backend directly.

### 9.2 Workstream B: Signal Engine Correctness

Objective:
- Make the snapshot and signal engine conform to the strategy spec for V1-required inputs.

Required changes:
- Compute ORB from the current regular session's first three 5-minute bars.
- Add ORB High and ORB Low as confluence levels.
- Add current session open price as a confluence level.
- Compute hourly support/resistance from the 1-hour data set over the defined lookback window.
- Fix Fibonacci wiring and use only documented V1 fib levels.
- Replace placeholder `nextLevel` logic with next actual hourly support/resistance.
- Add deterministic fixtures for:
  - bullish session with valid long setup
  - bearish session with valid short setup
  - choppy session where non-VWAP signals are suppressed
  - no-signal session with complete symbol snapshots

Target files:
- `backend/src/services/money-maker/snapshotBuilder.ts`
- `backend/src/services/money-maker/symbolDataFetcher.ts`
- `backend/src/lib/money-maker/indicator-computer.ts`
- confluence/router/rr helper surfaces as needed
- new fixture and integration test files

Acceptance criteria:
- `buildSnapshot()` produces correct confluence inputs and correct R:R targets from deterministic fixtures.
- A signal is never emitted because of placeholder target math.
- Session-aware calculations are validated for regular market hours.

### 9.3 Workstream C: Polling And Data-Flow Hardening

Objective:
- Prevent overlapping fetch storms and stale-state races in the UI path.

Required changes:
- Add in-flight request deduping or abort logic in the polling hook.
- Ensure refresh cannot overlap with the scheduled poll.
- Keep the last good snapshot rendered during transient refresh failures.
- Add explicit empty/error/degraded states with predictable behavior.
- Consider backend caching or single-flight protection if snapshot fan-out remains expensive.

Target files:
- `hooks/use-money-maker-polling.ts`
- `components/money-maker/*`
- backend snapshot controller or service layer if needed

Acceptance criteria:
- Under simulated slow snapshot responses, only one active snapshot request is allowed per client.
- Refresh failure does not erase the last good symbol snapshot state.

### 9.4 Workstream D: UI Contract Validation

Objective:
- Prove the rendered admin experience matches backend output contracts.

Required changes:
- Add component or integration tests for:
  - symbol snapshot render with zero signals
  - signal card render with WHY panel
  - error state render
  - watchlist save rollback behavior
- Add stable selectors for Playwright on high-value UI surfaces.
- Verify the admin-only tab appears only for admins and remains inaccessible for non-admins.

Target files:
- `components/money-maker/setup-card.tsx`
- `components/money-maker/setup-grid.tsx`
- `components/money-maker/watchlist-manager.tsx`
- `components/money-maker/money-maker-shell.tsx`
- test files under the app/component test surface

Acceptance criteria:
- The UI contract is covered in automated tests and does not depend on manual interpretation of screenshots.

### 9.5 Workstream E: Release And Deployment Discipline

Objective:
- Ensure validated code is what actually ships and is what users hit.

Required changes:
- Add a pre-release checklist with exact commands and required artifacts.
- Add a post-deploy smoke path for the live admin route.
- Record deployed commit SHA, environment URL, timestamp, and smoke evidence in release notes.
- Define immediate rollback actions for auth regression, signal regression, and blank-state regression.

Acceptance criteria:
- No release note may claim "production-ready" unless post-deploy smoke evidence exists.

## 10. Phase Plan

### Phase 0: Baseline Lock And Failure Inventory

Goal:
- Freeze the current failure inventory and write the missing tests before changing behavior.

Slices:
- P0-S1: Author backend route contract tests for auth outcomes.
- P0-S2: Author `buildSnapshot()` fixture tests that currently fail.
- P0-S3: Author frontend/component tests for zero-signal snapshot rendering and error states.
- P0-S4: Author Playwright admin-flow smoke spec skeleton and baseline it.

Exit criteria:
- Failing tests exist for each validated defect class before fixes begin.

### Phase 1: Security Remediation

Goal:
- Close MM-001 fully.

Slices:
- P1-S1: Backend admin gate implementation.
- P1-S2: Route test completion and direct-backend negative validation.

Exit criteria:
- No path exists for a non-admin user to retrieve Money Maker backend data.

### Phase 2: Engine Remediation

Goal:
- Close MM-002, MM-003, and MM-004.

Slices:
- P2-S1: Session-aware ORB and open-price support.
- P2-S2: Hourly S/R computation and R:R target correction.
- P2-S3: Fibonacci wiring correction and confluence completeness.
- P2-S4: Deterministic engine integration fixtures for long, short, choppy, and no-signal sessions.

Exit criteria:
- Engine outputs match fixture expectations and spec-defined behavior.

### Phase 3: Polling And UI Hardening

Goal:
- Close MM-005 and stabilize the rendered member experience.

Slices:
- P3-S1: Polling single-flight or abort protection.
- P3-S2: Preserve last good snapshot on transient failure.
- P3-S3: UI state contract coverage and watchlist behavior coverage.

Exit criteria:
- No overlapping request races under the defined simulated slow-response scenario.

### Phase 4: End-To-End And Deployment Hardening

Goal:
- Close MM-006 and MM-007.

Slices:
- P4-S1: Playwright admin flow with seeded or mocked data.
- P4-S2: Non-admin denial E2E coverage.
- P4-S3: Post-deploy smoke checklist and release note evidence template.

Exit criteria:
- Production-readiness claim is supported by route, engine, UI, E2E, and deployed-environment evidence.

## 11. Test Strategy

### 11.1 Unit

- math helpers
- confluence clustering
- regime calculation
- strategy routing
- R:R helper

### 11.2 Integration

- `buildSnapshot()` with recorded fixtures
- snapshot controller auth and response contract
- watchlist controller write/read behavior
- polling hook behavior with slow and failed responses

### 11.3 End-To-End

- admin can open Money Maker, load snapshots, refresh, and manage watchlist
- non-admin is denied
- blank symbol card placeholders do not appear once snapshot payload exists

### 11.4 Post-Deploy Smoke

Required for every release candidate:
- confirm deployed commit SHA
- hit live Money Maker page as admin
- verify watchlist loads
- verify at least one symbol card renders non-placeholder snapshot data
- verify refresh works
- verify network responses come from the intended environment

## 12. Mandatory Validation Gates

The detailed gate protocol lives in the autonomous quality packet, but the release minimum is:

```bash
pnpm exec eslint <touched frontend/app files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <money-maker targeted suites>
pnpm --dir backend exec jest <money-maker backend suites> --runInBand
pnpm exec playwright test <money-maker e2e specs> --project=chromium --workers=1
pnpm build
```

Release is blocked if any of the following are missing:
- backend auth negative test evidence
- `buildSnapshot()` fixture evidence
- UI contract test evidence
- Playwright admin flow evidence
- post-deploy smoke evidence

## 13. Operational Readiness

Before rollout:
- verify Supabase tables exist in target environment
- verify backend env contains Massive and Supabase credentials
- verify admin-role resolution is identical across app and backend
- verify tab visibility configuration matches admin-only intent

After rollout:
- record live screenshot and network evidence
- record exact commit deployed
- record observed snapshot timestamp and symbols

## 14. Rollback

Rollback must be fast and bounded:
- disable the Money Maker tab in `tab_configurations` if the surface must be hidden
- revert the remediation PR or deployment
- do not destroy Money Maker tables during rollback
- if auth is uncertain, prefer hiding the tab and blocking backend routes over leaving the feature partially exposed

## 15. Definition Of Done

Money Maker is done only when all of the following are true:
- no open P0 or P1 defects remain
- backend auth is admin-only and proven by tests
- engine uses spec-compliant inputs and target selection
- UI contract is covered and green
- Playwright admin and non-admin flows are green
- post-deploy smoke evidence is attached to release notes
- release notes describe actual validated behavior, not intended behavior
