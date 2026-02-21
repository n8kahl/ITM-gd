# Phase Backlog and Workplan: SPX Autonomous Recovery
Date: February 20, 2026

## 1. Planning Baseline
This workplan is derived from:
1. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md`

## 2. Execution Cadence
1. One phase may span multiple PR slices.
2. Do not open work on a higher-risk phase until dependent gates are green.
3. If a phase mixes reliability and UX, land reliability first.

## 3. Phase Ledger

### Phase 0: Baseline Lock and Contract Freeze (P0)
Objective: lock critical selector/test contracts before refactor.

Deliverables:
1. E2E baseline failure inventory with root-cause labels.
2. Selector contract manifest for all critical SPX surfaces.

Primary files:
1. `/e2e/spx-*.spec.ts`
2. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_SELECTOR_CONTRACT_2026-02-20.md`

Dependencies: none.

Exit criteria:
1. Critical selector contracts are documented and traceable.

### Phase 1: Regression Recovery (P0)
Objective: restore broken user contracts and remove UX dead-ends.

Deliverables:
1. Command palette trigger parity with tests.
2. Coach pinned alert lifecycle restored.
3. Coach action chip/timeline visibility restored.
4. Contract revert-to-AI visibility logic stabilized.

Primary files:
1. `/components/spx-command-center/spx-header.tsx`
2. `/components/spx-command-center/ai-coach-feed.tsx`
3. `/components/spx-command-center/contract-card.tsx`
4. `/components/spx-command-center/contract-selector.tsx`
5. `/app/members/spx-command-center/page.tsx`

Dependencies:
1. Phase 0 contract definitions.

Exit criteria:
1. Critical SPX regression tests pass.
2. No coach/contract UX dead-end remains.

### Phase 2: Command Surface Consolidation (P0)
Objective: remove duplicate command logic and unify action behavior.

Deliverables:
1. Canonical SPX command registry.
2. Unified command availability predicates.
3. Keyboard/palette/action-strip parity.

Primary files:
1. `/lib/spx/commands.ts`
2. `/hooks/use-spx-command-registry.ts`
3. `/components/spx-command-center/action-strip.tsx`
4. `/components/spx-command-center/command-palette.tsx`
5. `/app/members/spx-command-center/page.tsx`

Dependencies:
1. Phase 1 command path recovery.

Exit criteria:
1. No duplicate command execution branches remain.
2. Command parity verified across all surfaces.

### Phase 3: Orchestration Refactor and Context Cleanup (P0/P1)
Objective: reduce stale-state risk and improve maintainability.

Deliverables:
1. Shell/controller split.
2. Legacy bridge cleanup.
3. Compatibility shim preservation.

Primary files:
1. `/app/members/spx-command-center/page.tsx`
2. `/app/members/spx-command-center/spx-command-center-shell.tsx`
3. `/hooks/use-spx-command-controller.ts`
4. `/contexts/SPXCommandCenterContext.tsx`

Dependencies:
1. Phase 2 command registry stability.

Exit criteria:
1. State transition behavior remains deterministic.
2. Critical E2E flows remain green.

### Phase 4: Overlay Presets and Spatial Packaging (P1)
Objective: keep visual richness while constraining production risk.

Deliverables:
1. Three production presets (`execution`, `flow`, `spatial`).
2. Advanced toggles moved to drawer/HUD.
3. Performance throttle indicator visible when active.

Primary files:
1. `/lib/spx/spatial-hud.ts`
2. `/components/spx-command-center/action-strip.tsx`
3. `/components/spx-command-center/sidebar-panel.tsx`
4. `/app/members/spx-command-center/page.tsx`

Dependencies:
1. Phase 3 refactor baseline.

Exit criteria:
1. Preset behavior deterministic and tested.
2. Spatial remains opt-in until performance gates pass.

### Phase 5: Experience Polish, Accessibility, Responsive QA (P1)
Objective: finalize clarity and accessibility quality.

Deliverables:
1. Mode-specific CTA hierarchy pass.
2. Header signal clarity pass.
3. Mobile touch target/readability pass.
4. Focus and contrast pass.

Primary files:
1. `/components/spx-command-center/spx-header.tsx`
2. `/components/spx-command-center/setup-feed.tsx`
3. `/components/spx-command-center/ai-coach-feed.tsx`
4. `/components/spx-command-center/mobile-brief-panel.tsx`
5. `/components/spx-command-center/mobile-panel-tabs.tsx`

Dependencies:
1. Phases 1-4 complete.

Exit criteria:
1. Accessibility and responsive checklist complete.

### Phase 6: Repository Cleanup and Release Hardening (P0)
Objective: leave repository clean and release-ready.

Deliverables:
1. Artifact cleanup and ignore hygiene.
2. Superseded spec archive organization.
3. Final gate commands passing.

Primary files:
1. `.gitignore`
2. `/docs/specs/archive/spx/*`
3. SPX source/test files touched by prior phases.

Dependencies:
1. Phases 0-5 complete.

Exit criteria:
1. Release gate command suite green.
2. Clean intentional git diff only.

### Phase 7: Data Orchestrator and Feed Trust Hardening (P0/P1)
Objective: deterministic market data behavior and visible trust state.

Deliverables:
1. Canonical event-normalized orchestrator.
2. Heartbeat/staleness/sequence-gap controls.
3. Fallback policy implementation and UI linkage.
4. Feed transition telemetry.

Primary files:
1. `/lib/spx/market-data-orchestrator.ts`
2. `/lib/spx/event-schema.ts`
3. `/lib/spx/feed-health.ts`
4. `/contexts/SPXCommandCenterContext.tsx`
5. `/components/spx-command-center/spx-header.tsx`

Dependencies:
1. Phase 3 context architecture in place.

Exit criteria:
1. UI and command safety react correctly to feed trust changes.

### Phase 8: Decision Intelligence and Risk Envelope (P1)
Objective: increase decision quality and enforce safety boundaries.

Deliverables:
1. Multi-timeframe alignment model.
2. Dynamic confidence model.
3. Risk-envelope gating with reason codes.
4. Coach explainability payloads.

Primary files:
1. `/lib/spx/decision-engine.ts`
2. `/lib/spx/risk-envelope.ts`
3. `/components/spx-command-center/setup-feed.tsx`
4. `/components/spx-command-center/ai-coach-feed.tsx`
5. `/components/spx-command-center/contract-selector.tsx`

Dependencies:
1. Phase 7 data reliability baseline.

Exit criteria:
1. Unsafe commands blocked deterministically with explicit reason codes.

### Phase 9: Chart Interaction, Replay, Scenario Lanes (P1)
Objective: deliver high-value visual intelligence with controlled performance.

Deliverables:
1. Crosshair and OHLC tooltip interactions.
2. Replay engine with deterministic playback.
3. Scenario lanes (base/adverse/acceleration).
4. Focus mode switching.
5. Mockup parity maintenance for scope validation artifact.

Primary files:
1. `/components/spx-command-center/spx-chart.tsx`
2. `/components/spx-command-center/action-strip.tsx`
3. `/components/spx-command-center/sidebar-panel.tsx`
4. `/lib/spx/replay-engine.ts`
5. `/components/spx-command-center/ai-coach-feed.tsx`
6. `/Users/natekahl/ITM-gd/docs/spx-command-center-production-recovery-mockup.html`

Dependencies:
1. Phase 7 and Phase 8 complete.

Exit criteria:
1. Replay determinism validated.
2. Chart interaction performance remains within budget.

### Phase 10: Journal Automation and Governance Hardening (P2)
Objective: close the loop for learning, auditing, and operational hygiene.

Deliverables:
1. Automated trade journal capture.
2. Post-trade analytics and adherence scoring.
3. Alert suppression policy.
4. Feature-flag lifecycle metadata completion.

Primary files:
1. `/lib/spx/trade-journal-capture.ts`
2. `/components/spx-command-center/post-trade-panel.tsx`
3. `/lib/spx/flags.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RUNBOOK_2026-02-20.md`

Dependencies:
1. Phase 9 complete.

Exit criteria:
1. Every completed trade has full journal artifact coverage.
2. Governance metadata complete for all active flags.

## 4. Autonomous Slice Template
For each PR slice, log:
1. Slice ID (`P<phase>-S<index>`)
2. Objective
3. Affected files
4. Tests run
5. Risks introduced
6. Rollback approach
7. Status (`planned`, `in_progress`, `blocked`, `done`)

## 5. Phase Progress Rules
1. A phase may be marked done only when all exit criteria are met.
2. `blocked` phases require explicit blocker + mitigation entry.
3. Do not advance to dependent phases with unresolved P0 defects.
