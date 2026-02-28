# SPX Command Center Expert Execution Spec
Date: 2026-02-28
Owner: Product + Engineering
Primary Route: `/members/spx-command-center`
Execution Mode: Expert-first simplification with fact density and progressive disclosure

## 1. Objective
Ship an expert-grade SPX Command Center that removes decision friction and surfaces only what matters now, while preserving the existing backend signal stack.

This workstream must:
1. Replace the current mixed panels with a deterministic `Trade Stream` (forming, triggered, past) in ascending lifecycle order.
2. Prioritize relevance in-the-moment with a pinned `Now Focus` item.
3. Convert coach from visual-heavy narrative UI to concise factual guidance with expandable details.
4. Reduce visible controls and eliminate action duplication.
5. Preserve and expose data trust (freshness, source, fallback age) at the point of decision.
6. Execute through `CLAUDE.md` spec-first slice cadence with full documentation packet and release gates.

## 2. Corpus Review and Historical Synthesis

### 2.1 Review Method
1. Indexed all SPX Command Center docs into `tmp/spx-doc-inventory.tsv` (`129` lines including header).
2. Indexed phase/slice docs into `tmp/spx-phase-summary.tsv` (`105` lines including header).
3. Deep-reviewed foundational and latest-state docs:
- `docs/specs/SPX_COMMAND_CENTER_DEV_SPEC.md`
- `docs/specs/SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md`
- `docs/specs/SPX_COMMAND_CENTER_PHASE18_EXECUTION_SPEC_2026-02-23.md`
- `docs/specs/SPX_COMMAND_CENTER_PHASE18_RUNBOOK_2026-02-23.md`
- `docs/specs/SPX_COMMAND_CENTER_PHASE18_RELEASE_NOTES_2026-02-23.md`
- `docs/specs/SPX_COMMAND_CENTER_PHASE18_CLOSEOUT_AUDIT_2026-02-24.md`
- `docs/specs/SPX_COMMAND_CENTER_MASTER_AUDIT_2026-02-26.md`
- `docs/specs/SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md`
- `docs/specs/SPX_CALIBRATION_BASELINE_2026-02-24.md`
- `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`
4. Verified current implementation surfaces in frontend/backend source for setup feed, coach feed, action strip, shell orchestration, and snapshot pipeline.

### 2.2 History Timeline (Condensed)
1. 2026-02-14: v1 full spec established broad capability scope.
2. 2026-02-20: production recovery spec shifted to stability, command parity, and deterministic state machine.
3. 2026-02-20 to 2026-02-23: multi-phase hardening delivered environment gates, weighted confluence, adaptive EV, and flow windows.
4. 2026-02-24: Phase 18 closeout marked partial completion with open quality/perf targets.
5. 2026-02-26: master audit reported 55+ findings across lifecycle, cache, chart completeness, replay fidelity, optimizer credibility, and RLS.

### 2.3 Current-State Truth
1. Core backend signal capability is materially stronger than early phases (environment gate, flow aggregation, weighted confluence, adaptive EV, fallback age cap, tick-health gating).
2. Frontend still presents too many simultaneous decisions in one surface (`SetupFeed`, `AICoachFeed`, dense `ActionStrip`, advanced HUD toggles), increasing cognitive load for expert use.
3. Triggered history is currently local-state centric in setup feed and not yet elevated into a canonical trade lifecycle stream.
4. Coach remains interaction-heavy and visually dominant relative to execution-critical facts.
5. Documentation drift exists (including mislabeled non-SPX slice docs), requiring stricter governance in this workstream.

## 3. Current Gap Inventory (Usability, Layout, UX, Usefulness)

### 3.1 Information Architecture and Layout Gaps
1. No single canonical list for lifecycle progression; setup feed splits data across actionable cards, watchlist, and triggered history.
2. Right rail mixes setup scan, contract selection, and coach with equal visual weight, obscuring decision priority.
3. Action strip contains too many controls in primary line, creating command ambiguity.
4. Advanced HUD and overlay controls are discoverable before core execution intent is resolved.
5. In-trade, scan, and standby content coexist in the same viewport without hard priority framing.

### 3.2 Workflow and Decision Flow Gaps
1. Expert cannot answer "What matters in the next 30-120 seconds?" from one compact surface.
2. Triggered vs forming vs past is not modeled as one timeline contract.
3. Past signals are represented as alert replay snippets, not a normalized outcome-aware lifecycle lane.
4. Stage-trade action appears in multiple places, increasing accidental command load.
5. Blocked execution reasons are present but fragmented across header/setup/action controls.

### 3.3 Coach and Communication Gaps
1. Coach surface has high visual and interaction density (pinned alerts, decision cards, quick prompts, full history, composer).
2. Facts and actions are intermixed with narrative content and icons, reducing scannability for experts.
3. Coach uses substantial vertical space even when user only needs concise execution facts.
4. Current default does not enforce "facts first, details on demand".

### 3.4 Data Relevance and Trust Gaps
1. Freshness exists in backend but is not consistently surfaced at row-level where actions are taken.
2. Setup cards are rich but not normalized for rapid compare across lifecycle states.
3. Relevance ranking is implicit and spread across policy/tier logic; user-facing sort contract is not explicit.
4. Triggered history persistence relies on local storage path, not backend-backed lifecycle record.
5. Data fallback/degraded state can still feel equivalent to live state in dense UI.

### 3.5 Mobile/Responsive and Density Gaps
1. Prior phases improved overflow, but high-density controls still require horizontal scanning.
2. Touch effort is still high when execution-critical controls are mixed with optional overlays.
3. Mobile expert workflow is not hard-gated to a minimal action path first.

### 3.6 Governance and QA Gaps
1. Doc drift between spec/audit and implementation is not automatically prevented.
2. Existing E2E coverage validates many contracts but not a unified lifecycle stream contract.
3. No dedicated KPI instrumentation for "time-to-first-confident-action" in SPX command center.

## 4. Target Experience Contract (Expert Mode)

### 4.1 Core Interaction Model
Replace the current setup-first + coach-heavy composition with a `Trade Stream` model:
1. `Now Focus` (single pinned card): highest-immediacy item across all lifecycle states.
2. `Trade Stream` (primary panel): lifecycle ascending order with deterministic sorting.
3. `Coach Facts` (secondary panel): concise text facts tied to selected stream item; details expandable.
4. `Execution Action` (single primary CTA rail): one primary action per state.

### 4.2 Lifecycle States (User-Facing)
1. `forming`: setup is building, not yet actionable.
2. `triggered`: entry condition active or recently triggered and still actionable.
3. `past`: invalidated, expired, target-resolved, or exited trade outcome.

### 4.3 Sorting Contract
Global stream order is lifecycle ascending:
1. `forming`
2. `triggered`
3. `past`

Within each lifecycle bucket:
1. Primary sort key: `momentPriority` (higher urgency first).
2. Secondary sort key:
- `forming`: nearest-to-trigger ETA ascending.
- `triggered`: time since trigger ascending.
- `past`: most recent resolution ascending by event timestamp.
3. Tertiary sort key: stable setup ID to guarantee deterministic rendering.

`Now Focus` ignores lifecycle order and always picks max urgency item.

### 4.4 Row Information Density (Facts First)
Every stream row must show, without expansion:
1. Setup type + direction.
2. Lifecycle state and age (`triggered 42s ago`, `forming ETA 3m`, `past 12m ago`).
3. Entry zone, stop, T1, T2.
4. Probability, confluence, EV.
5. Flow/regime alignment summary.
6. Freshness badge (`LIVE`, `STALE`, `FALLBACK`) with exact age seconds.
7. Single recommended action label (`WAIT`, `STAGE`, `MANAGE`, `REVIEW`).

Expanded details must include:
1. Trigger context.
2. Confluence breakdown.
3. Gate reasons and blockers.
4. Memory context and touch history.
5. Contract recommendation details (collapsed by default).
6. Outcome/replay metadata for past items.

### 4.5 Coach Facts Contract (No Visual Coach Chrome)
Coach becomes facts rail, not a visual conversation center:
1. Remove coach visual-heavy patterns (hero alert styling, icon-led prompt grids, large timeline focus by default).
2. Default output is concise facts block (max 5 lines):
- Verdict
- Confidence
- Invalidation
- Position/risk constraint
- Next review trigger
3. `Details` disclosure provides `Why`, `Counter-case`, `Risk checklist`, and `History`.
4. Quick actions are reduced to max 2 contextually valid actions.
5. Composer remains available only in details context.

### 4.6 Control Surface Contract
Primary visible controls on desktop must be capped to:
1. Timeframe
2. Levels toggle
3. Primary CTA
4. Why
5. State chip
6. View mode

All other controls move to `Advanced` drawer.

## 5. Technical Design and Data Contracts

### 5.1 New Canonical Read Model
Add `TradeStreamItem` and `TradeStreamSnapshot` contracts in backend and shared frontend types.

`TradeStreamItem` (minimum fields):
1. `id`, `stableIdHash`, `lifecycleState`, `status`, `direction`, `setupType`.
2. `entryZone`, `stop`, `target1`, `target2`.
3. `probability`, `confluenceScore`, `evR`, `alignmentScore`.
4. `momentPriority`, `recommendedAction`, `actionBlockedReason`.
5. `freshness`: `source`, `generatedAt`, `ageMs`, `degraded`.
6. `timing`: `createdAt`, `triggeredAt`, `resolvedAt`, `etaToTriggerMs`.
7. `reason`: `triggerContext`, `gateReasons`, `decisionDrivers`, `decisionRisks`.
8. `outcome` (past only): `result`, `rMultiple`, `resolvedBy`.

`TradeStreamSnapshot` (minimum fields):
1. `items`: `TradeStreamItem[]`.
2. `nowFocusItemId`.
3. `countsByLifecycle`.
4. `feedTrust`: unified trust block for render gating.
5. `generatedAt`.

### 5.2 Backend Endpoint
Add endpoint:
1. `GET /api/spx/trade-stream`

Behavior:
1. Composes active setups + environment state + execution/outcome context into lifecycle stream.
2. Merges triggered history and past outcomes from backend persistence (no local-only dependence).
3. Calculates deterministic `momentPriority` and returns pre-sorted payload + now focus.
4. Includes explicit freshness per item and snapshot-level fallback flags.

### 5.3 Frontend State Model
1. Add dedicated hook `useSPXTradeStream()`.
2. Stream becomes canonical source for setup panel rendering.
3. Existing setup selection and execution contexts consume stream IDs and status-safe actions.
4. Remove duplicated ranking logic from UI components where possible; ranking authoritative in backend, with frontend tie-break fallback.

### 5.4 Coach Refactor Surface
1. Introduce `CoachFactsRail` component.
2. Keep existing coach decision engine; transform payload into strict factual schema before render.
3. Defer full history/chat interaction behind details disclosure.
4. Remove mandatory visual alerts from default layout; keep critical alert text row only.

### 5.5 Feature Flags
Add scoped flags:
1. `SPX_EXPERT_TRADE_STREAM_ENABLED`
2. `SPX_COACH_FACTS_MODE_ENABLED`
3. `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`
4. `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`

Default rollout:
1. Backend sort + payload fields first.
2. Trade stream UI second.
3. Coach facts mode third.
4. Simplified action strip fourth.

## 6. Phase and Slice Execution Plan

## Phase 0: Baseline Lock and Contract Definition
Goal: lock current behavior and establish immutable contracts for migration.

Slices:
1. P0-S1: Generate selector and API contract baseline for current SPX route.
2. P0-S2: Add explicit trade stream contract docs and mock payload fixtures.

Target files:
1. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S1_2026-02-28.md`
2. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S2_2026-02-28.md`
3. `e2e/fixtures/spx-trade-stream/*.json`

Exit criteria:
1. API schema baseline committed.
2. Selector contract for new panel agreed.

## Phase 1: Backend Trade Stream Read Model
Goal: expose canonical lifecycle stream.

Slices:
1. P1-S1: Define `TradeStreamItem`/`TradeStreamSnapshot` types.
2. P1-S2: Implement lifecycle assembly service from setups + outcomes.
3. P1-S3: Add `/api/spx/trade-stream` route + trust/freshness fields.
4. P1-S4: Unit tests for lifecycle mapping, sorting, and freshness labeling.

Primary files:
1. `backend/src/services/spx/types.ts`
2. `backend/src/services/spx/tradeStream.ts` (new)
3. `backend/src/routes/spx.ts`
4. `backend/src/services/spx/__tests__/tradeStream*.test.ts`

Exit criteria:
1. Deterministic sort contract proven in tests.
2. Past lifecycle no longer local-storage-only.

## Phase 2: Trade Stream UI Conversion
Goal: make stream the primary decision surface.

Slices:
1. P2-S1: Build `TradeStreamPanel` with now focus + lifecycle groups.
2. P2-S2: Replace `SetupFeed` primary list with stream rows.
3. P2-S3: Add expandable detail panes and row-level action semantics.
4. P2-S4: Wire selection/stage-trade paths to stream IDs.

Primary files:
1. `components/spx-command-center/trade-stream-panel.tsx` (new)
2. `components/spx-command-center/setup-feed.tsx`
3. `contexts/spx/SPXSetupContext.tsx`
4. `hooks/use-spx-api.ts` or dedicated `hooks/use-spx-trade-stream.ts` (new)
5. `lib/types/spx-command-center.ts`

Exit criteria:
1. Expert can evaluate forming/triggered/past from one panel without opening coach.
2. Now focus always visible when stream has data.

## Phase 3: Coach Facts Mode
Goal: enforce facts-first coaching and remove visual bloat from default.

Slices:
1. P3-S1: Build `CoachFactsRail` presentation layer.
2. P3-S2: Collapse quick prompts/actions to max 2 context-valid actions.
3. P3-S3: Move timeline/chat into details disclosure.
4. P3-S4: Remove visual-heavy default coach elements from shell.

Primary files:
1. `components/spx-command-center/ai-coach-feed.tsx`
2. `components/spx-command-center/coach-facts-rail.tsx` (new)
3. `components/spx-command-center/spx-command-center-shell-sections.tsx`

Exit criteria:
1. Default coach footprint reduced by at least 40% vertical space.
2. Factual summary available in <= 5 lines above fold.

## Phase 4: Action Strip and Layout Simplification
Goal: reduce option overload and enforce primary-action clarity.

Slices:
1. P4-S1: Reduce default visible controls to core six.
2. P4-S2: Move non-core controls to advanced drawer.
3. P4-S3: Remove duplicated stage-trade pathways.
4. P4-S4: Responsive verification for 375px and 1280px layouts.

Primary files:
1. `components/spx-command-center/action-strip.tsx`
2. `components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
3. `components/spx-command-center/spx-mobile-surface.tsx`

Exit criteria:
1. No primary action duplication in same state.
2. No horizontal overflow in action strip at required breakpoints.

## Phase 5: Telemetry, QA, and Governance Closure
Goal: enforce correctness, trust metrics, and process compliance.

Slices:
1. P5-S1: Add stream usage telemetry and decision-latency metrics.
2. P5-S2: Add E2E contracts for stream order, now focus, and coach facts mode.
3. P5-S3: Complete release docs packet and sign-off artifacts.

Primary files:
1. `lib/spx/telemetry.ts`
2. `e2e/spx-trade-stream.spec.ts` (new)
3. `docs/specs/SPX_COMMAND_CENTER_EXPERT_RELEASE_NOTES_2026-02-28.md` (new)
4. `docs/specs/SPX_COMMAND_CENTER_EXPERT_RUNBOOK_2026-02-28.md` (new)

Exit criteria:
1. Release gates green under Node >= 22.
2. All required docs synchronized.

## 7. Acceptance Criteria

### 7.1 Expert Workflow Criteria
1. User can identify top actionable trade context in <= 8 seconds from page load.
2. Forming, triggered, and past trades are visible in one stream with ascending lifecycle order.
3. Each row shows actionable facts without expansion.
4. Details are available on demand without navigating away.
5. Coach default view is factual summary, not full visual timeline.

### 7.2 Data Trust Criteria
1. 100% of stream rows include freshness age and source.
2. Fallback/degraded state is visually distinct and includes reason.
3. Triggered and past entries persist through reload and session changes via backend data.

### 7.3 Command Clarity Criteria
1. Exactly one primary CTA per state (`scan`, `evaluate`, `in_trade`, `post_trade`).
2. Default visible controls <= 6 on desktop action strip.
3. No duplicate stage-trade CTA in same viewport state.

### 7.4 Performance and Stability Criteria
1. Stream render update under 120ms for payloads up to 40 rows.
2. No dropped-frame animation requirements for core list operations.
3. Existing snapshot endpoint and stream endpoint coexist without regression.

## 8. Validation Gates (CLAUDE.md Aligned)

### 8.1 Slice-Level Gates
```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

### 8.2 Release-Level Gates
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run lib/spx/__tests__
pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1
```

### 8.3 Additional SPX-Specific Gates for This Workstream
1. `pnpm --dir backend exec tsc --noEmit --strict`
2. `pnpm --dir backend test -- src/services/spx/__tests__/tradeStream*.test.ts`
3. `pnpm exec playwright test e2e/spx-trade-stream.spec.ts --project=chromium --workers=1`
4. Verify Node runtime is `>=22` for final gate evidence.

## 9. Risk Register and Rollback

### 9.1 Key Risks
1. Sorting contract mismatch between backend and frontend causes row jitter.
2. Past-lifecycle persistence query may add latency under load.
3. Coach simplification may regress existing coach-interaction tests.
4. Stream conversion may unintentionally bypass existing execution safety gates.

### 9.2 Mitigations
1. Backend sort authoritative + deterministic tie-break tests.
2. Add response budget guard and fallback pagination for past items.
3. Keep compatibility mode flag for legacy coach feed.
4. Reuse `resolveExecutionEntryGate` as single source of execution block truth.

### 9.3 Rollback Plan
1. Disable `SPX_EXPERT_TRADE_STREAM_ENABLED` to revert to legacy setup feed.
2. Disable `SPX_COACH_FACTS_MODE_ENABLED` to restore current coach panel.
3. Disable `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED` for previous control surface.
4. If needed, route-level rollback by pinning frontend to previous SPX release tag.

## 10. Required Autonomous Documentation Packet
This spec must be accompanied by:
1. Phase slice reports:
- `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE*_SLICE_*.md`
2. Release notes:
- `docs/specs/SPX_COMMAND_CENTER_EXPERT_RELEASE_NOTES_2026-02-28.md`
3. Runbook:
- `docs/specs/SPX_COMMAND_CENTER_EXPERT_RUNBOOK_2026-02-28.md`
4. Autonomous control packet:
- `docs/specs/spx-command-center-expert-autonomous-2026-02-28/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
- `docs/specs/spx-command-center-expert-autonomous-2026-02-28/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
- `docs/specs/spx-command-center-expert-autonomous-2026-02-28/08_AUTONOMOUS_EXECUTION_TRACKER.md`

## 11. Open Decisions to Resolve Before Phase 1
1. Should `past` include only same-session events by default, with multi-session expansion toggle?
2. Should lifecycle ascending order be strict, or should user have a `Now-first` sort toggle in expert settings?
3. Should coach composer be disabled entirely by default in expert mode, or only collapsed behind details?

## 12. Execution Checklist
- [x] Historical corpus reviewed and synthesized.
- [x] Current-state gaps documented with UX and data-trust focus.
- [x] Target experience contract defined.
- [x] Concrete phase/slice plan defined with file boundaries.
- [x] Validation and release gates aligned to `CLAUDE.md`.
- [x] Risk and rollback paths documented.
- [ ] Product owner sign-off.
- [ ] Begin Phase 0 implementation slices.
