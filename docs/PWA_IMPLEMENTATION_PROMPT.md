# Claude Code Prompt: PWA Spec-Driven Implementation

> **Usage:** Copy this entire prompt into a Claude Code session (or Codex task) with the TradeITM repo checked out. It implements `docs/PWA_SPEC.md` using gated phases with test verification between each phase.

---

## System Instructions

You are implementing a production-grade PWA for the TradeITM Next.js application. You MUST follow spec-driven development — every feature you build traces back to `docs/PWA_SPEC.md`. You MUST NOT deviate from the spec, improvise features, or skip phases.

Read `CLAUDE.md` and `docs/PWA_SPEC.md` before writing any code. These are your source of truth.

### Development Methodology: Gated Phases

This implementation is divided into 7 sequential phases. Each phase has:

1. **Implementation** — Write the code specified in the phase
2. **Unit/Integration Tests** — Write tests that verify the code works
3. **Gate Check** — Run the test suite. ALL tests must pass before proceeding
4. **Documentation** — Update inline JSDoc and the phase's section of `docs/PWA_CHANGELOG.md`

**CRITICAL RULES:**
- Never start Phase N+1 until Phase N's gate check passes
- If a gate check fails, fix the failing tests before proceeding — do not skip or delete tests
- Run `pnpm test:unit` after every phase. Run `pnpm test:e2e:mobile` after Phases 3, 5, and 7
- Run `pnpm build` after every phase to catch type errors
- Commit after each phase passes its gate: `git commit -m "feat(pwa): phase N — <description>"`
- Every new file must have a JSDoc header comment explaining its purpose and which spec section it implements

### Project Context

```
Stack:           Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase
Package Manager: pnpm 10
Node:            22+
Test Runner:     Vitest (unit), Playwright (e2e)
Linter:          ESLint
Build:           next build --webpack
CI:              GitHub Actions (.github/workflows/e2e-tests.yml)
Design System:   "Emerald Standard" — dark mode only, #10B981 primary, #0A0A0B background
CSS Variables:   var(--emerald-elite), var(--champagne), glass-card-heavy
Imports:         @/ alias (tsconfig paths: "@/*" → "./*")
Icons:           Lucide React only
Images:          next/image only
Fonts:           Playfair Display (headings), Inter (body), Geist Mono (data)
```

**Existing files you'll modify** (read these first):
- `public/manifest.json` — current partial manifest
- `public/sw.js` — hand-rolled service worker (~290 lines) with offline journal sync
- `components/pwa/service-worker-register.tsx` — already rewritten with update detection
- `app/layout.tsx` — root layout
- `app/members/layout.tsx` — members area layout
- `app/globals.css` — design system (~1067 lines)
- `components/members/mobile-top-bar.tsx` — sticky mobile header
- `components/members/mobile-bottom-nav.tsx` — bottom tab bar with haptics
- `hooks/use-is-mobile.ts` — breakpoint-based mobile detection
- `middleware.ts` — CSP nonce, auth, route gating
- `playwright.config.ts` — existing projects: chromium, mobile, mobile-members

**Existing files to reference** (read but don't modify):
- `contexts/MemberAuthContext.tsx` — membership tier from Discord roles
- `lib/motion-primitives.ts` — existing animation constants
- `lib/sounds.ts` — audio utilities
- `lib/web-push-service.ts` — already implemented server-side push delivery
- `lib/types/notifications.ts` — already implemented notification types
- `app/api/admin/notifications/route.ts` — already implemented admin push API
- `components/admin/notification-user-search.tsx` — already implemented

**Already completed** (do NOT reimplement):
- Push notification admin panel (`app/admin/notifications/page.tsx`)
- Web push service (`lib/web-push-service.ts`)
- Notification types (`lib/types/notifications.ts`)
- Admin notification API routes (`app/api/admin/notifications/`)
- Service worker SKIP_WAITING handler (already in `sw.js`)
- Service worker registration with update detection (already rewritten)
- `notification_broadcasts` DB table (already migrated)
- `push_subscriptions` DB table (already migrated)

---

## Phase 1: Installability Foundation (Spec §3, §4, §5)

### Goal
Make the app pass 100% of Lighthouse PWA checks on mobile.

### Tasks

**1.1 — Icon Asset Pipeline** (Spec §4)
```
Create: scripts/generate-pwa-icons.ts
Create: public/icons/ directory with all 14 icon files
```
- Install `sharp` as a devDependency: `pnpm add -D sharp @types/sharp`
- Write `scripts/generate-pwa-icons.ts` that reads `public/hero-logo.png` (773KB source)
- Generate all sizes from the table in Spec §4: 72, 96, 128, 144, 152, 192, 384, 512 (purpose: any)
- Generate maskable variants at 192 and 512 — logo centered in 80% safe zone, `#0A0A0B` background fill
- Generate monochrome at 192 — white silhouette on transparent
- Generate 3 shortcut icons at 96x96 — render the Lucide icon name (BookOpen, Bot, LayoutDashboard) as white on `#047857` rounded-rect background. Use `@resvg/resvg-js` or SVG-to-PNG for this.
- Add script to package.json: `"generate:pwa-icons": "tsx scripts/generate-pwa-icons.ts"`
- Run the script to generate all icons

**1.2 — Manifest Overhaul** (Spec §3)
```
Modify: public/manifest.json — complete rewrite
```
- Replace the entire file with the manifest from Spec §3 verbatim
- Verify all icon `src` paths point to files that exist in `public/icons/`

**1.3 — Root Layout Meta Tags** (Spec §7A)
```
Modify: app/layout.tsx
```
- Add/update viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
- Add `<meta name="theme-color" content="#0A0A0B" media="(prefers-color-scheme: dark)" />`
- Verify existing apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title are present
- Add `<meta name="format-detection" content="telephone=no" />`
- Add `<meta name="msapplication-TileColor" content="#0A0A0B" />`
- Add `<meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />`
- Use Next.js metadata API where possible, fall back to `<head>` for non-standard tags

**1.4 — Standalone CSS** (Spec §7B)
```
Modify: app/globals.css
```
- Add the entire "PWA STANDALONE MODE ADJUSTMENTS" CSS block from Spec §7B
- Includes: `@media (display-mode: standalone)` rules, `.safe-top`, `.safe-bottom`, `.safe-left`, `.safe-right`, `.pb-nav`, nav user-select prevention, `.scroll-native`, `.scrollbar-mobile-hide`, touch target sizing `@media (pointer: coarse)`
- Do NOT duplicate existing `pb-safe` — keep both, they serve different purposes

**1.5 — Offline Fallback Page** (Spec §5A)
```
Create: public/offline.html
```
- Self-contained HTML (no external deps, all CSS inline, logo as inline SVG or base64)
- `#0A0A0B` background, centered TradeITM logo, "You're offline" message
- "Your queued trades will sync when you reconnect" reassurance
- Retry button: `onclick="location.reload()"`
- Style with Emerald Standard colors (emerald accent, champagne/ivory text)
- Embed Inter font subset (regular weight only, Latin chars) as base64 woff2

**1.6 — Service Worker Upgrades** (Spec §5A, §5C, §5D, §5E)
```
Modify: public/sw.js
```
- Add `SW_VERSION = '5.0.0'` constant at top
- Add `/offline.html` to `STATIC_ASSETS` array
- Expand `STATIC_ASSETS` with the full list from Spec §5C
- Update navigation fetch handler to fall back to `/offline.html` per Spec §5A code block
- Add periodic background sync handler for `dashboard-refresh` per Spec §5D
- Log version on activate: `console.log('[SW] Activated version ${SW_VERSION}')`

### Phase 1 Gate Check

```bash
# 1. Build must succeed with no type errors
pnpm build

# 2. All generated icons must exist
ls -la public/icons/

# 3. Manifest must be valid JSON
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')); console.log('manifest OK')"

# 4. Offline page must exist and be valid HTML
test -f public/offline.html && echo "offline.html OK"

# 5. Unit tests pass
pnpm test:unit

# 6. Write and run a Phase 1 verification test
# Create: __tests__/pwa/phase1-installability.test.ts
```

**Phase 1 Test File:** `lib/__tests__/pwa/phase1-installability.test.ts`
```typescript
// Test: manifest.json is valid and has required fields (id, name, start_url, display, icons with 512px, screenshots)
// Test: All icon files referenced in manifest exist on disk (fs.existsSync)
// Test: offline.html exists and contains required elements (logo, retry button, offline message)
// Test: sw.js contains SW_VERSION, SKIP_WAITING handler, offline.html in STATIC_ASSETS
// Test: manifest has at least one maskable icon at 512px
// Test: manifest has at least one screenshot with form_factor "narrow"
// Test: manifest has shortcuts array with 3+ entries
// Test: manifest has share_target defined
```

**Commit:** `git commit -m "feat(pwa): phase 1 — installability foundation (icons, manifest, offline, SW upgrades)"`

---

## Phase 2: A2HS Install Prompt (Spec §6)

### Goal
Build the branded install prompt with animation on Android and instruction overlay on iOS.

### Tasks

**2.1 — Standalone Detection Hook** (Spec §11A)
```
Create: hooks/use-is-standalone.ts
```
- Check `window.matchMedia('(display-mode: standalone)').matches`
- Check `(navigator as any).standalone` (iOS Safari)
- Check URL params for `utm_source=pwa` (from manifest start_url)
- Return `boolean`
- SSR-safe: return `false` during SSR

**2.2 — PWA Install Hook** (Spec §6D)
```
Create: hooks/use-pwa-install.ts
```
- Capture `beforeinstallprompt` event in a ref
- Track state: `{ isInstallable, isStandalone, promptOutcome, showPrompt() }`
- `showPrompt()` calls `event.prompt()` and tracks the outcome
- Listen for `appinstalled` event
- Write install events to Supabase `conversion_events` table (event_type: 'pwa_install') — use `fetch('/api/analytics/event', ...)`
- Persist dismissal in `localStorage` key `tradeitm-a2hs-dismissed` with timestamp
- Suppression logic: don't show for 14 days after dismiss, never after install

**2.3 — Install Prompt Bottom Sheet** (Spec §6A)
```
Create: components/pwa/install-prompt.tsx
```
- Client component using framer-motion
- Bottom sheet visual per the ASCII diagram in Spec §6A
- Animation sequence per Spec §6A: backdrop fade → sheet spring up → logo bounce → text stagger → CTA pulse
- Uses `use-pwa-install` hook for state and prompt trigger
- Show condition: user on `/members` route for 30s OR 3+ page visits in session, AND not dismissed, AND not standalone
- CTA button: `btn-premium btn-luxury` classes
- Container: `glass-card-heavy rounded-t-2xl`
- Feature list: "Works offline", "Push notifications", "Instant launch" with checkmarks
- "Maybe Later" text button dismisses with 14-day suppression
- Logo uses `next/image` with `src="/logo.png"`

**2.4 — iOS Install Guide** (Spec §6B)
```
Create: components/pwa/ios-install-guide.tsx
```
- Detect iOS: check userAgent for iPhone/iPad AND not standalone
- Bottom sheet with 3-step instructions per Spec §6B
- Bouncing arrow animation pointing to Safari share button: `{ y: [0, -8, 0] }` repeat infinite
- Different arrow position for iPhone (bottom center) vs iPad (top right)
- "Got it" dismiss button
- Same suppression logic via localStorage

**2.5 — Mount Install Components**
```
Modify: app/members/layout.tsx
```
- Import and render `<InstallPrompt />` inside the members layout (after the main content)
- Only renders on client, only on mobile (use existing `useIsMobile` hook)

### Phase 2 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 2 Test File:** `lib/__tests__/pwa/phase2-install-prompt.test.ts`
```typescript
// Test: useIsStandalone returns false in non-standalone env
// Test: usePwaInstall initial state has isInstallable: false, isStandalone: false
// Test: localStorage suppression logic — dismissed < 14 days ago = suppressed
// Test: localStorage suppression logic — dismissed > 14 days ago = not suppressed
// Test: localStorage suppression logic — installed = always suppressed
// Test: InstallPrompt component renders nothing when not installable (snapshot)
// Test: iOSInstallGuide component renders nothing on non-iOS (snapshot)
```

**Commit:** `git commit -m "feat(pwa): phase 2 — A2HS install prompt with iOS guide"`

---

## Phase 3: Mobile Navigation Polish (Spec §7)

### Goal
Every navigation element is safe-area aware, keyboard-friendly, and works in standalone mode.

### Tasks

**3.1 — Mobile Top Bar Updates** (Spec §7C)
```
Modify: components/members/mobile-top-bar.tsx
```
- Add `pt-[env(safe-area-inset-top)]` to the header element
- Change fixed `h-14` to `min-h-[3.5rem]` so it grows with safe area
- Add network status dot: small circle next to logo — green (`bg-emerald-400`) when online, amber (`bg-amber-400`) when offline. Use `navigator.onLine` + event listeners.
- Add back button: when on a sub-page deeper than 2 segments (e.g., `/members/academy/courses/[slug]`), show `<ChevronLeft>` in the left slot that calls `router.back()`

**3.2 — Mobile Bottom Nav Updates** (Spec §7D)
```
Modify: components/members/mobile-bottom-nav.tsx
```
- Add `badge` prop to NavTab interface: `badge?: number`
- Render badge dot per Spec §7D code block (red circle, 9+ truncation)
- Add keyboard detection: use `window.visualViewport` resize to detect keyboard open (height diff > 150px), hide bottom nav when keyboard is open
- Verify `pb-safe` handles iPhone 15/16 Pro home indicator

**3.3 — Members Layout Updates** (Spec §7E)
```
Modify: app/members/layout.tsx
```
- Replace static `pb-28` with `pb-nav lg:pb-8` (uses new CSS utility from Phase 1)
- Add `will-change: transform, opacity` to the Framer Motion animated container for smoother mobile transitions

**3.4 — Swipe Navigation** (Spec §7F)
```
Create: hooks/use-swipe-navigation.ts
```
- Detect right-swipe from left 20px edge zone
- Threshold: 80px horizontal swipe
- Calls `router.back()` on successful swipe
- Visual feedback: subtle emerald gradient from left edge during swipe (CSS pseudo-element or overlay div)
- Only active in standalone mode on mobile
- Use touch events: `touchstart`, `touchmove`, `touchend`

**3.5 — Pull-to-Refresh** (Spec §7E.2)
```
Create: components/pwa/pull-to-refresh.tsx
```
- Custom pull-to-refresh component (not browser default)
- Touch event based: detect pull-down when scrollTop === 0
- Custom indicator: pulsing emerald logo (reuse existing skeleton-loader pattern)
- Calls `router.refresh()` on release past threshold (60px)
- Only active in standalone mode on mobile
- Prevent double-trigger with debounce

### Phase 3 Gate Check

```bash
pnpm build
pnpm test:unit
pnpm test:e2e:mobile
```

**Phase 3 Test File:** `lib/__tests__/pwa/phase3-mobile-nav.test.ts`
```typescript
// Test: useSwipeNavigation only activates in standalone mode
// Test: useSwipeNavigation requires 80px threshold
// Test: useSwipeNavigation only triggers from left 20px edge
// Test: PullToRefresh component renders nothing on desktop
// Test: Keyboard detection logic — heightDiff > 150 = keyboard open
```

**Phase 3 E2E Test File:** `e2e/specs/pwa/mobile-nav.spec.ts`
```typescript
// Viewport: iPhone 15 (390x844)
// Test: Bottom nav renders all tab items
// Test: Active tab indicator shows on current route
// Test: Navigation between all primary tabs works
// Test: No horizontal overflow on dashboard page
// Test: No horizontal overflow on journal page
// Test: No horizontal overflow on AI coach page
// Test: Cards stack vertically at 320px viewport
```

**Commit:** `git commit -m "feat(pwa): phase 3 — mobile nav polish (safe area, keyboard, swipe, pull-to-refresh)"`

---

## Phase 4: Native Features (Spec §8)

### Goal
Integrate platform APIs: haptics, badges, share, wake lock, push subscription management.

### Tasks

**4.1 — Haptics Utility** (Spec §8B)
```
Create: lib/haptics.ts
```
- Export `haptics` object with: `light`, `medium`, `heavy`, `success`, `error`, `selection` patterns
- Each calls `navigator.vibrate?.()` with the patterns from Spec §8B
- Apply across the app:
  - `haptics.medium` → CTA buttons, form submissions
  - `haptics.success` → Journal entry saved, sync complete toasts
  - `haptics.error` → Form validation failures, network errors
  - `haptics.selection` → Dropdown selections
  - (Leave existing `haptics.light` in bottom nav as-is)

**4.2 — Badge API** (Spec §8C)
```
Create: lib/badge.ts
```
- `setAppBadge(count: number)` — uses `navigator.setAppBadge` / `navigator.clearAppBadge`
- Feature detection: no-op when API unavailable
- Integrate: set badge on push notification receipt (in `sw.js`), clear on app focus

**4.3 — Share Button** (Spec §8D)
```
Create: components/pwa/share-button.tsx
```
- Uses `navigator.share()` when available
- Fallback: copy to clipboard with toast confirmation
- Props: `title`, `text`, `url`
- Styled as an icon button with `Share2` Lucide icon
- Add to journal entry view and AI Coach insights

**4.4 — Wake Lock** (Spec §8E)
```
Modify: AI Coach page component
```
- Add `navigator.wakeLock.request('screen')` when AI Coach conversation is active
- Re-acquire on `visibilitychange` (iOS releases on tab switch)
- Release on unmount
- Feature detection: no-op when API unavailable

**4.5 — Push Notification Client** (Spec §8A)
```
Create: lib/push-notifications.ts
```
- `subscribeToPush()`: request permission, subscribe via `pushManager.subscribe()` with VAPID key from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, save subscription to `/api/push/subscribe`
- `unsubscribeFromPush()`: remove subscription from browser and Supabase
- `isPushSupported()`: feature detection
- `isPushGranted()`: check `Notification.permission`

```
Create: components/pwa/notification-settings.tsx
```
- Toggle switch UI for enabling/disabling push notifications
- Shows current permission state
- Handles the permission request flow
- Add to `/members/profile` page

### Phase 4 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 4 Test File:** `lib/__tests__/pwa/phase4-native-features.test.ts`
```typescript
// Test: haptics.light calls navigator.vibrate with 10
// Test: haptics.success calls navigator.vibrate with [10, 50, 20]
// Test: haptics gracefully no-ops when navigator.vibrate is undefined
// Test: setAppBadge calls navigator.setAppBadge when available
// Test: setAppBadge is no-op when API unavailable
// Test: isPushSupported returns false when PushManager missing
// Test: ShareButton renders share icon
// Test: ShareButton falls back to clipboard when navigator.share unavailable
```

**Commit:** `git commit -m "feat(pwa): phase 4 — native features (haptics, badge, share, wake lock, push client)"`

---

## Phase 5: Offline & Connectivity (Spec §9)

### Goal
Users know when they're offline, see cached data gracefully, and trust their changes will sync.

### Tasks

**5.1 — Network Status Context** (Spec §9A)
```
Create: contexts/NetworkStatusContext.tsx
```
- Client context provider
- State: `{ isOnline: boolean, wasOffline: boolean, effectiveType: string | null }`
- Uses `navigator.onLine` + `online`/`offline` events
- Reads `navigator.connection?.effectiveType` where available
- Exposes via `useNetworkStatus()` hook

**5.2 — Offline Banner** (Spec §9B)
```
Create: components/pwa/offline-banner.tsx
```
- Fixed banner below mobile top bar when offline
- Amber background: "You're offline — changes will sync when you reconnect"
- When back online: brief emerald success banner "Back online — syncing..." auto-dismisses after 3s
- Animate in/out with framer-motion slide
- Uses `useNetworkStatus()` context

**5.3 — Mount Network Provider**
```
Modify: app/layout.tsx or app/members/layout.tsx
```
- Wrap members content with `<NetworkStatusProvider>`
- Render `<OfflineBanner />` inside the members layout, between top bar and main content

**5.4 — Journal Sync Indicator** (Spec §9D)
```
Modify: Journal page or journal components
```
- Read IndexedDB journal mutation queue count
- Display: "N changes pending sync" (amber dot) when mutations queued
- Display: "Syncing..." (emerald pulse) when actively syncing
- Display: "All changes saved" (emerald check) — auto-dismiss 2s

### Phase 5 Gate Check

```bash
pnpm build
pnpm test:unit
pnpm test:e2e:mobile
```

**Phase 5 Test File:** `lib/__tests__/pwa/phase5-offline.test.ts`
```typescript
// Test: NetworkStatusContext defaults to isOnline: true
// Test: NetworkStatusContext updates on offline event
// Test: NetworkStatusContext sets wasOffline flag after recovery
// Test: OfflineBanner renders when isOnline is false
// Test: OfflineBanner shows recovery message briefly after reconnect
// Test: OfflineBanner renders nothing when online and not recently recovered
```

**Phase 5 E2E Test File:** `e2e/specs/pwa/offline.spec.ts`
```typescript
// Test: Offline fallback page loads when network is disconnected during navigation
// Test: Dashboard shows cached content when offline
// Test: Offline banner appears when network drops
// Test: Offline banner disappears when network returns
```

**Commit:** `git commit -m "feat(pwa): phase 5 — offline UX (network context, banner, sync indicators)"`

---

## Phase 6: iOS Hardening (Spec §11)

### Goal
iOS standalone mode works without quirks — splash screens, keyboard handling, navigation.

### Tasks

**6.1 — iOS Splash Screen Generation** (Spec §4)
```
Create: scripts/generate-pwa-splashes.ts
Create: public/splash/ directory
```
- Generate splash screens for all 16 device resolutions in Spec §4 table
- Each splash: `#0A0A0B` background, centered TradeITM logo at ~25% viewport width, subtle emerald radial gradient glow beneath
- Use sharp for image composition
- Add script: `"generate:pwa-splashes": "tsx scripts/generate-pwa-splashes.ts"`

**6.2 — Splash Screen Meta Tags**
```
Modify: app/layout.tsx
```
- Add `<link rel="apple-touch-startup-image">` tags for each device resolution
- Use `media` queries per the format in Spec §4

**6.3 — iOS Keyboard Handling** (Spec §11B)
```
Create: hooks/use-ios-keyboard-fix.ts
```
- When in standalone + iOS: listen for input focus events
- After 300ms delay (keyboard animation), scroll focused element into view with `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Apply to AI Coach chat input and Journal entry form

**6.4 — iOS Session Persistence** (Spec §11E)
```
Verify/Modify: contexts/MemberAuthContext.tsx (if needed)
```
- Ensure auth state check happens immediately on app reopen
- If session is expired, redirect to login
- Show pulsing logo loader during rehydration (already exists — verify it triggers)

**6.5 — Permissions-Policy Header** (Spec §13)
```
Modify: middleware.ts
```
- Add `Permissions-Policy` header for push notification permissions
- Ensure CSP allows service worker registration

### Phase 6 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 6 Test File:** `lib/__tests__/pwa/phase6-ios.test.ts`
```typescript
// Test: All splash screen files exist on disk (loop over expected filenames)
// Test: useIosKeyboardFix is no-op on non-iOS
// Test: Splash meta tags reference valid files
```

**Commit:** `git commit -m "feat(pwa): phase 6 — iOS hardening (splashes, keyboard, session persistence)"`

---

## Phase 7: Testing, Verification & CI (Spec §10, §12)

### Goal
Full test coverage, Lighthouse CI, performance verification. The final quality gate.

### Tasks

**7.1 — Comprehensive E2E Tests** (Spec §12A)
```
Create: e2e/specs/pwa/pwa-installability.spec.ts
Create: e2e/specs/pwa/mobile-layouts.spec.ts
```

`pwa-installability.spec.ts`:
- Service worker registers successfully
- Manifest is accessible and returns 200
- All icon URLs in manifest return 200
- Start URL loads and caches
- Theme color meta tag matches manifest theme_color
- Offline fallback page loads when disconnected

`mobile-layouts.spec.ts` — Test at 320px, 375px, 390px, 430px:
- Dashboard: no horizontal overflow
- Journal: entries stack correctly
- AI Coach: chat bubbles fit viewport
- Academy: course cards stack on mobile
- Profile: form fields are full width
- All modals fit within viewport

**7.2 — Add Playwright PWA Project**
```
Modify: playwright.config.ts
```
- Add a `pwa` project with iPhone 15 viewport (393x852)
- Add a `pwa-android` project with Pixel 7 viewport
- Both should NOT block service workers (remove `serviceWorkers: 'block'` for these projects)

**7.3 — Screenshot Generation** (Spec §4)
```
Create: scripts/generate-pwa-screenshots.ts
```
- Use Playwright to take actual screenshots of the running app
- Dashboard wide (1280x720), Dashboard narrow (390x844), Journal narrow, AI Coach narrow
- Save to `public/screenshots/`
- Add script: `"generate:pwa-screenshots": "tsx scripts/generate-pwa-screenshots.ts"`

**7.4 — Lighthouse CI** (Spec §12C)
```
Create: .github/workflows/lighthouse.yml
```
- Runs on PR against mobile emulation
- Uses `treosh/lighthouse-ci-action` or `lhci`
- Fail thresholds: PWA = 100%, Performance >= 85, Accessibility >= 95, Best Practices >= 95
- Upload results as PR comment

**7.5 — Performance Audit**
- Run `pnpm build` and check bundle sizes against Spec §10 budget
- Initial JS < 150KB gzip, route chunks < 50KB avg, CSS < 30KB, SW < 15KB
- If over budget, identify and split large chunks

**7.6 — PWA Changelog**
```
Create: docs/PWA_CHANGELOG.md
```
- Document every change made across all 7 phases
- Format: Phase number, files created, files modified, tests added
- Include before/after Lighthouse scores if available

### Phase 7 Gate Check (Final)

```bash
# Full test suite
pnpm test:unit
pnpm test:e2e
pnpm build

# Verify all PWA files exist
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('public/manifest.json','utf8'));
const missing = manifest.icons.filter(i => !fs.existsSync('public' + i.src));
if (missing.length) { console.error('Missing icons:', missing); process.exit(1); }
manifest.screenshots.filter(s => !fs.existsSync('public' + s.src)).length &&
  console.warn('Missing screenshots (generate after deployment)');
console.log('All manifest assets verified');
"
```

**Commit:** `git commit -m "feat(pwa): phase 7 — testing, CI, verification, changelog"`

---

## Post-Implementation Checklist

After all 7 phases pass their gates:

- [ ] All unit tests pass: `pnpm test:unit`
- [ ] All e2e tests pass: `pnpm test:e2e`
- [ ] Build succeeds: `pnpm build`
- [ ] No TypeScript errors
- [ ] No ESLint errors: `pnpm lint`
- [ ] Every new file has JSDoc header referencing spec section
- [ ] `docs/PWA_CHANGELOG.md` is complete
- [ ] Lighthouse PWA score is 100% (run locally with `npx lighthouse http://localhost:3000/members --view`)
- [ ] All commits follow convention: `feat(pwa): phase N — description`
- [ ] No `#D4AF37` (old gold) anywhere in new code
- [ ] All new components use `glass-card-heavy`, `var(--emerald-elite)`, `var(--champagne)` where appropriate
- [ ] All images use `next/image`
- [ ] All icons use Lucide React
- [ ] All imports use `@/` alias

## File Summary

### New Files (25 total)
| File | Phase | Spec Section |
|------|-------|-------------|
| `scripts/generate-pwa-icons.ts` | 1 | §4 |
| `public/icons/*` (14 files) | 1 | §4 |
| `public/offline.html` | 1 | §5A |
| `hooks/use-is-standalone.ts` | 2 | §11A |
| `hooks/use-pwa-install.ts` | 2 | §6D |
| `components/pwa/install-prompt.tsx` | 2 | §6A |
| `components/pwa/ios-install-guide.tsx` | 2 | §6B |
| `hooks/use-swipe-navigation.ts` | 3 | §7F |
| `components/pwa/pull-to-refresh.tsx` | 3 | §7E |
| `lib/haptics.ts` | 4 | §8B |
| `lib/badge.ts` | 4 | §8C |
| `components/pwa/share-button.tsx` | 4 | §8D |
| `lib/push-notifications.ts` | 4 | §8A |
| `components/pwa/notification-settings.tsx` | 4 | §8A |
| `contexts/NetworkStatusContext.tsx` | 5 | §9A |
| `components/pwa/offline-banner.tsx` | 5 | §9B |
| `scripts/generate-pwa-splashes.ts` | 6 | §4 |
| `public/splash/*` (~16 files) | 6 | §4 |
| `hooks/use-ios-keyboard-fix.ts` | 6 | §11B |
| `e2e/specs/pwa/pwa-installability.spec.ts` | 7 | §12A |
| `e2e/specs/pwa/mobile-nav.spec.ts` | 3,7 | §12A |
| `e2e/specs/pwa/mobile-layouts.spec.ts` | 7 | §12A |
| `e2e/specs/pwa/offline.spec.ts` | 5,7 | §12A |
| `scripts/generate-pwa-screenshots.ts` | 7 | §4 |
| `.github/workflows/lighthouse.yml` | 7 | §12C |
| `docs/PWA_CHANGELOG.md` | 7 | — |

### Modified Files (10 total)
| File | Phases | Changes |
|------|--------|---------|
| `public/manifest.json` | 1 | Complete rewrite |
| `public/sw.js` | 1 | Version, offline fallback, expanded precache, periodic sync |
| `app/layout.tsx` | 1, 6 | Meta tags, iOS splash links |
| `app/globals.css` | 1 | Standalone mode CSS, safe-area utilities |
| `app/members/layout.tsx` | 2, 3, 5 | Install prompt, dynamic padding, network provider |
| `components/members/mobile-top-bar.tsx` | 3 | Safe area, network dot, back button |
| `components/members/mobile-bottom-nav.tsx` | 3 | Badges, keyboard detection |
| `middleware.ts` | 6 | Permissions-Policy header |
| `playwright.config.ts` | 7 | PWA test projects |
| `package.json` | 1 | Scripts, sharp devDependency |

---

*This prompt implements `docs/PWA_SPEC.md` v1.0 using gated spec-driven development. Do not improvise beyond the spec.*
