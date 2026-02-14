# Claude Code / Codex Prompt: PWA Spec-Driven Implementation

> **Usage:** Feed this entire prompt as the task instruction for a Claude Code session or Codex autonomous run with the TradeITM repo checked out. It implements `docs/PWA_SPEC.md` using gated phases with build + test verification between each phase.

---

## System Instructions

You are implementing a production-grade PWA for the TradeITM Next.js application. You MUST follow spec-driven development — every feature you build traces back to `docs/PWA_SPEC.md`. You MUST NOT deviate from the spec, improvise features, or skip phases.

**Before writing ANY code**, read these files in order:
1. `CLAUDE.md` — project coding conventions, design system, forbidden patterns
2. `docs/PWA_SPEC.md` — the authoritative PWA specification (1430 lines, 13 sections)
3. `lib/pwa-utils.ts` — existing standalone/iOS detection utilities (reuse, don't duplicate)
4. `components/pwa/service-worker-register.tsx` — already complete SW lifecycle manager
5. `public/sw.js` — existing service worker (354 lines) with journal sync, push, caching

### Development Methodology: Gated Phases

This implementation is divided into 8 sequential phases. Each phase has:

1. **Implementation** — Write the code specified in the phase
2. **Unit/Integration Tests** — Write tests that verify the code works
3. **Gate Check** — Run the test suite and build. ALL must pass before proceeding
4. **Documentation** — Update inline JSDoc and append to `docs/PWA_CHANGELOG.md`

**CRITICAL RULES:**
- Never start Phase N+1 until Phase N's gate check passes with zero failures
- If a gate check fails, fix the issue — do not skip, delete, or `.skip` tests
- Run `pnpm build` after every phase to catch type errors early
- Run `pnpm test:unit` after every phase
- Run `pnpm test:e2e:mobile` after Phases 3, 4, 6, and 8
- Commit after each successful gate: `git commit -m "feat(pwa): phase N — <description>"`
- Every new file MUST have a JSDoc header comment: purpose, spec section reference, author
- When modifying existing files, read the FULL file first — never edit blind

### Accurate Project State (as of Feb 2026)

```
Stack:           Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase
Package Manager: pnpm 10.29.1 (set via corepack)
Node:            22+
Test Runner:     Vitest (unit — lib/__tests__/**), Playwright (e2e — e2e/specs/**)
Linter:          ESLint
Build:           pnpm build (next build --webpack)
CI:              GitHub Actions (.github/workflows/e2e-tests.yml)
Design System:   "Emerald Standard" — dark mode ONLY
  Primary:       #10B981 (var(--emerald-elite))
  Background:    #0A0A0B (onyx)
  Accent:        #F5EDCC (var(--champagne)) — NOT #D4AF37 (forbidden)
  Cards:         glass-card-heavy utility class
Imports:         @/ alias (tsconfig: "@/*" → "./*")
Icons:           Lucide React ONLY
Images:          next/image ONLY
Fonts:           Playfair Display (headings), Inter (body), Geist Mono (data)
```

### What Already Exists (do NOT reimplement)

These are already complete and production-ready. Read them for context but do not modify:

| File | What it does | Status |
|------|-------------|--------|
| `components/pwa/service-worker-register.tsx` | Full SW lifecycle: update detection, Sonner toast, 60s idle auto-reload, SKIP_WAITING, controllerchange guard | ✅ Complete (105 lines) |
| `lib/web-push-service.ts` | Server-side VAPID push delivery with batch processing, tier targeting, subscription cleanup | ✅ Complete (269 lines) |
| `lib/types/notifications.ts` | TypeScript interfaces for push notifications, broadcasts, targeting | ✅ Complete (95 lines) |
| `app/api/admin/notifications/route.ts` | GET (list history) + POST (create & send broadcast) admin API | ✅ Complete (204 lines) |
| `app/api/admin/notifications/search-users/route.ts` | User search for individual push targeting | ✅ Complete |
| `app/admin/notifications/page.tsx` | Admin notification compose + history UI | ✅ Complete |
| `components/admin/notification-user-search.tsx` | Debounced Discord user picker for notifications | ✅ Complete |
| `lib/pwa-utils.ts` | `isStandaloneMode()`, `isIOS()`, `isIOSStandalone()` — SSR-safe detection | ✅ Complete (38 lines) |
| `push_subscriptions` DB table | Supabase table with RLS | ✅ Migrated |
| `notification_broadcasts` DB table | Supabase table with RLS, indexes | ✅ Migrated |

### What Exists But Needs Changes

| File | Current state | What's missing |
|------|--------------|----------------|
| `public/manifest.json` | Partial: 4 icons (16, 32, 192 combo, 180), no `id`, no `display_override`, `start_url: "/"`, `"purpose": "any maskable"` (invalid combo on single icon) | Full rewrite per Spec §3 |
| `public/sw.js` | Solid: 354 lines, journal sync, push, cache-first/network-first strategies, SKIP_WAITING handler | Missing: `SW_VERSION`, `offline.html` fallback, expanded `STATIC_ASSETS`, periodic sync |
| `app/layout.tsx` | Has: manifest link, appleWebApp meta via Next.js API, ServiceWorkerRegister mounted | Missing: `viewport-fit=cover`, `theme-color` meta, `format-detection`, `msapplication-*`, iOS splash links |
| `app/globals.css` | Has: `pb-safe`, `.scrollbar-hide`, mobile blur reductions, reduced-motion support (1182 lines) | Missing: `@media (display-mode: standalone)` rules, `.safe-top/bottom/left/right`, `.pb-nav`, touch target sizing, nav user-select |
| `app/members/layout.tsx` | Has: auth guards, animated route transitions, MobileTopBar, MemberBottomNav, uses `pb-safe lg:pb-0` on content wrapper, `pb-28` on `<main>` | Missing: `pb-nav` dynamic padding, `will-change` on motion container, InstallPrompt mount, NetworkStatusProvider |
| `components/members/mobile-top-bar.tsx` | Has: sticky header, logo, avatar (46 lines) | Missing: `safe-area-inset-top`, network indicator, back button for sub-pages |
| `components/members/mobile-bottom-nav.tsx` | Has: 4 tabs + More, haptic feedback, spring animations, `fixed bottom-6 left-4 right-4`, pb-safe (236 lines) | Missing: badge prop/rendering, keyboard detection to hide nav, safe-area-aware bottom positioning |
| `hooks/use-focus-trap.ts` | Has: Tab/Shift+Tab focus wrapping, Escape key handling | Missing: body scroll lock — modals/sheets can scroll content behind them |
| `components/ui/dialog.tsx` | Radix Dialog with portal to body, fixed overlay | Missing: body scroll lock on open |
| `components/journal/trade-entry-sheet.tsx` | Portal-based sheet with focus trap | Missing: body scroll lock, scroll position restoration on close |
| `components/journal/entry-detail-sheet.tsx` | Portal-based detail view sheet | Missing: body scroll lock, scroll position restoration on close |
| `app/members/studio/page.tsx` | Desktop-only page, shows mobile warning | Missing: redirect to `/members` on mobile PWA so user doesn't get stuck |
| `playwright.config.ts` | Has: chromium, mobile (iPhone 13), mobile-members (Pixel 7), ai-coach projects, `serviceWorkers: 'block'` | Missing: PWA test project with SW allowed |
| `package.json` | Has: `web-push`, `framer-motion`, full test scripts | Missing: `sharp` devDep, `generate:pwa-*` scripts |

### What Does NOT Exist (contrary to original prompt)

**`middleware.ts` does NOT exist in this project.** The original spec references it for Permissions-Policy headers. Instead, configure security headers via `next.config.ts` `headers()` or a new middleware file if needed. Do not assume it exists — verify with `ls` before attempting to modify.

**`public/icons/` directory does NOT exist.** No icon assets have been generated yet.

**`public/offline.html` does NOT exist.** No offline fallback page exists.

**`public/screenshots/` and `public/splash/` directories do NOT exist.**

---

## Phase 1: Installability Foundation (Spec §3, §4, §5)

### Goal
Make the app pass 100% of Lighthouse PWA audit checks on mobile.

### Pre-flight
```bash
# Verify current state before making changes
ls public/manifest.json public/sw.js public/hero-logo.png
cat public/manifest.json
head -20 public/sw.js
```

### Tasks

**1.1 — Icon Asset Pipeline** (Spec §4)
```
Install:  pnpm add -D sharp @types/sharp
Create:   scripts/generate-pwa-icons.ts
Create:   public/icons/ (14 icon files)
Add:      package.json script "generate:pwa-icons": "tsx scripts/generate-pwa-icons.ts"
```
- Read `public/hero-logo.png` (773KB) as source image
- Generate all sizes: 72, 96, 128, 144, 152, 192, 384, 512 (purpose: `any`)
- Generate maskable variants at 192 and 512: logo centered in 80% safe zone, `#0A0A0B` background fill padding
- Generate monochrome at 192: white silhouette on transparent background
- Generate 3 shortcut icons at 96x96: Lucide icon (BookOpen, Bot, LayoutDashboard) as white on `#047857` rounded-rect. Use SVG string → sharp composite approach
- Run the script: `pnpm generate:pwa-icons`
- Verify all 14 files exist in `public/icons/`

**1.2 — Manifest Overhaul** (Spec §3)
```
Modify: public/manifest.json — COMPLETE REWRITE
```
- Replace the entire file with the manifest JSON from Spec §3 (lines 79-232)
- This adds: `id`, `display_override`, `start_url: "/members?utm_source=pwa"`, full icon array with separated purposes, `screenshots`, `shortcuts`, `share_target`, `protocol_handlers`
- Verify every icon `src` path in the manifest matches a real file in `public/icons/`

**1.3 — Root Layout Meta Tags** (Spec §7A)
```
Modify: app/layout.tsx
```
Read the file first. The current metadata export uses Next.js Metadata API. Add/update:
- Add `viewport` export: `{ width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover' }` — use Next.js `export const viewport` API
- Add `themeColor` in viewport or metadata: `[{ media: '(prefers-color-scheme: dark)', color: '#0A0A0B' }]`
- Add to `other` metadata: `{ 'format-detection': 'telephone=no', 'msapplication-TileColor': '#0A0A0B', 'msapplication-TileImage': '/icons/icon-144x144.png' }`
- Keep all existing metadata (appleWebApp, icons, openGraph, twitter)
- Update icon references to include the new 512px icon

**1.4 — Standalone CSS** (Spec §7B)
```
Modify: app/globals.css — APPEND new section
```
Read the file first (1182 lines). Append the PWA standalone CSS block from Spec §7B at the end:
- `@media all and (display-mode: standalone)` body rules (padding-top safe-area, overscroll-behavior)
- `.safe-top`, `.safe-bottom`, `.safe-left`, `.safe-right` utilities
- `.pb-nav` = `calc(env(safe-area-inset-bottom) + 4.5rem)`
- `nav, .nav-item` user-select/touch-callout prevention
- `.scroll-native` with `-webkit-overflow-scrolling: touch`
- `@media (pointer: coarse)` touch target minimum 44x44px
- Do NOT modify existing `.pb-safe` or `.scrollbar-hide` — they serve different purposes

**1.5 — Offline Fallback Page** (Spec §5A)
```
Create: public/offline.html
```
- Self-contained HTML — NO external CSS/JS/font files
- Inline all styles in `<style>` tag
- Logo as inline SVG (trace from hero-logo.png) or base64 data URI
- Background: `#0A0A0B`
- "You're offline" heading in champagne (`#F5EDCC`)
- "Your queued trades will sync when you reconnect" body text in ivory (`#F5F5F0`)
- Retry button styled with emerald (`#10B981`) background: `onclick="location.reload()"`
- Embed a minimal Inter font subset as base64 woff2, OR use system font stack as fallback
- Keep file under 15KB total

**1.6 — Service Worker Upgrades** (Spec §5A, §5C, §5D, §5E)
```
Modify: public/sw.js
```
Read the full file first (354 lines). Apply these targeted changes:

1. Add `const SW_VERSION = '5.0.0'` as the FIRST line
2. Expand `STATIC_ASSETS` array (currently 6 items) to include:
   ```javascript
   const STATIC_ASSETS = [
     '/',
     '/members',
     '/members/journal',
     '/members/ai-coach',
     '/members/academy/courses',
     '/offline.html',
     '/manifest.json',
     '/favicon.png',
     '/hero-logo.png',
     '/apple-touch-icon.png',
     '/icons/icon-192x192.png',
     '/icons/icon-512x512.png',
   ]
   ```
3. Update the navigation fetch handler — find the existing `request.mode === 'navigate'` block and update its catch to fall back to `caches.match('/offline.html')`:
   ```javascript
   .catch(() => caches.match(request)
     .then((cached) => cached || caches.match('/offline.html'))
   )
   ```
4. Add periodic sync handler before the existing message listener:
   ```javascript
   self.addEventListener('periodicsync', (event) => {
     if (event.tag === 'dashboard-refresh') {
       event.waitUntil(
         fetch('/api/members/dashboard')
           .then(response => {
             if (response.ok) {
               return caches.open(API_CACHE_NAME)
                 .then(cache => cache.put('/api/members/dashboard', response))
             }
           })
           .catch(() => {/* silent fail */})
       )
     }
   })
   ```
5. Add version logging in the activate handler: `console.log('[SW] Activated version ${SW_VERSION}')`

### Phase 1 Gate Check

```bash
# 1. Icons generated
ls -la public/icons/ | wc -l  # Should be 14+ files

# 2. Manifest valid
node -e "
const m = JSON.parse(require('fs').readFileSync('public/manifest.json','utf8'));
const checks = [
  ['id', !!m.id],
  ['display_override', Array.isArray(m.display_override)],
  ['512px icon', m.icons.some(i => i.sizes === '512x512')],
  ['maskable icon', m.icons.some(i => i.purpose === 'maskable')],
  ['screenshots', m.screenshots?.length >= 1],
  ['shortcuts', m.shortcuts?.length >= 3],
  ['share_target', !!m.share_target],
];
const fails = checks.filter(([,v]) => !v);
if (fails.length) { console.error('FAIL:', fails.map(([n]) => n)); process.exit(1); }
console.log('Manifest OK');
"

# 3. Offline page exists
test -f public/offline.html && echo "offline.html OK" || echo "FAIL: offline.html missing"

# 4. Build succeeds
pnpm build

# 5. Unit tests pass
pnpm test:unit
```

**Phase 1 Test File:** `lib/__tests__/pwa/phase1-installability.test.ts`

Write a Vitest test file that verifies:
- `manifest.json` is valid JSON with required fields: `id`, `name`, `start_url`, `display`, `display_override`
- Manifest has at least one icon at 512x512
- Manifest has at least one icon with `purpose: "maskable"`
- Manifest has no icon with `purpose: "any maskable"` (the invalid combo)
- Manifest has `screenshots` array with at least 1 narrow entry
- Manifest has `shortcuts` array with 3+ entries
- Manifest has `share_target` object
- All icon `src` paths in manifest resolve to existing files (`fs.existsSync('public' + icon.src)`)
- `offline.html` exists and contains "offline" text and a retry mechanism
- `sw.js` contains `SW_VERSION` string
- `sw.js` contains `offline.html` in its STATIC_ASSETS

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
- Import and wrap the existing `lib/pwa-utils.ts` functions as a React hook
- Uses `isStandaloneMode()` from `@/lib/pwa-utils` + adds `matchMedia` listener for live updates
- Also checks URL params for `utm_source=pwa` (from manifest start_url)
- Returns `boolean`
- SSR-safe: returns `false` during SSR
- DO NOT duplicate the detection logic — import from `lib/pwa-utils.ts`

**2.2 — PWA Install Hook** (Spec §6D)
```
Create: hooks/use-pwa-install.ts
```
- Capture `beforeinstallprompt` event, store in ref
- Track state: `{ isInstallable, isStandalone, promptOutcome, showPrompt() }`
- `showPrompt()` calls `deferredPrompt.prompt()` and reads `userChoice`
- Listen for `appinstalled` event → mark as installed
- Write install analytics via `fetch('/api/analytics/event', { method: 'POST', body: JSON.stringify({ event_type: 'pwa_install' }) })` — if the endpoint doesn't exist, create a simple one or log to console
- Persist in `localStorage`:
  - `tradeitm-a2hs-dismissed`: timestamp — suppress for 14 days
  - `tradeitm-a2hs-installed`: boolean — suppress permanently
- Uses `useIsStandalone()` hook for standalone detection

**2.3 — Install Prompt Bottom Sheet** (Spec §6A)
```
Create: components/pwa/install-prompt.tsx
```
- `'use client'` component using `framer-motion` (already in deps)
- Bottom sheet layout per ASCII diagram in Spec §6A
- Animation sequence:
  1. Backdrop: `bg-black/60` fade in 300ms
  2. Sheet: `y: "100%"` → `y: 0` with spring `{ stiffness: 300, damping: 30 }`
  3. Logo: scale 0.5 → 1.0 with bounce, 150ms delay
  4. Text elements: fade + slide up, staggered 50ms each
  5. CTA button: pulse glow after 500ms delay
  6. Dismiss: slide down + fade out, 200ms
- Display condition: (on `/members` for 30s OR 3+ page visits) AND not dismissed AND not standalone AND installable
- CTA uses `glass-card-heavy rounded-t-2xl` container
- Feature bullets: "Works offline", "Push notifications", "Instant launch"
- Logo: `<Image src="/logo.png" .../>` (next/image)
- "Maybe Later" text button → dismiss with 14-day suppression
- "Add to Home Screen" button → calls `showPrompt()` from hook

**2.4 — iOS Install Guide** (Spec §6B)
```
Create: components/pwa/ios-install-guide.tsx
```
- Detect iOS using `isIOS()` from `@/lib/pwa-utils`
- Show only when: iOS AND not standalone AND not dismissed
- Bottom sheet with 3-step instructions per Spec §6B
- Animated bouncing arrow (framer-motion `{ y: [0, -8, 0] }` repeat: Infinity) pointing to Safari share button
- iPhone: arrow at bottom center. iPad: arrow at top right
- "Got it" dismiss button with same localStorage suppression

**2.5 — Mount Install Components**
```
Modify: app/members/layout.tsx
```
Read the full file first (174 lines). Add after `<MemberBottomNav />`:
```tsx
<InstallPrompt />
```
Import at top: `import { InstallPrompt } from '@/components/pwa/install-prompt'`
The component handles its own mobile detection and show/hide logic internally.

### Phase 2 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 2 Test File:** `lib/__tests__/pwa/phase2-install-prompt.test.ts`

Write tests that verify:
- `useIsStandalone` returns `false` in JSDOM (non-standalone)
- `usePwaInstall` initial state: `isInstallable: false`, `isStandalone: false`
- localStorage dismissal logic: dismissed within 14 days → returns suppressed
- localStorage dismissal logic: dismissed > 14 days ago → not suppressed
- localStorage installed flag → always suppressed
- Install prompt component renders null when `isInstallable` is false

**Commit:** `git commit -m "feat(pwa): phase 2 — A2HS install prompt with iOS guide"`

---

## Phase 3: Mobile Navigation Polish (Spec §7)

### Goal
Every navigation element handles safe areas, keyboards, and standalone mode correctly.

### Tasks

**3.1 — Mobile Top Bar Updates** (Spec §7C)
```
Modify: components/members/mobile-top-bar.tsx (currently 46 lines)
```
Read full file first. Changes:
- Add `pt-[env(safe-area-inset-top)]` to the header element class
- Change `h-14` to `min-h-[3.5rem]` so it grows with safe area
- Add network status dot: small `<span>` with `w-2 h-2 rounded-full` next to logo — `bg-emerald-400` when `navigator.onLine`, `bg-amber-400` when offline. Add `online`/`offline` event listeners in a `useEffect`.
- Add back button: use `usePathname()` to check segment depth. When `pathname.split('/').length > 3` (deeper than `/members/something`), show `<ChevronLeft>` icon button in the left slot that calls `router.back()`. Import `ChevronLeft` from `lucide-react`, `usePathname` and `useRouter` from `next/navigation`.

**3.2 — Mobile Bottom Nav Updates** (Spec §7D)
```
Modify: components/members/mobile-bottom-nav.tsx (currently 236 lines)
```
Read full file first. Changes:
- Add `badge?: number` to the tab type/interface
- Add badge rendering: when `badge > 0`, show absolute-positioned red dot:
  ```tsx
  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
    {badge > 9 ? '9+' : badge}
  </span>
  ```
- Add keyboard detection hook: `window.visualViewport` resize listener, set `keyboardOpen` when height diff > 150px. Return `null` when keyboard is open to hide bottom nav entirely.

**3.3 — Members Layout Updates** (Spec §7E)
```
Modify: app/members/layout.tsx (currently 174 lines)
```
Read full file. Changes:
- Line 153: Change `pb-28` to `pb-nav` in the `<main>` className (keep `lg:pb-8`)
- Add `style={{ willChange: 'transform, opacity' }}` to the `<motion.div>` at line 155 for smoother mobile transitions

**3.4 — Swipe Navigation** (Spec §7F)
```
Create: hooks/use-swipe-navigation.ts
```
- Detects right-swipe from left 20px edge zone via touch events
- Threshold: 80px horizontal before triggering
- Calls `router.back()` on successful swipe
- Visual: optional emerald gradient overlay div from left edge during active swipe
- Only active when `isStandaloneMode()` returns true AND `useIsMobile()` returns true
- Import `isStandaloneMode` from `@/lib/pwa-utils`
- Attach to `document` in a `useEffect`, clean up on unmount

**3.5 — Pull-to-Refresh** (Spec §7E.2)
```
Create: components/pwa/pull-to-refresh.tsx
```
- Client component wrapping children
- Touch-based: detects pull-down when `scrollTop === 0`
- Custom indicator: pulsing emerald circle (not browser default)
- Triggers `router.refresh()` on release past 60px threshold
- Only renders in standalone mode on mobile (`isStandaloneMode()` + `useIsMobile()`)
- Debounce to prevent double-trigger
- Mount in `app/members/layout.tsx` wrapping the `<main>` content

**3.6 — Toast System Mobile Positioning**
```
Modify: components/ui/app-toaster.tsx
```
Read the file first. The Sonner `<Toaster>` is currently positioned at `top-right` which is hidden under the mobile top bar. Changes:
- Change `position` to `bottom-center` on mobile, keep `top-right` on desktop. Use the `position` prop dynamically or set `position="bottom-center"` with `className="lg:!top-4 lg:!right-4 lg:!bottom-auto lg:!left-auto"` override
- Add `style={{ bottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}` so toasts appear above the bottom nav
- Set `visibleToasts={3}` to prevent toast stacking overflow
- Set error toast duration to `7000` (default 4000 is too fast for error messages)
- Toasts are barely used in the app — search for existing `toast(` calls to audit. Key places that NEED toast feedback but don't have it:
  - Journal trade save success → add `toast.success('Trade saved')`
  - Journal trade save error → add `toast.error('Failed to save trade')`
  - Profile settings save → add `toast.success('Settings updated')`
  - AI Coach error responses → add `toast.error('Something went wrong')`

Note: Adding toast calls to these locations is part of this task. Read each file before modifying.

**3.7 — Touch Target Minimum Sizing**
```
Modify: components/members/mobile-bottom-nav.tsx
Modify: app/globals.css
```
Read files first. Several interactive elements are below the WCAG 44x44px minimum:
- Bottom nav tab buttons: currently use `py-1.5 px-2.5` (~36px height). Change to `py-3 px-3` to ensure ≥44px tap height
- More menu items: currently `px-2.5 py-2` (~32px height). Change to `px-3 py-2.5` for ≥44px height
- In `globals.css`, verify the `@media (pointer: coarse)` touch target rules from Phase 1 Task 1.4 include:
  ```css
  @media (pointer: coarse) {
    button, a, [role="button"], input, select, textarea {
      min-height: 44px;
      min-width: 44px;
    }
  }
  ```

**3.8 — Animation Performance Optimization**
```
Modify: components/members/mobile-bottom-nav.tsx
Modify: app/members/layout.tsx
Modify: app/members/ai-coach/page.tsx (if applicable)
```
Read each file first. The current animations create performance issues on mobile:
- Bottom nav uses `framer-motion` spring animations on every tab switch. Add `@media (prefers-reduced-motion: reduce)` handling: wrap the motion values in a check using `useReducedMotion()` from framer-motion, falling back to instant transitions
- In `members/layout.tsx`, the route transition `contentVariants` already handles `prefersReducedMotion` (good). However, the `filter: 'blur(4px)'` in desktop variants and `filter: 'blur(2px)'` in mobile variants are GPU-expensive on low-end devices. Consider removing blur from mobile variants entirely — use opacity + translateX only:
  ```tsx
  // Mobile variants (isMobile = true): remove blur, keep slide
  initial: { opacity: 0.85, x: 28, scale: 1 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -18, scale: 1 },
  ```
- In AI Coach, search for any infinitely looping animations (e.g., `EmptyState` pulsing animation). If found, ensure they use `will-change: transform` and have a `prefers-reduced-motion` fallback that stops the loop

### Phase 3 Gate Check

```bash
pnpm build
pnpm test:unit
pnpm test:e2e:mobile
```

**Phase 3 Test File:** `lib/__tests__/pwa/phase3-mobile-nav.test.ts`

Write tests:
- `useSwipeNavigation` is no-op when standalone mode is false (mock `isStandaloneMode` to return false)
- Swipe threshold validation: swipe < 80px should not trigger
- Keyboard detection: height diff > 150 → keyboardOpen = true
- Keyboard detection: height diff < 150 → keyboardOpen = false
- Bottom nav tab buttons have minimum 44px logical height (measure rendered padding)
- More menu items have minimum 44px logical height

**Phase 3 E2E Test:** `e2e/specs/pwa/mobile-nav.spec.ts`

Viewport: 390x844 (iPhone 15):
- Bottom nav renders all visible tab items
- Active tab indicator shows on current route
- Tab navigation works between primary tabs
- No horizontal overflow on `/members` page
- No horizontal overflow on `/members/journal` page

**Commit:** `git commit -m "feat(pwa): phase 3 — mobile nav polish (safe area, keyboard, swipe, pull-to-refresh, toast, touch targets, animation perf)"`

---

## Phase 4: Scroll Containment & Native-Feel Layout (Spec §7, §11)

### Goal
Eliminate all scroll-through, rubber-band, and layout-overlap issues so the PWA feels like a native app — not a website in a wrapper.

### Context (Critical)
The app currently has these scroll/layout problems in standalone PWA mode:
- **Body scrolls behind modals/sheets.** All overlay components (`TradeEntrySheet`, `EntryDetailSheet`, AI Coach `MobileToolSheet`, Radix `Dialog`) portal to `document.body` but never lock body scroll. Users can scroll the page behind every overlay.
- **No overscroll containment.** iOS rubber-band bounce at top/bottom of page triggers pull-to-refresh or reveals the URL bar in minimal-ui. Scroll can chain from inner containers to the body.
- **Bottom nav positioning fragility.** Uses `fixed bottom-6` with flat `pb-safe`, but on newer notched iPhones the margin and safe-area can conflict.
- **No scroll position restoration.** When user opens a sheet → content behind scrolls → sheet closes → scroll position is lost.
- **Studio page traps mobile PWA users.** `/members/studio` shows a desktop-only warning but has no way to navigate back in standalone mode (no browser back button).

### Tasks

**4.1 — Body Scroll Lock Utility**
```
Create: lib/use-scroll-lock.ts
```
- Custom hook: `useScrollLock(isLocked: boolean)`
- When locked:
  - Save `document.body.style.overflow` and `document.body.style.position` and `window.scrollY`
  - Set `document.body.style.overflow = 'hidden'`
  - Set `document.body.style.position = 'fixed'` (prevents iOS Safari scroll-through)
  - Set `document.body.style.top = `-${scrollY}px`` (maintains visual position)
  - Set `document.body.style.width = '100%'` (prevents layout shift from scrollbar removal)
- When unlocked:
  - Restore all saved values
  - Call `window.scrollTo(0, savedScrollY)` to restore scroll position
- Handle edge case: multiple overlays open simultaneously (use a ref counter)

**4.2 — Apply Scroll Lock to All Overlays**
```
Modify: hooks/use-focus-trap.ts
Modify: components/ui/dialog.tsx
Modify: components/journal/trade-entry-sheet.tsx
Modify: components/journal/entry-detail-sheet.tsx
```
Read each file fully before modifying. For each:
- Import `useScrollLock` from `@/lib/use-scroll-lock`
- Call `useScrollLock(isOpen)` where `isOpen` is the overlay's open state
- For `use-focus-trap.ts`: add scroll lock as part of the trap activation/deactivation
- For Radix Dialog: apply in `DialogContent` via a wrapper `useEffect` keyed on the open state
- For journal sheets: apply where the portal is conditionally rendered

Also find and modify the AI Coach `MobileToolSheet`:
- Search: `grep -r "MobileToolSheet" app/members/ai-coach/`
- Read the component, add `useScrollLock(isSheetOpen)`

**4.3 — Overscroll Containment CSS**
```
Modify: app/globals.css
```
Add these rules to the standalone mode section (created in Phase 1):
```css
/* Prevent ALL overscroll effects in standalone PWA */
@media all and (display-mode: standalone) {
  html {
    overflow: hidden;
    height: 100%;
  }

  body {
    overflow-y: auto;
    height: 100%;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
  }
}

/* Scroll containment for nested scrollable areas */
.scroll-contain {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* Chat containers, modal content, scrollable panels */
[data-scroll-container] {
  overscroll-behavior: contain;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

**4.4 — Fix Bottom Nav Safe Area Positioning**
```
Modify: components/members/mobile-bottom-nav.tsx
```
Read full file first. Change the bottom positioning from `fixed bottom-6` to use CSS `max()` for safe-area-aware positioning:
```tsx
// Change the container className from:
//   fixed bottom-6 left-4 right-4
// To:
//   fixed left-4 right-4
// And add inline style:
style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
```
This ensures the nav sits above the home indicator on notched iPhones while maintaining the 24px offset on non-notched devices.

**4.5 — Apply Scroll Containment to Key Containers**
```
Modify: AI Coach chat messages container
Modify: Academy course list / lesson content
Modify: Journal entries list
```
For each scrollable content area, add `data-scroll-container` attribute or `scroll-contain` class to prevent scroll chaining to the body. Find these by searching for `overflow-y-auto` or `overflow-y-scroll` classes:
```bash
grep -rn "overflow-y-auto\|overflow-y-scroll\|overflow-auto" components/ app/members/ --include="*.tsx"
```

**4.6 — Studio Page Mobile Redirect**
```
Modify: app/members/studio/page.tsx
```
Read the file first. Currently shows a "desktop only" message on mobile. In standalone PWA mode, users have no browser back button. Add:
```tsx
// At the top of the component:
const router = useRouter()
const isMobile = useIsMobile()

useEffect(() => {
  if (isMobile) {
    router.replace('/members')
  }
}, [isMobile, router])
```
This redirects mobile PWA users to the dashboard instead of stranding them.

**4.7 — Members Layout Scroll Structure**
```
Modify: app/members/layout.tsx
```
Read the file first. The current structure allows the entire page to scroll as one unit. For PWA, the layout should use a contained scroll approach:
- The outer wrapper should be `h-[100dvh]` (dynamic viewport height) in standalone mode
- The main content area should be the only scrollable region
- Add `overscroll-behavior: contain` to the main scroll area

Update the content wrapper div:
```tsx
<div className={cn(
  'min-h-screen relative overflow-hidden pb-safe lg:pb-0',
  'lg:pl-[280px]',
  // In standalone mode, use fixed height with contained scroll
  'standalone:h-[100dvh] standalone:min-h-0',
)}>
```
And add a CSS utility for standalone detection:
```css
@media all and (display-mode: standalone) {
  .standalone\:h-\[100dvh\] { height: 100dvh; }
  .standalone\:min-h-0 { min-height: 0; }
}
```
The `<main>` element becomes the scroll container with `overflow-y: auto overscroll-behavior-y: contain`.

**4.8 — Safe Area Double-Padding Fix**
```
Modify: app/members/layout.tsx
Modify: components/members/mobile-bottom-nav.tsx
```
Read both files first. There is currently a double-padding issue:
- The content wrapper div has `pb-safe lg:pb-0` AND `<main>` has `pb-28 lg:pb-8`
- The bottom nav also accounts for safe area via its own positioning
- This creates excessive bottom whitespace on notched iPhones

Fix: Remove `pb-safe` from the content wrapper div. The `pb-28` on `<main>` (which becomes `pb-nav` in Phase 3 Task 3.3) is the single source of truth for bottom padding. The bottom nav's own safe-area-aware positioning (from Task 4.4) handles its own inset. There should be only ONE layer of safe-area compensation, not two.

**4.9 — AI Coach Height Calculation Fix**
```
Modify: app/members/ai-coach/page.tsx
```
Read the file first. The mobile chat container uses `h-[calc(100dvh-10.5rem)]` which doesn't account for the bottom nav height correctly. The `10.5rem` is a hardcoded guess. Fix:
- Replace with `h-[calc(100dvh-var(--mobile-chrome))]` where `--mobile-chrome` is a CSS custom property set in the layout or globals:
  ```css
  :root {
    --mobile-chrome: calc(3.5rem + env(safe-area-inset-top) + 4.5rem + env(safe-area-inset-bottom));
    /* top bar height + safe-area-top + bottom nav height + safe-area-bottom */
  }
  ```
- Or use the simpler approach: wrap the AI Coach content area in a flex container that fills the remaining space: `flex-1 min-h-0 overflow-y-auto` inside a `flex flex-col h-[100dvh]` parent
- Ensure the chat input area at the bottom doesn't overlap with the bottom nav
- Test: the chat messages should fill exactly the visible space between top bar and bottom nav

**4.10 — Entry Detail Sheet Safe-Area Height**
```
Modify: components/journal/entry-detail-sheet.tsx
```
Read the file first. The sheet uses `h-[92vh]` which doesn't account for safe areas on notched devices. The sheet content can be obscured by the home indicator.
- Change `h-[92vh]` to `h-[calc(100dvh-env(safe-area-inset-top)-2rem)]` to use dynamic viewport height minus the top safe area and a small top margin
- Ensure the sheet's internal scroll container has `overscroll-behavior: contain` (from Task 4.5)

**4.11 — Textarea Keyboard Interaction**
```
Modify: app/members/ai-coach/page.tsx (chat input)
Modify: components/journal/trade-entry-sheet.tsx (notes textarea)
```
Read each file. When the mobile keyboard opens, `textarea` elements with `max-height` constraints can cause layout jumps:
- For the AI Coach chat input: verify `max-h-[120px]` works correctly with the keyboard. If the keyboard pushes the input up, the max-height may need adjustment. Use `window.visualViewport.height` to dynamically compute available space
- For journal trade notes: ensure the textarea doesn't resize/jump when focused. Add `resize-none` class if not present, and wrap in a container with stable height

### Phase 4 Gate Check

```bash
pnpm build
pnpm test:unit
pnpm test:e2e:mobile
```

**Phase 4 Test File:** `lib/__tests__/pwa/phase4-scroll-containment.test.ts`

Write tests:
- `useScrollLock(true)` sets `document.body.style.overflow` to `'hidden'`
- `useScrollLock(false)` restores `document.body.style.overflow` to original value
- `useScrollLock` restores scroll position on unlock
- Multiple simultaneous locks don't interfere (ref counter)

**Phase 4 E2E Test:** `e2e/specs/pwa/scroll-containment.spec.ts`

Viewport: 390x844:
- Open journal trade entry sheet → body should not scroll behind it
- Open AI Coach tool sheet → body should not scroll behind it
- Scroll to bottom of dashboard → no rubber-band past content
- Navigate to `/members/studio` on mobile → redirects to `/members`
- AI Coach chat area fills space between top bar and bottom nav without overlap
- Entry detail sheet content is not obscured by device home indicator

**Commit:** `git commit -m "feat(pwa): phase 4 — scroll containment & native-feel layout (scroll lock, overscroll, safe areas, height fixes)"`

---

## Phase 5: Native Features (Spec §8)

### Goal
Integrate platform APIs: haptics, badges, share, wake lock, push subscription UI.

### Tasks

**5.1 — Haptics Utility** (Spec §8B)
```
Create: lib/haptics.ts
```
```typescript
export const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(25),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 50, 20]),
  error: () => navigator.vibrate?.([50, 30, 50]),
  selection: () => navigator.vibrate?.(5),
}
```
Then apply across the app (read each file before modifying):
- Form submission buttons → `haptics.medium`
- Journal entry save success → `haptics.success`
- Form validation errors → `haptics.error`
- Dropdown/picker selections → `haptics.selection`
- Leave existing `navigator.vibrate(10)` in bottom nav as-is (it's already `haptics.light`)

**5.2 — Badge API** (Spec §8C)
```
Create: lib/badge.ts
```
- `setAppBadge(count)` — feature-detect `navigator.setAppBadge`/`clearAppBadge`
- No-op when unavailable
- In `sw.js` push handler: call `setAppBadge` after showing notification
- On app focus (in service-worker-register or layout): call `clearAppBadge`

**5.3 — Share Button** (Spec §8D)
```
Create: components/pwa/share-button.tsx
```
- Uses `navigator.share({ title, text, url })` when available
- Fallback: `navigator.clipboard.writeText(url)` with Sonner toast "Link copied"
- Props: `{ title: string, text: string, url: string, className?: string }`
- Renders `Share2` icon from lucide-react
- Integrate into journal entry detail view and AI Coach insight cards (read those files first to find appropriate mount points)

**5.4 — Wake Lock** (Spec §8E)
```
Modify: AI Coach page component (find with: grep -r "ai-coach" app/members/)
```
Read the file first. Add a `useEffect` that:
- Requests `navigator.wakeLock.request('screen')` when component mounts
- Re-acquires on `visibilitychange` event (iOS releases on tab switch)
- Releases on unmount
- Feature-detect: wrap in `if ('wakeLock' in navigator)` check

**5.5 — Push Notification Client** (Spec §8A)
```
Create: lib/push-notifications.ts
```
- `subscribeToPush()`: request `Notification.permission`, call `pushManager.subscribe()` with VAPID public key from `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`, POST subscription to `/api/push/subscribe`
- `unsubscribeFromPush()`: call `subscription.unsubscribe()`, DELETE from Supabase
- `isPushSupported()`: check `'PushManager' in window && 'serviceWorker' in navigator`
- `isPushGranted()`: check `Notification.permission === 'granted'`

```
Create: components/pwa/notification-settings.tsx
```
- Toggle switch for push notifications (use Radix Switch from existing shadcn components)
- Shows permission state: "Enabled", "Disabled", "Blocked by browser"
- Handles full permission flow: request → subscribe → save
- Mount on the `/members/profile` page (find and read the profile page first)

```
Create: app/api/push/subscribe/route.ts
```
- POST: save subscription to `push_subscriptions` table (user_id from session, endpoint + keys from body)
- DELETE: remove subscription by endpoint

### Phase 5 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 5 Test File:** `lib/__tests__/pwa/phase5-native-features.test.ts`

Write tests:
- `haptics.light` calls `navigator.vibrate` with `10`
- `haptics.success` calls `navigator.vibrate` with `[10, 50, 20]`
- `haptics` functions are no-op when `navigator.vibrate` is undefined
- `setAppBadge(5)` calls `navigator.setAppBadge(5)` when available
- `setAppBadge(0)` calls `navigator.clearAppBadge()` when available
- `setAppBadge` is no-op when Badge API unavailable
- `isPushSupported()` returns false when `PushManager` missing from window

**Commit:** `git commit -m "feat(pwa): phase 5 — native features (haptics, badge, share, wake lock, push client)"`

---

## Phase 6: Offline & Connectivity (Spec §9)

### Goal
Users know when they're offline, see cached data, and trust their changes will sync.

### Tasks

**6.1 — Network Status Context** (Spec §9A)
```
Create: contexts/NetworkStatusContext.tsx
```
- `'use client'` context provider
- State: `{ isOnline: boolean, wasOffline: boolean, effectiveType: string | null }`
- Uses `navigator.onLine` + `online`/`offline` window events
- Reads `(navigator as any).connection?.effectiveType` where available
- Exports `NetworkStatusProvider` and `useNetworkStatus()` hook
- SSR-safe: defaults to `isOnline: true`

**6.2 — Offline Banner** (Spec §9B)
```
Create: components/pwa/offline-banner.tsx
```
- Fixed banner positioned below mobile top bar
- Offline: amber background (`bg-amber-900/90 backdrop-blur`), text: "You're offline — changes will sync when you reconnect"
- Recovery: emerald background (`bg-emerald-900/90`), text: "Back online — syncing..." — auto-dismiss after 3s
- Animate in/out with framer-motion `slideY`
- Consumes `useNetworkStatus()` context

**6.3 — Mount Network Provider & Banner**
```
Modify: app/members/layout.tsx
```
- Import `NetworkStatusProvider` from `@/contexts/NetworkStatusContext`
- Wrap the entire return of `MembersLayoutContent` with `<NetworkStatusProvider>`
- Import and render `<OfflineBanner />` after `<MobileTopBar />` and before the main content div

**6.4 — Journal Sync Indicator** (Spec §9D)
```
Create: components/pwa/journal-sync-indicator.tsx
```
- Reads IndexedDB journal mutation store (`tradeitm-offline-journal` / `mutations`) for queue count
- States: "N changes pending sync" (amber), "Syncing..." (emerald pulse), "All changes saved" (emerald check, auto-dismiss 2s)
- Mount on the journal page (find with `ls app/members/journal/`)

**6.5 — Error Boundaries for Key Routes**
```
Create: app/members/journal/error.tsx
Create: app/members/academy/courses/[slug]/error.tsx
Create: app/members/academy/learn/[id]/error.tsx
Create: app/members/profile/error.tsx
Create: app/members/ai-coach/error.tsx
```
Next.js App Router uses `error.tsx` files as route-level error boundaries. Most member routes currently have no error boundary — an unhandled error crashes the entire page with no recovery path (especially bad in PWA standalone mode where the user can't refresh via browser UI).

Each error boundary should:
- Be a `'use client'` component with `{ error, reset }` props
- Display an Emerald Standard-styled error card: `glass-card-heavy` container, `AlertCircle` icon (lucide-react), error message, "Try Again" button calling `reset()`, "Go Home" link to `/members`
- Log the error: `console.error('[Route] Error:', error)`
- Match the dark background: `bg-[#0A0A0B]`
- Example structure:
  ```tsx
  'use client'
  import { AlertCircle, RefreshCw, Home } from 'lucide-react'
  import Link from 'next/link'

  export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="glass-card-heavy p-6 max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-semibold text-ivory">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{error.message || 'An unexpected error occurred'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="...emerald button styles...">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </button>
            <Link href="/members" className="...ghost button styles...">
              <Home className="w-4 h-4 mr-2" /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }
  ```

**6.6 — Loading State Timeouts**
```
Modify: app/members/journal/loading.tsx (if exists, else create)
Modify: app/members/ai-coach/loading.tsx (if exists)
Modify: app/members/academy/courses/loading.tsx (if exists)
```
Check if `loading.tsx` files exist for the main routes (`ls app/members/*/loading.tsx`). For any that exist:
- Add an 8-second timeout after which the skeleton loader transitions to a subtle "Taking longer than expected..." message with a retry link
- Use `useState` + `useEffect` with `setTimeout(8000)` to track the timeout
- Don't remove the skeleton — overlay the message on top
- For routes that don't have loading files, this is lower priority — the error boundaries from 6.5 will catch failures

### Phase 6 Gate Check

```bash
pnpm build
pnpm test:unit
pnpm test:e2e:mobile
```

**Phase 6 Test File:** `lib/__tests__/pwa/phase6-offline.test.ts`

Write tests:
- `NetworkStatusContext` defaults to `isOnline: true`
- Dispatching `offline` event sets `isOnline: false`
- Dispatching `online` event after offline sets `wasOffline: true`
- `OfflineBanner` renders offline message when `isOnline: false`
- `OfflineBanner` renders nothing when online and `wasOffline: false`

**Phase 6 E2E Test:** `e2e/specs/pwa/offline.spec.ts`

- Navigate to `/members`, then `page.context().setOffline(true)` → verify offline banner appears
- Set back online → verify banner disappears
- While offline, navigate to uncached route → verify offline fallback page loads
- Error boundary: navigate to a route, inject JS error → verify error boundary renders with "Try Again" button
- Error boundary "Try Again" button calls `reset()` and re-renders the route

**Commit:** `git commit -m "feat(pwa): phase 6 — offline UX (network context, banner, sync indicators, error boundaries, loading timeouts)"`

---

## Phase 7: iOS Hardening (Spec §11)

### Goal
iOS standalone mode works without quirks — splash screens, keyboard, navigation.

### Tasks

**7.1 — iOS Splash Screen Generation** (Spec §4)
```
Create: scripts/generate-pwa-splashes.ts
Create: public/splash/ directory (~16 files)
Add:    package.json script "generate:pwa-splashes": "tsx scripts/generate-pwa-splashes.ts"
```
- Generate splash screens for all 16 device resolutions listed in Spec §4 table
- Each: `#0A0A0B` background, centered TradeITM logo at ~25% viewport width
- Subtle emerald glow: `radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 60%)` — composite with sharp
- Run: `pnpm generate:pwa-splashes`

**7.2 — Splash Screen Meta Tags**
```
Modify: app/layout.tsx
```
- Add `<link rel="apple-touch-startup-image">` tags in the `<head>` for each device resolution
- Use `media` attribute queries per the format in Spec §4 (e.g., `(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)`)
- Since this is a Server Component, add the links directly in the `<head>` JSX

**7.3 — iOS Keyboard Handling** (Spec §11B)
```
Create: hooks/use-ios-keyboard-fix.ts
```
- When `isIOSStandalone()` returns true (import from `@/lib/pwa-utils`):
- Listen for `focus` events on `input, textarea` elements
- After 300ms delay, call `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Apply by importing in AI Coach chat component and Journal entry form

**7.4 — iOS Session Persistence** (Spec §11E)
```
Verify: contexts/MemberAuthContext.tsx
```
- Read the file. Verify that on mount, auth state is checked immediately
- Verify expired sessions redirect to `/login`
- Verify the pulsing logo loader displays during rehydration
- If any of these are missing, add them. If all present, document as verified in PWA_CHANGELOG.md

**7.5 — Security Headers**
```
Check: Does next.config.ts or next.config.js have a headers() function?
```
- If yes, add `Permissions-Policy: push=(self)` to the headers
- If no, create one or add the header via the appropriate config mechanism
- Also verify CSP (from `x-nonce` in layout) allows `worker-src 'self'` for service worker

### Phase 7 Gate Check

```bash
pnpm build
pnpm test:unit
```

**Phase 7 Test File:** `lib/__tests__/pwa/phase7-ios.test.ts`

Write tests:
- All expected splash screen files exist on disk
- `useIosKeyboardFix` is no-op when `isIOSStandalone()` returns false (mock the import)
- Layout.tsx contains `apple-touch-startup-image` link tags (read file with fs and check string)

**Commit:** `git commit -m "feat(pwa): phase 7 — iOS hardening (splashes, keyboard, session persistence)"`

---

## Phase 8: Testing, Verification & CI (Spec §10, §12)

### Goal
Full test coverage, Lighthouse CI, performance verification. The final quality gate.

### Tasks

**8.1 — Comprehensive PWA E2E Test** (Spec §12A)
```
Create: e2e/specs/pwa/pwa-installability.spec.ts
```
- Service worker registers (check `navigator.serviceWorker.controller`)
- Manifest accessible at `/manifest.json` (status 200, valid JSON)
- All icon URLs in manifest return 200
- Theme color meta matches manifest `theme_color`
- Start URL loads successfully

**8.2 — Mobile Layout Verification** (Spec §12A)
```
Create: e2e/specs/pwa/mobile-layouts.spec.ts
```
Test at viewports 320px, 375px, 390px, 430px:
- Dashboard: `scrollWidth <= clientWidth` (no horizontal overflow)
- Journal: entries stack vertically
- AI Coach: chat bubbles within viewport
- Academy: course cards stack on mobile
- All touch targets ≥ 44px height

**8.3 — Add Playwright PWA Projects**
```
Modify: playwright.config.ts
```
Read first. Add two new projects:
- `pwa-ios`: iPhone 15 viewport (393x852), do NOT include `serviceWorkers: 'block'`
- `pwa-android`: Pixel 7 viewport, do NOT include `serviceWorkers: 'block'`
- Point test directory to `e2e/specs/pwa/**`
- Add script to package.json: `"test:e2e:pwa": "playwright test --project=pwa-ios --project=pwa-android"`

**8.4 — Screenshot Generation** (Spec §4)
```
Create: scripts/generate-pwa-screenshots.ts
Add:    package.json script "generate:pwa-screenshots": "tsx scripts/generate-pwa-screenshots.ts"
```
- Use Playwright to capture running app screenshots
- Dashboard wide (1280x720), Dashboard narrow (390x844), Journal narrow, AI Coach narrow
- Save to `public/screenshots/`
- Note: this requires a running dev server, so document the usage in the script header

**8.5 — Lighthouse CI** (Spec §12C)
```
Create: .github/workflows/lighthouse.yml
```
- Trigger: pull_request
- Build the app, start preview server
- Run Lighthouse via `treosh/lighthouse-ci-action@v11` or `lhci`
- Fail thresholds: PWA ≥ 100%, Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95
- Upload HTML report as artifact

**8.6 — Performance Audit**
- Run `pnpm build` and inspect `.next/` output sizes
- Check against Spec §10 budget: Initial JS < 150KB gzip, route chunks < 50KB avg, CSS < 30KB
- If over budget, add `next/dynamic` imports or code-split large components
- Document findings in PWA_CHANGELOG.md

**8.7 — Accessibility Audit & Fixes**
```
Audit all new and modified components
```
Run through all PWA components and modified files for accessibility:
- **Focus rings**: Ensure all interactive elements (buttons, links, tabs) have visible focus rings. Search for `focus:` and `focus-visible:` in new components. Add `focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]` where missing
- **ARIA labels**: All icon-only buttons must have `aria-label`. Check:
  - Top bar back button (Phase 3) → `aria-label="Go back"`
  - Network status dot → `aria-label="Network status: online"` / `"Network status: offline"`
  - Bottom nav tab buttons → already have labels (verify)
  - Pull-to-refresh indicator → `aria-hidden="true"` (decorative)
  - Install prompt dismiss → `aria-label="Dismiss install prompt"`
- **Color contrast**: Verify all text meets WCAG AA (4.5:1 for normal text, 3:1 for large text). Key risk areas: `text-muted-foreground` on `#0A0A0B` background
- **Reduced motion**: Verify all new framer-motion animations have `prefers-reduced-motion` handling. The install prompt, pull-to-refresh, and offline banner must respect `useReducedMotion()`

**8.8 — Image Optimization Audit**
```
Search and fix across codebase
```
Run:
```bash
grep -rn "unoptimized" components/ app/ --include="*.tsx"
grep -rn '<img ' components/ app/ --include="*.tsx"
```
- Remove `unoptimized` prop from any Discord avatar `<Image>` components — Next.js image optimization should handle remote images. Verify `next.config.ts` has `images.remotePatterns` for `cdn.discordapp.com`
- Replace any raw `<img>` tags with `next/image` `<Image>` component
- For large images (hero, course thumbnails), ensure `placeholder="blur"` or `placeholder="empty"` with a loading skeleton
- For avatar images, ensure `sizes` prop is set correctly (e.g., `sizes="40px"` for 40px avatars) to prevent oversized downloads

**8.9 — Form Input Mode & Autocomplete Audit**
```
Search and fix across member pages
```
Run:
```bash
grep -rn 'type="number"\|type="text"\|<input\|<textarea' app/members/ components/journal/ components/members/ --include="*.tsx"
```
- All numeric inputs (price, quantity, percentage fields) should have `inputMode="decimal"` for proper mobile keyboard. Search journal trade entry form, any settings forms
- All email fields should have `inputMode="email"` and `autoComplete="email"`
- All name fields should have `autoComplete="name"` or `autoComplete="given-name"`
- All password fields should have `autoComplete="current-password"` or `autoComplete="new-password"`
- Textarea elements in forms should have `resize-none` class unless intentionally resizable

**8.10 — PWA Changelog**
```
Create: docs/PWA_CHANGELOG.md
```
- Document all changes across Phases 1-8 (10 tasks in this phase)
- Format per phase: files created, files modified, tests added, key decisions
- Include final Lighthouse scores
- Include UX production hardening summary: toast fixes, touch targets, scroll lock, error boundaries, accessibility

### Phase 8 Gate Check (FINAL)

```bash
# Complete test suite
pnpm test:unit
pnpm test:e2e
pnpm build

# Asset verification
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('public/manifest.json','utf8'));
const missing = m.icons.filter(i => !fs.existsSync('public' + i.src));
if (missing.length) { console.error('Missing icons:', missing.map(i => i.src)); process.exit(1); }
console.log('All ' + m.icons.length + ' manifest icons verified');
fs.existsSync('public/offline.html') || (console.error('Missing offline.html'), process.exit(1));
console.log('Offline page verified');
"
```

**Phase 8 Audit Verification:**
```bash
# Accessibility: no icon-only buttons without aria-label
grep -rn '<button' components/ app/ --include="*.tsx" | grep -v 'aria-label' | grep -i 'icon\|lucide'

# Images: no unoptimized or raw img tags
grep -rn 'unoptimized' components/ app/ --include="*.tsx"
grep -rn '<img ' components/ app/ --include="*.tsx"

# Form inputs: verify inputMode on number fields
grep -rn 'type="number"' components/ app/ --include="*.tsx" | grep -v 'inputMode'

# Touch targets: verify coarse pointer rules exist
grep -n 'pointer: coarse' app/globals.css
```

**Commit:** `git commit -m "feat(pwa): phase 8 — testing, CI, verification, audits, changelog"`

---

## Post-Implementation Checklist

After all 8 phases pass their gates, verify:

- [ ] `pnpm test:unit` — all pass
- [ ] `pnpm test:e2e` — all pass
- [ ] `pnpm build` — zero errors
- [ ] `pnpm lint` — zero errors (run `pnpm lint` if configured, or `npx eslint . --ext .ts,.tsx`)
- [ ] Every new file has JSDoc header with spec section reference
- [ ] `docs/PWA_CHANGELOG.md` documents all changes
- [ ] No `#D4AF37` (old gold) in any new code — search: `grep -r "D4AF37" components/ lib/ hooks/ contexts/ app/`
- [ ] All new components use `glass-card-heavy`, `var(--emerald-elite)`, `var(--champagne)` where appropriate
- [ ] All images use `next/image` (no raw `<img>` tags)
- [ ] All icons use `lucide-react` (no other icon libraries)
- [ ] All imports use `@/` alias (no relative `../../` paths)
- [ ] No body scroll-through on any modal/sheet (test by opening journal trade entry sheet and trying to scroll)
- [ ] No rubber-band overscroll on body in standalone mode
- [ ] All interactive elements have visible focus rings (`focus-visible:ring-2`)
- [ ] All icon-only buttons have `aria-label`
- [ ] All numeric inputs have `inputMode="decimal"`
- [ ] Toasts appear above bottom nav on mobile (not hidden behind top bar)
- [ ] Error boundaries catch crashes gracefully on all member routes
- [ ] All touch targets are ≥ 44px on coarse pointer devices
- [ ] No `unoptimized` prop on any `<Image>` component (except SVGs)
- [ ] No raw `<img>` tags — all images use `next/image`
- [ ] All 8 commits follow `feat(pwa): phase N — description` convention
- [ ] Run Lighthouse locally: `npx lighthouse http://localhost:3000/members --preset=desktop --view` and verify PWA score = 100%

---

## Complete File Manifest

### New Files to Create (35 + 7 unit test files)

| # | File | Phase | Spec § |
|---|------|-------|--------|
| 1 | `scripts/generate-pwa-icons.ts` | 1 | §4 |
| 2 | `public/icons/*` (14 icon files) | 1 | §4 |
| 3 | `public/offline.html` | 1 | §5A |
| 4 | `hooks/use-is-standalone.ts` | 2 | §11A |
| 5 | `hooks/use-pwa-install.ts` | 2 | §6D |
| 6 | `components/pwa/install-prompt.tsx` | 2 | §6A |
| 7 | `components/pwa/ios-install-guide.tsx` | 2 | §6B |
| 8 | `hooks/use-swipe-navigation.ts` | 3 | §7F |
| 9 | `components/pwa/pull-to-refresh.tsx` | 3 | §7E |
| 10 | `lib/use-scroll-lock.ts` | 4 | §7/§11 |
| 11 | `lib/haptics.ts` | 5 | §8B |
| 12 | `lib/badge.ts` | 5 | §8C |
| 13 | `components/pwa/share-button.tsx` | 5 | §8D |
| 14 | `lib/push-notifications.ts` | 5 | §8A |
| 15 | `components/pwa/notification-settings.tsx` | 5 | §8A |
| 16 | `app/api/push/subscribe/route.ts` | 5 | §8A |
| 17 | `contexts/NetworkStatusContext.tsx` | 6 | §9A |
| 18 | `components/pwa/offline-banner.tsx` | 6 | §9B |
| 19 | `components/pwa/journal-sync-indicator.tsx` | 6 | §9D |
| 20 | `app/members/journal/error.tsx` | 6 | — |
| 21 | `app/members/academy/courses/[slug]/error.tsx` | 6 | — |
| 22 | `app/members/academy/learn/[id]/error.tsx` | 6 | — |
| 23 | `app/members/profile/error.tsx` | 6 | — |
| 24 | `app/members/ai-coach/error.tsx` | 6 | — |
| 25 | `scripts/generate-pwa-splashes.ts` | 7 | §4 |
| 26 | `public/splash/*` (~16 splash files) | 7 | §4 |
| 27 | `hooks/use-ios-keyboard-fix.ts` | 7 | §11B |
| 28 | `e2e/specs/pwa/pwa-installability.spec.ts` | 8 | §12A |
| 29 | `e2e/specs/pwa/mobile-nav.spec.ts` | 3 | §12A |
| 30 | `e2e/specs/pwa/mobile-layouts.spec.ts` | 8 | §12A |
| 31 | `e2e/specs/pwa/offline.spec.ts` | 6 | §12A |
| 32 | `e2e/specs/pwa/scroll-containment.spec.ts` | 4 | §12A |
| 33 | `scripts/generate-pwa-screenshots.ts` | 8 | §4 |
| 34 | `.github/workflows/lighthouse.yml` | 8 | §12C |
| 35 | `docs/PWA_CHANGELOG.md` | 8 | — |
| 36 | `lib/__tests__/pwa/phase1-installability.test.ts` | 1 | §12 |
| 37 | `lib/__tests__/pwa/phase2-install-prompt.test.ts` | 2 | §12 |
| 38 | `lib/__tests__/pwa/phase3-mobile-nav.test.ts` | 3 | §12 |
| 39 | `lib/__tests__/pwa/phase4-scroll-containment.test.ts` | 4 | §12 |
| 40 | `lib/__tests__/pwa/phase5-native-features.test.ts` | 5 | §12 |
| 41 | `lib/__tests__/pwa/phase6-offline.test.ts` | 6 | §12 |
| 42 | `lib/__tests__/pwa/phase7-ios.test.ts` | 7 | §12 |

### Existing Files to Modify (19)

| # | File | Phases | Key Changes |
|---|------|--------|-------------|
| 1 | `public/manifest.json` | 1 | Complete rewrite — add id, display_override, full icons, screenshots, shortcuts, share_target |
| 2 | `public/sw.js` | 1, 5 | Add SW_VERSION, offline fallback, expanded precache, periodic sync, badge on push |
| 3 | `app/layout.tsx` | 1, 7 | viewport export, theme-color, format-detection, msapplication meta, iOS splash links |
| 4 | `app/globals.css` | 1, 4 | Standalone mode CSS, safe-area utils, touch targets, overscroll containment, scroll-contain, `--mobile-chrome` custom property |
| 5 | `app/members/layout.tsx` | 2, 3, 4, 6 | InstallPrompt, pb-nav, will-change, contained scroll in standalone, NetworkStatusProvider, remove double pb-safe |
| 6 | `components/members/mobile-top-bar.tsx` | 3 | safe-area-inset-top, network dot, back button |
| 7 | `components/members/mobile-bottom-nav.tsx` | 3, 4 | Badge rendering, keyboard detection, safe-area-aware bottom, touch target sizing |
| 8 | `hooks/use-focus-trap.ts` | 4 | Add body scroll lock via useScrollLock |
| 9 | `components/ui/dialog.tsx` | 4 | Add body scroll lock to DialogContent |
| 10 | `components/ui/app-toaster.tsx` | 3 | Mobile repositioning, safe-area offset, max visible count, error duration |
| 11 | `components/journal/trade-entry-sheet.tsx` | 4 | Add body scroll lock + scroll position restore, textarea resize-none |
| 12 | `components/journal/entry-detail-sheet.tsx` | 4 | Add body scroll lock + scroll position restore, safe-area-aware height |
| 13 | `app/members/ai-coach/page.tsx` | 3, 4, 5 | Scroll containment, wake lock, height calculation fix, animation perf, reduced-motion |
| 14 | `app/members/studio/page.tsx` | 4 | Mobile redirect to /members (prevent PWA dead-end) |
| 15 | `playwright.config.ts` | 8 | Add pwa-ios and pwa-android projects |
| 16 | `package.json` | 1, 8 | sharp devDep, generate:pwa-* scripts, test:e2e:pwa script |
| 17 | Journal/profile/AI Coach pages | 3 | Add toast feedback for success/error actions |
| 18 | Various form components | 8 | inputMode, autoComplete attributes |
| 19 | Discord avatar components | 8 | Remove `unoptimized`, add proper `sizes` |

### Files NOT Modified (reference only)

| File | Why |
|------|-----|
| `components/pwa/service-worker-register.tsx` | Already complete — 105 lines, full lifecycle |
| `lib/web-push-service.ts` | Already complete — 269 lines, VAPID + batch delivery |
| `lib/types/notifications.ts` | Already complete — 95 lines, all interfaces |
| `lib/pwa-utils.ts` | Already complete — 38 lines, import from here don't duplicate |
| `app/api/admin/notifications/route.ts` | Already complete — 204 lines |
| `components/academy/academy-sub-nav.tsx` | Already works — sticky sub-nav with horizontal scroll, correct z-index stacking |

---

## Navigation Map (Reference for All Phases)

Codex should understand the full route tree to ensure every path has working navigation in standalone mode:

```
/members (Dashboard — home, bottom nav tab 1)
├── /members/journal (bottom nav tab 2)
│   └── /members/journal/analytics (sub-page — needs back button)
├── /members/ai-coach (bottom nav tab 3)
├── /members/academy (Academy home)
│   ├── /members/academy/courses (bottom nav tab 4 "Library")
│   │   └── /members/academy/courses/[slug] (sub-page — needs back button)
│   ├── /members/academy/learn/[id] (sub-page — needs back button)
│   ├── /members/academy/continue (academy sub-nav)
│   ├── /members/academy/review (academy sub-nav)
│   ├── /members/academy/saved (academy sub-nav)
│   └── /members/academy/onboarding (sub-page)
├── /members/profile (More menu)
├── /members/social (More menu)
└── /members/studio (desktop only — redirect mobile to /members)
```

**Sub-navigation layers:**
1. **Bottom nav** — 4 primary tabs + More menu (Dashboard, Journal, AI Coach, Library, More)
2. **Academy sub-nav** — horizontal scrollable tabs within `/members/academy/*` routes (Home, Explore, Continue, Review, Saved)
3. **Top bar back button** — appears on any route deeper than `/members/{section}` (e.g., `/members/academy/courses/[slug]`)

**Overlay components that need scroll lock:**
- Journal: `TradeEntrySheet`, `EntryDetailSheet`, `ScreenshotQuickAdd`, delete confirmation modal
- AI Coach: `MobileToolSheet` (full-screen slide-up)
- Radix Dialog (used across app)
- Any future modals/sheets

---

*This prompt implements `docs/PWA_SPEC.md` v1.0 via gated spec-driven development with 8 phases (56 tasks total). Every feature traces to a spec section. Phase 4 (scroll containment) ensures the app feels native, not like a website wrapper. Phases 3, 4, 6, and 8 include UX production hardening: toast positioning, touch targets, animation performance, error boundaries, accessibility, image optimization, and form input modes. Do not improvise beyond the spec. Do not skip gate checks.*
