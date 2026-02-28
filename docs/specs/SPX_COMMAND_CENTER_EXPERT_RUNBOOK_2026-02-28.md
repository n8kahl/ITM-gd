# SPX Command Center Expert — Runbook
Date: 2026-02-28
Scope: Expert command-center experience (`P0-S1` through `P5-S3`)
Owner: Product + Engineering + On-Call

## 1. Operator Preflight Checks
1. Confirm runtime is Node `>= 20.19.5`.
2. Confirm deploy includes frontend + backend artifacts for trade-stream + coach facts.
3. Confirm feature flag plan for this environment:
   - `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`
   - `SPX_EXPERT_TRADE_STREAM_ENABLED`
   - `SPX_COACH_FACTS_MODE_ENABLED`
   - `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`
4. Confirm no unresolved critical incidents against `/members/spx-command-center`.
5. Confirm release evidence docs are complete:
   - `SPX_COMMAND_CENTER_EXPERT_RELEASE_NOTES_2026-02-28.md`
   - `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md`
   - `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S3_2026-02-28.md`

## 2. Health Verification Steps

### API and Data Contract Health
1. Validate `/api/spx/trade-stream` returns `200` with non-null `items`, `countsByLifecycle`, and `generatedAt`.
2. Validate response order is lifecycle ascending (`forming -> triggered -> past`) under current sort flag state.
3. Validate `nowFocusItemId` behavior:
   - set and matched when backend provides one,
   - deterministic fallback to first row when missing/unmatched.
4. Validate freshness blocks exist (`item.freshness.*`, `feedTrust.*`).

### UI Contract Health
1. Load `/members/spx-command-center` with trade-stream flag disabled and confirm legacy setup list renders.
2. Enable trade-stream flag and confirm:
   - trade stream panel renders,
   - lifecycle groups render,
   - now focus renders,
   - row selectors stable.
3. Enable coach facts mode and confirm:
   - legacy coach feed hidden,
   - facts rail shown,
   - details panel toggles open/closed,
   - at most two context-valid actions shown.
4. Confirm desktop stage-path dedupe:
   - row STAGE button suppressed where dedupe applies,
   - primary CTA owns stage path.

### Telemetry Health
1. Confirm telemetry records include:
   - `spx_trade_stream_rendered`
   - `spx_trade_stream_row_selected`
   - `spx_trade_stream_row_action`
   - `spx_trade_stream_stage_path_suppressed`
   - `spx_decision_latency_measured`
2. Confirm `spx_decision_latency_measured` payload has `latencyMs`, `mode`, `surface`, and row context fields when applicable.

## 3. Incident Triage Guidance

### Severity Classification
1. `SEV-1`: command center unavailable, repeated fatal runtime errors, or broken primary execution path.
2. `SEV-2`: incorrect lifecycle ordering, now-focus contract regressions, or coach facts disclosure/action contract breaks.
3. `SEV-3`: telemetry missing/degraded while UX remains functional.

### Triage Procedure
1. Capture timestamp, environment, user impact summary, and affected flags.
2. Determine scope:
   - API payload issue,
   - feature-flag gating issue,
   - UI selector/behavior issue,
   - telemetry-only issue.
3. Compare behavior against:
   - `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md` (contract gates)
   - `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S1_2026-02-28.md` (telemetry contract)
4. If production impact is active and rapid mitigation needed, execute staged rollback by flag order (Section 4).
5. Open/append incident decision log entry in:
   - `spx-command-center-expert-autonomous-2026-02-28/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`

## 4. Rollback Procedure

### Fast Mitigation (Flag Rollback)
1. Disable `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`.
2. Disable `SPX_COACH_FACTS_MODE_ENABLED`.
3. Disable `SPX_EXPERT_TRADE_STREAM_ENABLED`.
4. Disable `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`.
5. Re-verify legacy command-center baseline behavior.

### Deeper Rollback (Build Revert)
1. Revert to last known-good release artifact for command-center stack.
2. Re-run smoke checks on `/members/spx-command-center`.
3. Confirm telemetry and incident errors stabilize.
4. Record rollback rationale and approvers in change-control and decision log docs.

## 5. Post-Incident Exit Criteria
1. Root cause identified and documented.
2. Contract regression has deterministic reproduction + fix plan.
3. Required gates rerun in impacted scope and linked in decision log.
4. Feature flag state updated with explicit owner approval.
