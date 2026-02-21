# SPX Command Center Production Recovery Execution Spec
Date: February 20, 2026
Owner: Product + Engineering
Primary Route: `/members/spx-command-center`
Execution Mode: Stabilize first, then consolidate, then polish

## 1. Objective
Ship a production-ready SPX Command Center that restores trust and clarity while preserving the strongest recent improvements.

This recovery must:
1. Remove UX and state contradictions introduced during rapid iteration.
2. Restore broken user/test contracts (coach alerts, command palette trigger, timeline/action discoverability, contract revert behavior).
3. Consolidate orchestration architecture so behavior is deterministic and maintainable.
4. Keep chart and reliability improvements already delivering value.
5. Leave repository and release branch clean, testable, and auditable.
6. Deliver a genuinely informative, data-rich, visually rich SPX trading workflow without reintroducing cognitive overload.

## 2. Scope and Constraints

### 2.1 In scope
1. SPX command center UX and architecture.
2. Context orchestration and state flow.
3. Command surfaces (keyboard, palette, action strip, view toggles).
4. Coach decision + history + alert lifecycle UX.
5. Contract selection and AI recommendation reversion path.
6. Spatial overlay packaging and performance controls.
7. SPX-specific tests and release gates.
8. Repo cleanup actions directly related to SPX release quality.

### 2.2 Out of scope
1. New broker/order routing integration.
2. New strategy model R&D.
3. Non-SPX product redesigns.
4. Large backend rewrites unrelated to SPX command center stability.

### 2.3 Non-negotiable project constraints
1. Design system remains Emerald/Champagne dark mode (`claude.md`).
2. Market data naming must use Massive.com terminology.
3. Mobile-first behavior must remain intact.
4. Do not remove proven reliability hardening unless replaced with equal-or-better behavior.

## 3. Baseline Findings (Validated February 20, 2026)
1. Two-day SPX change set is high-risk: 64 files changed, 10k+ insertions.
2. Orchestrator files are oversized and currently hard to reason about:
- `/app/members/spx-command-center/page.tsx`
- `/contexts/SPXCommandCenterContext.tsx`
- `/components/spx-command-center/ai-coach-feed.tsx`
3. Key E2E user contracts are currently failing:
- coach message/timeline/action-chip visibility
- command palette trigger contract
- pinned coach alert lifecycle surface
- revert-to-AI contract path visibility
4. Feature flags are over-enabled by default, increasing blast radius.
5. Spatial overlay stack is powerful but currently too toggle-heavy and performance-sensitive for default-on production behavior.
6. CTA duplication and inconsistent button grouping create conflicting "primary" actions.
7. User journey progression (`scan -> evaluate -> in_trade -> post_trade`) is not consistently legible in the current UI.

## 4. Product Principles for Recovery
1. One primary action per state.
2. One canonical source of truth for trade state and execution context.
3. One command model across all surfaces.
4. Progressive disclosure for complexity (advanced overlays/history not default noise).
5. Stable-first defaults; advanced visuals opt-in.
6. Every visible behavior is test-contracted.

## 5. Target Experience Design

### 5.1 Desktop shell
Layout regions:
1. Header Signal Bar: symbol, feed health, ET market clock, regime, basis.
2. Main Chart Canvas: price + levels + state-appropriate overlays.
3. Decision Rail (right): Setup -> Coach -> Contract (ordered by state).
4. Execution Rail (bottom): single primary CTA + compact secondary controls.

### 5.2 Mobile shell
1. Default stack: brief -> setup -> coach now -> contract summary -> chart.
2. History and deep analytics moved into bottom sheet/drawer.
3. One-thumb execution controls with minimum 44px touch targets.

### 5.3 State-based primary action matrix
1. `scan`: primary action = `Select best setup`.
2. `evaluate`: primary action = `Enter trade focus`.
3. `in_trade`: primary action = `Manage risk / Exit trade`.
4. `post_trade`: primary action = `Return to scan`.

### 5.4 Coach surface model
1. `Now` (always visible): verdict, confidence, freshness, one primary action.
2. `Why` (collapsed by default): max 3 concise evidence bullets.
3. `History` (secondary): timeline + freeform chat.
4. `Pinned Alert Lane` (event-driven): lifecycle-driven short-lived alerts.

### 5.5 Contract surface model
1. AI recommendation card always visible when setup actionable.
2. Alternatives in expandable section.
3. Persistent mode label: `Using AI` vs `Using Alternative`.
4. Revert action visible whenever mode is `Using Alternative`.

### 5.6 Chart experience contract (data-rich + visually rich)
1. Default chart includes 5m candles, volume pane, VWAP, EMA9, EMA21, and active setup levels.
2. Context-sensitive overlays always show entry zone, stop/target guides, and live price marker.
3. Crosshair + OHLC tooltip on hover (desktop) and press/hold (mobile).
4. Price and time axes prioritize readability with ET labels and adaptive precision.
5. Advanced indicators are available in explicit groups (no uncontrolled toggle sprawl).

### 5.7 Focus modes
1. `Decision` mode emphasizes setup quality, confluence, and `Why now?` evidence.
2. `Execution` mode emphasizes active risk envelope, stop distance, and command gating.
3. `Risk-only` mode hides non-essential panels and keeps only chart, risk, and alert controls.
4. Mode switching target: < 120ms perceived transition.

### 5.8 Setup intelligence + risk envelope UX
1. Setup cards show alignment score, confidence, and confidence trend.
2. Risk envelope tile shows max loss, position cap, invalidation trigger, and block reason.
3. Scenario lanes (base/adverse/acceleration) preview likely path to stop/t1/t2.
4. AI recommendation must expose top 3 drivers and top 3 risks.

### 5.9 Replay and debrief loop
1. Replay supports last 30/60/120 minutes at 1x/2x/4x speed.
2. One-click journal snapshot captures setup, risk, coach rationale, and chart context.
3. Debrief computes execution quality (entry efficiency, stop discipline, rule adherence).

## 6. Target Technical Architecture

### 6.1 Composition model
Adopt shell + domain-controller separation:
1. `SPXCommandCenterShell` (layout/composition only).
2. `useSPXCommandController` (mode/actions/command registry).
3. Domain contexts remain split (price/analytics/setup/flow/coach) but remove legacy bridge behavior.

### 6.2 Command model (single registry)
All executable actions are defined once and consumed by:
1. keyboard shortcuts
2. command palette
3. action strip buttons
4. mobile/desktop CTA surfaces

Each command definition contains:
1. `id`
2. `availability predicate`
3. `execute()`
4. `telemetry payload`
5. `shortcut metadata`

### 6.3 Overlay model (preset-based)
Replace freeform production toggles with presets:
1. `execution`: levels + setup lock + risk shadow.
2. `flow`: execution + flow ribbon + gamma topography.
3. `spatial`: full spatial stack (cone + coach nodes + ghosts + ladder).

Advanced overlay toggles remain available in an `Advanced HUD` drawer (not primary rail).

### 6.4 State machine contract
Allowed transitions:
1. `scan -> evaluate`
2. `evaluate -> in_trade`
3. `evaluate -> scan`
4. `in_trade -> post_trade`
5. `post_trade -> scan`

Invalid combinations must be render-blocked and command-blocked.

### 6.5 Context cleanup contract
1. Retire legacy ref-freeze bridge logic in `SPXCommandCenterContext` once split-context consumers are complete.
2. Keep aggregate `useSPXCommandCenter()` API only as compatibility shim with direct pass-through values (no stale snapshot indirection).
3. Add explicit selector hooks to reduce broad re-renders.

### 6.6 Market data orchestrator (new core service)
1. Introduce `/lib/spx/market-data-orchestrator.ts` as the canonical ingest pipeline.
2. Normalize all inbound streams into one schema: `quote`, `bar`, `optionsFlow`, `greeks`, `breadth`, `setupSignal`, `systemHealth`.
3. Route all UI consumers through orchestrator read models (no component-level feed parsing).
4. Enforce deterministic ordering by source sequence + timestamp and mark/drop invalid packets.

### 6.7 Feed trust and failover controls
1. Heartbeat monitor per source with stale/degraded thresholds.
2. Sequence-gap detector with replay request + fallback snapshot behavior.
3. Feed health score drives UI status chips (`healthy`, `stale`, `degraded`).
4. Fallback order is explicit and test-contracted:
- live stream
- polling snapshot
- last-known-good cache with visible degradation badge

### 6.8 Store segmentation and command safety
Split state into independent stores:
1. `displayStore`: view mode, panel expansion, chart interaction state.
2. `decisionStore`: setup ranking, alignment score, coach rationale.
3. `executionStore`: active trade state, risk envelope, allowed transitions, command gating.
4. `journalStore`: immutable event journal for replay/debrief.

Hard rule: display mutations must never mutate execution state directly.

### 6.9 Risk envelope service
1. Compute per-setup constraints: max contracts, max dollar risk, invalidation distance, liquidity floor.
2. Block unsafe commands using explicit reason codes.
3. Surface reason codes in both UI and telemetry for auditability.
4. Persist envelope snapshots for post-trade review.

### 6.10 Decision intelligence pipeline
1. Multi-timeframe alignment engine (1m/5m/15m/1h) outputs a weighted alignment score.
2. Dynamic confidence model updates setup confidence using trend/volume/VWAP/GEX-breadth/regime inputs.
3. `Why now` payload includes ranked drivers, ranked risks, and freshness.
4. Scenario engine outputs base/adverse/acceleration lanes for coach and chart overlays.

### 6.11 Observability and governance
1. Emit telemetry for command usage, blocked actions, feed transitions, and mode changes.
2. Define SLOs for feed freshness, command latency, frame timing, and coach latency.
3. Require capability-level feature flags with instant kill-switch support.
4. Every major capability must ship with runbook + rollback path.

## 7. Feature Flag Policy (Production Defaults)

### 7.1 Stable defaults ON
1. `oneClickEntry`
2. `mobileFullTradeFocus`
3. `keyboardShortcuts`
4. `layoutStateMachine`
5. `mobileSmartStack`
6. `coachProactive`
7. `commandPalette`
8. `coachDockV1`
9. `coachAlertLifecycleV2`
10. `coachTimelineV2`
11. `coachMotionV1`
12. `coachSurfaceV2`

### 7.2 Beta defaults OFF (opt-in)
1. `spatialHudV1` (default off until stability gates met)
2. `coachDecisionV2` only if endpoint reliability > target threshold
3. `coachHistoryDrawerV1`
4. `coachMemoryV1`
5. `coachTrustSignalsV1`

### 7.3 Flag hygiene
1. Every flag must list owner, purpose, rollout date, and removal condition.
2. Remove stale flags within one release cycle after full adoption.

## 8. Concrete Implementation Plan (PR-sliced)

## Phase 0: Baseline Lock and Test Contract Freeze (P0)
Goal: Freeze expected behavior before refactor.

Deliverables:
1. Record failing SPX E2E baseline and annotate contract drift.
2. Publish selector contract manifest for SPX surfaces.

Files:
1. `/e2e/spx-*.spec.ts`
2. `/docs/specs/SPX_COMMAND_CENTER_SELECTOR_CONTRACT_2026-02-20.md` (new)

Exit criteria:
1. Every critical selector contract is explicitly documented.

## Phase 1: Regression Recovery (P0)
Goal: Restore broken user contracts without broad redesign.

Required fixes:
1. Restore command palette trigger test contract (`spx-command-palette-trigger`).
2. Reintroduce pinned coach alert lane backed by lifecycle state module.
3. Restore coach action chip/timeline discoverability path.
4. Stabilize `Use AI Recommendation` reversion visibility logic.

Primary files:
1. `/components/spx-command-center/spx-header.tsx`
2. `/components/spx-command-center/ai-coach-feed.tsx`
3. `/components/spx-command-center/contract-card.tsx`
4. `/components/spx-command-center/contract-selector.tsx`
5. `/app/members/spx-command-center/page.tsx`

Tests (must pass):
1. `/e2e/spx-command-palette.spec.ts`
2. `/e2e/spx-command-center.spec.ts`
3. `/e2e/spx-coach-messages.spec.ts`
4. `/e2e/spx-setup-interaction.spec.ts`

Exit criteria:
1. Critical contract tests green.
2. No UX dead-end in coach/contract flows.

## Phase 2: Command Surface Consolidation (P0)
Goal: Remove duplicated behavior logic.

Deliverables:
1. Introduce `SPX command registry` module.
2. Convert keyboard/palette/action strip to shared command source.
3. Enforce availability predicates uniformly.

New/changed files:
1. `/lib/spx/commands.ts` (new)
2. `/hooks/use-spx-command-registry.ts` (new)
3. `/app/members/spx-command-center/page.tsx`
4. `/components/spx-command-center/action-strip.tsx`
5. `/components/spx-command-center/command-palette.tsx`

Exit criteria:
1. No duplicated command execution branches in page-level component.
2. Command behavior parity across surfaces verified by tests.

## Phase 3: Orchestration Refactor and Context Cleanup (P0/P1)
Goal: Reduce complexity and stale-state risk.

Deliverables:
1. Split page orchestration into shell + controller + render sections.
2. Remove legacy snapshot-ref bridge behavior from context path.
3. Keep compatibility API for existing consumers.

Primary files:
1. `/app/members/spx-command-center/page.tsx`
2. `/app/members/spx-command-center/spx-command-center-shell.tsx` (new)
3. `/hooks/use-spx-command-controller.ts` (new)
4. `/contexts/SPXCommandCenterContext.tsx`

Targets:
1. Reduce `page.tsx` to <= 700 lines.
2. Reduce `SPXCommandCenterContext.tsx` to <= 1400 lines.

Exit criteria:
1. State transition tests pass.
2. No functional regressions in E2E critical suite.

## Phase 4: Overlay Presets + Spatial Packaging (P1)
Goal: Preserve visual richness with production-safe controls.

Deliverables:
1. Replace freeform toggle sprawl with 3 overlay presets.
2. Move advanced toggles to optional drawer.
3. Keep performance auto-throttle indicator visible when degraded.

Primary files:
1. `/lib/spx/spatial-hud.ts`
2. `/components/spx-command-center/action-strip.tsx`
3. `/components/spx-command-center/sidebar-panel.tsx`
4. `/app/members/spx-command-center/page.tsx`

Exit criteria:
1. Preset switching is deterministic and test-covered.
2. Spatial mode remains optional until performance gates pass.

## Phase 5: Experience Polish + Accessibility + Responsive QA (P1)
Goal: Production finish quality.

Deliverables:
1. CTA hierarchy cleanup in each mode.
2. Header signal bar quality pass (clock/feed/regime clarity).
3. Mobile stack readability/touch target validation.
4. Contrast/focus-state pass.

Files:
1. `/components/spx-command-center/spx-header.tsx`
2. `/components/spx-command-center/setup-feed.tsx`
3. `/components/spx-command-center/ai-coach-feed.tsx`
4. `/components/spx-command-center/mobile-brief-panel.tsx`
5. `/components/spx-command-center/mobile-panel-tabs.tsx`

Exit criteria:
1. Responsive and accessibility checklist complete.

## Phase 6: Repository Cleanup + Release Hardening (P0)
Goal: Leave repo clean and production-ready.

Required cleanup actions:
1. Remove/ignore generated artifacts from tracked scope (`playwright-report`, `test-results`, `.next`, transient logs).
2. Ensure no obsolete SPX temporary files or dead imports remain.
3. Archive superseded SPX spec drafts into `/docs/specs/archive/spx/` (do not delete history-critical docs).
4. Ensure selector/test contract docs are current.
5. Ensure only intentional SPX files are modified in final release branch.

Release gate commands:
1. `pnpm exec eslint .`
2. `pnpm exec tsc --noEmit`
3. `pnpm build`
4. `pnpm vitest run lib/spx/__tests__/...`
5. `pnpm playwright test e2e/spx-*.spec.ts --project=chromium`

Environment gate:
1. Use Node >= 22 for official release run.

Exit criteria:
1. All release gates green.
2. Clean git status except intended release changes.
3. Release notes and rollback steps prepared.

## Phase 7: Data Orchestrator + Feed Trust Hardening (P0/P1)
Goal: Establish deterministic market data behavior before adding new intelligence layers.

Deliverables:
1. Build canonical market data orchestrator with normalized event schema.
2. Add heartbeat/staleness/sequence-gap handling with explicit fallback policy.
3. Publish feed trust state to UI and command safety gates.
4. Instrument telemetry for feed transitions and packet validity.

Primary files:
1. `/lib/spx/market-data-orchestrator.ts` (new)
2. `/lib/spx/event-schema.ts` (new)
3. `/lib/spx/feed-health.ts` (new)
4. `/contexts/SPXCommandCenterContext.tsx`
5. `/components/spx-command-center/spx-header.tsx`

Exit criteria:
1. All SPX consumers read from orchestrator models, not direct feed parsing.
2. Feed trust transitions are deterministic and test-covered.
3. UI and command layer react consistently to degraded data.

## Phase 8: Decision Intelligence + Risk Envelope (P1)
Goal: Increase decision quality while making unsafe actions impossible.

Deliverables:
1. Implement multi-timeframe alignment scoring.
2. Implement dynamic setup confidence model (trend/volume/VWAP/GEX-breadth/regime).
3. Implement risk envelope reason-code gating for trade actions.
4. Extend coach payload with top drivers, top risks, and freshness age.

Primary files:
1. `/lib/spx/decision-engine.ts` (new)
2. `/lib/spx/risk-envelope.ts` (new)
3. `/components/spx-command-center/setup-feed.tsx`
4. `/components/spx-command-center/ai-coach-feed.tsx`
5. `/components/spx-command-center/contract-selector.tsx`

Exit criteria:
1. Unsafe commands are blocked with explicit reason codes.
2. Setup ranking is deterministic for identical input fixtures.
3. Coach decision payload always includes explainability fields.

## Phase 9: Chart Interaction + Replay + Scenario Lanes (P1)
Goal: Make the chart genuinely informative without sacrificing performance.

Deliverables:
1. Add crosshair/tooltip/indicator controls and level pinning.
2. Add replay engine (30/60/120 min, 1x/2x/4x).
3. Add scenario lanes (base/adverse/acceleration) to chart + coach surfaces.
4. Add focus mode switching (`Decision`, `Execution`, `Risk-only`).
5. Keep `/docs/spx-command-center-production-recovery-mockup.html` updated as a scope-validation artifact.

Primary files:
1. `/components/spx-command-center/spx-chart.tsx`
2. `/components/spx-command-center/action-strip.tsx`
3. `/components/spx-command-center/sidebar-panel.tsx`
4. `/lib/spx/replay-engine.ts` (new)
5. `/components/spx-command-center/ai-coach-feed.tsx`

Exit criteria:
1. Replay is deterministic for frozen event journals.
2. Scenario lanes render correctly for bullish and bearish setups.
3. Chart interaction remains within performance budget in default mode.

## Phase 10: Journal Automation + Governance Hardening (P2)
Goal: Convert execution improvements into repeatable, auditable trading edge.

Deliverables:
1. Auto-capture trade journal artifacts (chart snapshot + decision/risk context).
2. Add post-trade analytics (expectancy, adherence, setup win-rate by regime/time bucket).
3. Add smart alert suppression/severity tuning to reduce noise fatigue.
4. Complete feature flag lifecycle metadata and retirement plan.

Primary files:
1. `/lib/spx/trade-journal-capture.ts` (new)
2. `/components/spx-command-center/post-trade-panel.tsx`
3. `/lib/spx/flags.ts`
4. `/docs/specs/SPX_COMMAND_CENTER_RUNBOOK_2026-02-20.md` (new)

Exit criteria:
1. Every closed trade has a complete journal artifact.
2. Post-trade analytics render without manual backfill steps.
3. Flag catalog includes owner, rollout, and removal condition for all active flags.

## 9. Quality Matrix

### 9.1 Unit tests
1. state machine transitions
2. command registry availability logic
3. contract selection mode and reversion logic
4. coach alert lifecycle behavior
5. spatial preset derivation and fallbacks

### 9.2 Integration tests
1. contract-select endpoint fallback/backoff
2. coach decision endpoint fallback/backoff
3. degraded data health messaging

### 9.3 E2E critical flows
1. scan -> evaluate -> in_trade -> exit -> post_trade -> scan
2. command palette enter/exit trade flow
3. coach now/history/actions flow
4. contract alternative -> revert AI flow
5. desktop classic/spatial mode switching
6. mobile smart stack flow

### 9.4 Performance checks
1. frame timing under spatial mode
2. overlay auto-throttle behavior
3. focused level churn telemetry
4. command latency and interaction responsiveness

### 9.5 Reliability and chaos checks
1. feed disconnect/reconnect while in `in_trade`
2. sequence-gap injection and fallback path correctness
3. stale/degraded badge and command gating consistency
4. last-known-good cache behavior when all live feeds fail

### 9.6 Decision and risk validation
1. multi-timeframe alignment reproducibility for frozen fixtures
2. risk-envelope reason-code coverage (`allow` and `block` paths)
3. scenario lane generation sanity bounds and direction correctness
4. replay determinism checksum from identical event journals

### 9.7 UX interaction validation
1. crosshair and OHLC tooltip behavior (desktop + mobile hold)
2. focus mode persistence and keyboard parity
3. one-primary-action visibility in every state/mode combination

## 10. Acceptance Criteria (Production Ready)
1. No P0/P1 known defects open in SPX command center scope.
2. Critical SPX E2E suite green in CI and local release environment.
3. Deterministic one-primary-action behavior per state verified.
4. Coach + contract + setup panels show consistent active trade values.
5. Spatial functionality is optional and does not degrade default production flow.
6. Repository is clean, documented, and release-tag ready.
7. Feed trust and fallback transitions are deterministic and operator-visible.
8. Risk envelope blocks unsafe actions with explicit reason codes.
9. Chart presents realistic price/volume/indicator context with responsive interaction.
10. Replay + journal artifacts are generated for completed trade cycles.
11. Feature flags and runbooks are complete, current, and rollback-ready.

## 11. Rollback Strategy
1. Immediate rollback lever: disable beta flags (`spatialHudV1`, advanced coach extras).
2. Preserve stable command center path independent of spatial extras.
3. If coach v2 endpoint instability occurs, force fallback and keep execution-safe deterministic messaging.
4. Maintain release branch tag before Phase 4+ rollout.

## 12. Branch and Commit Strategy
1. Branch: `codex/spx-production-recovery`.
2. One phase per PR where practical.
3. Commit format:
- `fix(spx): restore coach alert lifecycle lane`
- `refactor(spx): consolidate command registry`
- `feat(spx): add overlay presets for production`
4. Every PR must include:
- scope
- risk
- tests run
- rollback plan

## 13. Execution Checklist
1. [x] Phase 0 complete
2. [x] Phase 1 complete
3. [x] Phase 2 complete
4. [x] Phase 3 complete
5. [x] Phase 4 complete
6. [x] Phase 5 complete
7. [x] Phase 6 complete
8. [x] Phase 7 complete
9. [x] Phase 8 complete
10. [x] Phase 9 complete
11. [x] Phase 10 complete
12. [x] Release gates all green
13. [x] Production deploy approved

## 14. Appendix: Canonical SPX Files for Recovery
1. `/app/members/spx-command-center/page.tsx`
2. `/contexts/SPXCommandCenterContext.tsx`
3. `/components/spx-command-center/ai-coach-feed.tsx`
4. `/components/spx-command-center/setup-feed.tsx`
5. `/components/spx-command-center/contract-selector.tsx`
6. `/components/spx-command-center/contract-card.tsx`
7. `/components/spx-command-center/spx-header.tsx`
8. `/components/spx-command-center/action-strip.tsx`
9. `/components/spx-command-center/command-palette.tsx`
10. `/components/spx-command-center/spx-chart.tsx`
11. `/lib/spx/flags.ts`
12. `/lib/spx/layout-mode.ts`
13. `/lib/spx/spatial-hud.ts`
14. `/e2e/spx-*.spec.ts`
15. `/lib/spx/market-data-orchestrator.ts`
16. `/lib/spx/feed-health.ts`
17. `/lib/spx/event-schema.ts`
18. `/lib/spx/decision-engine.ts`
19. `/lib/spx/risk-envelope.ts`
20. `/lib/spx/replay-engine.ts`
21. `/lib/spx/trade-journal-capture.ts`
22. `/components/spx-command-center/post-trade-panel.tsx`
23. `/docs/spx-command-center-production-recovery-mockup.html`
24. `/docs/spx-command-center-production-recovery-mockup.png`

## 15. Full Scope Capability Matrix (Review Sheet)

### 15.1 Reliability + data trust
1. Canonical market data orchestrator.
2. Heartbeat/staleness/sequence-gap detection.
3. Deterministic fallback chain with visible status.
4. Telemetry for every feed state transition.

### 15.2 Decision intelligence
1. Multi-timeframe alignment scoring.
2. Dynamic setup confidence model.
3. Explainable coach payload (`drivers`, `risks`, `freshness`).
4. Scenario engine for base/adverse/acceleration paths.

### 15.3 Execution safety
1. Strict state machine transition guards.
2. Risk-envelope reason-code gating.
3. Unified command registry with shared availability predicates.
4. Command block telemetry and audit trail.

### 15.4 Chart + interaction richness
1. Realistic candle/volume/indicator chart foundation.
2. Crosshair, OHLC tooltip, and level pinning.
3. Focus modes (`Decision`, `Execution`, `Risk-only`).
4. Replay and chart-linked debrief support.

### 15.5 Learning loop + governance
1. Automated journal capture for each trade cycle.
2. Post-trade analytics and adherence scoring.
3. Smart alert severity + suppression policy.
4. Feature-flag lifecycle ownership and retirement discipline.

## 16. Autonomous Documentation Packet
Execution must follow the autonomous packet in this order:
1. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/README.md`
2. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/01_AUTONOMOUS_EXECUTION_CHARTER.md`
3. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/02_PHASE_BACKLOG_AND_WORKPLAN.md`
4. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/03_QUALITY_PROTOCOL_AND_TEST_GATES.md`
5. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/04_RELEASE_RUNBOOK_SPX_RECOVERY.md`
6. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/05_ROLLBACK_AND_INCIDENT_RUNBOOK.md`
7. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
8. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
9. `/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
