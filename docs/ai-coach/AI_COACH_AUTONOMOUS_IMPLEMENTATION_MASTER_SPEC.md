# AI Coach - Autonomous Implementation Master Spec

**Version:** 1.0  
**Date:** 2026-02-13  
**Status:** Ready for Autonomous Execution  
**Primary Audience:** Codex/Claude autonomous coding agents, human reviewers

## 2026-02-14 Implementation Status

Last Updated: 2026-02-14  
Owner: AI Coach Engineering

- WP1 implemented: chart now consumes live websocket quote updates and patches active candle in-memory with delayed/live signaling.
- WP2 implemented: latest-request-wins fetch cancellation, retry-safe loading lifecycle, non-blocking chart refresh affordance.
- WP3 implemented: level click interactions, mobile-accessible level surface, and level quick actions (options/alert/chat).
- WP4 implemented: progressive `function_result` SSE events and partial-stream preservation on interrupted streams.
- WP5 partially implemented: shared singleton `use-price-stream` with subscription diffing/teardown hygiene for symbol streams.
- WP6 implemented for scoped surfaces: reduced-motion handling in core transitions/typing indicators and calmer action-bar interactions.
- WP7 implemented: screenshot analysis context persisted via canonical chat turns instead of local-only pseudo-messages.

Outstanding (follow-up):
- Extend shared-socket model to channel-specific realtime panels (`positions` / `tracked setups`) for full WP5 parity.

---

## 1. Objective

Deliver a production-grade upgrade of AI Coach chat + chart UX, real-time behavior, loading patterns, and interaction quality with an execution plan that can be run autonomously end-to-end:

1. Coding implementation
2. Testing (unit/integration/e2e/manual)
3. Rollout hardening and observability
4. Repo-wide documentation updates

This spec is intentionally prescriptive and file-specific so an autonomous agent can execute without additional product clarification.

---

## 2. Source of Truth and Alignment

This spec consolidates and supersedes execution detail spread across:

- `docs/ai-coach/CODEX_PROMPT_UX_POLISH.md`
- `docs/ai-coach/PUNCH_LIST.md`
- `docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md`
- `docs/ai-coach/AI_COACH_PROFESSIONAL_ENHANCEMENT_SPEC.md`
- `docs/ai-coach/STATUS_AND_PLAN.md`

If conflicts exist, precedence order is:

1. This document
2. `docs/ai-coach/STATUS_AND_PLAN.md`
3. `docs/ai-coach/AI_COACH_PROFESSIONAL_ENHANCEMENT_SPEC.md`
4. `docs/ai-coach/CODEX_PROMPT_UX_POLISH.md`
5. Other planning documents

---

## 3. Goals and Non-Goals

### 3.1 Goals

1. Make chart behavior feel live, responsive, and interaction-first (not fetch-blocked).
2. Improve chat streaming feedback and progressive rendering so users perceive immediate progress.
3. Reduce stale/racy UI states when switching symbols/timeframes/sessions.
4. Ensure accessibility and motion safety while preserving premium interaction quality.
5. Create complete testing + rollout gates with explicit pass/fail criteria.
6. Update repository documentation so behavior, architecture, and runbooks match implementation.

### 3.2 Non-Goals

1. No redesign of unrelated member dashboard surfaces outside AI Coach.
2. No pricing/subscription model changes.
3. No provider migration off Massive/OpenAI.
4. No major backend data model rewrite unless required for correctness.

---

## 4. Current State Summary (Execution-Relevant)

### 4.1 Chat

- Streaming chat exists via SSE (`POST /api/chat/stream`) with token events.
- Client uses optimistic message + streaming placeholder pattern.
- Screenshot analysis path can append local messages outside persisted chat flow.

### 4.2 Chart

- Chart data is fetched via REST in `CenterPanel` and rendered by `TradingChart`.
- Chart view does not consume live websocket symbol price stream for candle updates.
- Loading overlay blocks chart interactions during refreshes.
- Symbol/timeframe fetches are vulnerable to stale response overwrite without request cancellation guards.

### 4.3 Real-time infrastructure

- WebSocket endpoint `/ws/prices` exists and supports symbol/channel subscriptions.
- Price updates are produced from polling loops (adaptive intervals by market session).
- Multiple panels open independent socket connections.

### 4.4 Documentation state

- Extensive specs exist but are fragmented.
- Implementation docs are not fully synchronized to runtime behavior and operator runbook needs.

---

## 5. Scope

### 5.1 In Scope

- Frontend AI Coach chat, chart, workflow, and websocket integration surfaces.
- Backend chat streaming and websocket event behavior where needed for UX goals.
- Test suite additions/updates (unit/integration/e2e).
- Repo-wide documentation updates for changed behavior.

### 5.2 Out of Scope

- Complete backend architecture rewrite.
- Full migration to provider push streams if not required for this phase.

---

## 6. Implementation Strategy

Execute in 8 work packages (WP0-WP7). Each package has implementation tasks, test requirements, and documentation obligations.

---

## 7. Work Packages

## WP0 - Baseline, Guardrails, and Telemetry Hardening

### Purpose
Create safe execution baseline and measurable deltas before major changes.

### Tasks

1. Add baseline performance + UX instrumentation for:
   - Time-to-first-token (chat)
   - Time-to-first-visible-chart (chart)
   - Symbol switch latency
   - Stream error/fallback frequency
2. Ensure request IDs propagate in AI Coach backend logs for chat stream and chart requests.
3. Add Sentry breadcrumbs around chart symbol/timeframe transitions and websocket connect/disconnect.

### Files (expected)

- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/center-panel.tsx`
- `hooks/use-price-stream.ts`
- `backend/src/routes/chat.ts`
- `backend/src/routes/chart.ts`

### Acceptance

- Metrics emitted and visible in logs/Sentry in local + staging.
- No functional regressions.

---

## WP1 - Chart Real-Time Responsiveness

### Purpose
Make chart behavior feel truly live and interaction-first.

### Tasks

1. Wire chart view to live price stream hook for active symbol.
2. Update in-memory last candle using websocket ticks (without full refetch).
3. Use periodic REST reconciliation for backfill/data integrity only (not primary live path).
4. Add explicit stale-data indicators when stream disconnected.

### Files (expected)

- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/trading-chart.tsx`
- `hooks/use-price-stream.ts`
- `lib/api/ai-coach.ts`

### Notes

- Preserve existing `ai-coach-show-chart` and workflow event patterns.
- Do not break indicator rendering and derived panels (RSI/MACD).

### Acceptance

- Active chart price updates without forced full overlay refresh.
- Stream disconnect state visible and recoverable.
- Symbol/timeframe transitions still deterministic.

---

## WP2 - Chart Loading, Fetch Correctness, and Interaction Reliability

### Purpose
Eliminate stale/racy states and avoid interaction blocking.

### Tasks

1. Introduce request cancellation and latest-request wins policy for chart fetches.
2. Replace full-screen blocking loading overlay with non-blocking loading affordance.
3. Keep pan/zoom/crosshair interactions available during background refresh.
4. Ensure retry logic does not prematurely clear loading states while retries are pending.

### Files (expected)

- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/trading-chart.tsx`
- `components/ai-coach/skeleton-loaders.tsx`

### Acceptance

- Rapid symbol/timeframe changes cannot render stale response over latest request.
- Loading UI is non-blocking for non-empty chart states.
- Retry path communicates clear state and terminal failure.

---

## WP3 - Chart Level Interactions and UX Depth

### Purpose
Convert level labels from passive display to interactive workflow controls.

### Tasks

1. Add `onLevelClick` behavior to center chart and optionally highlight selected level.
2. Add mobile-compatible level list/sheet (current desktop-only behavior is insufficient).
3. Add quick actions from selected level:
   - Create alert
   - Open options at level strike
   - Send targeted chat prompt
4. Improve level context precision (distance points + percent + optional ATR distance when available).

### Files (expected)

- `components/ai-coach/chart-level-labels.tsx`
- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/widget-actions.ts`

### Acceptance

- Clicking level produces deterministic chart + workflow outcome.
- Mobile users can access and act on level context.
- No regression in existing widget context menu behavior.

---

## WP4 - Chat Streaming UX and Progressive Function Rendering

### Purpose
Improve perceived speed and trust in AI response generation.

### Tasks

1. Expand stream status phases and map UI labels/icons consistently.
2. Emit and consume progressive function result events (where feasible) before final `done`.
3. Support robust fallback when stream fails after partial content.
4. Ensure partial content is not silently lost during recovery paths.

### Files (expected)

- `backend/src/chatkit/streamService.ts`
- `backend/src/routes/chat.ts`
- `lib/api/ai-coach.ts`
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/chat-message.tsx`

### Acceptance

- User sees continuous progress across long tool-call loops.
- Mid-stream failure degrades gracefully with minimal content loss.
- Final functionCalls/chartRequest behavior remains correct.

---

## WP5 - Realtime Socket Consolidation and Subscription Hygiene

### Purpose
Reduce duplicate websocket connections and subscription drift.

### Tasks

1. Introduce shared websocket manager or hook-level singleton for AI Coach surfaces.
2. Add symbol unsubscribe diffing in `use-price-stream` when watched symbols change.
3. Ensure deterministic teardown/unsubscribe on unmount/session switch.
4. Validate channel authorization behavior remains intact.

### Files (expected)

- `hooks/use-price-stream.ts`
- `components/ai-coach/position-tracker.tsx`
- `components/ai-coach/tracked-setups-panel.tsx`
- `backend/src/services/websocket.ts` (only if protocol/event changes are needed)

### Acceptance

- Socket count reduced during multi-panel usage.
- No stale subscriptions after symbol/channel changes.
- Position/tracked setup realtime flows preserved.

---

## WP6 - Accessibility, Motion Safety, and Performance

### Purpose
Ensure UX polish is compatible with accessibility and scaling.

### Tasks

1. Respect reduced-motion preference for key transitions and looping animations.
2. Add keyboard/focus quality checks for chart-level interactions and chat action chips.
3. Prevent animation-heavy long chat performance degradation.
4. Validate color contrast and status readability in loading/error states.

### Files (expected)

- `components/ai-coach/view-transition.tsx`
- `components/ai-coach/chat-message.tsx`
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/widget-action-bar.tsx`

### Acceptance

- Reduced motion produces materially calmer UI behavior.
- Core keyboard flows pass manual validation.
- No measurable regression in render performance on long sessions.

---

## WP7 - Screenshot-to-Chat Context Integrity

### Purpose
Ensure screenshot workflows are first-class conversation state, not local-only ephemera.

### Tasks

1. Persist screenshot analysis summary/context as canonical chat turns.
2. Ensure session reload/history preserves screenshot-derived context.
3. Route follow-up prompts to use persisted context, not transient local-only messages.

### Files (expected)

- `app/members/ai-coach/page.tsx`
- `hooks/use-ai-coach-chat.ts`
- `backend/src/routes/chat.ts` (if additional endpoint needed)
- `backend/src/chatkit/chatService.ts` (if context persistence enhancement needed)

### Acceptance

- Reloading a session retains screenshot analysis context for follow-up reasoning.
- No duplicate local-only pseudo-messages when persistence succeeds.

---

## 8. Detailed Testing Specification

## 8.1 Unit Tests

### Frontend

1. `use-price-stream`:
   - subscribe/unsubscribe diff behavior
   - reconnect behavior
   - disconnect/error state transitions
2. `use-ai-coach-chat`:
   - stream event mapping
   - partial-stream fallback handling
   - chartRequest extraction invariants
3. `chart-level-labels`:
   - sorting/closest-level logic
   - interaction callback behavior

### Backend

1. `streamService`:
   - progressive status emission
   - fallback behavior under simulated stream failures
2. `websocket`:
   - subscription hygiene, channel auth, disconnect cleanup

## 8.2 Integration Tests

1. Chat stream endpoint emits valid ordered SSE events.
2. Chart fetch request cancellation prevents stale state commits.
3. Websocket updates + REST reconciliation do not corrupt active bar series.

## 8.3 E2E Tests (Playwright)

1. **Chat streaming journey**
   - send prompt
   - observe phase transitions
   - receive progressive content and final answer
2. **Chart live journey**
   - open chart
   - switch symbol/timeframe rapidly
   - confirm latest selection persists without stale overwrite
3. **Level interaction journey**
   - click level label
   - verify chart focus + action dispatch
4. **Realtime resilience journey**
   - simulate socket drop
   - verify UI degraded state then recovery
5. **Screenshot context journey**
   - upload screenshot
   - receive summary
   - reload session
   - confirm context continuity

## 8.4 Manual QA Checklist

1. Desktop + mobile interaction parity for chart + levels.
2. Keyboard-only navigation in chat and toolbars.
3. Reduced-motion validation.
4. Long-session memory/perf sanity check (100+ messages).

---

## 9. Definition of Done (DoD)

A work package is complete only when all are true:

1. Code implemented and type-safe.
2. Unit/integration/e2e tests added or updated and passing.
3. Sentry/log instrumentation added for new behavior.
4. Documentation updated per Section 10.
5. No critical regression in chat, chart, options, alerts, tracked setups.
6. Reviewer can reproduce behavior using runbook steps.

---

## 10. Repo-Wide Documentation Update Plan (Mandatory)

After implementation, update docs across repository to avoid drift.

## 10.1 AI Coach docs

Update:

- `docs/ai-coach/STATUS_AND_PLAN.md`
- `docs/ai-coach/DEVELOPER_HANDOFF.md`
- `docs/ai-coach/CODEX_PROMPT_UX_POLISH.md`
- `docs/ai-coach/PUNCH_LIST.md`
- `docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md`

Add or refresh:

- `docs/ai-coach/testing/AI_COACH_REALTIME_TEST_PLAN.md`
- `docs/ai-coach/architecture/AI_COACH_STREAMING_AND_REALTIME_ARCHITECTURE.md`
- `docs/ai-coach/runbooks/AI_COACH_ROLLOUT_AND_ROLLBACK_RUNBOOK.md`

## 10.2 Root and cross-cutting docs

Update where relevant:

- `README.md` (feature behavior summary and developer startup/testing commands)
- `TESTING_GUIDE.md` (new e2e scenarios and prerequisites)
- `AI_Chat_System_Architecture.md` (if streaming event model changes)

## 10.3 Documentation quality requirements

Each updated document must include:

1. Last updated date.
2. Exact commands for validation.
3. Known limitations and failure modes.
4. Ownership (which team/role should use the doc).

---

## 11. Autonomous Execution Protocol

Use this execution protocol for coding agents:

1. Implement one work package at a time.
2. Run relevant tests immediately after each package.
3. Commit package-complete changes in focused commits.
4. Update docs in the same package commit when behavior changed.
5. Do not defer docs to a final sweep.
6. If blocked by missing infra, create a blocker note in the package section and continue with next unblocked task.

Recommended branch naming:

- `codex/ai-coach-realtime-wp1`
- `codex/ai-coach-streaming-wp4`

Recommended commit pattern:

- `feat(ai-coach): wp1 live chart stream integration`
- `test(ai-coach): wp1 realtime chart coverage`
- `docs(ai-coach): wp1 realtime behavior + runbook updates`

---

## 12. Rollout and Risk Management

## 12.1 Rollout strategy

1. Deploy behind feature flags where feasible:
   - `AI_COACH_CHART_LIVE_UPDATES`
   - `AI_COACH_STREAM_PROGRESSIVE_FUNCTIONS`
2. Staged rollout:
   - internal/staging only
   - beta cohort
   - full production

## 12.2 Key risks

1. Stale chart state from race conditions.
2. Increased client complexity from progressive streaming events.
3. Websocket overload from duplicate subscriptions.
4. User confusion from inconsistent loading states.

## 12.3 Mitigations

1. Request cancellation + latest-request tokening.
2. Backward-compatible stream event schema.
3. Shared socket manager with strict subscription lifecycle.
4. Unified loading/status component patterns.

---

## 13. Rollback Plan

If severe regressions occur:

1. Disable new feature flags.
2. Revert to REST-only chart refresh path.
3. Revert to existing `status/token/done` stream rendering path.
4. Keep websocket channel auth hardening intact.
5. Publish incident summary and postmortem tasks in docs runbook.

Rollback success criteria:

- Chat send/receive fully operational.
- Chart opens and renders base candles.
- Options/alerts/tracked setups unaffected.

---

## 14. Final Acceptance Criteria

The program is accepted when all conditions are met:

1. Chart experience is non-blocking and visibly live for active symbols.
2. Chat stream UX shows progressive, trustworthy status throughout long operations.
3. No stale response race issues when rapidly changing chart context.
4. Realtime socket behavior is consolidated and subscription-clean.
5. Screenshot analysis context persists across sessions.
6. Accessibility and reduced-motion expectations are satisfied.
7. Repo-wide documentation reflects final implementation behavior and operations.

---

## 15. Implementation Deliverables Checklist

- [x] WP0 complete (request/breadcrumb instrumentation scoped to chart/chat paths)
- [x] WP1 complete
- [x] WP2 complete
- [x] WP3 complete
- [x] WP4 complete
- [ ] WP5 complete (channel-specific realtime panels still separate sockets)
- [x] WP6 complete (scoped UI surfaces)
- [x] WP7 complete
- [x] Unit tests passing (targeted pack)
- [ ] Integration tests passing (not fully rerun in this pass)
- [ ] E2E tests passing (not rerun in this pass)
- [ ] Manual QA complete
- [x] Documentation updates complete (Section 10)
- [ ] Staging rollout complete
- [ ] Production rollout complete

---

## 16. Notes for Autonomous Agents

1. Prioritize correctness of state transitions over visual polish.
2. Do not remove existing behavior until replacement is validated.
3. Preserve backward compatibility for API contracts unless explicitly versioned.
4. Keep changes incremental and test-backed.
5. Treat documentation updates as part of implementation, not optional follow-up.
