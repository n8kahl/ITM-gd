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
- Status: planned
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
  - `backend/src/services/money-maker/snapshotBuilder.ts`
  - `components/money-maker/setup-card.tsx`
  - `components/money-maker/signal-why-panel.tsx`
  - `components/money-maker/active-strategies-clock.tsx`
  - related tests
- Tests added:
  - normalization and trader-copy fixtures
- Tests run:
  - To be recorded during implementation
- Risks introduced:
  - UI churn on the existing board
- Mitigations:
  - keep the board compact and avoid changing poll behavior
- Rollback:
  - revert board-hardening slice as a unit
- Evidence:
  - component screenshots and targeted tests
- Notes:
  - This closes current live defects before larger V2 surfaces are added.

### Slice: 2.2
- Objective: Add shared V2 contracts plus deterministic underlying execution-plan logic.
- Status: planned
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
  - deterministic state/plan fixtures
- Tests run:
  - To be recorded during implementation
- Risks introduced:
  - divergence between raw signal and derived plan
- Mitigations:
  - derive only from canonical Money Maker signal fields
- Rollback:
  - revert plan-engine slice as a unit
- Evidence:
  - unit test output
- Notes:
  - This is the foundation slice for the rest of V2.

### Slice: 2.3
- Objective: Add single-leg contract guidance engine and filters.
- Status: planned
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
  - To be recorded during implementation
- Risks introduced:
  - wrong direction or weak liquidity selection
- Mitigations:
  - deterministic filters and single-leg-only assertions
- Rollback:
  - revert contract-guidance slice
- Evidence:
  - unit and integration outputs
- Notes:
  - Release-blocking slice.

### Slice: 2.4
- Objective: Build workspace APIs and persistence for plan and contract snapshots.
- Status: planned
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
  - To be recorded during implementation
- Risks introduced:
  - auth drift or broken degraded mode
- Mitigations:
  - reuse current Money Maker auth boundaries
- Rollback:
  - revert workspace API slice
- Evidence:
  - route integration test output
- Notes:
  - Snapshot polling must stay lightweight in this slice.

### Slice: 2.5
- Objective: Add planner workspace UI and board-to-workspace interaction.
- Status: planned
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
  - workspace render/state tests
- Tests run:
  - To be recorded during implementation
- Risks introduced:
  - UI overload or missing clarity
- Mitigations:
  - keep board lightweight and load detail on demand
- Rollback:
  - revert workspace UI slice
- Evidence:
  - component tests and screenshots
- Notes:
  - This slice must preserve the fast scan behavior of the board.

### Slice: 2.6
- Objective: Add exit playbook, target-progress states, transition alerts, and trust cues.
- Status: planned
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
  - exit-playbook rendering tests
  - state-transition tests
  - alert dedupe tests
- Tests run:
  - To be recorded during implementation
- Risks introduced:
  - generic or misleading exit language
- Mitigations:
  - tie every cue back to KCU structure rules
- Rollback:
  - revert exit-guidance slice
- Evidence:
  - targeted test output
- Notes:
  - Release-blocking slice.

### Slice: 2.7
- Objective: Validate, harden, and close the release packet.
- Status: planned
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
  - To be recorded during implementation
- Risks introduced:
  - drift between validated and deployed behavior
- Mitigations:
  - deployed SHA and smoke evidence required
- Rollback:
  - roll back feature visibility if final smoke fails
- Evidence:
  - Playwright output
  - deployed smoke log
- Notes:
  - Final release-blocking slice.
