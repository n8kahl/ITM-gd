# Change Control And PR Standard: Money Maker V2 Execution Guidance

Date: 2026-03-11
Governing spec: `docs/specs/MONEY_MAKER_V2_EXECUTION_GUIDANCE_SPEC_2026-03-11.md`
Implementation plan: `docs/specs/money-maker-v2-execution-guidance-autonomous-2026-03-11/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Purpose

Standardize how Money Maker V2 execution-guidance slices are proposed, implemented, validated, and approved.

## 2. Required Record Per Slice

Every slice must include:
1. Slice ID
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
### Slice: 2.?
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
2. Which execution-guidance gap it closes.
3. Exact scope boundaries.
4. Test additions.
5. Test evidence.
6. Rollback plan.
7. Remaining follow-ups, if any.

## 5. Merge Conditions

A slice cannot merge unless:
1. All required tests for that slice are green.
2. The change-control entry is complete.
3. The slice did not leave a `P0/P1` gap behind.
4. Claims in the PR can be verified from recorded evidence.

## 6. Active Slice Plan

### Slice: 2.1
- Objective: Fix board correctness issues and translate Money Maker into trader-facing language.
- Status: done
- Scope:
  - level normalization
  - hourly ladder dedupe
  - trader-facing zone translation
  - unavailable indicator rendering
  - ET clock and freshness cues
- Out of scope:
  - execution-plan engine
  - contracts guidance
- Files:
  - `lib/money-maker/types.ts`
  - `lib/money-maker/presentation.ts`
  - `backend/src/services/money-maker/snapshotBuilder.ts`
  - `backend/src/lib/money-maker/types.ts`
  - `components/money-maker/setup-card.tsx`
  - `components/money-maker/signal-why-panel.tsx`
  - `components/money-maker/money-maker-shell.tsx`
  - `components/money-maker/active-strategies-clock.tsx`
  - related tests
- Tests added:
  - normalization and trader-copy fixtures
  - shell freshness-badge coverage
  - snapshot board-contract coverage for hourly ladder + unavailable SMA
- Tests run:
  - `pnpm exec vitest run lib/money-maker/__tests__/presentation.test.ts components/money-maker/__tests__/setup-card.test.tsx components/money-maker/__tests__/money-maker-shell.test.tsx`
  - Result: pass
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts --runInBand`
  - Result: pass
  - `pnpm exec eslint --no-warn-ignored components/money-maker/setup-card.tsx components/money-maker/signal-why-panel.tsx components/money-maker/money-maker-shell.tsx components/money-maker/active-strategies-clock.tsx components/money-maker/__tests__/setup-card.test.tsx components/money-maker/__tests__/money-maker-shell.test.tsx lib/money-maker/presentation.ts lib/money-maker/__tests__/presentation.test.ts`
  - Result: pass
  - `pnpm exec eslint --no-warn-ignored backend/src/services/money-maker/snapshotBuilder.ts backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts backend/src/lib/money-maker/types.ts`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: pass
- Risks introduced:
  - UI churn on the existing board
- Mitigations:
  - keep the board compact and avoid changing poll behavior
- Rollback:
  - revert board-hardening slice as a unit
- Evidence:
  - targeted test output
  - local board rendering now uses plain-English zone summaries and hourly ladder chips
- Notes:
  - This closes current live defects before larger V2 surfaces are added.

### Slice: 2.2
- Objective: Add shared V2 contracts plus deterministic underlying execution-plan logic.
- Status: done
- Scope:
  - shared Money Maker V2 types
  - execution plan builder
  - execution state evaluator
  - trigger distance and entry-quality math
  - target 2 and invalidation logic
- Out of scope:
  - options-chain integration
  - planner workspace UI
- Files:
  - `lib/money-maker/types.ts`
  - `backend/src/services/money-maker/executionPlanBuilder.ts`
  - `backend/src/services/money-maker/executionStateEvaluator.ts`
  - related tests
- Tests added:
  - `backend/src/services/money-maker/__tests__/executionStateEvaluator.test.ts`
  - `backend/src/services/money-maker/__tests__/executionPlanBuilder.test.ts`
- Tests run:
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/executionStateEvaluator.test.ts src/services/money-maker/__tests__/executionPlanBuilder.test.ts --runInBand`
  - `pnpm exec tsc --noEmit`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm exec eslint --no-warn-ignored lib/money-maker/types.ts backend/src/lib/money-maker/types.ts backend/src/services/money-maker/executionStateEvaluator.ts backend/src/services/money-maker/executionPlanBuilder.ts backend/src/services/money-maker/__tests__/executionStateEvaluator.test.ts backend/src/services/money-maker/__tests__/executionPlanBuilder.test.ts`
- Risks introduced:
  - divergence between raw signal and derived plan
- Mitigations:
  - derive only from canonical Money Maker signal fields
- Rollback:
  - revert plan-engine slice as a unit
- Evidence:
  - unit test output
- Notes:
  - Added shared execution-plan contracts to frontend/backend Money Maker types.
  - Locked a deterministic pre-trigger `armed` threshold so valid setups do not collapse into `armed` simply because price remains above stop.
  - Added target 2 selection from the next hourly level beyond target 1 for both long and short plans.
  - This is the foundation slice for the rest of V2.

### Slice: 2.3
- Objective: Add single-leg contract guidance engine and filters.
- Status: done
- Scope:
  - contract guide builder
  - expiry policy
  - delta policy
  - liquidity filters
  - explanation strings
- Out of scope:
  - spreads or multi-leg support
  - sizing engine
- Files:
  - `backend/src/services/money-maker/contractGuideBuilder.ts`
  - related option-service adapters
  - related tests
- Tests added:
  - calls-only / puts-only routing tests
  - rejection tests for illiquid or invalid contracts
- Tests run:
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/executionStateEvaluator.test.ts src/services/money-maker/__tests__/executionPlanBuilder.test.ts src/services/money-maker/__tests__/contractGuideBuilder.test.ts --runInBand`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm exec eslint --no-warn-ignored backend/src/services/money-maker/contractGuideBuilder.ts backend/src/services/money-maker/__tests__/contractGuideBuilder.test.ts backend/src/services/money-maker/executionStateEvaluator.ts backend/src/services/money-maker/executionPlanBuilder.ts backend/src/services/money-maker/__tests__/executionStateEvaluator.test.ts backend/src/services/money-maker/__tests__/executionPlanBuilder.test.ts backend/src/lib/money-maker/types.ts lib/money-maker/types.ts`
- Risks introduced:
  - wrong direction or weak liquidity selection
- Mitigations:
  - deterministic filters and single-leg-only assertions
- Rollback:
  - revert contract-guidance slice
- Evidence:
  - unit and integration outputs
- Notes:
  - Implemented as a pure builder over existing `OptionsChainResponse[]` inputs so contract scoring stays off the board snapshot path.
  - Enforced single-leg only outputs with explicit bullish-call / bearish-put direction mapping.
  - Added DTE fallback handling inside the 2-14 day window and degraded-mode messaging when no valid contracts survive filters.
  - Release-blocking slice.

### Slice: 2.4
- Objective: Build workspace APIs and persistence for plan and contract snapshots.
- Status: done
- Scope:
  - backend routes
  - Next.js member proxies
  - guidance snapshot persistence
  - degraded-mode response contract
- Out of scope:
  - visual workspace UI
- Files:
  - backend controller/routes
  - Next proxy routes
  - migrations
  - persistence tests
- Tests added:
  - route auth
  - degraded payload
  - persistence contract tests
- Tests run:
  - `pnpm exec vitest run lib/__tests__/money-maker-member-route-access.test.ts`
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/workspaceBuilder.test.ts src/__tests__/integration/money-maker-api.test.ts src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/executionStateEvaluator.test.ts src/services/money-maker/__tests__/executionPlanBuilder.test.ts src/services/money-maker/__tests__/contractGuideBuilder.test.ts --runInBand`
  - `pnpm exec tsc --noEmit`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm exec eslint --no-warn-ignored app/api/members/money-maker/workspace/route.ts app/api/members/money-maker/plan/route.ts app/api/members/money-maker/contracts/route.ts lib/__tests__/money-maker-member-route-access.test.ts lib/money-maker/types.ts backend/src/lib/money-maker/types.ts backend/src/controllers/money-maker/index.ts backend/src/routes/money-maker/index.ts backend/src/services/money-maker/workspaceBuilder.ts backend/src/services/money-maker/contractGuideBuilder.ts backend/src/services/money-maker/executionStateEvaluator.ts backend/src/services/money-maker/executionPlanBuilder.ts backend/src/services/money-maker/__tests__/workspaceBuilder.test.ts backend/src/services/money-maker/__tests__/contractGuideBuilder.test.ts backend/src/services/money-maker/__tests__/executionStateEvaluator.test.ts backend/src/services/money-maker/__tests__/executionPlanBuilder.test.ts backend/src/__tests__/integration/money-maker-api.test.ts`
- Risks introduced:
  - auth drift or broken degraded mode
- Mitigations:
  - reuse current Money Maker auth boundaries
- Rollback:
  - revert workspace API slice
- Evidence:
  - route integration test output
- Notes:
  - Added `workspaceBuilder.ts` with on-demand plan + contracts assembly, degraded options handling, append-only persistence, and short-lived cache support.
  - Added backend endpoints for `/api/money-maker/workspace`, `/api/money-maker/plan`, and `/api/money-maker/contracts`.
  - Added member proxy routes for workspace, plan, and contracts using the existing Money Maker admin gate.
  - Added migration `20260401010000_create_money_maker_guidance_snapshots.sql` for guidance snapshot persistence.
  - Snapshot polling must stay lightweight in this slice.

### Slice: 2.5
- Objective: Add planner workspace UI and board-to-workspace interaction.
- Status: done
- Scope:
  - board upgrades
  - setup map
  - trade plan tab
  - contracts tab
  - card-to-workspace interaction
- Out of scope:
  - exit-playbook transition logic
- Files:
  - `components/money-maker/*`
  - `hooks/*`
  - related tests
- Tests added:
  - `components/money-maker/__tests__/money-maker-workspace-dialog.test.tsx`
  - updated `components/money-maker/__tests__/setup-card.test.tsx`
  - updated `components/money-maker/__tests__/money-maker-shell.test.tsx`
  - updated `e2e/specs/members/money-maker.spec.ts`
- Tests run:
  - `pnpm exec vitest run components/money-maker/__tests__/setup-card.test.tsx components/money-maker/__tests__/money-maker-shell.test.tsx components/money-maker/__tests__/money-maker-workspace-dialog.test.tsx`
  - Result: pass
  - `E2E_BACKEND_URL=https://example.invalid PLAYWRIGHT_BASE_URL=http://127.0.0.1:3005 PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/members/money-maker.spec.ts --project=chromium`
  - Result: pass
- Risks introduced:
  - UI overload or missing clarity
- Mitigations:
  - keep board lightweight and load detail on demand
- Rollback:
  - revert workspace UI slice
- Evidence:
  - component tests
  - local Playwright run for board-to-plan handoff
- Notes:
  - Added the workspace dialog, `Open Plan` actions on the board, and plain-English setup/plan/contracts tabs without bloating the scan-first card layout.

### Slice: 2.6
- Objective: Add exit playbook, target-progress states, transition alerts, and trust cues.
- Status: done
- Scope:
  - exit playbook tab
  - state badges
  - target-progress markers
  - transition telemetry and in-app alerts
  - delayed/stale-data warnings
- Out of scope:
  - broker P&L or fill tracking
- Files:
  - execution-state UI
  - telemetry hooks
  - related tests
- Tests added:
  - `lib/money-maker/__tests__/execution-summary.test.ts`
  - `lib/money-maker/__tests__/transition-alerts.test.ts`
  - `components/money-maker/__tests__/money-maker-execution-alerts.test.tsx`
  - updated `components/money-maker/__tests__/money-maker-workspace-dialog.test.tsx`
  - updated `e2e/specs/members/money-maker.spec.ts`
- Tests run:
  - `pnpm exec vitest run lib/money-maker/__tests__/presentation.test.ts lib/money-maker/__tests__/execution-summary.test.ts lib/money-maker/__tests__/transition-alerts.test.ts components/money-maker/__tests__/money-maker-execution-alerts.test.tsx components/money-maker/__tests__/money-maker-workspace-dialog.test.tsx`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm exec eslint --no-warn-ignored lib/money-maker/presentation.ts lib/money-maker/execution-summary.ts lib/money-maker/transition-alerts.ts lib/money-maker/__tests__/presentation.test.ts lib/money-maker/__tests__/execution-summary.test.ts lib/money-maker/__tests__/transition-alerts.test.ts components/money-maker/money-maker-workspace-dialog.tsx components/money-maker/money-maker-execution-alerts.tsx components/money-maker/__tests__/money-maker-workspace-dialog.test.tsx components/money-maker/__tests__/money-maker-execution-alerts.test.tsx hooks/use-money-maker-execution-alerts.ts`
  - Result: pass
  - `E2E_BACKEND_URL=https://example.invalid PLAYWRIGHT_BASE_URL=http://127.0.0.1:3005 PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/members/money-maker.spec.ts --project=chromium`
  - Result: pass
- Risks introduced:
  - generic or misleading exit language
- Mitigations:
  - tie every cue back to KCU structure rules
- Rollback:
  - revert exit-guidance slice
- Evidence:
  - targeted test output
- Notes:
  - Added shared execution-summary logic, deterministic transition-alert dedupe, workspace stale/delayed trust warnings, and exit-playbook visibility tied to the planner surface.

### Slice: 2.7
- Objective: Validate, harden, and close the release packet.
- Status: in_progress
- Scope:
  - targeted E2E
  - release notes
  - runbook updates
  - post-deploy smoke
- Out of scope:
  - new product capabilities
- Files:
  - e2e specs
  - docs
  - runbook/release notes
- Tests added:
  - final user-visible E2E flows
- Tests run:
  - `pnpm --dir backend exec jest src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/executionStateEvaluator.test.ts src/services/money-maker/__tests__/executionPlanBuilder.test.ts src/services/money-maker/__tests__/contractGuideBuilder.test.ts src/services/money-maker/__tests__/workspaceBuilder.test.ts src/__tests__/integration/money-maker-api.test.ts --runInBand`
  - Result: pass
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass after `pnpm build` regenerated `.next/types`
  - `pnpm build`
  - Result: pass
  - `E2E_BACKEND_URL=https://example.invalid PLAYWRIGHT_BASE_URL=http://127.0.0.1:3005 PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/members/money-maker.spec.ts --project=chromium`
  - Result: pass
- Risks introduced:
  - drift between validated and deployed behavior
- Mitigations:
  - deployed SHA and smoke evidence required
- Rollback:
  - roll back feature visibility if final smoke fails
- Evidence:
  - Playwright output
  - build output
  - deployed smoke log (pending)
- Notes:
  - Local release gate is green.
  - Remaining blocker is deployed smoke plus release-note/runbook closure.
