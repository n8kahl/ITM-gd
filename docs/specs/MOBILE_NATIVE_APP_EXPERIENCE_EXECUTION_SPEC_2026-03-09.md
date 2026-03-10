# Mobile Native App Experience Execution Spec

**Workstream:** Members iPhone Native-Feel Hardening
**Date:** 2026-03-09
**Status:** Draft - Ready for approval
**Owner:** Orchestrator
**Branch:** `codex/mobile-pwa`
**Release Train Window:** Monday, March 9, 2026 to Friday, May 29, 2026

---

## 0. Pre-Implementation Completeness Check

| Required Artifact (CLAUDE.md §6.3) | Path | Status |
|-------------------------------------|------|--------|
| Master execution spec | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_EXECUTION_SPEC_2026-03-09.md` | Present |
| Phase 1 slice report | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_PHASE1_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 2 slice report | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_PHASE2_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 3 slice report | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_PHASE3_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 4 slice report | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_PHASE4_SLICE_REPORT_2026-03-09.md` | Present |
| Release notes | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_RELEASE_NOTES_2026-03-09.md` | Present |
| Runbook | `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_RUNBOOK_2026-03-09.md` | Present |
| Change control standard | `docs/specs/mobile-native-app-experience-autonomous-2026-03-09/06_CHANGE_CONTROL_AND_PR_STANDARD.md` | Present |
| Risk register + decision log | `docs/specs/mobile-native-app-experience-autonomous-2026-03-09/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md` | Present |
| Autonomous execution tracker | `docs/specs/mobile-native-app-experience-autonomous-2026-03-09/08_AUTONOMOUS_EXECUTION_TRACKER.md` | Present |

Implementation gate: documentation packet complete as of Monday, March 9, 2026.

---

## 1. Objective

Deliver a true iPhone-native member experience for `/members` by removing route lockups, reducing perceived navigation latency, preserving context across tool transitions, and hardening realtime data continuity so users never need refresh/recovery clicks during normal flow.

---

## 2. Constraints

1. Dark mode only and Emerald Standard styling remains enforced.
2. No backend architecture rewrite; keep existing Next + Express + Supabase model.
3. No destructive behavior changes for desktop workflows.
4. Any auth changes must remain fail-closed and Supabase-compatible.
5. Trading/market APIs remain network-first for correctness; stale views must be explicitly labeled.
6. Validation under Node `>=20.19.5`.
7. No unrelated file churn outside declared slice scope.

---

## 3. Scope

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Members navigation stability | Remove tab lockup behavior and non-deterministic fallback reloads; add deterministic transition state model |
| Mobile route performance | Prefetch/warm critical member routes and tighten transition timing |
| Market and chart continuity | Same-origin proxy hardening, 401 recovery, stale-state fallback display model |
| iPhone app-shell polish | Viewport/safe-area alignment and touch feedback consistency |
| Standalone auth continuity | Harden iOS standalone OAuth handoff and return behavior |
| AI Coach mobile continuity | Preserve chat/chart state when switching mobile tool surfaces |
| Test and release hardening | Deterministic mobile stress, PWA, and regression coverage with explicit pass/fail evidence |

### 3.2 Out Of Scope

| Area | Reason |
|------|--------|
| App Store wrapper (Capacitor/TWA) | Not required for this workstream |
| Full offline market replay | Beyond current product architecture |
| Backend service decomposition | Not related to mobile UX quality gap |
| Admin desktop UX redesign | Not part of member iPhone native experience |

---

## 4. Discovery and Drift Analysis (Completed Before Design)

### 4.1 Runtime UX Symptoms

1. Users can get stuck after tapping member tabs and recover only via refresh or distant tab hop.
2. Mobile users see intermittent "market data unavailable" and chart/levels load failures.
3. Bottom nav labels on mobile lacked explicit full-width centering.

### 4.2 Confirmed Drift Surfaces (Code-Level)

| Drift Category | Findings |
|----------------|----------|
| Navigation transaction drift | `hooks/use-member-nav-handler.ts` has a pending-nav timer and `window.location.assign` fallback that can force hard navigations |
| Mobile perceived-latency drift | `prefetch={false}` on bottom nav links in `components/members/mobile-bottom-nav.tsx` increases cold route transitions |
| Data transport drift | Mixed direct backend and proxy usage previously created mobile CORS/token fragility |
| Auth continuity drift | `app/login/page.tsx` standalone warning confirms iOS shell OAuth context switch risk |
| Test-contract drift | Existing mobile nav E2E has intermittent "More" interaction detach/timeouts under stress |

### 4.3 Existing Baseline Strengths

1. PWA manifest, service worker registration, install CTA, and iOS splash support already exist.
2. Members shell already includes safe-area aware classes and standalone CSS hooks.
3. Mobile/PWA Playwright suites exist and are extensible.

---

## 5. Architecture and Experience Design

### 5.1 Architecture Direction

1. Move members navigation to a single deterministic transaction model (no blind hard-reload fallback during normal route changes).
2. Use same-origin proxy access for mobile-sensitive market/chart/levels APIs and preserve last-known-good UI state when realtime fails.
3. Add a shared mobile network state layer in members shell for consistent online/reconnecting/degraded cues.
4. Keep standalone-mode behavior explicit and predictable for OAuth and app-shell layout.

### 5.2 Experience Direction

1. Tab taps should feel immediate and cancellable like native bottom-tab navigation.
2. Tool transitions in AI Coach mobile should preserve context, not feel like page swaps.
3. Degraded data should be communicated as "stale + retrying" instead of dead-end failure text.
4. iPhone standalone users should have explicit auth handoff/return continuity and no dead-end state.

---

## 6. Phase and Slice Plan

## Phase 1: Navigation Transaction Reliability (Milestone A)

**Exit Criteria:** No route-lock behavior on `/members` tab switching under rapid taps.

### Slice 1.1 - Replace fallback hard-navigation behavior with deterministic route transaction state

- **Objective:** Eliminate lock-prone pending fallback semantics.
- **Agent:** Frontend Agent
- **Target Files:**
  - `hooks/use-member-nav-handler.ts`
  - `components/members/mobile-bottom-nav.tsx`
  - `components/members/mobile-top-bar.tsx`
- **Requirements:**
  1. Remove forced `window.location.assign` path for normal in-app navigation.
  2. Add explicit in-flight navigation state and ignore duplicate taps to same target.
  3. Add deterministic timeout handling that surfaces retry UI state instead of hard redirect.
- **Acceptance Criteria:**
  - Rapid tab taps do not trap navigation.
  - No full-page reload is triggered for healthy in-app route transitions.
  - Existing analytics tracking remains intact.
- **Validation:**
  ```bash
  pnpm exec eslint hooks/use-member-nav-handler.ts components/members/mobile-bottom-nav.tsx components/members/mobile-top-bar.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert three files.
- **Risk:** Medium.

### Slice 1.2 - Warm-route strategy for mobile member tabs

- **Objective:** Reduce cold-start tab latency to improve native feel.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/members/mobile-bottom-nav.tsx`
  - `app/members/layout.tsx`
- **Requirements:**
  1. Re-enable or selectively apply route prefetch/warm behavior for primary member tabs.
  2. Ensure prefetch strategy does not flood network on low-memory devices.
  3. Keep role/tab visibility logic unchanged.
- **Acceptance Criteria:**
  - Primary tab transitions are visibly faster on repeat navigation.
  - No new overfetch regressions in network logs.
- **Validation:**
  ```bash
  pnpm exec eslint components/members/mobile-bottom-nav.tsx app/members/layout.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert two files.
- **Risk:** Low.

### Slice 1.3 - Navigation telemetry and stall diagnostics contract

- **Objective:** Add measurable evidence for nav stall regressions.
- **Agent:** Frontend Agent
- **Target Files:**
  - `hooks/use-member-nav-handler.ts`
  - `lib/analytics.ts`
  - `e2e/specs/ux-stress-test.spec.ts`
- **Requirements:**
  1. Emit nav start/success/stall events with route ids and durations.
  2. Add stress assertion thresholds for tab cycling responsiveness.
- **Acceptance Criteria:**
  - Stall events are observable in telemetry.
  - Stress suite includes navigation-specific thresholds.
- **Validation:**
  ```bash
  pnpm exec eslint hooks/use-member-nav-handler.ts lib/analytics.ts e2e/specs/ux-stress-test.spec.ts
  pnpm exec tsc --noEmit
  pnpm exec playwright test e2e/specs/ux-stress-test.spec.ts --project=chromium --workers=1
  ```
- **Rollback:** Revert three files.
- **Risk:** Medium.

---

## Phase 2: Data Continuity and Degraded-State UX (Milestone B)

**Exit Criteria:** Mobile users see deterministic chart/market behavior with explicit degraded-state continuity and automatic retry.

### Slice 2.1 - Market/Chart proxy contract hardening

- **Objective:** Finish transport consistency for mobile-sensitive data paths.
- **Agent:** Frontend + Backend Agent
- **Target Files:**
  - `hooks/useMarketData.ts`
  - `app/api/market/_proxy.ts`
  - `app/api/chart/[symbol]/route.ts`
  - `app/api/levels/[symbol]/route.ts`
  - `lib/api/ai-coach.ts`
- **Requirements:**
  1. Keep same-origin fetch path as canonical in browser context.
  2. Ensure token/session fallback retry is deterministic for 401 paths.
  3. Standardize proxy error payloads for UI handling.
- **Acceptance Criteria:**
  - Mobile chart/levels requests no longer fail from cross-origin/token drift cases.
  - Proxy response shape is stable across chart/levels/market endpoints.
- **Validation:**
  ```bash
  pnpm exec eslint hooks/useMarketData.ts app/api/market/_proxy.ts app/api/chart/[symbol]/route.ts app/api/levels/[symbol]/route.ts lib/api/ai-coach.ts
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert five files.
- **Risk:** Medium.

### Slice 2.2 - Last-known-good cache presentation for dashboard market surfaces

- **Objective:** Replace hard failure feel with stale-but-usable continuity.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/dashboard/live-market-ticker.tsx`
  - `components/dashboard/market-movers-card.tsx`
  - `components/dashboard/market-analytics-card.tsx`
  - `hooks/useMarketData.ts`
- **Requirements:**
  1. Persist and render last-known-good market payloads with explicit stale timestamp.
  2. Show retrying/degraded chip instead of dead-end unavailable copy when possible.
  3. Avoid misleading realtime indicators when stale data is shown.
- **Acceptance Criteria:**
  - Temporary upstream failures do not blank dashboard market cards.
  - UI clearly distinguishes live vs stale data.
- **Validation:**
  ```bash
  pnpm exec eslint components/dashboard/live-market-ticker.tsx components/dashboard/market-movers-card.tsx components/dashboard/market-analytics-card.tsx hooks/useMarketData.ts
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert four files.
- **Risk:** Medium.

### Slice 2.3 - Members-wide connectivity banner and retry affordance

- **Objective:** Provide one consistent online/degraded/offline language across mobile routes.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/members/layout.tsx`
  - `components/members/network-status-banner.tsx` (new)
  - `hooks/use-online-status.ts` (new)
- **Requirements:**
  1. Detect `online/offline` state plus degraded API heartbeat status.
  2. Render lightweight banner/chip in members shell.
  3. Avoid layout jump and avoid blocking primary interactions.
- **Acceptance Criteria:**
  - Users can see connectivity state without navigating into individual features.
  - Offline/degraded recovery behavior is visibly communicated.
- **Validation:**
  ```bash
  pnpm exec eslint app/members/layout.tsx components/members/network-status-banner.tsx hooks/use-online-status.ts
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert/add-remove new files.
- **Risk:** Low.

---

## Phase 3: iPhone App-Shell and Auth Continuity (Milestone C)

**Exit Criteria:** Standalone iPhone shell behaves predictably for safe areas, gestures, and auth handoffs.

### Slice 3.1 - Viewport-fit and safe-area hardening pass

- **Objective:** Align layout metadata with safe-area CSS strategy for notch/home-indicator devices.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/layout.tsx`
  - `app/globals.css`
- **Requirements:**
  1. Ensure viewport metadata supports edge-to-edge iPhone behavior.
  2. Audit top/bottom bars and sheets for safe-area consistency.
  3. Keep desktop behavior unchanged.
- **Acceptance Criteria:**
  - No clipped top/bottom surfaces in iPhone standalone mode.
  - Home-indicator overlap is eliminated for fixed controls.
- **Validation:**
  ```bash
  pnpm exec eslint app/layout.tsx app/globals.css
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert two files.
- **Risk:** Low.

### Slice 3.2 - Standalone OAuth continuity hardening

- **Objective:** Reduce auth dead-end risk in iOS standalone handoff.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/login/page.tsx`
  - `app/api/auth/callback/route.ts`
  - `lib/safe-redirect.ts`
- **Requirements:**
  1. Persist return-intent robustly across Safari/app-shell round-trip.
  2. Add deterministic post-auth recovery when standalone context changes.
  3. Improve user-facing handoff messaging with explicit next-step guidance.
- **Acceptance Criteria:**
  - Standalone login returns user to intended member route without manual recovery.
  - Auth failure states are specific and actionable.
- **Validation:**
  ```bash
  pnpm exec eslint app/login/page.tsx app/api/auth/callback/route.ts lib/safe-redirect.ts
  pnpm exec tsc --noEmit
  pnpm exec playwright test e2e/discord-auth-flow.spec.ts --project=chromium --workers=1
  ```
- **Rollback:** Revert three files.
- **Risk:** Medium.

### Slice 3.3 - Touch feedback and gesture arbitration pass

- **Objective:** Standardize tap/press feedback to feel native and avoid gesture conflicts.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/members/mobile-bottom-nav.tsx`
  - `components/members/mobile-top-bar.tsx`
  - `components/ai-coach/inline-mini-chart.tsx`
  - `app/globals.css`
- **Requirements:**
  1. Normalize touch target sizing and press states.
  2. Prevent gesture conflicts between parent swipe handlers and chart drag surfaces.
  3. Keep optional haptic behavior scoped and non-blocking.
- **Acceptance Criteria:**
  - Tap targets are consistent and discoverable.
  - Chart pans do not accidentally trigger shell navigation gestures.
- **Validation:**
  ```bash
  pnpm exec eslint components/members/mobile-bottom-nav.tsx components/members/mobile-top-bar.tsx components/ai-coach/inline-mini-chart.tsx app/globals.css
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert four files.
- **Risk:** Medium.

---

## Phase 4: AI Coach Mobile Continuity and Release Hardening (Milestone D)

**Exit Criteria:** AI Coach mobile transitions preserve state, and full release gates are green.

### Slice 4.1 - Preserve chat and chart state across mobile tool-sheet transitions

- **Objective:** Remove state-loss feel caused by unmount-heavy mobile transitions.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/members/ai-coach/page.tsx`
  - `components/ai-coach/center-panel.tsx`
- **Requirements:**
  1. Keep core chat and chart contexts mounted where feasible.
  2. Ensure tool-sheet open/close does not reset user reading position or chart context.
  3. Maintain current desktop panel behavior.
- **Acceptance Criteria:**
  - Switching between chat and chart tools retains prior context.
  - Users do not lose active analysis state after sheet toggles.
- **Validation:**
  ```bash
  pnpm exec eslint app/members/ai-coach/page.tsx components/ai-coach/center-panel.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert two files.
- **Risk:** High.

### Slice 4.2 - Mobile regression and stress gate expansion

- **Objective:** Add deterministic evidence that lockups and clunky transitions are resolved.
- **Agent:** QA Agent
- **Target Files:**
  - `e2e/mobile-navigation.spec.ts`
  - `e2e/specs/ux-stress-test.spec.ts`
  - `e2e/pwa.spec.ts`
- **Requirements:**
  1. Add explicit members-tab storm tests.
  2. Add AI Coach mobile transition persistence checks.
  3. Keep flaky assertions isolated and documented via decision log if deferment is required.
- **Acceptance Criteria:**
  - Mobile nav and AI Coach persistence tests pass in CI profile.
  - Stress thresholds capture frame-lock regressions.
- **Validation:**
  ```bash
  pnpm exec eslint e2e/mobile-navigation.spec.ts e2e/specs/ux-stress-test.spec.ts e2e/pwa.spec.ts
  pnpm exec tsc --noEmit
  pnpm exec playwright test e2e/mobile-navigation.spec.ts --project=chromium --workers=1
  pnpm exec playwright test e2e/specs/ux-stress-test.spec.ts --project=chromium --workers=1
  pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
  ```
- **Rollback:** Revert three files.
- **Risk:** Medium.

### Slice 4.3 - Documentation synchronization and release evidence

- **Objective:** Close workstream with synchronized runbook, release notes, tracker, and risk log.
- **Agent:** Docs Agent
- **Target Files:**
  - `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_PHASE*_SLICE_REPORT_2026-03-09.md`
  - `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_RELEASE_NOTES_2026-03-09.md`
  - `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_RUNBOOK_2026-03-09.md`
  - `docs/specs/mobile-native-app-experience-autonomous-2026-03-09/*`
- **Requirements:**
  1. Update each slice report with real command outputs and status.
  2. Update risk/decision log for any deferments.
  3. Capture final release gate evidence.
- **Acceptance Criteria:**
  - CLAUDE.md §6.3 packet fully current.
  - Final release checklist complete and auditable.
- **Validation:** Manual doc consistency pass + final release gates.
- **Rollback:** Revert docs only.
- **Risk:** Low.

---

## 7. Implementation Plan (Prompt-Driven Session Plan)

## Session A - Plan and Author (No release gating)

1. Confirm slice scope and target files.
2. Implement one slice only.
3. Return required format:
   - Changed files
   - Command outputs (pass/fail)
   - Risks/notes
   - Suggested commit message

## Session B - Validate and Fix

1. Run slice-level gates.
2. Fix failures in-scope only.
3. Update phase slice report + tracker entries for that slice.

## Session C - Harden and Commit

1. Re-run slice gates.
2. Stage only in-scope files.
3. Commit with controlled message format.
4. Update change control and risk log.

## Session D - Milestone and Release Gates

1. Execute phase boundary gates.
2. Execute final release gates at workstream completion.
3. Update release notes + runbook + approval table.

---

## 8. Validation Gates

## Slice-level gates

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

## Release-level gates

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/mobile-navigation.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/specs/ux-stress-test.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
```

Runtime requirement: Node `>=20.19.5`.

---

## 9. Risks

1. Navigation transaction refactor could regress edge-case browser history behavior.
2. AI Coach state-preservation changes could increase memory pressure on low-end devices.
3. OAuth continuity hardening can surface callback edge cases in non-standalone sessions.
4. Stress-test thresholds may require calibration for CI variance.

Mitigations are tracked in `07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`.

---

## 10. Rollback Plan

1. Roll back by slice in reverse order (4.x -> 1.x).
2. If nav regression appears in production, prioritize reverting Phase 1 slices first.
3. If auth continuity regresses, revert Slice 3.2 independently and keep other slices live.
4. For data continuity regressions, revert Slice 2.2 first (UI cache layer), then 2.1 if transport contract changed behavior.

---

## 11. Closure Criteria

Workstream closes only when all conditions are met:

1. All planned slices are complete or explicitly deferred with recorded decision IDs.
2. Phase reports, release notes, runbook, and autonomous packet are synchronized.
3. Final release gates pass with documented command outputs.
4. Production deploy approval is recorded in release notes.
