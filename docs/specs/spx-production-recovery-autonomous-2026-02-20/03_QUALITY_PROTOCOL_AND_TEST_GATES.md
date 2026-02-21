# Quality Protocol and Test Gates: SPX Autonomous Recovery
Date: February 20, 2026

## 1. Quality Objective
Guarantee production-grade reliability, correctness, and UX clarity for all autonomous SPX implementation slices.

## 2. Defect Severity Model
1. `P0` - production-breaking correctness/safety issue or inability to manage active trade safely.
2. `P1` - major workflow break, missing critical visibility, or deterministic contract failure.
3. `P2` - degraded but usable behavior; workaround exists.
4. `P3` - cosmetic/non-blocking.

Blocking rules:
1. No open `P0` or `P1` defects are allowed for release candidate.
2. `P2` requires explicit acceptance note and next-fix owner/date.

## 3. Test Gate Tiers

### Tier A: Slice gates (required per PR slice)
1. Targeted unit tests for changed logic.
2. Targeted integration tests for affected data contracts.
3. Relevant E2E path if user-visible behavior changed.
4. Lint and type checks for changed scope.

### Tier B: Phase gates (required at phase completion)
1. Full phase-related test suite pass.
2. Regression checks against prior critical paths.
3. Updated documentation and rollback notes.

### Tier C: Release gates (blocking)
1. Full lint pass.
2. Full typecheck pass.
3. Production build pass.
4. Critical SPX E2E suite pass.
5. Manual QA signoff checklist pass.

## 4. Required Commands
Run from repository root.

### 4.1 Core static gates
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm build
```

### 4.2 SPX test suites
```bash
pnpm vitest run lib/spx/__tests__/...
pnpm playwright test e2e/spx-*.spec.ts --project=chromium
```

### 4.3 Focused suites by capability
1. Command/CTA changes:
```bash
pnpm playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts --project=chromium
```
2. Coach/contract changes:
```bash
pnpm playwright test e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium
```
3. Data/orchestrator changes:
```bash
pnpm vitest run lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/feed-health.test.ts
```

## 5. Reliability Validation Requirements
1. Simulate live feed dropout and verify stale/degraded transitions.
2. Simulate sequence gaps and verify fallback ordering.
3. Validate command gating in degraded state.
4. Verify no retry storms under forced backend failure responses.

Required artifacts:
1. Logs or screenshots proving transition correctness.
2. Test output summary linked in change-control record.

## 6. Performance and UX Budgets
1. Focus mode switch response target: < 120ms perceived transition.
2. Command interaction latency target: < 100ms local response for enabled actions.
3. Chart focused-level churn: <= 1 mutation/sec under live tick load.
4. No sustained frame drops in default mode under normal feed throughput.

If budget is breached:
1. Do not proceed to release gate.
2. Open blocking risk entry.
3. Add mitigation or scope rollback plan.

## 7. Manual QA Checklist (Blocking)
1. State flow is coherent: `scan -> evaluate -> in_trade -> post_trade -> scan`.
2. One primary CTA visible and correct in each state.
3. Coach `Now/Why/History` behavior is deterministic.
4. Contract alternative/revert behavior is deterministic.
5. Chart interactions (crosshair/tooltip/levels) work on desktop and mobile patterns.
6. Feed health badges and fallback behavior are visible and accurate.
7. No duplicate or contradictory action buttons in any mode.

## 8. Documentation Quality Gates
Before phase close:
1. Update change control with tests run and outcomes.
2. Update risk register for new or resolved risks.
3. Update runbook sections if rollout/rollback behavior changed.

## 9. Final Release Quality Signoff
All must be true:
1. Tier A/B/C gates complete.
2. No unresolved `P0/P1` issues.
3. Rollback path validated and documented.
4. Final release notes generated.
5. Final diff review confirms only intentional changes.
