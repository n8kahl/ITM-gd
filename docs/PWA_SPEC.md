# TradeITM — Progressive Web App (PWA) Specification

**Version:** 1.0
**Date:** February 2026
**Target:** Codex Implementation Handoff
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Web App Manifest Overhaul](#3-web-app-manifest-overhaul)
4. [Icon & Splash Screen Asset Pipeline](#4-icon--splash-screen-asset-pipeline)
5. [Service Worker Upgrade](#5-service-worker-upgrade)
6. [Add-to-Homescreen (A2HS) Prompt & Animation](#6-add-to-homescreen-a2hs-prompt--animation)
7. [Mobile Navigation & Layout Optimization](#7-mobile-navigation--layout-optimization)
8. [Native Feature Integration](#8-native-feature-integration)
9. [Offline Experience & Connectivity Handling](#9-offline-experience--connectivity-handling)
10. [Performance Budget & Lighthouse Targets](#10-performance-budget--lighthouse-targets)
11. [iOS-Specific Handling](#11-ios-specific-handling)
12. [Testing & Verification Plan](#12-testing--verification-plan)
13. [File-by-File Implementation Checklist](#13-file-by-file-implementation-checklist)

---

## 1. Executive Summary

TradeITM has a partial PWA foundation — a basic manifest, a hand-written service worker with offline journal sync, and mobile-responsive layouts. This spec upgrades it to a **production-grade PWA** that feels indistinguishable from a native app on both iOS and Android. The three pillars are:

1. **Install Experience** — A branded, animated Add-to-Homescreen prompt that drives installs
2. **Native Features** — Push notifications, haptics, status bar theming, pull-to-refresh, share targets, badge API
3. **Mobile-First Verification** — Every layout, navigation path, and interactive element audited and optimized for phone viewports (320px–428px)

---

## 2. Current State Audit

### What Exists

| Component | File | Status | Issues |
|-----------|------|--------|--------|
| Manifest | `public/manifest.json` | Partial | Missing `id`, `screenshots`, `shortcuts`, 512px icon, `share_target`, `display_override` |
| Service Worker | `public/sw.js` | Good | No update flow, no offline fallback page, no workbox |
| SW Registration | `components/pwa/service-worker-register.tsx` | Minimal | No update detection, no update prompt, no lifecycle management |
| Mobile Top Bar | `components/members/mobile-top-bar.tsx` | Good | No connection status indicator, no PWA standalone detection |
| Mobile Bottom Nav | `components/members/mobile-bottom-nav.tsx` | Good | No badge API integration, missing safe-area for dynamic island |
| Members Layout | `app/members/layout.tsx` | Good | No pull-to-refresh, no overscroll control, pb-28 is static not dynamic |
| Root Layout | `app/layout.tsx` | Basic | Missing viewport-fit=cover, theme-color meta, standalone detection |
| CSS | `app/globals.css` | Has `pb-safe` | Missing standalone-mode styles, iOS bounce prevention |
| Icons | `public/` | Partial | No 512x512, no maskable icon at 512, no monochrome icon |
| Splash/Screenshots | — | Missing | No screenshots for manifest install dialog |

### What's Missing Entirely

- `beforeinstallprompt` event handler and custom A2HS UI
- Service worker update detection + "New version available" toast
- Offline fallback page (`/offline.html`)
- App shortcuts in manifest
- Share Target API
- Badging API integration for notification count
- PWA-standalone-mode CSS adjustments (hide browser chrome areas)
- `display_override` with `window-controls-overlay` option
- Network status context + UI indicators
- iOS splash screen images (`apple-touch-startup-image`)
- Periodic background sync for dashboard data
- `next-pwa` or equivalent Workbox integration (currently hand-rolled SW)

---

## 3. Web App Manifest Overhaul

### File: `public/manifest.json`

Replace the current manifest with this complete version. All fields are intentional.

```json
{
  "id": "/members",
  "name": "TradeITM - Premium Trade Alerts",
  "short_name": "TradeITM",
  "description": "Premium trade alerts and education from professional traders. Real-time alerts, AI coaching, and trade journaling.",
  "start_url": "/members?utm_source=pwa&utm_medium=homescreen",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait-primary",
  "background_color": "#0A0A0B",
  "theme_color": "#047857",
  "dir": "ltr",
  "lang": "en-US",
  "categories": ["finance", "education", "business"],
  "prefer_related_applications": false,
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/monochrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "monochrome"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "TradeITM Dashboard - Desktop View"
    },
    {
      "src": "/screenshots/dashboard-narrow.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "TradeITM Dashboard - Mobile View"
    },
    {
      "src": "/screenshots/journal-narrow.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Trade Journal - Track Your Trades"
    },
    {
      "src": "/screenshots/ai-coach-narrow.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "AI Coach - Personalized Trading Guidance"
    }
  ],
  "shortcuts": [
    {
      "name": "Trade Journal",
      "short_name": "Journal",
      "description": "Open your trade journal",
      "url": "/members/journal?utm_source=pwa_shortcut",
      "icons": [{ "src": "/icons/shortcut-journal.png", "sizes": "96x96" }]
    },
    {
      "name": "AI Coach",
      "short_name": "AI Coach",
      "description": "Chat with your AI trading coach",
      "url": "/members/ai-coach?utm_source=pwa_shortcut",
      "icons": [{ "src": "/icons/shortcut-ai-coach.png", "sizes": "96x96" }]
    },
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "View your trading dashboard",
      "url": "/members?utm_source=pwa_shortcut",
      "icons": [{ "src": "/icons/shortcut-dashboard.png", "sizes": "96x96" }]
    }
  ],
  "share_target": {
    "action": "/members/journal?action=share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  },
  "protocol_handlers": [
    {
      "protocol": "web+tradeitm",
      "url": "/members?handler=%s"
    }
  ]
}
```

### Key Changes from Current

- `id` field added (stable identity across manifest changes)
- `start_url` now points to `/members` (where users actually go) with UTM tracking
- `display_override` for graceful degradation
- Full icon set with separate `maskable` and `monochrome` entries (current manifest incorrectly uses `"purpose": "any maskable"` on a single icon — this causes rendering issues on Android)
- `screenshots` array enables the richer install dialog on Android Chrome
- `shortcuts` for long-press app icon actions
- `share_target` allows sharing links/text to the journal
- `protocol_handlers` for deep linking

---

## 4. Icon & Splash Screen Asset Pipeline

### Required Icon Assets

Create a new `public/icons/` directory. Generate all icons from the source `public/hero-logo.png` (773KB).

| File | Size | Purpose | Notes |
|------|------|---------|-------|
| `icon-72x72.png` | 72x72 | Android legacy | |
| `icon-96x96.png` | 96x96 | Android, shortcut icons | |
| `icon-128x128.png` | 128x128 | Chrome Web Store | |
| `icon-144x144.png` | 144x144 | Windows tiles | |
| `icon-152x152.png` | 152x152 | iPad | |
| `icon-192x192.png` | 192x192 | Android install | Primary Android icon |
| `icon-384x384.png` | 384x384 | Android splash | |
| `icon-512x512.png` | 512x512 | Android splash, Play Store | **Required for Lighthouse** |
| `maskable-192x192.png` | 192x192 | Android adaptive icons | Logo centered in safe zone (80% inner area), `#0A0A0B` background fill |
| `maskable-512x512.png` | 512x512 | Android adaptive icons | Same as above, larger |
| `monochrome-192x192.png` | 192x192 | Notification badges, themed icons | White silhouette on transparent |
| `shortcut-journal.png` | 96x96 | App shortcut | BookOpen icon, emerald background |
| `shortcut-ai-coach.png` | 96x96 | App shortcut | Bot icon, emerald background |
| `shortcut-dashboard.png` | 96x96 | App shortcut | LayoutDashboard icon, emerald background |

### Implementation: Icon Generation Script

Create `scripts/generate-pwa-icons.ts`:

```typescript
// Use sharp to resize hero-logo.png into all required sizes
// For maskable: add #0A0A0B padding so logo sits within 80% safe zone
// For monochrome: convert to white silhouette on transparent background
// For shortcuts: render Lucide icons on #047857 rounded-rect backgrounds
// Output: public/icons/*
```

### Required Screenshot Assets

Create a `public/screenshots/` directory. Screenshots should be actual captures of the app:

| File | Size | Form Factor | Content |
|------|------|-------------|---------|
| `dashboard-wide.png` | 1280x720 | Desktop | Members dashboard |
| `dashboard-narrow.png` | 390x844 | Phone | Members dashboard (mobile) |
| `journal-narrow.png` | 390x844 | Phone | Journal view (mobile) |
| `ai-coach-narrow.png` | 390x844 | Phone | AI Coach chat (mobile) |

### iOS Splash Screens (Apple Touch Startup Images)

Add to `app/layout.tsx` `<head>`. These need to match every device resolution or iOS shows a white flash.

Generate with a script or use `pwa-asset-generator`. Required device targets:

| Device | Width x Height | Pixel Ratio | Orientation |
|--------|---------------|-------------|-------------|
| iPhone SE | 640x1136 | 2x | portrait |
| iPhone 8 | 750x1334 | 2x | portrait |
| iPhone 8 Plus | 1242x2208 | 3x | portrait |
| iPhone X/XS/11 Pro | 1125x2436 | 3x | portrait |
| iPhone XR/11 | 828x1792 | 2x | portrait |
| iPhone XS Max/11 Pro Max | 1242x2688 | 3x | portrait |
| iPhone 12/13 mini | 1080x2340 | 3x | portrait |
| iPhone 12/13/14 | 1170x2532 | 3x | portrait |
| iPhone 12/13/14 Pro Max | 1284x2778 | 3x | portrait |
| iPhone 14 Pro | 1179x2556 | 3x | portrait |
| iPhone 14 Pro Max | 1290x2796 | 3x | portrait |
| iPhone 15 Pro / 16 | 1179x2556 | 3x | portrait |
| iPhone 15 Pro Max / 16 Plus | 1290x2796 | 3x | portrait |
| iPhone 16 Pro | 1206x2622 | 3x | portrait |
| iPhone 16 Pro Max | 1320x2868 | 3x | portrait |

Each splash screen should display:
- `#0A0A0B` background (onyx)
- Centered TradeITM logo (from `hero-logo.png`) at ~25% viewport width
- Subtle emerald glow beneath logo: `radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 60%)`

Link format in `<head>`:
```html
<link rel="apple-touch-startup-image"
  href="/splash/splash-1179x2556.png"
  media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
```

### Asset Generation Script

Create `scripts/generate-pwa-assets.ts` that uses `sharp` (already in devDependencies or install) to:
1. Read `public/hero-logo.png` as source
2. Generate all icon sizes into `public/icons/`
3. Generate maskable variants with padding
4. Generate splash screens with the brand layout described above into `public/splash/`
5. Generate screenshots by taking Playwright snapshots (integrate with existing E2E config)

---

## 5. Service Worker Upgrade

### Current Architecture (Keep)

The existing `public/sw.js` has solid fundamentals that should be preserved:
- Cache-first for static assets
- Network-first for API and navigation
- IndexedDB offline journal mutation queue with Background Sync
- Push notification handlers

### Upgrades Required

#### 5A. Offline Fallback Page

Create `public/offline.html` — a self-contained HTML file (no external dependencies) that renders:
- `#0A0A0B` background
- Centered TradeITM logo (inline SVG or base64)
- "You're offline" message in Inter font (embedded)
- "Your queued trades will sync when you reconnect" reassurance text
- Retry button that calls `location.reload()`
- Styled with the Emerald Standard (emerald accent, champagne text)

In `sw.js`, update the navigation fetch handler:

```javascript
// In the navigate handler, replace the current networkFirst fallback:
if (request.mode === 'navigate') {
  event.respondWith(
    fetch(request)
      .then((response) => {
        const cache = caches.open(RUNTIME_CACHE_NAME)
        cache.then(c => c.put(request, response.clone()))
        return response
      })
      .catch(() => caches.match(request)
        .then((cached) => cached || caches.match('/offline.html'))
      )
  )
  return
}
```

Also add `/offline.html` to `STATIC_ASSETS` so it's precached on install.

#### 5B. Service Worker Update Flow

Add these event listeners to `sw.js`:

```javascript
// Notify clients when a new version is available
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
```

#### 5C. Precache Expansion

Update `STATIC_ASSETS` to include:
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

#### 5D. Periodic Background Sync (Dashboard)

Add periodic sync for keeping dashboard data fresh:

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

#### 5E. Cache Versioning Strategy

Add a `VERSION` constant at the top of `sw.js` and bump it on each deploy:

```javascript
const SW_VERSION = '5.0.0'
// Log on activation for debugging
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activated version ${SW_VERSION}`)
  // ... existing cleanup logic
})
```

---

## 6. Add-to-Homescreen (A2HS) Prompt & Animation

This is the centerpiece UX feature. The prompt should feel premium and on-brand, not like a generic browser popup.

### 6A. New Component: `components/pwa/install-prompt.tsx`

```
Location: components/pwa/install-prompt.tsx
Type: Client Component ('use client')
Dependencies: framer-motion, lucide-react (Download, X, Smartphone), next/image
```

**Behavior:**
1. Listen for the `beforeinstallprompt` event (Android/Chrome only)
2. Store the event in a ref — do NOT call `.prompt()` immediately
3. Show the custom prompt after the user has been on the `/members` route for 30 seconds OR has visited 3+ pages in the current session
4. On iOS (detected via `navigator.standalone === undefined` and iOS user agent), show a manual instruction overlay instead (since `beforeinstallprompt` doesn't fire on iOS)
5. Persist dismissal in `localStorage` with key `tradeitm-a2hs-dismissed` — don't show again for 14 days after dismiss, never show again after install
6. Track install events in Supabase analytics (`conversion_events` table with `event_type: 'pwa_install'`)

**Visual Design:**

The prompt is a **bottom sheet** (rises from bottom of screen) with these elements:

```
┌─────────────────────────────────────┐
│  [X close]                          │
│                                     │
│      ┌──────────┐                   │
│      │  (logo)  │  ← animated       │
│      │  bounce  │     entrance       │
│      └──────────┘                   │
│                                     │
│   Install TradeITM                  │  ← Playfair Display heading
│                                     │
│   Get instant access to alerts,     │  ← Inter body
│   your journal, and AI coaching     │
│   right from your home screen.      │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  ⬇  Add to Home Screen        │ │  ← Primary CTA (emerald)
│  └────────────────────────────────┘ │
│                                     │
│       Maybe Later                   │  ← Text button (muted)
│                                     │
│   ● ● ●  3 features below:         │
│   ✓ Works offline                   │
│   ✓ Push notifications              │
│   ✓ Instant launch                  │
│                                     │
└─────────────────────────────────────┘
```

**Animation Sequence (Framer Motion):**

1. Backdrop: fade in `bg-black/60` over 300ms
2. Sheet: slide up from `y: 100%` to `y: 0` with spring `{ stiffness: 300, damping: 30 }`
3. Logo: scale from 0.5 to 1.0 with bounce overshoot, delayed 150ms
4. Text: fade+slide up, staggered 50ms per element
5. CTA button: pulse glow animation after 500ms delay (`animate-pulse-emerald`)
6. Dismiss: slide down + fade out, 200ms

**CSS Classes used:**
- Container: `glass-card-heavy` with `rounded-t-2xl`
- CTA: `btn-premium` + `btn-luxury`
- Backdrop: custom with `backdrop-blur-sm`

### 6B. iOS Install Instructions Component: `components/pwa/ios-install-guide.tsx`

Since iOS Safari doesn't support `beforeinstallprompt`, show a step-by-step guide:

```
Location: components/pwa/ios-install-guide.tsx
Type: Client Component
```

**Visual: Animated instruction overlay**

```
┌─────────────────────────────────────┐
│  [X close]                          │
│                                     │
│   Install TradeITM on iPhone        │  ← heading
│                                     │
│   Step 1:                           │
│   Tap the share button ↑            │  ← animated arrow pointing
│   in Safari's toolbar               │     to the share button
│                                     │
│   Step 2:                           │
│   Scroll down and tap               │
│   "Add to Home Screen"              │
│                                     │
│   Step 3:                           │
│   Tap "Add" to confirm              │
│                                     │
│   [Got it]                          │  ← dismiss button
│                                     │
└─────────────────────────────────────┘
```

Include a bouncing arrow animation pointing toward Safari's share button (bottom center on iPhone, top-right on iPad). Use Framer Motion with `{ y: [0, -8, 0] }` repeat infinite.

### 6C. Update SW Registration: `components/pwa/service-worker-register.tsx`

Rewrite to handle the full lifecycle:

```typescript
'use client'

import { useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  const onUpdate = useCallback((registration: ServiceWorkerRegistration) => {
    setWaitingWorker(registration.waiting)
    toast('New version available', {
      description: 'Tap to update TradeITM',
      action: {
        label: 'Update',
        onClick: () => {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
        },
      },
      duration: Infinity,
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for waiting worker (update available)
      if (registration.waiting) {
        onUpdate(registration)
        return
      }

      // Listen for new installing worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdate(registration)
          }
        })
      })
    }).catch((error) => {
      console.error('[PWA] SW registration failed:', error)
    })

    // Reload page when new SW takes over
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [onUpdate])

  return null
}
```

### 6D. Install Analytics Hook: `hooks/use-pwa-install.ts`

```typescript
// Tracks:
// - beforeinstallprompt event fired (eligible for install)
// - Custom prompt shown
// - User accepted install
// - User dismissed prompt
// - appinstalled event fired (actual install completed)
// - Is standalone mode (already installed)
//
// Writes to Supabase conversion_events table
// Exposes: { isInstallable, isStandalone, showPrompt, promptOutcome }
```

---

## 7. Mobile Navigation & Layout Optimization

### 7A. Root Layout Updates (`app/layout.tsx`)

Add these to the `<head>`:

```html
<!-- Viewport: cover entire screen including notch/dynamic island -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

<!-- Theme color (matches status bar on Android) -->
<meta name="theme-color" content="#0A0A0B" media="(prefers-color-scheme: dark)" />

<!-- Apple PWA meta tags -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="TradeITM" />

<!-- Disable phone number detection on iOS -->
<meta name="format-detection" content="telephone=no" />

<!-- Microsoft tile -->
<meta name="msapplication-TileColor" content="#0A0A0B" />
<meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
```

Note: `apple-mobile-web-app-status-bar-style: black-translucent` is already set via the Next.js metadata API in the existing code. Verify it outputs correctly.

### 7B. Global CSS Additions (`app/globals.css`)

Add a new section for PWA standalone mode:

```css
/* ============================================
   PWA STANDALONE MODE ADJUSTMENTS
   ============================================ */

/* When running as installed PWA, remove browser-chrome-dependent UI */
@media all and (display-mode: standalone) {
  /* Extra top padding to account for status bar / notch */
  body {
    padding-top: env(safe-area-inset-top);
  }

  /* Prevent rubber-band overscroll on iOS standalone */
  html, body {
    overscroll-behavior-y: none;
  }
}

/* Safe area insets for all edges */
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-left {
  padding-left: env(safe-area-inset-left);
}

.safe-right {
  padding-right: env(safe-area-inset-right);
}

/* Dynamic bottom nav height calculation */
.pb-nav {
  padding-bottom: calc(env(safe-area-inset-bottom) + 4.5rem);
}

/* Prevent text selection on nav elements (feels more native) */
nav, .nav-item {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Prevent pull-to-refresh on the outer document (we handle it ourselves) */
@media all and (display-mode: standalone) {
  body {
    overscroll-behavior-y: contain;
  }
}

/* Smooth momentum scrolling for all scrollable containers */
.scroll-native {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}

/* Hide scrollbars on mobile but keep scrollable */
@media (max-width: 1023px) {
  .scrollbar-mobile-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-mobile-hide::-webkit-scrollbar {
    display: none;
  }
}

/* Touch target sizing - ensure all interactive elements meet 44x44px minimum */
@media (pointer: coarse) {
  button, a, [role="button"], input, select, textarea {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### 7C. Mobile Top Bar Updates (`components/members/mobile-top-bar.tsx`)

Changes needed:

1. **Add safe-area-inset-top support:** When in standalone mode, the top bar needs to account for the notch/dynamic island.

```tsx
// Add this to the header element:
className="sticky top-0 z-40 lg:hidden flex items-center justify-between px-4
  bg-[#0A0A0B]/95 backdrop-blur-[20px] border-b border-white/[0.06]
  pt-[env(safe-area-inset-top)]"
// Adjust height from fixed h-14 to min-h-[3.5rem] so it grows with safe area
```

2. **Add network status indicator:** Show a small dot next to the logo — green for online, amber for offline.

3. **Add back button for deep navigation:** When on a sub-page (e.g., `/members/academy/courses/[slug]`), show a `<ChevronLeft>` back button in the left slot instead of the empty div.

### 7D. Mobile Bottom Nav Updates (`components/members/mobile-bottom-nav.tsx`)

Changes needed:

1. **Dynamic safe area:** The current `pb-safe` utility is `calc(env(safe-area-inset-bottom) + 0.625rem)`. This works but should be verified on iPhone 15/16 Pro with dynamic island.

2. **Badge support:** Add a notification badge dot on the Dashboard tab when there are unread alerts. Use the Badging API where supported:

```tsx
// Add badge prop to NavTab interface
interface NavTab {
  id: string
  label: string
  href: string
  icon: LucideIcon
  badge?: number // unread count
}

// Render badge:
{tab.badge && tab.badge > 0 && (
  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full
    text-[9px] font-bold text-white flex items-center justify-center">
    {tab.badge > 9 ? '9+' : tab.badge}
  </span>
)}
```

3. **Standalone mode height adjustment:** In standalone mode on iOS, the home indicator area overlaps the bottom nav. Verify the current `pb-safe` handles this.

4. **Prevent bottom nav from being pushed up by iOS keyboard:** When a text input is focused (e.g., AI Coach chat input), the bottom nav should hide:

```tsx
// Add keyboard detection:
const [keyboardOpen, setKeyboardOpen] = useState(false)

useEffect(() => {
  const onResize = () => {
    // On iOS, window.visualViewport.height shrinks when keyboard opens
    if (window.visualViewport) {
      const heightDiff = window.innerHeight - window.visualViewport.height
      setKeyboardOpen(heightDiff > 150)
    }
  }
  window.visualViewport?.addEventListener('resize', onResize)
  return () => window.visualViewport?.removeEventListener('resize', onResize)
}, [])

// In render:
if (keyboardOpen) return null // Hide bottom nav when keyboard is up
```

### 7E. Members Layout Updates (`app/members/layout.tsx`)

Changes needed:

1. **Replace static `pb-28` with dynamic padding:**

```tsx
// Change:
<main className="px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-8">
// To:
<main className="px-4 py-4 lg:px-8 lg:py-6 pb-nav lg:pb-8">
```

Where `pb-nav` is the new CSS utility that accounts for safe area + nav height.

2. **Add pull-to-refresh on mobile:** Implement a custom pull-to-refresh (not the browser default which feels non-native in standalone mode):

```tsx
// New component: components/pwa/pull-to-refresh.tsx
// Uses touch events to detect pull-down gesture
// Shows a custom refresh indicator (pulsing emerald logo)
// Calls router.refresh() on release
// Only active in standalone mode and on mobile
```

3. **Add route transition optimization:** The current Framer Motion transitions are good but add `will-change: transform, opacity` to the animated container for smoother mobile performance.

### 7F. Touch & Gesture Optimization

Create `hooks/use-swipe-navigation.ts`:

```typescript
// Enables swipe-back gesture (right swipe from left edge)
// on mobile in standalone mode where there's no browser back button.
// Threshold: 80px horizontal swipe from left 20px edge zone.
// Calls router.back() on successful swipe.
// Visual: shows a subtle emerald gradient from the left edge during swipe.
```

### 7G. Viewport Verification Checklist

Every page in `/members/*` must be verified at these widths:

| Width | Device | Notes |
|-------|--------|-------|
| 320px | iPhone SE (2nd/3rd gen) | Smallest supported viewport |
| 375px | iPhone 13 mini, SE-class | Common small phone |
| 390px | iPhone 14/15 standard | Most common iPhone |
| 393px | iPhone 15 Pro, iPhone 16 | Dynamic island |
| 430px | iPhone 15 Pro Max, 16 Plus | Largest iPhone |
| 360px | Samsung Galaxy S-series | Most common Android |
| 412px | Pixel 7/8 | Google phones |

**Verification criteria for each page:**

- [ ] No horizontal scroll at any viewport width
- [ ] All text readable without zooming (minimum 14px body, 12px labels)
- [ ] All touch targets 44x44px minimum
- [ ] Bottom nav doesn't overlap content
- [ ] Top bar doesn't overlap content below
- [ ] Cards stack vertically, no side-by-side cards below 375px
- [ ] Modals/sheets don't overflow viewport
- [ ] Form inputs don't cause layout shift when focused
- [ ] Charts/graphs resize properly (Recharts responsive containers)
- [ ] Images don't overflow containers
- [ ] Long text truncates with ellipsis, doesn't break layout

---

## 8. Native Feature Integration

### 8A. Push Notifications Enhancement

The existing push handler in `sw.js` is functional. Add client-side subscription management:

Create `components/pwa/notification-settings.tsx`:
- Rendered on the `/members/profile` page
- Toggle to enable/disable push notifications
- Subscription stored in Supabase `push_subscriptions` table
- Uses VAPID keys from env `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Create `lib/push-notifications.ts`:
```typescript
export async function subscribeToPush(): Promise<PushSubscription | null>
export async function unsubscribeFromPush(): Promise<void>
export function isPushSupported(): boolean
export function isPushGranted(): boolean
```

New DB table (Supabase migration):
```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);
```

### 8B. Haptic Feedback Enhancement

The current `triggerHaptic()` in `mobile-bottom-nav.tsx` uses `navigator.vibrate(10)`. Expand this into a utility:

Create `lib/haptics.ts`:
```typescript
export const haptics = {
  light: () => navigator.vibrate?.(10),       // Tab taps, toggles
  medium: () => navigator.vibrate?.(25),      // Button presses, confirmations
  heavy: () => navigator.vibrate?.(50),       // Errors, warnings
  success: () => navigator.vibrate?.([10, 50, 20]),  // Trade saved, sync complete
  error: () => navigator.vibrate?.([50, 30, 50]),    // Failed action
  selection: () => navigator.vibrate?.(5),    // List item select, option pick
}
```

Apply across the app:
- `haptics.light` → Bottom nav taps (already exists), form toggles
- `haptics.medium` → CTA buttons, form submissions, modal open/close
- `haptics.success` → Journal entry saved, background sync complete toast
- `haptics.error` → Form validation failures, network errors
- `haptics.selection` → Dropdown selections, calendar date pick

### 8C. Badge API

Create `lib/badge.ts`:
```typescript
export async function setAppBadge(count: number): Promise<void> {
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      await navigator.setAppBadge(count)
    } else {
      await navigator.clearAppBadge()
    }
  }
}
```

Trigger badge updates:
- When new trade alerts arrive via push notification → increment
- When user opens the app / views dashboard → clear

### 8D. Share API

Create `components/pwa/share-button.tsx`:
```typescript
// Uses navigator.share() when available (mobile browsers)
// Fallback to clipboard copy on desktop
// Appears on journal entries and AI Coach insights
// Share content: title + text summary + URL to the entry
```

### 8E. Wake Lock API (for AI Coach sessions)

When a user is in an active AI Coach conversation, prevent the screen from dimming:

```typescript
// In the AI Coach page component:
useEffect(() => {
  let wakeLock: WakeLockSentinel | null = null

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen')
    }
  }

  requestWakeLock()

  // Re-acquire on visibility change (iOS releases on tab switch)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') requestWakeLock()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    wakeLock?.release()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}, [])
```

---

## 9. Offline Experience & Connectivity Handling

### 9A. Network Status Context

Create `contexts/NetworkStatusContext.tsx`:

```typescript
'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean  // true if the user was offline at any point this session
  effectiveType: string | null  // '4g', '3g', '2g', 'slow-2g'
}

// Provider wraps the app in root layout
// Uses navigator.onLine + 'online'/'offline' events
// Also checks navigator.connection.effectiveType for connection quality
// Exposes via useNetworkStatus() hook
```

### 9B. Offline Banner Component

Create `components/pwa/offline-banner.tsx`:

```
When isOnline === false:
  Show a fixed top banner (below mobile top bar, above content):
  ┌──────────────────────────────────┐
  │ ⚡ You're offline — changes will │
  │    sync when you reconnect       │
  └──────────────────────────────────┘

  Background: amber-900/90, backdrop-blur
  Text: amber-200
  Animate in: slide down from top
  Animate out: slide up when back online

When back online after being offline:
  Show a brief success banner:
  ┌──────────────────────────────────┐
  │ ✓ Back online — syncing...       │
  └──────────────────────────────────┘

  Background: emerald-900/90
  Auto-dismiss after 3 seconds
```

### 9C. Offline-Capable Pages

| Route | Offline Strategy | Cache Method |
|-------|-----------------|--------------|
| `/members` (Dashboard) | Show cached data with "Last updated" timestamp | API cache (network-first) |
| `/members/journal` | Full offline CRUD via IndexedDB queue (already exists) | SW background sync |
| `/members/ai-coach` | Show cached conversation history, disable new messages | API cache |
| `/members/academy/courses` | Show cached course list, allow reading cached content | Cache-first for content |
| `/members/profile` | Show cached profile, disable edits | API cache |

### 9D. Journal Offline Sync Indicator

In the journal page, show a sync status:

```
When mutations are queued:
  "2 changes pending sync" (amber dot)

When syncing:
  "Syncing..." (emerald pulse animation)

When sync complete:
  "All changes saved" (emerald check) — auto-dismiss after 2s
```

Reads from the IndexedDB journal mutation store to get queue count.

---

## 10. Performance Budget & Lighthouse Targets

### Target Scores (Mobile)

| Metric | Target | Current (Estimated) |
|--------|--------|-------------------|
| Performance | >90 | ~75-80 |
| Accessibility | >95 | ~85-90 |
| Best Practices | >95 | ~80-85 |
| SEO | >95 | ~90 |
| PWA | 100% | ~60% (missing installability checks) |

### Core Web Vitals Targets

| Metric | Target | Action |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | <2.5s | Preload hero assets, optimize image sizes |
| FID (First Input Delay) | <100ms | Defer non-critical JS, reduce main thread work |
| CLS (Cumulative Layout Shift) | <0.1 | Set explicit dimensions on images/containers, prevent font flash |
| INP (Interaction to Next Paint) | <200ms | Optimize event handlers, reduce re-renders |
| TTFB (Time to First Byte) | <800ms | Edge caching, Supabase connection pooling |

### PWA Lighthouse Checklist (Must all pass)

- [x] Registers a service worker (exists)
- [ ] Service worker successfully controls the page (verify)
- [ ] Web app manifest meets installability requirements (needs 512px icon, screenshots)
- [ ] Has a `<meta name="viewport">` with `width` or `initial-scale` (exists)
- [ ] Provides a valid `apple-touch-icon` (exists)
- [ ] Configured for a custom splash screen (needs splash images)
- [ ] Sets a theme color for the address bar (needs `theme-color` meta tag in `<head>`)
- [ ] Content is sized correctly for the viewport (verify)
- [ ] Has a maskable icon (needs dedicated maskable icon at 512px)
- [ ] Redirects HTTP to HTTPS (verify via HSTS)
- [ ] Service worker fetches offline page (needs `/offline.html`)
- [ ] `start_url` responds with 200 when offline (needs precaching `/members`)

### Bundle Size Budget

| Chunk | Max Size (gzip) |
|-------|----------------|
| Initial JS | 150KB |
| Route chunk (avg) | 50KB |
| CSS (total) | 30KB |
| Service worker | 15KB |

---

## 11. iOS-Specific Handling

iOS PWAs have significant quirks that require special handling.

### 11A. Standalone Detection

Create `hooks/use-is-standalone.ts`:

```typescript
export function useIsStandalone(): boolean {
  // Check multiple methods:
  // 1. CSS media query: (display-mode: standalone)
  // 2. navigator.standalone (iOS Safari)
  // 3. URL params (utm_source=pwa from manifest start_url)
}
```

### 11B. iOS Keyboard Handling

iOS doesn't resize the viewport when the keyboard opens in standalone mode. Instead, the keyboard overlaps content. Fix:

```typescript
// In components that have text inputs (AI Coach, Journal):
useEffect(() => {
  if (!isStandalone || !isIOS) return

  const inputs = document.querySelectorAll('input, textarea')

  const onFocus = (e: Event) => {
    // Scroll the focused element into view after keyboard animation
    setTimeout(() => {
      (e.target as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }, 300)
  }

  inputs.forEach(input => input.addEventListener('focus', onFocus))
  return () => inputs.forEach(input => input.removeEventListener('focus', onFocus))
}, [isStandalone, isIOS])
```

### 11C. iOS Navigation Gestures

In standalone mode on iOS, there's no back button. Handle with:
1. The swipe-back gesture from section 7F
2. Explicit back buttons in sub-page headers (mobile-top-bar.tsx upgrade)
3. Bottom sheet close gestures (swipe down)

### 11D. iOS Status Bar Theming

With `black-translucent` status bar style, the app content extends behind the status bar. Ensure the mobile top bar has the correct `padding-top: env(safe-area-inset-top)`.

### 11E. iOS Session Persistence

iOS aggressively kills PWA processes. When the app is reopened:
1. Check auth state immediately (the Supabase session cookie persists)
2. If the session is expired, redirect to login seamlessly
3. Show the pulsing logo loader (already exists) during session rehydration

### 11F. iOS Limitations to Document

These limitations should be noted in the UI where relevant:
- Push notifications require iOS 16.4+ and the app must be installed via Add to Home Screen
- Background sync is not supported on iOS
- Badge API is not supported on iOS
- Periodic sync is not supported on iOS
- The journal offline queue will flush on next app open (not via background sync)

---

## 12. Testing & Verification Plan

### 12A. Automated Tests (Playwright)

Extend the existing Playwright configuration with PWA-specific tests:

**File: `e2e/pwa.spec.ts`**

```typescript
// Test: Service worker registers successfully
// Test: Manifest is valid and accessible
// Test: Offline fallback page loads when network is disconnected
// Test: App is installable (check beforeinstallprompt fires)
// Test: Start URL loads when offline (cached)
// Test: Theme color meta tag matches manifest
// Test: All icons are accessible (200 responses)
// Test: Navigation works in standalone mode viewport
```

**File: `e2e/mobile-nav.spec.ts`**

```typescript
// Test at 390x844 (iPhone 15 standard) viewport:
// Test: Bottom nav is visible and all 5 items render
// Test: Tab navigation works for all 4 primary tabs + More menu
// Test: Active state indicator animates correctly
// Test: More menu opens/closes properly
// Test: Bottom nav hides when keyboard is open
// Test: Safe area insets don't cause overlap
// Test: Pull-to-refresh triggers on overscroll
// Test: Swipe-back gesture works from left edge
```

**File: `e2e/mobile-layouts.spec.ts`**

```typescript
// Test at 320px, 375px, 390px, 430px viewports:
// Test: Dashboard page — no horizontal overflow
// Test: Journal page — entries stack correctly
// Test: AI Coach page — chat bubbles fit within viewport
// Test: Academy page — course cards stack on mobile
// Test: Profile page — form fields are full width
// Test: All modals/sheets fit within viewport
```

### 12B. Manual Testing Checklist

**Android (Chrome):**
- [ ] Install prompt appears after qualifying engagement
- [ ] Install creates homescreen icon with correct splash screen
- [ ] App launches in standalone mode (no browser chrome)
- [ ] Push notifications arrive and open correct page on tap
- [ ] Offline mode shows banner and fallback page on uncached routes
- [ ] Journal offline sync works (create entry offline → goes online → syncs)
- [ ] App shortcuts work on long-press of icon
- [ ] Share target works (share URL from another app to TradeITM)
- [ ] Badge count appears on icon

**iOS (Safari 16.4+):**
- [ ] iOS install guide overlay appears and is accurate
- [ ] After manual Add to Home Screen, app launches standalone
- [ ] Splash screen shows (no white flash)
- [ ] Status bar theming is correct (content behind notch)
- [ ] Navigation works without browser back button
- [ ] Keyboard doesn't obscure input fields
- [ ] App survives process kill and relaunch (session persists)
- [ ] Push notifications work (iOS 16.4+)

### 12C. Lighthouse CI

Add to CI pipeline:

```yaml
# .github/workflows/lighthouse.yml
# Run Lighthouse on every PR against mobile emulation
# Fail if PWA score < 100%
# Fail if Performance < 85
# Fail if any Core Web Vital exceeds threshold
```

---

## 13. File-by-File Implementation Checklist

### New Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `components/pwa/install-prompt.tsx` | Custom A2HS bottom sheet with animation |
| 2 | `components/pwa/ios-install-guide.tsx` | iOS manual install instructions overlay |
| 3 | `components/pwa/offline-banner.tsx` | Network status banner |
| 4 | `components/pwa/pull-to-refresh.tsx` | Custom pull-to-refresh for standalone mode |
| 5 | `components/pwa/notification-settings.tsx` | Push notification subscription UI |
| 6 | `components/pwa/share-button.tsx` | Native share button with clipboard fallback |
| 7 | `contexts/NetworkStatusContext.tsx` | Online/offline state provider |
| 8 | `hooks/use-pwa-install.ts` | Install prompt state management + analytics |
| 9 | `hooks/use-is-standalone.ts` | Standalone mode detection |
| 10 | `hooks/use-swipe-navigation.ts` | Edge swipe-back gesture |
| 11 | `lib/haptics.ts` | Haptic feedback utility functions |
| 12 | `lib/badge.ts` | App badging API wrapper |
| 13 | `lib/push-notifications.ts` | Push subscription management |
| 14 | `public/offline.html` | Self-contained offline fallback page |
| 15 | `public/icons/` | Full icon set (11 files) |
| 16 | `public/screenshots/` | Manifest screenshots (4 files) |
| 17 | `public/splash/` | iOS splash screens (~15 files) |
| 18 | `scripts/generate-pwa-assets.ts` | Icon/splash generation script |
| 19 | `e2e/pwa.spec.ts` | PWA-specific Playwright tests |
| 20 | `e2e/mobile-nav.spec.ts` | Mobile navigation Playwright tests |
| 21 | `e2e/mobile-layouts.spec.ts` | Mobile layout verification tests |

### Existing Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `public/manifest.json` | Complete rewrite per section 3 |
| 2 | `public/sw.js` | Add offline fallback, update flow, periodic sync, expanded precache |
| 3 | `components/pwa/service-worker-register.tsx` | Full rewrite with update detection + toast |
| 4 | `app/layout.tsx` | Add viewport meta, theme-color, iOS splash links, NetworkStatusProvider, InstallPrompt |
| 5 | `app/globals.css` | Add standalone mode styles, safe-area utilities, touch target sizing |
| 6 | `app/members/layout.tsx` | Add pull-to-refresh, dynamic padding, NetworkStatusProvider integration |
| 7 | `components/members/mobile-top-bar.tsx` | Safe area padding, network indicator, back button |
| 8 | `components/members/mobile-bottom-nav.tsx` | Badge support, keyboard detection, standalone adjustments |
| 9 | `hooks/use-is-mobile.ts` | No changes needed (already good) |
| 10 | `middleware.ts` | Add `Permissions-Policy` for push notification permissions |

### Supabase Migrations

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `create_push_subscriptions` | Push notification subscription storage |
| 2 | `add_pwa_install_event_type` | Add 'pwa_install' to conversion_events enum (if applicable) |

### Dependencies to Add

```bash
npm install --save-dev sharp  # For icon/splash generation script
# No new runtime dependencies — all PWA APIs are native browser APIs
```

---

## Implementation Priority Order

**Phase 1: Installability (Days 1–2)**
1. Generate icon assets (section 4)
2. Rewrite manifest.json (section 3)
3. Add viewport/meta tags to root layout (section 7A)
4. Add standalone CSS (section 7B)
5. Create offline.html (section 5A)
6. Update sw.js (section 5)
7. Run Lighthouse → target PWA score 100%

**Phase 2: Install Prompt (Days 3–4)**
8. Build install-prompt.tsx with animation (section 6A)
9. Build ios-install-guide.tsx (section 6B)
10. Rewrite service-worker-register.tsx (section 6C)
11. Build use-pwa-install.ts hook (section 6D)

**Phase 3: Mobile Nav Polish (Days 5–6)**
12. Update mobile-top-bar.tsx (section 7C)
13. Update mobile-bottom-nav.tsx (section 7D)
14. Update members layout (section 7E)
15. Build swipe navigation (section 7F)
16. Viewport verification at all widths (section 7G)

**Phase 4: Native Features (Days 7–8)**
17. Build haptics.ts and apply (section 8B)
18. Build push notification system (section 8A)
19. Build badge API (section 8C)
20. Build share button (section 8D)
21. Add wake lock to AI Coach (section 8E)

**Phase 5: Offline & Connectivity (Days 9–10)**
22. Build NetworkStatusContext (section 9A)
23. Build offline-banner.tsx (section 9B)
24. Build pull-to-refresh.tsx (section 7E)
25. Add journal sync indicator (section 9D)

**Phase 6: iOS Hardening (Days 11–12)**
26. Generate iOS splash screens (section 4)
27. iOS keyboard handling (section 11B)
28. iOS session persistence testing (section 11E)
29. Build use-is-standalone.ts (section 11A)

**Phase 7: Testing & Verification (Days 13–14)**
30. Write all Playwright tests (section 12A)
31. Complete manual testing checklist (section 12B)
32. Set up Lighthouse CI (section 12C)
33. Performance profiling and optimization
34. Screenshot generation for manifest

---

## Design Tokens Reference (for all new components)

All new UI must use the Emerald Standard:

```
Primary Action:        var(--emerald-elite) → #10B981
Deep Background:       #0A0A0B (--onyx)
Card Background:       glass-card-heavy utility
Text Primary:          var(--ivory) → #F5F5F0
Text Secondary:        var(--muted-foreground) → #9A9A9A
Text Accent:           var(--champagne-hex) → #F5EDCC
Border:                rgba(255, 255, 255, 0.08–0.12)
Success:               emerald-400 → #34D399
Warning:               amber-500
Error:                 red-500
Heading Font:          Playfair Display (--font-serif)
Body Font:             Inter (--font-sans)
Data Font:             Geist Mono (--font-mono)
Border Radius:         var(--radius) → 0.5rem
Spring Animation:      { stiffness: 300, damping: 30 } (LUXURY_SPRING)
Transition Duration:   0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

**FORBIDDEN:** Do NOT use `#D4AF37` (old gold). If encountered, refactor to champagne `#F5EDCC`.

---

*End of specification. This document should provide everything needed for autonomous implementation.*
