# SPX Command Center Runbook (Recovery Track)
Date: February 20, 2026

## 1. Scope
This runbook covers operational ownership for:
1. Feed trust and fallback behavior.
2. Decision/risk gating.
3. Replay, scenario lanes, and focus modes.
4. Trade-journal auto-capture and post-trade analytics.
5. SPX UX flag lifecycle governance.

## 2. Pre-Release Checks
1. Use Node `>=22` for official release candidate validation.
2. `pnpm exec eslint .` passes without errors.
3. `pnpm exec tsc --noEmit` passes.
4. `pnpm run build` passes.
5. SPX unit tests pass:
`pnpm vitest run lib/spx/__tests__`
6. SPX end-to-end suite passes:
`pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`
7. Metadata coverage check returns empty gaps:
`getSPXUXFlagMetadataCoverageGaps()`.

## 3. Runtime Checks
1. Header data-health and fallback reason align with feed trust.
2. Primary CTA blocks unsafe entries with explicit reason.
3. Replay status shows window/speed and advances deterministically.
4. Scenario lanes appear in chart and coach panels for selected setup.
5. Exiting trade focus emits a new post-trade artifact in local journal panel.

## 4. Incident Response
1. If replay/focus mode causes instability:
set `SPX_UX_SPATIAL_HUD_V1=0` and `SPX_UX_COMMAND_PALETTE=1`.
2. If coach panels flood alerts:
keep `coachAlertLifecycleV2` enabled and monitor `spx_coach_no_change_suppressed`.
3. If journal capture fails:
verify localStorage write path and `spx_trade_journal_captured` telemetry.
4. If feed trust appears inconsistent:
review `spx_data_health_changed` and fallback reason-code transitions.

## 5. Ownership
1. Execution controls: `spx-execution`.
2. Chart/replay/scenario UI: `spx-visual`.
3. Coach + suppression: `spx-coach`.
4. Feed/orchestrator + context: `spx-platform`.
5. Mobile behavior: `spx-mobile`.
