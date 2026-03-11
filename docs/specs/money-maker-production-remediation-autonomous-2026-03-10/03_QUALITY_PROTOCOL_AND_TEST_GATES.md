# Quality Protocol And Test Gates: Money Maker Production Remediation

Date: 2026-03-10

## 1. Purpose

Define the blocking quality system for Money Maker remediation so the implementation cannot be called production-ready on helper tests alone.

## 2. Severity Model

1. `P0` - security boundary failure, incorrect trading signal math that can emit materially wrong alerts, deployed blank-state regression, or inability to access/disable the feature safely.
2. `P1` - major workflow break, missing required confluence inputs, missing admin-gate enforcement, deterministic data-contract failure.
3. `P2` - degraded but usable behavior, transient UX regression, or operator inconvenience with a clear workaround.
4. `P3` - cosmetic or non-blocking quality defect.

Blocking rules:
1. No open `P0` or `P1` issues are allowed at release candidate.
2. `P2` requires explicit written acceptance, owner, and target date.
3. Missing tests for a `P0` or `P1` surface are treated as a `P1` gap.

## 3. Required Test Layers

Every remediation slice must prove correctness at the highest-risk affected layer.

### Layer A: Unit

Use for isolated pure logic:
- indicator math
- confluence logic
- routing logic
- R:R helper logic

### Layer B: Integration

Use for contract-bearing behavior:
- `buildSnapshot()` with deterministic fixtures
- backend route auth behavior
- backend route response payloads
- polling hook state transitions
- watchlist persistence behavior

### Layer C: End-To-End

Use for user-visible workflows:
- admin can load Money Maker page with non-placeholder snapshot data
- admin can refresh
- admin can update watchlist
- non-admin is denied

### Layer D: Post-Deploy Smoke

Use for every release candidate:
- deployed commit verification
- live admin page load
- non-placeholder card content
- network verification against intended environment

## 4. Slice Gates

Every slice must pass:
1. Targeted lint on touched files.
2. Root typecheck.
3. Backend typecheck if backend code changed.
4. New or updated tests for the changed contract.
5. Evidence recorded in change control.

Minimum slice standard:
- no code-only slice without test delta for a changed contract
- no "will add tests later" for auth or engine fixes

## 5. Phase Gates

At the end of each phase:
1. All relevant slice tests pass together.
2. No open `P0/P1` findings in that phase remain.
3. Tracker and risk register are updated.
4. A phase slice report is written with exact commands and results.

## 6. Release Gates

All of the following are mandatory:

```bash
pnpm exec eslint <touched frontend/app files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <money-maker frontend/shared suites>
pnpm --dir backend exec jest <money-maker backend suites> --runInBand
pnpm exec playwright test <money-maker specs> --project=chromium --workers=1
pnpm build
```

Release-blocking evidence:
1. Backend auth negative tests.
2. `buildSnapshot()` fixture tests with expected outputs.
3. UI contract tests proving zero-signal snapshot rendering.
4. Playwright admin flow.
5. Playwright non-admin denial flow.
6. Post-deploy smoke record.

## 7. Fixture Requirements

Recorded or synthetic fixtures must cover:
1. Trending-up session with valid long setup.
2. Trending-down session with valid short setup.
3. Choppy session where non-VWAP setups are blocked.
4. No-signal session with valid symbol snapshots.
5. Failed market-data fetch or partial-data scenario.

Fixture tests must assert:
1. ORB values come from the current session.
2. Open price is present when expected.
3. Hourly target selection is real, not placeholder math.
4. Fibonacci levels are sourced from actual returned keys.
5. Signal suppression behavior matches the strategy gate rules.

## 8. Deployment Verification Protocol

Before deploy:
1. Record branch head SHA.
2. Record expected environment URL.
3. Record the exact commands run and their results.

After deploy:
1. Confirm deployed SHA matches the validated SHA.
2. Open the live Money Maker route as admin.
3. Capture one screenshot showing non-placeholder symbol data.
4. Capture one network log proving snapshot endpoint success.
5. Record timestamp, environment, and operator in release notes.

If any of the above fail:
1. Release is not complete.
2. Feature must not be described as production-ready.
3. Roll back or hide the tab until corrected.

## 9. Manual QA Checklist

Blocking:
1. Admin can load the page.
2. Non-admin is denied.
3. Watchlist defaults load if custom watchlist is absent.
4. Snapshot cards render price, regime, indicators, and last-candle time when signal count is zero.
5. Signal card renders correctly when a signal fixture is injected.
6. Refresh does not blank the screen.
7. Transient backend failure preserves the last known good state and shows a clear degraded/error message.

## 10. Documentation Gates

Before phase close:
1. Change control updated.
2. Risk register updated.
3. Execution tracker updated.
4. Phase slice report written.

Before release close:
1. Release notes updated with actual evidence.
2. Runbook updated.
3. Rollback path verified.

## 11. Final Signoff Conditions

Money Maker can be called production-ready only when:
1. Tiered gates are complete.
2. No unresolved `P0/P1` issues remain.
3. No missing required test layer remains.
4. Post-deploy smoke is attached.
5. Final diff review confirms the shipped behavior matches the validated behavior.
