# Mobile UX + PWA Execution Spec

**Workstream:** Mobile Reachability, Native-Feel UX, and PWA Installability
**Date:** 2026-03-01
**Status:** Draft — Pending Approval
**Owner:** Orchestrator
**Branch:** `codex/mobile-pwa`
**Release Train:** March 2 – May 29, 2026 (90-day frame per §12.1)

---

## 1. Objective

Transform TradeITM from a responsive web app into a native-grade mobile experience with full PWA installability, push notifications, and zero-trap navigation. Every member-facing feature must be reachable and usable on mobile, including in PWA standalone mode.

---

## 2. Constraints

1. **Dark mode only** — all mobile UI must use The Emerald Standard (§2).
2. **No new dependencies** without justification — prefer Tailwind utility classes and existing Shadcn/UI primitives.
3. **Bundle budget** — no client-side bundle increase > 10KB per slice without justification (§9.2).
4. **Backward compatibility** — desktop layouts must not regress. All changes mobile-first, desktop-preserved.
5. **Auth model unchanged** — mobile navigation changes must respect existing `MemberAuthContext` role/tab visibility logic.
6. **Massive.com naming** — never reference "Polygon" in any code, comments, or docs (§3).
7. **Single-process Massive WebSocket** — no changes to tick ingest architecture (§4).
8. **Node >= 20.19.5** — all validation gates run under this runtime (§6.5).

---

## 3. Scope

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Mobile Navigation | Uncap `getMobileTabs()`, harden "More" overflow menu, add immersive route mode for SPX |
| Studio Mobile | Remove hard block, convert mouse events to pointer events, tap-to-select controls |
| AI Coach Mobile | Options chain mobile layout, remove hover-only critical actions |
| Mobile Polish | `dvh` + safe-area normalization, touch target audit, connection status indicator |
| PWA Manifest | Full icon matrix (192 + 512 + maskable), `id`, `start_url`, `shortcuts`, `screenshots` |
| Service Worker | Fix `/api/*` caching policy (network-only default), allowlist cache-safe endpoints only |
| Push Notifications | Member-facing toggle in Profile Settings, end-to-end subscribe/store/send/receive |
| Install Prompt | Custom A2HS CTA for Chromium (`beforeinstallprompt`) + iOS guidance UI |
| Splash Screens | `pwa-asset-generator` pipeline for iOS `apple-touch-startup-image` tags |
| Standalone CSS | `@media (display-mode: standalone)` adjustments for safe areas and overscroll |
| PWA E2E Tests | Playwright PWA project with `serviceWorkers: 'allow'`, manifest/SW/offline assertions |

### 3.2 Out of Scope

| Area | Reason |
|------|--------|
| App Store submission (TWA/Capacitor) | Future phase — PWA-first |
| Offline-first for all routes | Only journal has offline mutation queue; expanding is future work |
| Push notification segmentation/scheduling | V2 — this phase enables basic subscribe + send |
| Admin dashboard mobile | Admin is desktop-only by design |
| Backend architecture changes | No Express/Massive/Redis changes required |
| Database schema changes | No migrations required for this workstream |

---

## 4. Discovery Findings (Audit Summary)

### 4.1 Mobile UX Findings

**P0 — Feature Reachability**

- `contexts/MemberAuthContext.tsx` line ~1178: `getMobileTabs().slice(0, 5)` caps mobile tabs, hiding features entirely.
- `components/members/mobile-bottom-nav.tsx` line ~190: "More" menu has no `max-height`, no scroll, no safe-area padding. Uses `mousedown` (not `pointerdown`) for dismiss.
- `app/members/studio/page.tsx` line ~29: Hard-blocks mobile with "Desktop Required" message.
- `components/studio/blur-box.tsx` line ~30-139: Mouse-only events (`onMouseDown`, `mousemove`, `mouseup`), hover-only control visibility.
- SPX mobile coach dock (`z-[68]`) collides with member bottom nav (`z-40` at `bottom-6`).

**P1 — Usability**

- `components/ai-coach/options-chain.tsx`: Calls/Puts rendered side-by-side without mobile stacking.
- `components/ai-coach/chat-panel.tsx` line ~361: Session delete is `opacity-0 group-hover:opacity-100` (invisible on touch).
- Multiple components use `h-[92vh]`, `h-[calc(100vh-...)]` — breaks on iOS dynamic address bar.

### 4.2 PWA Findings

**P0 — Installability**

- `public/manifest.json`: Only one 192px icon, no 512px, no maskable. Missing `id`, `shortcuts`, `screenshots`.
- `public/sw.js` line ~271: Caches ALL `/api/*` GET responses via `networkFirst` — stale data risk for trading platform.
- No member-facing push notification toggle exists (subscription helpers in `lib/notifications.ts` are never called from UI).

**P1 — Polish**

- No custom install prompt (A2HS) UX.
- No iOS splash screen pipeline.
- `playwright.config.ts` blocks service workers (`serviceWorkers: 'block'`) — PWA regressions go undetected.

---

## 5. Phase/Slice Plan

### Phase 1: Mobile Reachability (Milestone A — Weeks 1–4)

**Exit Criteria:** Every member feature is reachable on mobile. No route strands users in PWA standalone. SPX mobile has no nav collisions.

#### Slice 1.1 — Uncap Mobile Tabs

- **Objective:** Remove the 5-tab limit so all `mobile_visible` features are accessible.
- **Agent:** Frontend Agent
- **Target Files:**
  - `contexts/MemberAuthContext.tsx`
- **Requirements:**
  1. Replace `getVisibleTabs().filter(tab => tab.mobile_visible).slice(0, 5)` with `getVisibleTabs().filter(tab => tab.mobile_visible)`.
  2. No unrelated changes.
- **Acceptance Criteria:**
  - All `mobile_visible` tabs render in bottom nav (first 4) + overflow menu (remainder).
  - Desktop layout unchanged.
- **Validation:**
  ```bash
  pnpm exec eslint contexts/MemberAuthContext.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert single-line change.
- **Risk:** Low.

#### Slice 1.2 — Harden "More" Overflow Menu

- **Objective:** Make overflow menu scrollable, touch-safe, and PWA-standalone compatible.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/members/mobile-bottom-nav.tsx`
- **Requirements:**
  1. Add `max-h-[60vh] overflow-y-auto pb-safe` to menu container.
  2. Switch click-away listener from `mousedown` to `pointerdown`.
  3. Ensure menu renders correctly with 8–15 items.
  4. Add `env(safe-area-inset-bottom)` padding.
- **Acceptance Criteria:**
  - Menu scrolls when items exceed viewport.
  - Dismiss works on touch, mouse, and pen inputs.
  - Menu does not extend behind iOS home indicator.
- **Validation:**
  ```bash
  pnpm exec eslint components/members/mobile-bottom-nav.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert file.
- **Risk:** Low.

#### Slice 1.3 — SPX Immersive Route Mode

- **Objective:** Hide member bottom nav on `/members/spx-command-center` to eliminate z-index collision with coach dock.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/members/layout.tsx`
- **Requirements:**
  1. Use `usePathname()` to detect SPX route.
  2. Set `const hideMobileNav = pathname.startsWith('/members/spx-command-center')`.
  3. Conditionally render `<MobileBottomNav />` and optionally `<MobileTopBar />`.
  4. Ensure a clear "back/escape" path exists (e.g., top-bar back button or gesture).
- **Acceptance Criteria:**
  - On `/members/spx-command-center`, bottom nav is hidden on mobile.
  - Coach dock has full bottom-screen space without collision.
  - User can navigate back to other member routes.
  - Desktop layout unchanged.
- **Validation:**
  ```bash
  pnpm exec eslint app/members/layout.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert file.
- **Risk:** Medium — must verify escape path thoroughly.

#### Slice 1.4 — Studio Mobile Enablement (Lite Mode)

- **Objective:** Remove "Desktop Required" block and make Studio minimally functional on mobile via pointer events.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/members/studio/page.tsx`
  - `components/studio/blur-box.tsx`
- **Requirements:**
  1. Remove mobile hard-block conditional in `studio/page.tsx`.
  2. Replace all `onMouseDown`/`mousemove`/`mouseup` with `onPointerDown`/`pointermove`/`pointerup` in `blur-box.tsx`.
  3. Add `selectedId` state — controls visible when element is selected (tap-to-select).
  4. In `@media (hover: none)`, always show delete and one resize affordance.
  5. Touch targets >= 44px for interactive controls.
- **Acceptance Criteria:**
  - Studio loads on mobile without "Desktop Required" screen.
  - User can select, move, resize, and delete blur boxes via touch.
  - Desktop behavior unchanged (hover still works).
- **Validation:**
  ```bash
  pnpm exec eslint app/members/studio/page.tsx components/studio/blur-box.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert both files.
- **Risk:** Medium — touch interaction quality needs manual QA.

### Phase 2: Native-Feel Mobile UX (Milestone B — Weeks 5–8)

**Exit Criteria:** Mobile layouts are readable and touch-first. No hover-only critical actions. Modals/sheets use `dvh` + safe areas.

#### Slice 2.1 — Options Chain Mobile Layout

- **Objective:** Make AI Coach options chain readable on mobile with a segmented Calls/Puts toggle.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/ai-coach/options-chain.tsx`
- **Requirements:**
  1. Change `flex` to `flex-col lg:flex-row` for Calls/Puts containers.
  2. Add mobile segmented control ("Calls" / "Puts") visible below `lg` breakpoint.
  3. Wrap tables in `overflow-x-auto`.
  4. Add sticky header row.
  5. Condense non-essential columns on mobile.
- **Acceptance Criteria:**
  - On mobile, user sees one table at a time with toggle.
  - Table scrolls horizontally if needed.
  - Header stays visible during scroll.
  - Desktop side-by-side layout preserved.
- **Validation:**
  ```bash
  pnpm exec eslint components/ai-coach/options-chain.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert file.
- **Risk:** Low.

#### Slice 2.2 — Remove Hover-Only Critical Actions

- **Objective:** Ensure all destructive/primary actions are discoverable on touch devices.
- **Agent:** Frontend Agent
- **Target Files (sweep):**
  - `components/ai-coach/chat-panel.tsx` (session delete)
  - All components with `opacity-0 group-hover:opacity-100` on critical actions (discovery via grep)
- **Requirements:**
  1. Add `[@media(hover:none)]:opacity-100` to each affected element.
  2. Alternatively, implement "show on selected row" logic where appropriate.
  3. Touch targets >= 44px.
- **Acceptance Criteria:**
  - On touch devices, critical actions (delete, edit, share) are visible without hover.
  - Desktop hover behavior unchanged.
- **Validation:**
  ```bash
  pnpm exec eslint <touched files>
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert individual files.
- **Risk:** Low — purely additive CSS.

#### Slice 2.3 — `dvh` + Safe-Area Normalization

- **Objective:** Fix iOS viewport bugs across sheets and modals.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/journal/entry-detail-sheet.tsx`
  - `components/journal/trade-entry-sheet.tsx`
  - AI Coach mobile sheets (discovery via grep for `vh` usage)
  - `app/globals.css` (shared utility classes)
- **Requirements:**
  1. Replace `h-[92vh]`, `h-[calc(100vh-...)]` with `dvh` equivalents.
  2. Add `env(safe-area-inset-bottom)` padding to bottom-anchored elements.
  3. Add shared CSS utility class/token for modal containers if pattern repeats > 3 times.
- **Acceptance Criteria:**
  - Sheets/modals don't jump or crop on iOS Safari.
  - In PWA standalone, layouts are stable.
  - Desktop unchanged.
- **Validation:**
  ```bash
  pnpm exec eslint <touched files>
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert individual files.
- **Risk:** Low.

### Phase 3: PWA Installability + Push (Milestone C — Weeks 9–12)

**Exit Criteria:** Lighthouse PWA installability checks pass. Custom install CTA works. Push toggle works end-to-end.

#### Slice 3.1 — Manifest Overhaul + Icon Pipeline

- **Objective:** Meet PWA installability requirements with complete manifest and icon set.
- **Agent:** Frontend Agent
- **Target Files:**
  - `public/manifest.json`
  - `public/icons/` (new directory)
  - `app/layout.tsx` (metadata updates)
- **Requirements:**
  1. Add `id: "/"` field.
  2. Set `start_url: "/members?utm_source=pwa&utm_medium=homescreen"`.
  3. Add `shortcuts` array (Dashboard, Journal, AI Coach, SPX).
  4. Add `screenshots` array (mobile + desktop).
  5. Add icon matrix: 72, 96, 128, 144, 152, 192, 384, 512 (regular + maskable variants).
  6. Add `categories`, `description`, `orientation: "portrait"`.
  7. Wire all icons in `app/layout.tsx` metadata.
- **Acceptance Criteria:**
  - Lighthouse PWA installability audit passes.
  - Chrome DevTools Application panel shows no manifest warnings.
- **Validation:**
  ```bash
  pnpm exec eslint app/layout.tsx
  pnpm exec tsc --noEmit
  pnpm run build
  ```
- **Rollback:** Revert manifest + layout.
- **Risk:** Low.

#### Slice 3.2 — Service Worker Caching Policy Fix

- **Objective:** Prevent stale API data from being served, especially for trading endpoints.
- **Agent:** Frontend Agent
- **Target Files:**
  - `public/sw.js`
- **Requirements:**
  1. Change `/api/*` default strategy from `networkFirst` to network-only.
  2. Create explicit allowlist for cache-safe endpoints (if any — e.g., static config).
  3. Never cache SPX/market-data endpoints.
  4. Preserve offline journal mutation queue (IndexedDB + Background Sync).
  5. Preserve push notification handlers.
- **Acceptance Criteria:**
  - `/api/*` requests always hit network (no stale trading data).
  - Journal offline queue still works.
  - Push `notificationclick` still works.
- **Validation:**
  ```bash
  pnpm run build
  ```
- **Rollback:** Revert `sw.js`.
- **Risk:** Medium — must verify offline journal queue is unaffected.

#### Slice 3.3 — Push Notifications Toggle

- **Objective:** Give members a UI to subscribe/unsubscribe from push notifications.
- **Agent:** Frontend Agent
- **Target Files:**
  - `components/profile/profile-settings-sheet.tsx`
  - `lib/notifications.ts` (minor improvements if needed)
- **Requirements:**
  1. Add "Notifications" section in Profile Settings.
  2. Toggle calls `subscribeToPush()` / `unsubscribeFromPush()` from `lib/notifications.ts`.
  3. Show current subscription state.
  4. Only request browser permission on explicit user tap.
  5. Show iOS-specific hint: "Install the app to your home screen to enable push notifications."
  6. Handle permission-denied state gracefully.
- **Acceptance Criteria:**
  - Toggle enables/disables push subscription.
  - Subscription stored via existing `push-subscriptions` API.
  - iOS users see install guidance when not in standalone mode.
  - Permission-denied shows clear messaging (not broken toggle).
- **Validation:**
  ```bash
  pnpm exec eslint components/profile/profile-settings-sheet.tsx lib/notifications.ts
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Revert both files.
- **Risk:** Low.

#### Slice 3.4 — Custom Install Prompt (A2HS)

- **Objective:** Provide branded, contextual install CTA for Chromium browsers + iOS guidance.
- **Agent:** Frontend Agent
- **Target Files:**
  - `hooks/use-pwa-install.ts` (new)
  - `components/pwa/install-cta.tsx` (new)
  - `app/members/layout.tsx` (render CTA)
- **Requirements:**
  1. Hook captures `beforeinstallprompt` event and exposes `canInstall`, `promptInstall()`, `isInstalled`.
  2. CTA component shows branded install banner (Emerald Standard).
  3. On iOS, show "Add to Home Screen" instructions with Safari share icon visual.
  4. Show CTA contextually (e.g., after 2nd visit, or after first journal entry).
  5. Dismissible with "Don't show again" (stored in `localStorage`).
- **Acceptance Criteria:**
  - Chromium: tapping "Install" triggers native install prompt.
  - iOS: clear visual instructions for Add to Home Screen.
  - Already-installed: CTA never shows.
  - Dismissed: CTA never shows again.
- **Validation:**
  ```bash
  pnpm exec eslint hooks/use-pwa-install.ts components/pwa/install-cta.tsx app/members/layout.tsx
  pnpm exec tsc --noEmit
  ```
- **Rollback:** Remove new files, revert layout.
- **Risk:** Low.

#### Slice 3.5 — iOS Splash Screen Pipeline

- **Objective:** Generate and wire Apple splash screens for all iOS device resolutions.
- **Agent:** Frontend Agent
- **Target Files:**
  - `public/splash/` (new directory, generated assets)
  - `app/layout.tsx` (add `apple-touch-startup-image` links)
  - `package.json` (add `generate:splash` script)
- **Requirements:**
  1. Add `pwa-asset-generator` as devDependency.
  2. Create generation script targeting TradeITM branding (emerald background + logo).
  3. Wire generated `<link>` tags into `app/layout.tsx`.
- **Acceptance Criteria:**
  - iOS installed PWA shows branded splash on launch.
  - All current iOS device resolutions covered.
- **Validation:**
  ```bash
  pnpm exec tsc --noEmit
  pnpm run build
  ```
- **Rollback:** Remove splash assets and revert layout.
- **Risk:** Low.

#### Slice 3.6 — Standalone-Mode CSS

- **Objective:** Polish PWA standalone experience with safe-area and overscroll adjustments.
- **Agent:** Frontend Agent
- **Target Files:**
  - `app/globals.css`
- **Requirements:**
  1. Add `@media (display-mode: standalone)` block.
  2. Set `overscroll-behavior: none` (prevent pull-to-refresh).
  3. Adjust fixed-position elements for safe-area insets.
  4. Set `-webkit-tap-highlight-color: transparent`.
  5. Add `user-select: none` on nav elements (not content).
- **Acceptance Criteria:**
  - In PWA standalone, no overscroll bounce on nav.
  - Fixed elements respect notch/home indicator.
  - Content remains selectable.
- **Validation:**
  ```bash
  pnpm exec eslint app/globals.css
  pnpm run build
  ```
- **Rollback:** Revert globals.css.
- **Risk:** Low.

### Phase 4: Hardening + Regression Suite (Week 13)

**Exit Criteria:** Playwright PWA project exists. Mobile regression suite covers all major routes. Runbook exists.

#### Slice 4.1 — Playwright PWA Project

- **Objective:** Add automated PWA regression tests.
- **Agent:** QA Agent
- **Target Files:**
  - `playwright.config.ts`
  - `e2e/pwa.spec.ts` (new)
- **Requirements:**
  1. Add `pwa-chromium` project to Playwright config with `serviceWorkers: 'allow'`.
  2. Test: manifest `<link>` exists in document head.
  3. Test: service worker registers successfully.
  4. Test: offline journal mutation enqueues entry to IndexedDB when network fails.
  5. Test: install prompt hook detects `beforeinstallprompt` (mock).
- **Acceptance Criteria:**
  - `pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium` passes.
  - Tests do not interfere with existing `chromium` project (which still blocks SW).
- **Validation:**
  ```bash
  pnpm exec eslint playwright.config.ts e2e/pwa.spec.ts
  pnpm exec tsc --noEmit
  pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
  ```
- **Rollback:** Revert config, remove spec file.
- **Risk:** Low.

#### Slice 4.2 — Mobile Regression Suite

- **Objective:** E2E coverage for mobile-specific UI behavior.
- **Agent:** QA Agent
- **Target Files:**
  - `e2e/mobile-navigation.spec.ts` (new)
  - `e2e/mobile-test-helpers.ts` (new)
- **Requirements:**
  1. Test mobile bottom nav renders all visible tabs.
  2. Test "More" menu opens, scrolls, and dismisses on touch.
  3. Test SPX route hides bottom nav.
  4. Test Studio loads on mobile viewport.
  5. Test options chain toggle (Calls/Puts) on mobile.
  6. Use mobile viewport preset (390x844 iPhone 14).
- **Acceptance Criteria:**
  - All tests pass with `--project=chromium --workers=1`.
- **Validation:**
  ```bash
  pnpm exec playwright test e2e/mobile-*.spec.ts --project=chromium --workers=1
  ```
- **Rollback:** Remove spec files.
- **Risk:** Low.

#### Slice 4.3 — Documentation + Runbook

- **Objective:** Complete the autonomous documentation packet.
- **Agent:** Docs Agent
- **Target Files:**
  - `docs/specs/MOBILE_PWA_RELEASE_NOTES_2026-03-01.md` (new)
  - `docs/specs/MOBILE_PWA_RUNBOOK_2026-03-01.md` (new)
- **Requirements:**
  1. Release notes covering all implemented slices.
  2. Runbook covering: PWA install troubleshooting, push notification debugging, service worker update procedure, splash screen regeneration, mobile nav configuration.
- **Acceptance Criteria:**
  - Both docs exist and are current with implementation.
- **Validation:** Manual review.
- **Rollback:** N/A (docs only).
- **Risk:** None.

---

## 6. Release Gates

### Slice-Level Gates (run after every slice)

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
```

### Phase-Level Gates (run at each milestone boundary)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm exec playwright test e2e/mobile-*.spec.ts --project=chromium --workers=1
```

### Final Release Gates (Week 13)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/mobile-*.spec.ts e2e/pwa.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
```

**Runtime requirement:** All gates validated under Node >= 20.19.5.

---

## 7. Test Contract

Per §6.6 and §11.5:

1. **Selectors:** Prefer `getByRole`, `getByLabel`, `getByText`. Fall back to `data-testid` only when DOM is ambiguous.
2. **Mobile viewport:** Use `{ width: 390, height: 844 }` (iPhone 14) as canonical mobile preset.
3. **Timeouts:** `test.setTimeout(60_000)` in every `beforeEach`.
4. **Async assertions:** Use `expect.poll(() => ..., { timeout: 10_000 })` for state transitions.
5. **PWA tests:** Must run in separate `pwa-chromium` project with `serviceWorkers: 'allow'`.
6. **If locator ambiguity appears:** Add `data-testid` at the owning UI boundary immediately (this is the only case where production code changes during QA).

---

## 8. Agent Assignment

| Slice | Agent | Rationale |
|-------|-------|-----------|
| 1.1–1.4 | Frontend Agent | App Router pages, components, contexts |
| 2.1–2.3 | Frontend Agent | Component layout and CSS changes |
| 3.1–3.6 | Frontend Agent | PWA assets, hooks, components, globals.css |
| 4.1–4.2 | QA Agent | E2E test creation (read-only on production code) |
| 4.3 | Docs Agent | Release notes and runbook |

**Shared file coordination** (via Orchestrator):
- `app/members/layout.tsx` is touched by Slices 1.3 and 3.4 — execute sequentially.
- `app/globals.css` is touched by Slices 2.3 and 3.6 — execute sequentially.
- `app/layout.tsx` is touched by Slices 3.1 and 3.5 — execute sequentially.

---

## 9. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | iOS Safari `dvh` support varies across versions | Medium | Medium | Test on iOS 15+ only; add fallback `vh` for older |
| R2 | Studio pointer events break complex drag/resize on some Android browsers | Medium | High | Manual QA on Chrome Android + Samsung Internet |
| R3 | `beforeinstallprompt` not supported in Firefox/Safari | Certain | Low | Graceful degradation — only show CTA where supported |
| R4 | SW caching change breaks offline journal queue | Low | High | Targeted test in Slice 3.2 validation; queue uses IndexedDB (separate from fetch cache) |
| R5 | iOS push requires standalone mode — users may not understand | Medium | Medium | iOS-specific guidance UI in Slice 3.3 |
| R6 | Uncapping tabs causes visual overflow on very small screens | Low | Medium | "More" menu hardening in Slice 1.2 handles this |

---

## 10. Rollback Strategy

Each slice has an independent rollback defined above. At the phase level:

- **Phase 1 rollback:** Revert `codex/mobile-pwa` branch to pre-Phase-1 commit. All changes are additive CSS/logic; no migrations.
- **Phase 2 rollback:** Same — revert to Phase 1 completion commit.
- **Phase 3 rollback:** Revert manifest, SW, new hooks/components. Push subscriptions in DB are harmless to leave.
- **Phase 4 rollback:** Remove test files. No production impact.

**No feature flags required** — all changes are low-risk UI/CSS/asset changes with no backend or database implications.

---

## 11. Closure Criteria

Per §6.8, this workstream is complete only when:

1. All slice acceptance criteria met (tracked in `08_AUTONOMOUS_EXECUTION_TRACKER.md`).
2. All release gates green under Node >= 20.19.5.
3. Release notes (`MOBILE_PWA_RELEASE_NOTES_2026-03-01.md`) current.
4. Runbook (`MOBILE_PWA_RUNBOOK_2026-03-01.md`) current.
5. Change control + risk register + tracker current.
6. Production deploy approval explicitly recorded.

---

## 12. Prioritized Backlog Reference

| # | Priority | Slice | Area | Issue | Effort | Impact |
|---|----------|-------|------|-------|--------|--------|
| 1 | P0 | 1.1 | Mobile Nav | Mobile tabs capped at 5 | S | Critical |
| 2 | P0 | 1.2 | Mobile Nav | More menu no scrolling | S | High |
| 3 | P0 | 1.3 | SPX Mobile | Bottom-nav collision risk | M | High |
| 4 | P0 | 1.4 | Studio | Mobile hard-block | M | High |
| 5 | P0 | 3.1 | PWA | Manifest missing 512 icon + fields | S | High |
| 6 | P0 | 3.2 | PWA | SW caches all `/api/*` | M | Critical |
| 7 | P0 | 3.3 | Push | No member subscription UI | M | High |
| 8 | P1 | 2.1 | AI Coach | Options chain unreadable on mobile | M | High |
| 9 | P1 | 2.2 | Mobile UX | Hover-only critical actions | M | Medium |
| 10 | P1 | 2.3 | Mobile UX | `vh` viewport bugs | M | Medium |
| 11 | P1 | 3.4 | PWA | Install prompt UX missing | M | High |
| 12 | P1 | 3.5 | PWA | Splash screens missing | M | Medium |
| 13 | P1 | 3.6 | PWA | Standalone-mode CSS | S | Medium |
| 14 | P1 | 4.1 | Testing | No PWA E2E | M | High |
| 15 | P2 | 4.2 | Testing | Mobile regression suite | M | Medium |
| 16 | P2 | 4.3 | Docs | Release notes + runbook | S | Medium |
