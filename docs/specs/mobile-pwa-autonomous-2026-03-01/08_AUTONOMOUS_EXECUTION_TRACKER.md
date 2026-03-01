# Autonomous Execution Tracker — Mobile UX + PWA Workstream

**Workstream:** Mobile Reachability, Native-Feel UX, and PWA Installability
**Date:** 2026-03-01
**Governing Spec:** `docs/specs/MOBILE_PWA_EXECUTION_SPEC_2026-03-01.md`
**Branch:** `codex/mobile-pwa`

---

## 1. Overall Status

| Phase | Status | Target | Actual | Notes |
|-------|--------|--------|--------|-------|
| Phase 1: Mobile Reachability | NOT STARTED | Week 4 | — | |
| Phase 2: Native-Feel UX | NOT STARTED | Week 8 | — | |
| Phase 3: PWA Installability + Push | NOT STARTED | Week 12 | — | |
| Phase 4: Hardening + Regression | NOT STARTED | Week 13 | — | |

---

## 2. Slice Execution Detail

### Phase 1: Mobile Reachability

#### Slice 1.1 — Uncap Mobile Tabs

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — All mobile_visible tabs render | — |
| — Desktop layout unchanged | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 1.2 — Harden "More" Overflow Menu

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Menu scrolls with 8-15 items | — |
| — Dismiss works on touch/mouse/pen | — |
| — Safe-area padding applied | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 1.3 — SPX Immersive Route Mode

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Bottom nav hidden on SPX mobile | — |
| — Coach dock has full space | — |
| — Escape path exists | — |
| — Desktop unchanged | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 1.4 — Studio Mobile Enablement

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Studio loads on mobile | — |
| — Select/move/resize/delete via touch | — |
| — Desktop hover still works | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

**Phase 1 Gate:**
```
eslint:       —
tsc:          —
build:        —
playwright:   —
```

---

### Phase 2: Native-Feel Mobile UX

#### Slice 2.1 — Options Chain Mobile Layout

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Mobile segmented Calls/Puts toggle | — |
| — Horizontal scroll on table | — |
| — Sticky header | — |
| — Desktop side-by-side preserved | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 2.2 — Remove Hover-Only Critical Actions

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Critical actions visible on touch | — |
| — Desktop hover unchanged | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 2.3 — dvh + Safe-Area Normalization

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — No iOS viewport jump/crop | — |
| — PWA standalone stable | — |
| — Desktop unchanged | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

**Phase 2 Gate:**
```
eslint:       —
tsc:          —
build:        —
playwright:   —
```

---

### Phase 3: PWA Installability + Push

#### Slice 3.1 — Manifest Overhaul + Icon Pipeline

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| — `build` | — |
| **Acceptance Criteria** | |
| — Lighthouse PWA installability passes | — |
| — No manifest warnings in DevTools | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 3.2 — Service Worker Caching Policy Fix

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `build` | — |
| **Acceptance Criteria** | |
| — /api/* requests network-only | — |
| — Journal offline queue works | — |
| — Push notificationclick works | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 3.3 — Push Notifications Toggle

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Toggle enables/disables push | — |
| — Subscription stored via API | — |
| — iOS install guidance shown | — |
| — Permission-denied handled | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 3.4 — Custom Install Prompt (A2HS)

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| **Acceptance Criteria** | |
| — Chromium install prompt triggers | — |
| — iOS instructions shown | — |
| — Already-installed: hidden | — |
| — Dismissed: hidden | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 3.5 — iOS Splash Screen Pipeline

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `tsc --noEmit` | — |
| — `build` | — |
| **Acceptance Criteria** | |
| — iOS PWA shows branded splash | — |
| — All current device resolutions covered | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 3.6 — Standalone-Mode CSS

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Frontend Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `build` | — |
| **Acceptance Criteria** | |
| — No overscroll bounce on nav | — |
| — Fixed elements respect notch | — |
| — Content remains selectable | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

**Phase 3 Gate:**
```
eslint:       —
tsc:          —
build:        —
playwright:   —
```

---

### Phase 4: Hardening + Regression

#### Slice 4.1 — Playwright PWA Project

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | QA Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `eslint` | — |
| — `tsc --noEmit` | — |
| — `playwright (pwa-chromium)` | — |
| **Acceptance Criteria** | |
| — Manifest link test passes | — |
| — SW registration test passes | — |
| — Offline journal queue test passes | — |
| — Install prompt hook test passes | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 4.2 — Mobile Regression Suite

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | QA Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Validation** | |
| — `playwright (chromium)` | — |
| **Acceptance Criteria** | |
| — Mobile nav renders all tabs | — |
| — More menu opens/scrolls/dismisses | — |
| — SPX hides bottom nav | — |
| — Studio loads on mobile | — |
| — Options chain toggle works | — |
| **Commit** | — |
| **Risks Encountered** | — |
| **Session** | — |

#### Slice 4.3 — Documentation + Runbook

| Field | Value |
|-------|-------|
| **Status** | NOT STARTED |
| **Agent** | Docs Agent |
| **Branch** | `codex/mobile-pwa` |
| **Files Changed** | — |
| **Acceptance Criteria** | |
| — Release notes current | — |
| — Runbook covers all ops procedures | — |
| **Commit** | — |
| **Session** | — |

**Final Release Gate:**
```
eslint:                    —
tsc:                       —
build:                     —
vitest:                    —
playwright (chromium):     —
playwright (pwa-chromium): —
Node version:              —
```

---

## 3. Session Log

| Session | Date | Slice(s) | Agent | Outcome | Head Commit | Notes |
|---------|------|----------|-------|---------|-------------|-------|
| | | | | | | |

---

## 4. Handoff Block Template

```markdown
Branch: codex/mobile-pwa
Head commit: <sha>
Slice objective: <current slice>
Files touched: <list>
Validation run:
- eslint: PASS/FAIL
- tsc --noEmit: PASS/FAIL
- playwright: PASS/FAIL (if applicable)
Known pre-existing failures: <list or "none">
Next exact action: <what to do next>
```
