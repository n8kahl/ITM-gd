# SPX Command Center Expert Contract Baseline
Date: 2026-02-28
Baseline Commit: `b7fd209`
Scope Route: `/members/spx-command-center`

## 1. Purpose
Freeze the current selector and API contract before Expert Trade Stream implementation.

## 2. Frontend Selector Contract (Current)

### 2.1 Core shell and primary command selectors
1. `spx-command-center`
2. `spx-header-overlay`
3. `spx-command-palette-trigger`
4. `spx-action-strip`
5. `spx-action-primary-cta`
6. `spx-action-primary-cta-desktop`
7. `spx-action-primary-why`
8. `spx-action-primary-why-desktop`
9. `spx-action-decision-state`
10. `spx-view-mode-toggle`
11. `spx-view-mode-classic`
12. `spx-view-mode-spatial`

### 2.2 Setup, sidebar, and chart selectors
1. `spx-sidebar-decision-zone`
2. `spx-sidebar-panel`
3. `spx-chart-surface`
4. `spx-chart-replay-status`
5. `spx-chart-scenario-lanes`
6. `spx-post-trade-panel`
7. `spx-setup-lock-overlay`

### 2.3 Coach selectors (current, pre-facts-rail)
1. `spx-ai-coach-feed`
2. `spx-ai-coach-pinned-alert`
3. `spx-ai-coach-timeline`
4. `spx-coach-decision-brief`
5. `spx-coach-decision-actions`
6. `spx-coach-quick-prompts-toggle`
7. `spx-coach-quick-prompts`
8. `spx-ai-coach-jump-latest`
9. `spx-coach-bottom-sheet`

### 2.4 Overlay and advanced HUD selectors
1. `spx-action-advanced-hud-toggle`
2. `spx-action-advanced-hud-drawer`
3. `spx-action-overlay-levels`
4. `spx-action-overlay-cone`
5. `spx-action-overlay-coach`
6. `spx-action-overlay-gex`
7. `spx-flow-ribbon`
8. `spx-flow-ticker`
9. `spx-priority-level-overlay`
10. `spx-probability-cone-svg`
11. `spx-rr-shadow-overlay`
12. `spx-spatial-ghost-layer`

## 3. Backend SPX API Route Contract (Current)
All routes are under authenticated + pro-tier guarded SPX router.

### 3.1 Snapshot and analytics
1. `GET /api/spx/snapshot`
2. `GET /api/spx/analytics/win-rate`
3. `GET /api/spx/analytics/win-rate/backtest`
4. `GET /api/spx/analytics/optimizer/scorecard`
5. `GET /api/spx/analytics/optimizer/schedule`
6. `GET /api/spx/analytics/optimizer/history`
7. `POST /api/spx/analytics/optimizer/scan`
8. `POST /api/spx/analytics/optimizer/revert`

### 3.2 Market structure and setup surfaces
1. `GET /api/spx/levels`
2. `GET /api/spx/clusters`
3. `GET /api/spx/gex`
4. `GET /api/spx/gex/history`
5. `GET /api/spx/setups`
6. `GET /api/spx/setups/:id`
7. `GET /api/spx/fibonacci`
8. `GET /api/spx/flow`
9. `GET /api/spx/regime`
10. `GET /api/spx/basis`
11. `GET /api/spx/contract-select`
12. `POST /api/spx/contract-select`

### 3.3 Broker + coach surfaces
1. `GET /api/spx/broker/tradier/status`
2. `POST /api/spx/broker/tradier/credentials`
3. `POST /api/spx/broker/tradier/test-balance`
4. `POST /api/spx/broker/tradier/mode`
5. `POST /api/spx/broker/tradier/kill`
6. `GET /api/spx/broker/tradier/positions`
7. `GET /api/spx/coach/state`
8. `POST /api/spx/coach/message`
9. `POST /api/spx/coach/decision`

## 4. Snapshot Payload Baseline (`GET /api/spx/snapshot`)
Source type: `SPXSnapshot` in `backend/src/services/spx/types.ts`.

Required top-level fields:
1. `levels`
2. `clusters`
3. `fibLevels`
4. `gex`
5. `basis`
6. `spyImpact`
7. `setups`
8. `regime`
9. `prediction`
10. `flow`
11. `coachMessages`
12. `generatedAt`

Optional top-level fields currently present:
1. `flowAggregation`
2. `environmentGate`
3. `standbyGuidance`

## 5. Current-State Behaviors to Preserve During P0
1. Feed trust/fallback status chip rendering in header.
2. Execution entry gating from feed health + broker state.
3. Command palette trigger accessibility.
4. Coach pinned alert lifecycle behavior.
5. Replay and overlay control availability contracts.

## 6. Known Baseline Constraints
1. Node runtime in local baseline capture is `v20.19.5`; release evidence must be re-run under Node `>=22`.
2. Contract is pre-Expert-Trade-Stream and expected to be superseded by Phase 1 route additions.

