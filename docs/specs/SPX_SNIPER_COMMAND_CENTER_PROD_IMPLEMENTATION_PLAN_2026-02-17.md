# SPX Sniper Command Center: Production Implementation Plan

**Date:** February 17, 2026  
**Route:** `/members/spx-command-center`  
**Goal:** Convert the current SPX dashboard into an action-first sniper cockpit without destabilizing the snapshot and websocket foundation.

## 1. Inputs Reviewed
- `claude.md`
- `SPX_COMMAND_CENTER_AUDIT.md`
- `docs/specs/SPX_COMMAND_CENTER_DEV_SPEC.md`
- `docs/ai-coach/SPX_COMMAND_CENTER_ROLLBACK_REBUILD_2026-02-15.md`
- `docs/ai-coach/SPX_COMMAND_CENTER_DETERMINISTIC_STABILIZATION_2026-02-16.md`
- `docs/ai-coach/SPX_COMMAND_CENTER_WEBSOCKET_AUDIT_2026-02-16.md`
- Current implementation in:
  - `app/members/spx-command-center/page.tsx`
  - `contexts/SPXCommandCenterContext.tsx`
  - `components/spx-command-center/*`
  - `app/api/spx/[...path]/route.ts`

## 2. Current State vs Audit Requirements

### 2.1 Completed or mostly completed
- Header has hero SPX price, posture cluster, direction pills, and actionable summary.
- Action Strip exists with top alert and compact posture/flow pills.
- Layout is already Tier-1 + 60/40 Tier-2 (chart left, action stack right).
- Setup card includes entry thermometer, confluence pills, and action-oriented headline.
- Flow ticker includes alignment scoring against selected setup.
- Contract card already has a visual risk/reward bar and spread health signal.
- Data health/resilience baseline exists (snapshot health states, stale/degraded handling, websocket status badges).

### 2.2 Partial gaps
- Header still carries several secondary metrics at similar visual weight (Basis/GEX blocks still dense).
- Action Strip lacks dismiss/ack persistence and click analytics.
- Setup cards still show mixed secondary metrics (Dist/Risk) instead of strict go/no-go focus.
- Flow ticker lacks explicit compact/expanded modes with "single top event by default" behavior.
- AI Coach has quick prompts and setup filtering, but no pinned unread alert lifecycle.
- Contract selector is still informational for sizing; no risk-based quantity input.
- Probability cone markers are implemented in `decision-context.tsx` but not in `probability-cone.tsx` or chart-level visual markers.

### 2.3 Not implemented
- Level Matrix is still table-first, not proximity-ladder map.
- Chart <-> level hover/link interactions for proximity map do not exist.
- Mobile "Brief" tab does not exist.
- Triggered setup sound/browser notification flow not implemented.
- Session P&L tracker widget not implemented.
- GEX landscape still undersized (expanded chart is `h-20`) and lacks explicit current-price marker.

## 3. Production Constraints and Guardrails
- Preserve snapshot-first state contract in `SPXCommandCenterContext`.
- Preserve websocket churn protections from Feb 16 stabilization.
- Keep proxy fallback behavior in `app/api/spx/[...path]/route.ts` intact while shipping UX refactors.
- No runtime feature flags assumed; rollout is commit and branch gated.
- Maintain Emerald Standard from `claude.md` and mobile read-only behavior unless explicitly changed.

## 4. Delivery Plan (Phased, Dependency-Safe)

**Execution Status (as of February 17, 2026):**
- Phase 0 started: telemetry module and first-pass instrumentation are in progress in the SPX context/UI.
- Remaining phases are pending implementation.

## Phase 0: Baseline and Instrumentation (1 day)
**Objective:** Create measurement and safety baseline before visual changes.

**Implementation**
- Add analytics event taxonomy and logger wrappers:
  - `spx_header_action_click`
  - `spx_setup_selected`
  - `spx_contract_requested`
  - `spx_coach_alert_ack`
  - `spx_flow_mode_toggled`
  - `spx_level_map_interaction`
- Add perf markers for:
  - Time to first actionable setup render
  - Time to first setup select
  - Contract recommendation latency
- Add Sentry breadcrumbs in key interactions (setup select, contract request, coach send).

**Files**
- `lib/analytics/*` (or existing tracking utility)
- `contexts/SPXCommandCenterContext.tsx`
- `components/spx-command-center/*.tsx` (event call sites)

**Exit criteria**
- Metrics visible in logs/Sentry for one full trading session replay.
- No regression in current E2E suite.

## Phase 1: Mission Briefing Hardening (1 day)
**Objective:** Finish header/action-strip hierarchy and reduce cognitive load.

**Implementation**
- Header:
  - Remove secondary "equal weight" feel by demoting non-primary metric blocks.
  - Add tick flash animation on price change (up/down pulse with reduced-motion fallback).
  - Keep action tagline formula: actionable count + regime + flow bias.
- Action Strip:
  - Add top-alert dismiss/ack control.
  - Persist dismiss state in `sessionStorage` by message id.
  - Add one-click "expand full coach panel" action.

**Files**
- `components/spx-command-center/spx-header.tsx`
- `components/spx-command-center/action-strip.tsx`
- `components/spx-command-center/ai-coach-feed.tsx`

**Exit criteria**
- Pinned alert is dismissible and remains dismissed during session.
- Header communicates one primary value (SPX) and one action sentence at glance.

## Phase 2: Battlefield IA Finalization (1-2 days)
**Objective:** Lock final information architecture for desktop and mobile.

**Implementation**
- Desktop:
  - Keep 60/40 split but enforce right column order: Setup Feed -> Contract Selector -> AI Coach.
  - Move Level Matrix access to explicit chart-level drawer trigger.
  - Keep Advanced section collapsed by default with Basis + GEX.
- Mobile:
  - Add fifth tab `brief` with summary stack:
    - top actionable setup
    - flow conviction badge
    - prediction direction pills
    - latest coach alert

**Files**
- `app/members/spx-command-center/page.tsx`
- `components/spx-command-center/mobile-panel-tabs.tsx`
- `components/spx-command-center/action-strip.tsx`
- `components/spx-command-center/spx-chart.tsx`

**Exit criteria**
- Contract panel visible above fold at 1366x768.
- Mobile tab count = 5 with no horizontal overflow.

## Phase 3: Setup + Contract Execution UX (2 days)
**Objective:** Make each setup card immediately actionable with execution preview.

**Implementation**
- Setup card:
  - Promote "Why Now" pills above secondary metrics.
  - Replace Dist/Risk tiles with Probability + contract-derived R:R (when available).
  - Add compact one-tap contract preview block on selected setup.
- Contract card / selector:
  - Add risk-based sizing input (`maxRiskDollars`) and computed contract count.
  - Show expected P&L for T1/T2 next to size recommendation.
  - Keep Greek details visible in compact 4-metric row; leave deep detail expandable.

**Files**
- `components/spx-command-center/setup-card.tsx`
- `components/spx-command-center/setup-feed.tsx`
- `components/spx-command-center/contract-selector.tsx`
- `components/spx-command-center/contract-card.tsx`

**Exit criteria**
- Trader can select setup and see size recommendation in one panel without scrolling.
- No recommendation API calls for non-ready/non-triggered setups.

## Phase 4: Tactical Flow + Coach Advisor (2 days)
**Objective:** Convert feed-like widgets to tactical decision helpers.

**Implementation**
- Flow ticker:
  - Add explicit compact mode default (bar + conviction + top event).
  - Add expand/collapse to view full ranked event list.
  - Standardize near-entry tag threshold (exactly +/-20 points).
- Coach:
  - Pinned unread alert region with acknowledge action.
  - Group messages by `setupId`, default to selected setup, "All messages" toggle.
  - Parse actionable phrases from `structuredData` and render chips.

**Files**
- `components/spx-command-center/flow-ticker.tsx`
- `components/spx-command-center/ai-coach-feed.tsx`
- `components/spx-command-center/coach-message.tsx`

**Exit criteria**
- First coach action is always visible without scrolling.
- Flow widget answers "confirms or diverges" in one line.

## Phase 5: Level Proximity Map (3 days)
**Objective:** Replace table model with spatial decision map.

**Implementation**
- Build `LevelProximityMap` component (SVG preferred for accessibility and hit-testing).
- Render:
  - vertical price ladder
  - current price line
  - support/resistance tinted bars
  - strength-encoded bar widths
  - cluster-zone shaded bands
  - selected setup markers (entry zone, stop, targets)
- Interaction:
  - hover ladder level -> highlight corresponding chart annotation
  - chart level click -> focus ladder row
- Keep legacy table behind internal fallback toggle for one release candidate.

**Files**
- `components/spx-command-center/level-matrix.tsx` (replace implementation)
- `components/spx-command-center/cluster-zone-bar.tsx` (merge/deprecate)
- `components/spx-command-center/spx-chart.tsx`
- `contexts/SPXCommandCenterContext.tsx` (shared hovered-level state)

**Exit criteria**
- Ladder and chart cross-highlighting works both directions.
- No frame drops below 30fps during active price updates.

## Phase 6: Quick Wins Bundle (2 days)
**Objective:** Finish high-value polish with low architectural risk.

**Implementation**
- Probability cone:
  - Add setup entry/target markers in `probability-cone.tsx`.
- GEX landscape:
  - Increase expanded height to at least `h-44`.
  - Add current price marker and dynamic bar count.
- Alerts:
  - Add opt-in sound + browser notification for setup transition `ready -> triggered`.
  - Add preferences store (`localStorage`) and permission handling.
- Session P&L widget:
  - Add compact widget in header/action strip area.
  - If no executed-trade source exists, start with manual session tracking and mark as beta.

**Files**
- `components/spx-command-center/probability-cone.tsx`
- `components/spx-command-center/gex-landscape.tsx`
- `components/spx-command-center/spx-header.tsx` or `action-strip.tsx`
- `contexts/SPXCommandCenterContext.tsx`

**Exit criteria**
- Notifications fire once per unique setup transition.
- GEX view readable on 1366x768 without zooming.

## Phase 7: Hardening, QA, and Launch (1-2 days)
**Objective:** Ensure stable production rollout.

**Implementation**
- Add/extend tests:
  - Unit: flow alignment, sizing calculator, coach grouping, proximity map scaling.
  - E2E: brief tab behavior, pinned alert ack persistence, map-chart interaction.
- Accessibility checks:
  - keyboard navigation for map and alert controls
  - 44px touch targets on mobile
  - reduced-motion compliance for pulses
- Performance checks against spec targets:
  - mobile LCP < 3s
  - route bundle < 250KB gzipped
  - chart fps >= 30fps
- Run degraded-mode drills:
  - snapshot timeout
  - websocket disconnect
  - contract-select failure

**Exit criteria**
- All SPX unit/integration/E2E suites pass.
- No new console error bursts under degraded upstream simulation.
- KPI deltas are non-negative for actionable engagement metrics.

## 5. KPI and Telemetry Contract
Track before and after each phase:
- `ttfa_seconds`
- `actionable_select_rate`
- `setup_to_contract_view_rate`
- `coach_alert_ack_latency_ms`
- `flow_expand_rate`
- `snapshot_degraded_rate`
- `ui_error_log_rate`

Target outcomes:
- 20%+ improvement in `ttfa_seconds`
- 15%+ improvement in `actionable_select_rate`
- No increase in `snapshot_degraded_rate` and `ui_error_log_rate`

## 6. Test Plan

### 6.1 Automated
- Extend existing SPX tests:
  - `e2e/spx-command-center.spec.ts`
  - `e2e/spx-setup-interaction.spec.ts`
  - `e2e/spx-responsive.spec.ts`
  - `e2e/spx-coach-messages.spec.ts`
- Add unit tests for:
  - proximity map coordinate mapping
  - risk-based sizing
  - coach alert pinning + ack persistence
  - flow compact/expanded rendering rules

### 6.2 Manual QA matrix
- Desktop: 1366x768, 1440x900, 1920x1080
- Mobile: iOS Safari and Android Chrome
- Failure drills:
  - upstream 502
  - timeout
  - ws disconnect
  - stale snapshot mode

## 7. Rollout and Rollback

### Rollout
1. Ship by phase in SPX-scoped commits.
2. Validate KPI and error gates after each phase.
3. Promote only when gates pass for one live trading session window.

### Rollback
- Revert latest SPX UX commit first.
- Preserve proxy and snapshot hardening unless root-cause requires backend rollback.
- If Level Proximity Map causes instability, restore table fallback in `level-matrix.tsx` immediately.

## 8. Risks and Mitigations
- **Risk:** Proximity map interaction complexity introduces chart regressions.
  - **Mitigation:** Ship map with legacy fallback path for one candidate build.
- **Risk:** Notification spam on noisy setup transitions.
  - **Mitigation:** de-duplicate by setup id + status transition signature and cooldown.
- **Risk:** Added UI logic increases re-render pressure.
  - **Mitigation:** memoize derived calculations and use selector-level memoization in context.
- **Risk:** Session P&L lacks a canonical trade execution source.
  - **Mitigation:** phase as beta with explicit source label and follow-up backend integration.

## 9. Definition of Done
The Sniper Command Center release is done when:
- All 7 priority audit items are implemented or explicitly deferred with owner and date.
- Quick wins A-D are complete; E is complete or shipped as beta with known limits.
- Existing resilience guarantees (snapshot + websocket + proxy) are preserved.
- E2E, integration, and manual QA gates pass with no Sev-1 or Sev-2 defects.
- KPI gates show improved action clarity without reliability regressions.
