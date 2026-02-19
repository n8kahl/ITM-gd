# SPX AI Coach UX Modernization Production Spec

**Date:** February 19, 2026  
**Branch:** `codex/spx-ai-coach-ux-modernization-spec`  
**Route:** `/members/spx-command-center`  
**Scope:** AI Coach interaction model, alert lifecycle, placement, motion, and mobile/desktop usability.

## 1. Executive Decisions

1. Remove mandatory ack as the default coach alert interaction.
2. Promote coach visibility and access in all states, with a sticky compact coach surface.
3. Replace static alert + message rendering with fluid transitions and timeline behaviors.
4. Convert passive chips into actionable one-click coach actions.
5. Add explicit severity-based alert handling: passive, warning, critical.
6. Gate rollout with flags and keep immediate rollback paths.

## 2. Problem Statement

Current coach behavior has three high-friction issues:

- Alert interaction is manual and interruptive (`Acknowledge` as primary action).
- Coach placement is too low in layout hierarchy (especially scan/evaluate).
- Message list interactions are static (no meaningful transitions, no timeline affordances, no modern feed behavior).

Code-level drivers:

- Pinned alert with ack-first interaction in `components/spx-command-center/ai-coach-feed.tsx`.
- Dismiss persistence stored as session-only IDs in `lib/spx/coach-alert-state.ts`.
- Coach panel appears below setup/contract on desktop in `app/members/spx-command-center/page.tsx`.
- Message cards are static and binary expand/collapse in `components/spx-command-center/coach-message.tsx`.

## 3. Goals

### 3.1 Product goals

- Make coach feel like a live copilot, not a static message pane.
- Reduce interaction cost for alert handling.
- Keep coach visible during high-urgency moments without obscuring execution flow.
- Improve mobile usability without regressing desktop power-user speed.

### 3.2 UX goals

- Zero required clicks to clear routine alerts.
- Alert state changes are visible and understandable (seen, snoozed, muted).
- Message timeline feels alive (entry transitions, auto-follow when appropriate).
- Coach actions are one tap and context-aware.

### 3.3 Technical goals

- Maintain render performance on frequent message and stream updates.
- Preserve accessibility and reduced-motion support.
- Keep rollout fully feature-flagged and measurable.

## 4. Non-goals

- No broker order execution integration in this scope.
- No backend model retraining work in this scope.
- No full visual redesign of all SPX panels outside coach-related surfaces.

## 5. Current State Findings

### 5.1 Alert lifecycle

- Pinned alert is selected by priority and shown until manually acknowledged.
- Dismissed IDs are persisted in session storage only.
- No concept of alert seen time, snooze duration, mute rules, or critical-only blocking.

### 5.2 Layout placement

- Desktop right rail order is Setup -> Contract -> Coach (coach often below fold).
- Mobile smart stack places coach after chart/flow.

### 5.3 Message timeline

- Fixed-height message list with basic overflow scrolling.
- No auto-follow logic, unread indicator, or timeline jump control.
- No animated insertion/removal and no streaming reveal treatment.

### 5.4 Interaction quality

- Action chips are informational only.
- Control sizing and spacing are tight for touch.
- Expand/collapse interactions are abrupt.

## 6. Target UX Model

### 6.1 Coach shell model

Introduce three coach surfaces:

1. **Coach Dock (persistent compact):**
   - Always visible in desktop right rail and mobile bottom area.
   - Shows latest high-priority guidance, unread count, and quick open.
2. **Coach Panel (expanded):**
   - Full timeline + quick actions + composer.
3. **Critical Alert Banner (conditional):**
   - Only for critical alerts (risk breach class), not for routine setup guidance.

### 6.2 Alert lifecycle model

New alert states:

- `new`
- `seen`
- `snoozed`
- `muted`
- `expired`

Rules:

- Routine alerts auto-mark `seen` after 2s in viewport.
- Default actions: `Snooze 5m`, `Mute Setup`, `View Context`.
- `Acknowledge` remains only for `critical` alerts.
- Seen alerts collapse into timeline automatically.

### 6.3 Message timeline model

- Animate new messages into timeline.
- Auto-follow only when user is at bottom.
- If user is scrolled up, show `New messages` pill with jump-to-latest.
- Keep composer sticky at bottom of panel.
- Preserve keyboard submission and quick actions.

### 6.4 Quick action model

- Message chips become clickable actions (send scoped prompt).
- Dynamic quick action row remains but uses larger touch targets.
- In-trade quick actions pin to top of coach panel while in trade mode.

### 6.5 Placement model by state

Desktop:

- `scan`: Coach Dock visible above contract preview; full panel collapsed.
- `evaluate`: Coach panel moves above contract selector.
- `in_trade`: Coach panel pinned directly under in-trade summary; critical alert strip near header if present.

Mobile smart stack:

- Add sticky bottom coach dock.
- Coach panel opens as bottom sheet (not full page jump), preserving chart/setup context.

## 7. Technical Design

### 7.1 New feature flags

Add to `lib/spx/flags.ts`:

- `coachDockV1`
- `coachAlertLifecycleV2`
- `coachTimelineV2`
- `coachMotionV1`

Defaults:

- `false` initially in production.
- Enabled in internal/dev and staged rollout environments.

### 7.2 Alert state contract

Create `lib/spx/coach-alert-state-v2.ts` with typed lifecycle record:

```ts
interface CoachAlertLifecycleRecord {
  id: string
  setupId: string | null
  severity: 'routine' | 'warning' | 'critical'
  status: 'new' | 'seen' | 'snoozed' | 'muted' | 'expired'
  seenAt?: string
  snoozedUntil?: string
  mutedUntil?: string
}
```

Storage:

- Use local storage key `spx.coach.alert.lifecycle.v2`.
- Maintain 72h TTL cleanup.
- Keep compatibility read path for `spx.coach.dismissed_alert_ids.v1` during migration.

### 7.3 Message interaction contract

Extend structured data usage in `CoachMessage` handling:

- Optional fields consumed by UI:
  - `severity`
  - `dedupeKey`
  - `recommendedActions`
  - `expiresAt`

No backend schema break required because `structuredData` is already untyped map.

### 7.4 Component changes

#### `components/spx-command-center/ai-coach-feed.tsx`

- Replace pinned-alert ack pattern with lifecycle-aware banner component.
- Add auto-seen observer for top alert and timeline cards.
- Add `New messages` pill and auto-follow behavior.
- Add sticky composer and larger action controls.
- Add motion wrappers for alert and message list items.

#### `components/spx-command-center/coach-message.tsx`

- Convert chips into actionable buttons.
- Add compact/expanded variant support.
- Add soft expand transition instead of abrupt text swap.

#### `components/spx-command-center/coach-dock.tsx` (new)

- Compact dock surface for latest actionable coach item.
- Controls: open panel, snooze routine alert, unread badge.

#### `components/spx-command-center/coach-bottom-sheet.tsx` (new)

- Mobile-only expandable sheet driven by dock interaction.
- Contains `AICoachFeed` in panel mode.

#### `app/members/spx-command-center/page.tsx`

- Reorder right-rail placement by layout mode.
- Add coach dock mount points (desktop/mobile).
- Keep command palette + shortcut behavior unchanged.

### 7.5 Context integration

#### `contexts/SPXCommandCenterContext.tsx`

- Keep proactive message emission as-is for now.
- Add optional severity mapping helper for proactive reasons:
  - `status_triggered` -> `routine`
  - `flow_divergence` -> `warning`
  - `stop_proximity` -> `critical` when stop distance < configured threshold

### 7.6 Accessibility requirements

- Minimum 44x44 interactive touch targets for alert and quick-action controls.
- Clear focus-visible styles for chips/buttons.
- Reduced-motion fallback: no spring/slide, simple fade only.
- Preserve semantic roles and aria-labels for alert controls.

### 7.7 Performance requirements

- No frame drops above 16ms budget during burst message insertion (10 messages / 2s).
- Timeline operations avoid full-list re-render when appending.
- Use memoization and stable keys for message rows.

## 8. Telemetry Contract

Extend `SPX_TELEMETRY_EVENT` in `lib/spx/telemetry.ts`:

- `COACH_ALERT_SEEN`
- `COACH_ALERT_SNOOZED`
- `COACH_ALERT_MUTED`
- `COACH_DOCK_OPENED`
- `COACH_DOCK_COLLAPSED`
- `COACH_TIMELINE_JUMP_LATEST`
- `COACH_MESSAGE_ACTION_CLICKED`

Payload baseline:

- `setupId`
- `messageId`
- `severity`
- `tradeMode`
- `layoutMode`
- `surface` (`dock`, `panel`, `banner`, `mobile_sheet`)

## 9. Phased Implementation Plan

### Phase 0: Baseline + Flag Scaffolding

Deliverables:

- Add new coach UX flags.
- Add telemetry constants and no-op emit points.
- Snapshot baseline metrics from existing events.

Gate:

- Existing SPX e2e suites remain green.

### Phase 1: Alert Lifecycle v2

Deliverables:

- Implement `coach-alert-state-v2` helpers.
- Integrate auto-seen and snooze/mute behavior.
- Preserve v1 dismissed list compatibility fallback.

Gate:

- Unit tests for storage migration, TTL cleanup, lifecycle transitions.

### Phase 2: Coach Dock + Placement Reorder

Deliverables:

- Add desktop coach dock and move coach above contract in `evaluate` and `in_trade`.
- Add mobile dock + bottom sheet container.

Gate:

- Responsive e2e coverage for dock visibility and open/close flows.

### Phase 3: Timeline v2 Behavior

Deliverables:

- Auto-follow at bottom.
- New-message pill when user scrolled up.
- Sticky composer.

Gate:

- E2E for scrolled-up timeline behavior and jump-to-latest.

### Phase 4: Actionable Message Cards

Deliverables:

- Clickable action chips (send scoped prompts).
- Expanded controls and improved focus states.

Gate:

- E2E for chip-triggered prompts and telemetry emission.

### Phase 5: Motion and Microinteraction Polish

Deliverables:

- AnimatePresence/layout transitions for alert and messages.
- Reduced-motion handling.

Gate:

- Visual QA pass and no accessibility regressions.

### Phase 6: Hardening + Rollout

Deliverables:

- Enable flags for internal users.
- Monitor telemetry and performance.
- Gradual production enablement.

Gate:

- KPI stability for 3 sessions before full enablement.

## 10. Test Plan

### 10.1 Unit tests

- `lib/spx/__tests__/coach-alert-state-v2.test.ts`
  - migration v1 -> v2
  - TTL cleanup
  - auto-seen rules
  - snooze/mute transitions

### 10.2 Component tests

- `components/spx-command-center/__tests__/coach-message.test.tsx`
  - action chip callback behavior
  - expand transition states

### 10.3 E2E tests

Add/extend:

- `e2e/spx-coach-messages.spec.ts`
  - lifecycle actions (seen/snooze/mute)
  - timeline auto-follow + new-message pill
- `e2e/spx-responsive.spec.ts`
  - mobile dock + bottom sheet behavior
- `e2e/spx-layout-state-machine.spec.ts`
  - coach placement in `scan` / `evaluate` / `in_trade`

### 10.4 Regression suites

Run:

- `pnpm test:e2e -- e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-responsive.spec.ts e2e/spx-layout-state-machine.spec.ts e2e/spx-command-palette.spec.ts`

## 11. Rollout and Rollback

Rollout order:

1. Enable `coachAlertLifecycleV2` in internal env.
2. Enable `coachDockV1` and `coachTimelineV2` for pro internal cohort.
3. Enable `coachMotionV1` last after perf verification.

Rollback:

- Disable new coach flags individually; legacy coach feed remains functional.
- Keep v1 alert state reader until full migration confidence is achieved.

## 12. Acceptance Criteria

1. Routine alerts no longer require manual acknowledgment.
2. Critical alerts remain explicit and visible until resolved/dismissed.
3. Coach is visible and reachable within one interaction in all modes.
4. Message insertions/removals are animated unless reduced-motion is active.
5. Timeline behavior supports auto-follow and unread-jump flow.
6. Mobile coach interaction is fluid via dock + sheet without losing trade context.
7. No regression in existing SPX command center core flows.

## 13. Autonomous Delivery Checklist

Before coding each phase:

1. Confirm enabled flags and default values.
2. Confirm telemetry event names and payload schema.
3. Confirm e2e selectors to avoid brittle assertions.

During coding:

1. Keep commits phase-scoped and reversible.
2. Run lint and targeted tests after each phase.
3. Update spec with any changed assumptions.

Before merge:

1. Full SPX e2e regression green.
2. No unresolved accessibility violations in coach surfaces.
3. Rollback path documented and validated.
