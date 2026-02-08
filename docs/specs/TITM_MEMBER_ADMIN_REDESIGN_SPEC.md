# TITM Member & Admin Platform Redesign
## Complete Specification for Claude Code Implementation

**Version:** 2.0 — Massive.com Integration Enhancement
**Date:** February 8, 2026
**Author:** Architecture & Design Team
**Status:** SPECIFICATION - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Guiding Principles & Design Philosophy](#2-guiding-principles--design-philosophy)
3. [Design System Specification](#3-design-system-specification)
4. [Authentication & Role-Based Access](#4-authentication--role-based-access)
5. [Member Platform Architecture](#5-member-platform-architecture)
6. [Member Dashboard](#6-member-dashboard)
7. [Trade Journal - Complete Specification](#7-trade-journal---complete-specification)
8. [Social Sharing & Trade Cards](#8-social-sharing--trade-cards)
9. [Massive.com Market Data Integration](#9-massivecom-market-data-integration)
10. [AI Coach Integration Points](#10-ai-coach-integration-points)
11. [Admin Platform Architecture](#11-admin-platform-architecture)
12. [Admin Dashboard](#12-admin-dashboard)
13. [Admin Tab Configuration System](#13-admin-tab-configuration-system)
14. [Admin Settings & Discord Management](#14-admin-settings--discord-management)
15. [Admin Analytics & Insights](#15-admin-analytics--insights)
16. [Database Schema Changes](#16-database-schema-changes)
17. [API Routes Specification](#17-api-routes-specification)
18. [Mobile-First Responsive Strategy](#18-mobile-first-responsive-strategy)
19. [Implementation Phases](#19-implementation-phases)
20. [File Structure & Organization](#20-file-structure--organization)
21. [Testing Strategy](#21-testing-strategy)
22. [Performance Requirements](#22-performance-requirements)
23. [Accessibility Requirements](#23-accessibility-requirements)

---

## 1. Executive Summary

### Vision

Transform the TITM Member and Admin platforms from functional-but-basic dashboards into an immersive, premium trading command center that justifies premium membership pricing and delivers a cohesive experience matching the luxury aesthetic of the public-facing homepage.

### Scope

- **Complete redesign** of the `/members/*` and `/admin/*` routes
- **No backward compatibility** required (no current users)
- **Homepage remains untouched** - it is the design north star
- **AI Coach continues separate development** per its existing implementation plan
- The spec covers every component, every interaction, every database field

### What Changes

| Area | Current State | Target State |
|------|--------------|--------------|
| Member Dashboard | 3 placeholder cards | Live command center with WebSocket market data, streaks, AI insights, real-time P&L |
| Trade Journal | Basic CRUD table | Auto-enriched journal with live market context, AI grading, trade replay, pattern detection |
| Social Sharing | Non-existent | Verified trade cards with real market data overlays, social export, community gallery |
| Market Data | Unused Massive.com capacity | Live prices, auto-enrichment, trade replay, smart tags, verified stats |
| Admin Dashboard | Basic stats + placeholders | Analytics command center with member insights, revenue, engagement |
| Admin Tab Config | Hardcoded tab arrays | Visual drag-and-drop tab/permission configurator per Discord role |
| Navigation | Static sidebar | Adaptive nav with role-based tabs, mobile-optimized, contextual actions |
| Design Language | Functional but inconsistent | Unified luxury glassmorphism matching homepage exactly |

### Key Constraints

1. The public homepage (`app/page.tsx`) MUST NOT be modified
2. All shared components (navbar, footer) used by the homepage MUST remain stable
3. The AI Coach backend (`/backend/`) continues its own development roadmap
4. Discord OAuth remains the sole authentication method
5. Supabase remains the database/auth/storage provider
6. The existing design system (globals.css) is the source of truth

---

## 2. Guiding Principles & Design Philosophy

### 2.1 The "Quiet Luxury" Standard

Every screen, component, and interaction must pass the "Quiet Luxury" test:

- **Would this feel at home in a Bloomberg Terminal crossed with a private wealth management portal?**
- **Does this justify a $199+/month membership fee?**
- **Would a professional trader feel proud showing this to a colleague?**

### 2.2 Design Pillars

**Pillar 1: Cinematic Depth**
Every surface has depth. Glass cards float over dark backgrounds. Subtle shadows and blur create layers. Nothing is flat. Nothing is generic.

**Pillar 2: Emerald & Champagne Palette**
The color system communicates wealth and precision. Emerald for growth and action. Champagne for premium highlights. Onyx for depth. Ivory for clarity.

**Pillar 3: Intentional Animation**
Every animation serves a purpose. Page transitions use spring physics. Scroll reveals use staggered timing. Hover states provide feedback. Nothing moves without reason.

**Pillar 4: Information Density Without Clutter**
Trading platforms need data. Premium platforms present it elegantly. Use progressive disclosure, smart defaults, and contextual detail to show the right data at the right time.

**Pillar 5: Mobile-First, Desktop-Optimized**
Design for the phone in a trader's hand at market open, then expand for the multi-monitor desk setup. Every feature must work on both.

### 2.3 Anti-Patterns to Avoid

- NO jQuery Mobile patterns, styling, or component behaviors
- NO generic Bootstrap/Material UI aesthetics
- NO bright white backgrounds or light mode defaults
- NO cramped mobile layouts with tiny touch targets
- NO placeholder text that ships to production ("Coming soon", "TBD")
- NO inconsistent spacing, font sizes, or color values
- NO components that don't match the homepage design language

### 2.4 Typography Rules

| Element | Font | Weight | Size | Tracking |
|---------|------|--------|------|----------|
| Page Titles | Playfair Display | 600 | clamp(1.75rem, 3vw, 2.5rem) | -0.02em |
| Section Headers | Playfair Display | 500 | clamp(1.25rem, 2vw, 1.75rem) | -0.01em |
| Card Titles | Inter | 600 | 1rem (16px) | 0 |
| Body Text | Inter | 300-400 | 0.875rem (14px) | 0.01em |
| Data/Numbers | Geist Mono | 400 | 0.875rem (14px) | tnum |
| Labels/Captions | Inter | 500 | 0.75rem (12px) | 0.05em |
| Button Text | Inter | 500 | 0.875rem (14px) | 0.02em |

### 2.5 Spacing System

All spacing uses the 4px base grid (Tailwind's default):

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline spacing, icon gaps |
| `space-2` | 8px | Tight component spacing |
| `space-3` | 12px | Default component padding |
| `space-4` | 16px | Card padding, section gaps |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Major section gaps |
| `space-12` | 48px | Page-level spacing |
| `space-16` | 64px | Hero-level spacing |

---

## 3. Design System Specification

### 3.1 Color Tokens (from globals.css)

```
Primary Brand:
  --emerald-elite: #10B981      (CTAs, active states, positive P&L)
  --wealth-emerald: #047857     (primary buttons, links)
  --emerald-deep: #064E3B       (hover states, dark accents)
  --wealth-emerald-light: #059669 (secondary highlights)

Accent:
  --champagne: #F3E5AB          (premium highlights, badges, borders)
  --champagne-light: #F5F3ED    (subtle warm tones)
  --champagne-dark: #B8B5AD     (muted champagne)

Neutrals:
  --onyx: #0A0A0B               (primary background)
  --onyx-light: #141416         (card backgrounds, secondary)
  --ivory: #F5F5F0              (primary text)
  --muted-foreground: #9A9A9A   (secondary text)

Semantic:
  profit-green: #10B981         (matches emerald-elite for P&L consistency)
  loss-red: #EF4444             (red-500 for losses, destructive)
  warning-amber: #F59E0B        (amber-500 for warnings)
  info-blue: #3B82F6            (blue-500 for informational)
  neutral-gray: #6B7280         (gray-500 for neutral states)

Glass:
  --glass-bg: rgba(255, 255, 255, 0.03)
  --glass-border: rgba(255, 255, 255, 0.10)
  --glass-blur: 60px
```

### 3.2 Component Patterns

**Glass Card (Primary Container)**
```
Background: rgba(255, 255, 255, 0.03)
Backdrop-filter: blur(40px)
Border: 1px solid rgba(255, 255, 255, 0.10)
Border-radius: 12px (rounded-xl)
Padding: 24px (p-6)
Transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)
Hover: border-color rgba(255, 255, 255, 0.16), translateY(-2px)
```

**Glass Card Heavy (Feature Cards)**
```
Background: rgba(255, 255, 255, 0.02)
Backdrop-filter: blur(60px) saturate(120%)
Border: 1px solid rgba(255, 255, 255, 0.08)
Box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)
Border-radius: 16px (rounded-2xl)
```

**Stat Card**
```
Uses Glass Card base
Inner highlight: inset border-top 1px rgba(255, 255, 255, 0.06)
Label: text-muted-foreground, uppercase, tracking-widest, text-xs
Value: text-ivory, font-mono, text-2xl, font-semibold
Trend indicator: emerald for up, red for down, with arrow icon
```

**Data Table**
```
Container: Glass Card
Header row: bg-white/5, text-xs uppercase tracking-wider text-muted-foreground
Body rows: border-b border-white/5, hover:bg-white/3
Cells: py-3 px-4, font-mono for numbers
Sticky header on scroll
Alternating row subtle differentiation: odd:bg-white/[0.01]
```

**Modal/Sheet**
```
Overlay: bg-black/60 backdrop-blur-sm
Container: Glass Card Heavy with max-width
Entry animation: scale(0.95) + opacity(0) -> scale(1) + opacity(1), 300ms spring
Exit animation: reverse, 200ms ease-out
Close button: top-right, ghost variant, X icon
```

**Form Controls**
```
Input: bg-white/5, border border-white/10, rounded-lg
  Focus: ring-2 ring-emerald-elite/50, border-emerald-elite/30
  Placeholder: text-muted-foreground/50
Select: Same as input with chevron-down icon
Textarea: Same as input with resize-y
Toggle: emerald-elite when active, bg-white/10 when inactive
```

### 3.3 Animation Specifications

**Page Transitions (Framer Motion)**
```javascript
const pageVariants = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(2px)" }
};
const pageTransition = {
  type: "spring", stiffness: 300, damping: 30, mass: 0.8
};
// Duration: ~300-400ms perceived
```

**Card Enter (Stagger)**
```javascript
const containerVariants = {
  animate: { transition: { staggerChildren: 0.06 } }
};
const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
};
```

**Hover Lift**
```javascript
whileHover={{ y: -2, transition: { duration: 0.3 } }}
// Combined with CSS box-shadow transition
```

**Number Counter (for stats)**
```javascript
// Animate from 0 to target value over 1.2s
// Use spring physics with stiffness: 100, damping: 30
// Font: Geist Mono with tabular numbers for no-jitter counting
```

**Skeleton Loading**
```
Background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)
Animation: shimmer 2s infinite
Border-radius: matches target element
```

---

## 4. Authentication & Role-Based Access

### 4.1 Authentication Flow (Unchanged Core, Improved UX)

The core Discord OAuth flow remains. Changes focus on the post-auth experience:

```
User clicks "Login with Discord"
  -> Supabase redirects to Discord OAuth
  -> Discord authorizes, redirects to /auth/callback
  -> Supabase creates session
  -> sync-discord-roles edge function fires
  -> User profile cached in user_discord_profiles
  -> MemberAuthContext initializes:
     1. Fetch user session
     2. Fetch Discord profile (or create from Supabase data)
     3. Determine membership tier from role_tier_mapping
     4. Fetch allowed tabs from admin configuration
     5. Set permissions state
  -> Route to /members with personalized dashboard
```

### 4.2 Unified Permission System

**ELIMINATE the dual permission system.** Consolidate into a single, clean model:

```typescript
// NEW: Single permission model
interface MemberPermissions {
  tier: 'core' | 'pro' | 'executive' | null;
  allowedTabs: TabConfig[];          // Fetched from admin-configured tab list
  discordRoles: DiscordRole[];       // Raw Discord roles for display
  isAdmin: boolean;                  // From JWT app_metadata
  syncedAt: string;                  // Last sync timestamp
}

interface TabConfig {
  id: string;                        // e.g., 'dashboard', 'journal', 'ai-coach'
  label: string;                     // Display name
  icon: string;                      // Lucide icon name
  path: string;                      // Route path
  requiredTier: 'core' | 'pro' | 'executive';
  badge?: string;                    // e.g., 'New', 'Beta'
  badgeVariant?: 'emerald' | 'champagne' | 'destructive';
  description?: string;              // Tooltip text
  mobileVisible: boolean;            // Show in mobile bottom nav
  sortOrder: number;                 // Display order (admin-configurable)
}
```

**Remove:** `user_permissions` table queries from MemberAuthContext, legacy `hasPermission()` fallback, hardcoded `TABS` arrays.

**Replace with:** Admin-configured `tab_configurations` table (see Section 12).

### 4.3 Role Sync Improvements

```typescript
// Enhanced sync with better error UX
interface SyncResult {
  success: boolean;
  tier: string | null;
  tabsUnlocked: string[];           // List of tab IDs now available
  tabsLocked: string[];             // List of tab IDs not available (for upsell)
  discordUsername: string;
  discordAvatar: string;
  syncedAt: string;
  nextSyncAvailable: string;        // ISO timestamp (30-second cooldown)
}
```

### 4.4 Login Page Redesign

The login page (`/login`) must match the homepage aesthetic:

**Layout:**
- Full viewport height
- Aurora background (reuse from homepage)
- Centered glass card (max-w-md)
- TITM logo at top (SparkleLogoSvg)
- "Welcome to the Trading Room" heading (Playfair Display)
- Brief tagline: "Your premium trading command center awaits"
- Single large Discord login button (emerald, with Discord icon)
- Subtle security badges below: "256-bit encryption", "Discord OAuth 2.0"
- Footer links: Privacy Policy, Terms of Service

**States:**
- Default: Login button enabled
- Loading: Button shows spinner, "Connecting to Discord..."
- Error: Red toast with retry action
- Already authenticated: Auto-redirect to /members with spring animation

---

## 5. Member Platform Architecture

### 5.1 Layout Structure

```
/members/layout.tsx
├── MemberAuthProvider (context wrapper)
│   ├── Sidebar (desktop: fixed left 280px, mobile: hidden)
│   │   ├── Brand Header (logo + "Trading Room" text)
│   │   ├── User Profile Card (avatar, name, tier badge)
│   │   ├── Navigation (dynamic from admin-configured tabs)
│   │   ├── Quick Actions (Sync Roles, New Entry shortcuts)
│   │   └── Tier Upgrade CTA (if not executive)
│   ├── MobileTopBar (mobile only: logo + hamburger + profile icon)
│   ├── Content Area (with AnimatePresence page transitions)
│   │   └── {children} (page content)
│   └── MobileBottomNav (mobile only: max 5 filtered tabs)
```

### 5.2 Sidebar Specification

**Desktop Sidebar (>= 1024px / lg breakpoint):**

```
Width: 280px fixed
Background: rgba(10, 10, 11, 0.95)
Backdrop-filter: blur(40px)
Border-right: 1px solid rgba(255, 255, 255, 0.08)
Position: fixed, full height
z-index: 40
```

**Brand Section:**
- TITM SparkleLogoSvg (32px height)
- "Trading Room" in Playfair Display, text-sm, champagne color
- Divider: 1px gradient line (champagne-dark -> transparent)

**User Profile Card:**
```
Container: glass-card with p-4, mt-4, mx-3
Avatar: 48px round, Discord avatar with emerald ring border
  Fallback: Initials on emerald gradient background
Username: Inter 600, ivory, truncate
Tier Badge: Pill shape
  Core: bg-emerald-900/30, text-emerald-400, border-emerald-800/50
  Pro: bg-champagne/10, text-champagne, border-champagne/30
  Executive: bg-gradient-to-r from-champagne to-emerald-400, text-onyx
Last synced: text-xs text-muted-foreground, relative time ("2m ago")
```

**Navigation Items:**
```
Each item:
  Container: mx-3, rounded-lg, px-3, py-2.5
  Icon: 18px, text-muted-foreground (inactive), text-emerald-400 (active)
  Label: Inter 400, text-sm
  Badge: Pill, text-[10px], font-medium

Active state:
  Background: rgba(16, 185, 129, 0.08)
  Left border: 3px solid champagne with glow shadow
  Icon: text-emerald-400
  Label: text-ivory font-medium

Hover state (inactive):
  Background: rgba(255, 255, 255, 0.03)
  Label: text-ivory

Transition: all 200ms ease
```

**Default Tab Configuration (admin-overridable):**

| Tab ID | Label | Icon | Required Tier | Mobile | Badge |
|--------|-------|------|--------------|--------|-------|
| dashboard | Command Center | LayoutDashboard | core | Yes | - |
| journal | Trade Journal | BookOpen | core | Yes | - |
| ai-coach | AI Coach | Bot | pro | Yes | Beta |
| library | Training Library | GraduationCap | pro | No | - |
| studio | Trade Studio | Palette | executive | No | - |
| profile | Profile | UserCircle | core | Yes | - |

**Tier Upgrade CTA (shown when user is not Executive):**
```
Container: mx-3, mb-4, glass-card with champagne border glow
Icon: Sparkles (champagne)
Text: "Unlock {next_tier} features"
Button: btn-luxury-outline, small
Links to: /members/profile#upgrade (or external Stripe link)
```

### 5.3 Mobile Navigation

**Top Bar (< 1024px):**
```
Height: 56px
Background: rgba(10, 10, 11, 0.95)
Backdrop-filter: blur(20px)
Border-bottom: 1px solid rgba(255, 255, 255, 0.06)
Position: sticky top-0
z-index: 40

Left: Hamburger menu icon (opens slide-over drawer)
Center: TITM logo (24px height)
Right: User avatar (32px round, clickable -> profile)
```

**Bottom Nav (< 1024px):**
```
Height: 64px + safe-area-inset-bottom
Background: rgba(10, 10, 11, 0.98)
Backdrop-filter: blur(20px)
Border-top: 1px solid rgba(255, 255, 255, 0.06)
Position: fixed bottom-0
z-index: 40
Max items: 5 (dynamically filtered from allowed tabs, mobile-visible only)

Each item:
  Icon: 20px
  Label: text-[10px], font-medium
  Active: text-emerald-400, icon filled
  Inactive: text-muted-foreground
  Tap: haptic feedback (via navigator.vibrate if supported)
```

**Slide-Over Drawer (hamburger menu):**
```
Overlay: bg-black/60 backdrop-blur-sm
Panel: 300px from left, full height
  Matches sidebar design exactly
  Close: X button or swipe left gesture
  Transition: slide from left, 250ms spring
```

---

## 6. Member Dashboard

### 6.1 Overview

The dashboard is the member's command center. It must feel alive with real-time data while maintaining the premium aesthetic. Everything shown is real data from the database and live market feeds — no mocks, no placeholders. The Massive.com WebSocket integration provides live SPX/NDX prices that update every second, making the dashboard feel institutional-grade.

### 6.2 Layout (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│  Welcome Header (greeting + date + market status)        │
├─────────────────────────────────────────────────────────┤
│  ┌─ Live Market Ticker (full width) ───────────────────┐ │
│  │  SPX $6,042.50 ▲+0.32%  │  NDX $21,540 ▲+0.18%    │ │
│  │  VWAP: $6,035  │  ATR: $47.25  │  IV Rank: 42%     │ │
│  │  (WebSocket real-time from Massive.com)              │ │
│  └─────────────────────────────────────────────────────┘ │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  Win Rate │  P&L MTD │  Streak  │ AI Grade │  Trades MTD │
│  (stat)   │  (stat)  │  (stat)  │  (stat)  │   (stat)    │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                                                          │
│  ┌─ P&L Equity Curve (60% width) ──┐ ┌─ Quick Actions ─┐│
│  │  Recharts area chart             │ │ + New Trade      ││
│  │  30-day rolling P&L              │ │ Ask AI Coach    ││
│  │  Emerald fill, champagne line    │ │ Share Last Win  ││
│  └──────────────────────────────────┘ └─────────────────┘│
│                                                          │
│  ┌─ Recent Trades (full width) ────────────────────────┐ │
│  │  Last 5 journal entries as compact cards              │ │
│  │  Symbol | Direction | P&L | AI Grade | Date           │ │
│  │  "View all" link -> /members/journal                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ AI Insights (50%) ──────┐ ┌─ Trading Calendar (50%)┐ │
│  │  Latest AI coach summary  │ │  Heat map of trade days │ │
│  │  Pattern detection note   │ │  Green = profit day     │ │
│  │  "Chat with Coach" CTA   │ │  Red = loss day          │ │
│  └──────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Layout (Mobile)

```
┌─────────────────────────────┐
│  Welcome Header (compact)    │
├─────────────────────────────┤
│  Stat Cards (2x2 grid)       │
│  ┌────────┐ ┌────────┐      │
│  │Win Rate│ │ P&L MTD│      │
│  └────────┘ └────────┘      │
│  ┌────────┐ ┌────────┐      │
│  │ Streak │ │AI Grade│      │
│  └────────┘ └────────┘      │
├─────────────────────────────┤
│  Quick Actions (horizontal   │
│  scroll chips)               │
├─────────────────────────────┤
│  P&L Chart (full width)     │
├─────────────────────────────┤
│  Recent Trades (stacked      │
│  cards, swipeable)           │
├─────────────────────────────┤
│  AI Insights Card            │
├─────────────────────────────┤
│  Trading Calendar (compact)  │
└─────────────────────────────┘
```

### 6.4 Component Specifications

#### Live Market Ticker (NEW — Massive.com WebSocket)

```typescript
interface LiveMarketTickerProps {
  symbols: string[];  // ['SPX', 'NDX']
  // Data streams via Massive.com WebSocket connection
}
```

```
Container: Glass Card (subtle), full width, py-3 px-6
Background: rgba(255,255,255,0.02) with very subtle emerald gradient on left edge
Layout: flex items-center justify-between, horizontal scroll on mobile

Data points (live-updating via WebSocket):
  SPX Price: Geist Mono, 16px, font-semibold, ivory
    Change: +$X.XX (+X.XX%), emerald if up / red if down
    Pulse dot: emerald or red, animating
  NDX Price: Same format
  VWAP: "VWAP $X,XXX" — Geist Mono, text-sm, muted
  ATR(14): "ATR $XX.XX" — Geist Mono, text-sm, muted
  IV Rank: "IV Rank XX%" — with color coding:
    < 25%: emerald (low IV = cheap options)
    25-50%: ivory (normal)
    50-75%: champagne (elevated)
    > 75%: amber (high IV)

Update frequency:
  Prices: Every 1 second via WebSocket
  VWAP/ATR: Every 60 seconds via REST (cached)
  IV Rank: Every 5 minutes via REST

Market hours behavior:
  Pre-market (4-9:30 AM ET): Show pre-market prices, label "Pre-Market"
  Open (9:30 AM-4 PM ET): Full live data, pulse animation
  After hours (4-8 PM ET): Show last price, label "After Hours"
  Closed: Show previous close, gray dot, no animation

Fallback: If WebSocket disconnects, fall back to 5-second REST polling
Connection indicator: Tiny dot (emerald = live, amber = polling, red = disconnected)
```

#### Welcome Header

```typescript
interface WelcomeHeaderProps {
  username: string;
  memberSince: string;
  marketStatus: 'pre-market' | 'open' | 'closed' | 'after-hours';
}
```

```
Layout: flex justify-between items-center
Left side:
  Greeting: "Good morning, {firstName}" (time-aware: morning/afternoon/evening)
  Font: Playfair Display, text-xl, ivory
  Subtitle: "Monday, February 8, 2026" - Inter, text-sm, text-muted-foreground

Right side:
  Market Status Pill:
    Pre-market: amber pulse dot + "Pre-Market" text
    Open: emerald pulse dot + "Market Open" text
    Closed: gray dot + "Market Closed" text
    After-hours: blue dot + "After Hours" text
  Time: Current ET time in Geist Mono
```

#### Stat Cards (5 cards in row, 2x2+1 on mobile)

Each stat card follows the design system Stat Card pattern:

**Win Rate Card:**
```
Label: "WIN RATE"
Value: "{percentage}%" (from journal_stats RPC)
Trend: vs. last month, emerald up / red down
Icon: Target (lucide)
Accent: Emerald glow on positive trend
```

**P&L MTD Card:**
```
Label: "P&L THIS MONTH"
Value: "${amount}" with Geist Mono, colored (emerald/red)
Trend: Percentage change vs. previous month
Icon: TrendingUp or TrendingDown (dynamic)
Accent: Matches P&L direction
```

**Streak Card:**
```
Label: "CURRENT STREAK"
Value: "{count} {wins/losses}" with fire emoji for 3+ win streak
Trend: "Best: {longest_streak}"
Icon: Flame (lucide)
Accent: Champagne for 5+ win streak (exceptional)
```

**AI Grade Card:**
```
Label: "AVG AI GRADE"
Value: Letter grade (A+, A, B+, etc.) from average of recent AI analyses
Trend: Arrow showing improvement/decline
Icon: GraduationCap (lucide)
Accent: Grade-colored (A=emerald, B=champagne, C=amber, D/F=red)
```

**Trades MTD Card:**
```
Label: "TRADES THIS MONTH"
Value: "{count}"
Trend: "vs. {last_month_count} last month"
Icon: BarChart3 (lucide)
Accent: Neutral
```

#### P&L Equity Curve

```typescript
interface EquityCurveProps {
  data: { date: string; cumulativePnl: number; }[];
  timeRange: '7d' | '30d' | '90d' | 'ytd' | 'all';
}
```

```
Library: Recharts AreaChart
Container: Glass Card Heavy, min-height 280px
Background fill: Emerald gradient (0.1 opacity at top -> 0 at bottom)
Line: 2px, champagne (#F3E5AB)
Grid: Subtle dashed lines, rgba(255,255,255,0.04)
X-axis: Date labels, text-xs, text-muted-foreground
Y-axis: Dollar amounts, Geist Mono, text-xs
Tooltip: Glass card with date + P&L value
Time range selector: Pill buttons in top-right corner
  Active: bg-emerald-900/30, text-emerald-400
  Inactive: text-muted-foreground
Zero line: Dashed, rgba(255,255,255,0.1)
```

#### Quick Actions Card

```
Container: Glass Card, flex flex-col gap-3
Title: "Quick Actions" in card-title style

Actions (each is a button):
1. "+ Log Trade" -> Opens journal entry modal
   Icon: Plus, Variant: btn-premium
2. "Ask AI Coach" -> Navigates to /members/ai-coach
   Icon: Bot, Variant: btn-luxury-outline
3. "Share Last Win" -> Opens trade card builder with last winning trade
   Icon: Share2, Variant: btn-luxury-glass
```

#### Recent Trades

```
Container: Glass Card, full width
Header: "Recent Trades" + "View All" link (text-emerald-400, hover underline)

Trade rows (last 5 entries from trading_journal_entries):
Each row:
  Layout: flex items-center gap-4, py-3, border-b border-white/5
  Symbol: font-mono font-semibold text-ivory
  Direction badge:
    Long: bg-emerald-900/30 text-emerald-400 "LONG"
    Short: bg-red-900/30 text-red-400 "SHORT"
  P&L: font-mono, colored (emerald/red), with $ and %
  AI Grade: Letter in small circle (colored by grade)
  Date: text-muted-foreground text-xs, relative ("2h ago", "Yesterday")
  Arrow: ChevronRight icon for click-to-expand/navigate

Click behavior: Navigate to /members/journal with entry highlighted
```

#### AI Insights Card

```typescript
interface AIInsightsProps {
  lastAnalysis: {
    summary: string;
    patterns: string[];
    suggestion: string;
  } | null;
}
```

```
Container: Glass Card with champagne border glow
Header: "AI Coach Insights" with Bot icon (champagne)

Content (if analyses exist):
  Latest insight summary (2-3 lines, text-sm)
  Pattern badges: Pill tags for detected patterns
    e.g., "Overtrading Mondays", "Strong at Support Bounces"
  Suggestion: Italic, text-muted-foreground
  CTA: "Discuss with Coach" -> /members/ai-coach

Content (if no analyses):
  Friendly empty state with Bot illustration
  "Start logging trades to unlock AI insights"
  CTA: "Log Your First Trade" -> opens journal entry modal
```

#### Trading Calendar Heatmap

```typescript
interface CalendarHeatmapProps {
  data: { date: string; pnl: number; tradeCount: number; }[];
  months: number; // 3 or 6
}
```

```
Container: Glass Card
Header: "Trading Activity" with Calendar icon

Grid: GitHub-style contribution heatmap
  Each cell: 12x12px rounded-sm
  Colors:
    No trades: rgba(255,255,255,0.03)
    Profit (low): emerald-900/40
    Profit (med): emerald-700/60
    Profit (high): emerald-500/80
    Loss (low): red-900/40
    Loss (med): red-700/60
    Loss (high): red-500/80

  Hover tooltip: Glass card with date, P&L, trade count
  Day labels: M, W, F on left
  Month labels: Jan, Feb, Mar on top

  Mobile: Show last 3 months
  Desktop: Show last 6 months
```

### 6.5 Data Sources

All dashboard data comes from these sources:

| Widget | Data Source | Query / Feed |
|--------|-----------|-------|
| **Live Market Ticker** | **Massive.com WebSocket** | **Real-time price stream for SPX, NDX** |
| **VWAP / ATR / IV Rank** | **Massive.com REST** | **GET /api/levels/:symbol (cached 60s), GET /api/options/:symbol/chain (IV calc)** |
| Win Rate | trading_journal_entries | RPC: get_journal_stats(user_id, date_range) |
| P&L MTD | trading_journal_entries | SUM(pnl) WHERE trade_date >= first_of_month |
| Streak | journal_streaks | Direct table read |
| AI Grade | trading_journal_entries | AVG(ai_analysis->grade) mapped to letter |
| Trades MTD | trading_journal_entries | COUNT(*) WHERE trade_date >= first_of_month |
| Equity Curve | trading_journal_entries | Cumulative SUM(pnl) ordered by trade_date |
| Recent Trades | trading_journal_entries | Last 5, ordered by created_at DESC |
| AI Insights | trading_journal_entries | Latest ai_analysis summary fields |
| Calendar | trading_journal_entries | GROUP BY trade_date, SUM(pnl), COUNT(*) |

---

## 7. Trade Journal - Complete Specification

### 7.1 Overview

The Trade Journal is the core feature of the member platform. It must feel like a professional-grade trading diary meets an AI-powered performance coach. Every trade logged becomes a data point that feeds AI analysis, performance metrics, and social sharing.

**Key differentiator:** Every journal entry is automatically enriched with real market data from Massive.com — VWAP, key levels, volume context, IV rank, and options Greeks at the exact moment of trade entry and exit. No other trading journal offers this. Members see not just WHAT they traded, but the full market context of WHY the trade worked or didn't. See Section 9 (Massive.com Integration) for complete enrichment specification.

### 7.2 Page Layout (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│  Header: "Trade Journal" (Playfair) + Stats Bar             │
├────────────────────────────────────────────────────────────┤
│  ┌─ Filter Bar ──────────────────────────────────────────┐  │
│  │ Date Range | Symbol Search | Direction | P&L Filter   │  │
│  │ Tags | AI Grade | Sort By | [+ New Entry] [Export]    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Summary Stats Row ──────────────────────────────────┐   │
│  │ Total Trades | Win Rate | Avg P&L | Best Trade | ...  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Entries Table/Cards ────────────────────────────────┐   │
│  │                                                       │   │
│  │  [Table view] or [Card view] toggle                   │   │
│  │                                                       │   │
│  │  Sortable columns with pagination                     │   │
│  │  Click row -> Expand inline or open detail sheet      │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Pagination ─────────────────────────────────────────┐   │
│  │ Showing 1-25 of 142 | < 1 2 3 ... 6 >               │   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Page Layout (Mobile)

```
┌──────────────────────────────┐
│  Header (compact) + [+] btn  │
├──────────────────────────────┤
│  Stats scroll (horizontal    │
│  chip cards)                 │
├──────────────────────────────┤
│  Filter chips (horizontal    │
│  scroll, collapsible)        │
├──────────────────────────────┤
│  Card View (default mobile)  │
│  ┌─ Trade Card ────────────┐ │
│  │ SPY  LONG  +$340       │ │
│  │ Feb 7 | Grade: A- | ★★★│ │
│  │ [Share] [Edit] [Detail] │ │
│  └─────────────────────────┘ │
│  ┌─ Trade Card ────────────┐ │
│  │ QQQ  SHORT  -$120      │ │
│  │ Feb 6 | Grade: C+ | ★★ │ │
│  └─────────────────────────┘ │
│  ... (infinite scroll)       │
└──────────────────────────────┘
```

### 7.4 Filter Bar Specification

```typescript
interface JournalFilters {
  dateRange: {
    from: Date | null;
    to: Date | null;
    preset: 'today' | 'this-week' | 'this-month' | 'last-month' | '3-months' | 'ytd' | 'all' | 'custom';
  };
  symbol: string | null;            // Text search, auto-uppercase
  direction: 'long' | 'short' | 'all';
  pnlFilter: 'winners' | 'losers' | 'all';
  tags: string[];                    // Multi-select from existing tags
  aiGrade: string[] | null;          // e.g., ['A+', 'A', 'A-']
  sortBy: 'date-desc' | 'date-asc' | 'pnl-desc' | 'pnl-asc' | 'rating-desc' | 'grade-desc';
  view: 'table' | 'cards';
}
```

**Desktop Filter Bar:**
```
Container: Glass Card, flex flex-wrap gap-3, items-center
Background: slightly more opaque than content cards

Date Range: DatePicker with preset buttons
  Presets as pills: Today, This Week, This Month, 3M, YTD, All
  Custom: opens calendar popover (react-day-picker)

Symbol: Search input with magnifying glass icon
  Debounced 300ms
  Auto-uppercase on input
  Shows recent symbols as dropdown suggestions

Direction: Segmented control (All | Long | Short)
  All: default, no highlight
  Long: emerald highlight
  Short: red highlight

P&L: Segmented control (All | Winners | Losers)
  Winners: emerald
  Losers: red

Tags: Multi-select dropdown
  Shows existing tags from user's entries
  Checkboxes with count badges

AI Grade: Multi-select dropdown
  Grade options: A+, A, A-, B+, B, B-, C+, C, C-, D, F
  Colored indicators per grade

Sort: Single select dropdown
  Options: Newest, Oldest, Highest P&L, Lowest P&L, Best Rating, Best Grade

View Toggle: Icon buttons (Table icon | Grid icon)
  Active: bg-emerald-900/30

Active filter count badge on mobile filter button
Clear all filters: "Reset" text button
```

**Mobile Filter:**
```
Default: Hidden behind "Filters" button with active count badge
Opens: Bottom sheet (slide up) with all filter options stacked vertically
Apply button: btn-premium, full width
Reset: ghost button
```

### 7.5 Summary Stats Row

```
Container: flex gap-4, horizontal scroll on mobile
Each stat: Glass Card (compact), min-w-[140px]

Stats displayed:
1. Total Trades: COUNT of filtered entries
2. Win Rate: percentage with colored trend arrow
3. Avg P&L: dollar amount, colored
4. Best Trade: symbol + P&L of highest profitable trade
5. Worst Trade: symbol + P&L of worst loss
6. Profit Factor: total wins / total losses ratio
7. Avg Win: average P&L of winning trades
8. Avg Loss: average P&L of losing trades

Each stat:
  Label: text-[10px] uppercase tracking-widest text-muted-foreground
  Value: text-lg font-mono font-semibold, colored where applicable
  Container: p-3, rounded-lg, bg-white/[0.02], border border-white/5
```

### 7.6 Entries Table (Table View)

```
Container: Glass Card, overflow-x-auto

Columns:
| # | Column | Width | Sortable | Format |
|---|--------|-------|----------|--------|
| 1 | Date | 100px | Yes | "Feb 7" or "Feb 7, 2026" |
| 2 | Symbol | 80px | Yes | Uppercase mono, bold |
| 3 | Direction | 80px | Yes | Badge (Long=emerald, Short=red) |
| 4 | Entry | 90px | No | $X,XXX.XX mono |
| 5 | Exit | 90px | No | $X,XXX.XX mono |
| 6 | Size | 70px | Yes | Number, right-aligned |
| 7 | P&L ($) | 100px | Yes | Colored, with +/- prefix |
| 8 | P&L (%) | 80px | Yes | Colored percentage |
| 9 | Grade | 60px | Yes | Letter in colored circle |
| 10 | Rating | 80px | Yes | 1-5 stars (filled emerald) |
| 11 | Tags | flex | No | Pill badges, max 2 shown + "+N" |
| 12 | Actions | 80px | No | Share, Edit, Delete icons |

Header row:
  Background: bg-white/5
  Text: text-[10px] uppercase tracking-wider text-muted-foreground
  Sticky on scroll
  Click column header to sort (shows sort arrow indicator)

Body rows:
  Height: 52px
  Border: border-b border-white/5
  Hover: bg-white/[0.02]
  Click (non-action area): Expand inline detail OR open side sheet

  Winning rows: Subtle emerald left border (2px)
  Losing rows: Subtle red left border (2px)

Row expansion (inline):
  Shows below the row with slide-down animation
  Contains: Screenshot thumbnail, setup/execution/lesson notes, full AI analysis
  Close: Click row again or X button

Empty state:
  Illustration: Journal/book icon in champagne
  Heading: "Your trading story starts here"
  Text: "Log your first trade and start building your performance history"
  CTA: btn-premium "+ Log Your First Trade"
```

### 7.7 Entries Cards (Card View)

```
Grid: grid-cols-1 md:grid-cols-2 xl:grid-cols-3, gap-4

Each card:
  Container: Glass Card with hover lift
  Layout:
    Top row: Symbol (bold, large) + Direction badge + P&L (colored, right-aligned)
    Middle row: Entry/Exit prices (mono, small) + Date
    Bottom row: AI Grade circle + Stars + Tags (max 2 pills)
    Footer: [Share] [Edit] icons, subtle divider above

  Winning cards: emerald top border (2px)
  Losing cards: red top border (2px)

  Screenshot indicator: Small image icon in corner if screenshot exists

  Click: Opens full detail sheet
```

### 7.8 New Entry / Edit Entry Modal

**Trigger:** "+ New Entry" button or Edit action on existing entry

**Container:** Full-screen sheet (slides from right on desktop, bottom on mobile)

```typescript
interface JournalEntryForm {
  // Trade Identification
  trade_date: Date;                  // Required, defaults to today
  symbol: string;                    // Required, auto-uppercase
  direction: 'long' | 'short';      // Required, toggle

  // Price Data
  entry_price: number | null;        // Optional (AI can fill)
  exit_price: number | null;         // Optional (AI can fill)
  position_size: number | null;      // Optional

  // P&L (auto-calculated if prices provided, or manual)
  pnl: number | null;               // Can be manually entered
  pnl_percentage: number | null;     // Auto-calc or manual

  // Media
  screenshot: File | string | null;  // File upload OR URL

  // Notes
  setup_notes: string;               // Markdown supported
  execution_notes: string;           // Markdown supported
  lessons_learned: string;           // Markdown supported

  // Metadata
  tags: string[];                    // Autocomplete from existing tags
  rating: 1 | 2 | 3 | 4 | 5;       // Star rating

  // AI (populated after analysis)
  ai_analysis: AITradeAnalysis | null;
}
```

**Form Layout:**

```
┌─ Entry Sheet ─────────────────────────────────────────┐
│  Header: "Log Trade" or "Edit Trade" + Close button    │
│                                                        │
│  ┌─ Trade Details Section ──────────────────────────┐  │
│  │  Date: [DatePicker]     Symbol: [Input]          │  │
│  │  Direction: [Long | Short toggle]                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Screenshot Section ─────────────────────────────┐  │
│  │  [Drop zone for screenshot upload]                │  │
│  │  "Drop screenshot or click to upload"             │  │
│  │  Supported: PNG, JPG, WebP (max 5MB)             │  │
│  │                                                    │  │
│  │  [Analyze with AI] button (emerald, sparkle icon) │  │
│  │  When clicked: spinner + "Analyzing your trade..."│  │
│  │  Result: Auto-fills prices, P&L, shows grade      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Price & P&L Section ────────────────────────────┐  │
│  │  Entry Price: [$____]  Exit Price: [$____]       │  │
│  │  Position Size: [____]                            │  │
│  │  P&L: [$____] (auto-calc or manual)              │  │
│  │  P&L %: [____%] (auto-calc or manual)            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Notes Section (tabbed) ─────────────────────────┐  │
│  │  [Setup] [Execution] [Lessons]                    │  │
│  │  ┌─ Active tab textarea ────────────────────────┐ │  │
│  │  │  Markdown-enabled textarea                    │ │  │
│  │  │  Placeholder: context-specific hints          │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Tags & Rating ──────────────────────────────────┐  │
│  │  Tags: [autocomplete multi-input]                 │  │
│  │  Quick tags: [Breakout] [Reversal] [Support]     │  │
│  │              [Momentum] [Scalp] [Swing]           │  │
│  │  Rating: ★★★★★ (clickable stars)                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ AI Analysis Panel (shown after analysis) ───────┐  │
│  │  Grade: [A-] in large colored circle              │  │
│  │  Summary: Brief AI analysis text                  │  │
│  │  Strengths: Bullet list with check icons          │  │
│  │  Improvements: Bullet list with arrow icons       │  │
│  │  Coaching Note: Italic text                       │  │
│  │  [Discuss with AI Coach] button                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Footer: [Cancel] [Save Draft] [Save & Close]         │
│  Delete: Ghost red button (with confirmation)          │
└───────────────────────────────────────────────────────┘
```

**Screenshot Upload (replacing URL-only input):**

```typescript
interface ScreenshotUpload {
  // Accept file upload via react-dropzone
  accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] };
  maxSize: 5 * 1024 * 1024; // 5MB

  // Upload to Supabase Storage bucket: 'trade-screenshots'
  // Path: {user_id}/{entry_id}/{filename}
  // Returns public URL for storage

  // Also accept URL paste (for backward compatibility)
  // Validate URL points to image (HEAD request check content-type)
}
```

**AI Analysis Flow:**

```
1. User uploads screenshot or provides URL
2. User clicks "Analyze with AI" button
3. Button shows loading state: spinner + "Analyzing your trade..."
4. POST /api/members/journal/analyze with image data
5. Edge function calls GPT-4 Vision
6. Response auto-fills:
   - symbol, direction (if extractable)
   - entry_price, exit_price (if visible)
   - pnl, pnl_percentage (if calculable)
   - ai_analysis object (grade, summary, strengths, improvements, coaching)
7. Form fields that were auto-filled show subtle champagne highlight
8. User can override any auto-filled value
9. AI Analysis Panel appears with full analysis
```

**Quick Tags System:**

```
Predefined quick tags (shown as clickable pills):
  Strategy: Breakout, Reversal, Support Bounce, Momentum, Scalp, Swing, Gap Fill
  Pattern: Double Top, Double Bottom, Head & Shoulders, Triangle, Flag, Channel
  Condition: High Volume, Low Volume, News Catalyst, Earnings, FOMC, Expiration

Custom tags: User can type and press Enter to create
Autocomplete: Shows matching existing tags as user types
Remove: Click X on tag pill
Max tags per entry: 10
```

### 7.9 Entry Detail Sheet

Opened when clicking a row/card in the journal. Full detail view of a single trade.

```
Container: Side sheet (right slide, 600px on desktop, full-screen mobile)

┌─ Entry Detail ────────────────────────────────────────┐
│  Header: {Symbol} {Direction} trade on {Date}          │
│  Close: X button                                       │
│                                                        │
│  ┌─ Trade Replay Chart (Massive.com data) ──────────┐  │
│  │  1-min candlestick chart for trade day             │  │
│  │  Entry/exit markers, VWAP line, PDH/PDL levels    │  │
│  │  [▶ Play] [1x/2x/5x/10x] replay controls         │  │
│  │  (See Section 9.4 for full spec)                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Screenshot (if exists) ────────────────────────┐  │
│  │  Full-width image, click to open in lightbox     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Trade Summary Card ─────────────────────────────┐  │
│  │  Direction: Badge | Entry: $XXX | Exit: $XXX     │  │
│  │  Size: XXX | P&L: +$XXX (+X.X%) | Rating: ★★★★  │  │
│  │  ✓ Verified | 1.8x Avg Volume | VWAP: $X,XXX    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Market Context (auto-enriched from Massive.com) ┐  │
│  │  Entry: 0.2 ATR from PDH | Vol: 180% avg         │  │
│  │  Exit: At Camarilla H3 | Day type: Trending      │  │
│  │  IV Rank: 42% at entry → 38% at exit              │  │
│  │  (See Section 9.3 for full enrichment spec)       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ AI Analysis (if exists) ────────────────────────┐  │
│  │  Grade: [A-] large circle                         │  │
│  │  Summary paragraph                                │  │
│  │                                                    │  │
│  │  Trend Analysis:                                   │  │
│  │    Direction: Bullish | Strength: Strong           │  │
│  │    Notes: "..."                                    │  │
│  │                                                    │  │
│  │  Entry Analysis:                                   │  │
│  │    Quality: Good                                   │  │
│  │    Observations: bullet list                       │  │
│  │    Improvements: bullet list                       │  │
│  │                                                    │  │
│  │  Exit Analysis: (same structure)                   │  │
│  │                                                    │  │
│  │  Risk Management: Score X/10                       │  │
│  │    observations + suggestions                      │  │
│  │                                                    │  │
│  │  Coaching Note: italic text                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Notes Accordion ────────────────────────────────┐  │
│  │  ▸ Setup Notes                                    │  │
│  │  ▸ Execution Notes                                │  │
│  │  ▸ Lessons Learned                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Tags: pill badges                                     │
│                                                        │
│  Footer: [Share Trade Card] [Edit] [Delete]            │
└───────────────────────────────────────────────────────┘
```

### 7.10 Journal Export

```
Trigger: "Export" button in filter bar
Format options: CSV, PDF (future)

CSV Export:
  Columns: Date, Symbol, Direction, Entry Price, Exit Price, Size, P&L, P&L%,
           Rating, AI Grade, Tags, Setup Notes, Execution Notes, Lessons Learned
  Filename: TITM_Journal_{username}_{date_range}.csv
  Respects current filters

  Implementation: Client-side generation using filtered data
  Download: Blob + anchor click pattern
```

---

## 8. Social Sharing & Trade Cards

### 8.1 Overview

Trade Cards are the social currency of the platform. Members can build beautiful, branded cards from their winning (or learning) trades and share them on social media. This drives organic growth and community engagement.

### 8.2 Trade Card Builder

**Trigger points:**
1. "Share" button on any journal entry
2. "Share Last Win" quick action on dashboard
3. "Share Trade Card" in entry detail sheet
4. Dedicated "Card Studio" subsection accessible from journal

**Builder Interface:**

```
Container: Full-screen modal or sheet

┌─ Trade Card Builder ──────────────────────────────────┐
│                                                        │
│  Left Panel (60%): Live Preview                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │            [LIVE CARD PREVIEW]                     │  │
│  │            Updates in real-time                     │  │
│  │            as settings change                      │  │
│  │                                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Right Panel (40%): Customization                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Template: [Dark] [Emerald] [Champagne] [Minimal]│  │
│  │                                                    │  │
│  │  Show/Hide toggles:                                │  │
│  │    ☑ Symbol & Direction                            │  │
│  │    ☑ P&L ($ and %)                                 │  │
│  │    ☐ Entry/Exit Prices                              │  │
│  │    ☑ Trade Date                                     │  │
│  │    ☑ AI Grade                                       │  │
│  │    ☐ Screenshot                                      │  │
│  │    ☑ Rating Stars                                    │  │
│  │    ☐ Notes Preview                                   │  │
│  │    ☑ TITM Branding                                  │  │
│  │                                                    │  │
│  │  Custom message: [textarea]                        │  │
│  │  "Great setup on SPY today!"                       │  │
│  │                                                    │  │
│  │  Watermark position: [Bottom-Left ▾]              │  │
│  │                                                    │  │
│  │  [Download PNG] [Copy to Clipboard]               │  │
│  │  [Share to Twitter] [Share to Discord]             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Mobile: Stacked (preview on top, controls below)      │
└───────────────────────────────────────────────────────┘
```

### 8.3 Trade Card Templates

**Template 1: "Dark Elite" (Default)**
```
Size: 1200x675px (Twitter/LinkedIn optimal)
Background: Linear gradient from #0A0A0B to #141416
Top section:
  TITM logo (small, top-left)
  Trade date (top-right, muted)
Center:
  Symbol in Playfair Display, 48px
  Direction badge (emerald/red pill)
  P&L in large Geist Mono, 64px, colored
  P&L percentage below
Bottom section:
  AI Grade circle (left)
  Star rating (center)
  Custom message (right, if provided)
Footer:
  "Trade In The Money" watermark, champagne, small
  Optional: @username or discord handle
Border: 1px emerald-900/30 with corner glow
```

**Template 2: "Emerald Gradient"**
```
Size: 1200x675px
Background: Radial gradient from #064E3B center to #0A0A0B edges
Same content layout as Dark Elite
Border: 1px emerald-500/20
Vignette overlay on edges
```

**Template 3: "Champagne Premium"**
```
Size: 1200x675px
Background: Linear gradient from #0A0A0B to subtle champagne tint
Accent elements in champagne instead of emerald
Symbol and P&L in champagne color
Elegant, premium feel
```

**Template 4: "Minimal"**
```
Size: 1200x675px
Background: Solid #0A0A0B
Minimal elements: Symbol, P&L, Date only
Large typography, maximum whitespace
Clean and professional
```

**Template 5: "Story" (Instagram/TikTok)**
```
Size: 1080x1920px (9:16 vertical)
Background: Full-height gradient
Large centered content
Bottom third: custom message area
Optimized for mobile viewing
```

### 8.4 Card Generation Technical Implementation

```typescript
// Using html-to-image library (already in dependencies)
import { toPng, toJpeg } from 'html-to-image';

interface TradeCardConfig {
  template: 'dark-elite' | 'emerald-gradient' | 'champagne-premium' | 'minimal' | 'story';
  entry: JournalEntry;
  showFields: {
    symbol: boolean;
    direction: boolean;
    pnl: boolean;
    prices: boolean;
    date: boolean;
    grade: boolean;
    screenshot: boolean;
    rating: boolean;
    notes: boolean;
    branding: boolean;
  };
  customMessage: string;
  watermarkPosition: 'bottom-left' | 'bottom-right' | 'bottom-center';
  username?: string;
}

// Generation flow:
// 1. Render card as React component in hidden container
// 2. Use html-to-image to capture as PNG/JPEG
// 3. For download: Create blob URL + anchor click
// 4. For clipboard: Use navigator.clipboard.write()
// 5. For Twitter: Open share URL with pre-filled text + image upload prompt
// 6. For Discord: Copy image to clipboard for paste in Discord
```

### 8.5 Share Actions

**Download PNG:**
```
html-to-image -> toPng() -> download
Filename: TITM_{symbol}_{date}_{username}.png
Resolution: 2x for retina displays
```

**Copy to Clipboard:**
```
html-to-image -> toBlob() -> navigator.clipboard.write([ClipboardItem])
Toast: "Trade card copied to clipboard!"
```

**Share to Twitter/X:**
```
// Twitter doesn't support direct image upload via URL
// Strategy: Copy image to clipboard + open tweet compose with text
window.open(`https://twitter.com/intent/tweet?text=${encodedText}`)
Text template: "🎯 ${symbol} ${direction} | ${pnl} (${pnl_pct}%) | Trade In The Money #TITM #Trading"
Toast: "Paste your trade card image in the tweet!"
```

**Share to Discord:**
```
// Copy image to clipboard for paste in Discord
// Similar to clipboard copy
Toast: "Trade card copied! Paste in your Discord channel"
```

### 8.6 Community Gallery (Future Enhancement)

```
Location: /members/gallery (new tab, admin-configurable)
Description: Members can opt-in to share trade cards to a community gallery
Features:
  - Public gallery of member trade cards
  - Upvote/celebrate system (not comments, just reactions)
  - Filter by symbol, date, P&L range
  - Weekly "Best Trades" highlight
  - Gamification: "Most Shared", "Highest Win Rate Shared"

Database table: shared_trade_cards
  id, user_id, journal_entry_id, template, config (JSONB),
  image_url (Supabase Storage), shared_at, likes_count,
  is_featured (admin-set)
```

---

## 9. Massive.com Market Data Integration

### 9.1 Strategic Overview

TITM pays $597/month for unlimited Massive.com API access (Options Advanced + Stocks Advanced + Indices Advanced). Currently ~35% of this capacity is used. This section specifies how to leverage the remaining 65% to create features no competing journal offers — turning raw market data into a premium differentiator that justifies the membership fee.

**Competitive moat:** Tradervue, TradeZella, Edgewonk, TraderSync — none of them integrate live institutional-grade market data into the journal experience. TITM will be the first trading journal where every entry is automatically enriched with the market context at the exact moment of the trade.

### 9.2 WebSocket Real-Time Connection

**Current state:** REST polling only.
**Target state:** Persistent WebSocket for live dashboard prices.

```typescript
// New service: lib/massive-websocket.ts
interface MassiveWebSocketConfig {
  symbols: string[];              // ['SPX', 'NDX']
  channels: ('trades' | 'quotes' | 'aggregates')[];
  reconnectAttempts: number;      // 5
  reconnectDelay: number;         // 2000ms, exponential backoff
}

interface LivePriceUpdate {
  symbol: string;
  price: number;
  change: number;                  // Dollar change from open
  changePct: number;               // Percentage change from open
  volume: number;                  // Cumulative day volume
  timestamp: number;               // Unix ms
}

// Connection lifecycle:
// 1. Member opens dashboard -> connect WebSocket via backend proxy
// 2. Backend authenticates with Massive.com API key
// 3. Subscribe to SPX, NDX aggregates (1-second bars)
// 4. Frontend receives updates via SSE or socket.io relay
// 5. Dashboard ticker updates in real-time
// 6. On disconnect: auto-reconnect with exponential backoff
// 7. Fallback: 5-second REST polling if WebSocket unavailable

// Backend proxy (Express):
// Single WebSocket connection per symbol, multiplexed to all connected members
// Reduces Massive.com connections to 2 (SPX + NDX) regardless of member count
```

**Implementation approach:** The backend maintains a single Massive.com WebSocket connection and broadcasts to connected frontend clients via Server-Sent Events (SSE). This keeps Massive.com connection count at 2 total regardless of member count.

### 9.3 Auto-Enriched Journal Entries

When a member logs a trade, the system automatically queries Massive.com to enrich the entry with institutional-grade market context. This happens server-side after the entry is saved.

```typescript
interface MarketContextSnapshot {
  // Pulled from Massive.com at trade entry/exit times
  entryContext: {
    timestamp: string;             // ISO timestamp
    price: number;                 // Verified market price at entry time
    vwap: number;                  // VWAP at moment of entry
    atr14: number;                 // ATR(14) at moment of entry
    volumeVsAvg: number;           // Volume relative to 20-day average (e.g., 1.8 = 180%)
    distanceFromPDH: number;       // Distance in $ from Previous Day High
    distanceFromPDL: number;       // Distance in $ from Previous Day Low
    nearestLevel: {                // Closest S/R level at entry
      name: string;                // e.g., "PDH", "VWAP", "Camarilla H3"
      price: number;
      distance: number;            // In ATR units
    };
  };
  exitContext: {                   // Same structure for exit
    timestamp: string;
    price: number;
    vwap: number;
    atr14: number;
    volumeVsAvg: number;
    distanceFromPDH: number;
    distanceFromPDL: number;
    nearestLevel: { name: string; price: number; distance: number; };
  };
  // Options-specific context (if options trade)
  optionsContext?: {
    ivAtEntry: number;             // Implied volatility at entry
    ivAtExit: number;              // IV at exit
    ivRankAtEntry: number;         // IV percentile rank (0-100)
    deltaAtEntry: number;          // Delta at entry
    thetaAtEntry: number;          // Theta decay at entry
    dteAtEntry: number;            // Days to expiration at entry
    dteAtExit: number;
  };
  // Daily context
  dayContext: {
    marketTrend: 'bullish' | 'bearish' | 'neutral'; // Based on price vs VWAP + pivot
    atrUsed: number;               // % of ATR range consumed before entry
    sessionType: 'trending' | 'range-bound' | 'volatile'; // Classified from price action
    keyLevelsActive: {             // All levels for the day
      pdh: number; pdl: number; pdc: number;
      vwap: number; atr14: number;
      pivotPP: number; pivotR1: number; pivotS1: number;
    };
  };
}
```

**Enrichment flow:**
```
1. Member saves journal entry with symbol + trade_date + entry/exit times
2. POST /api/members/journal → saves to trading_journal_entries
3. Background job triggers: POST /api/members/journal/enrich
4. Server fetches from Massive.com:
   a. 1-minute bars for the trade date (for exact price at timestamps)
   b. Daily bars for previous 30 days (for ATR, pivots)
   c. Pre-market minute bars (for PMH/PML)
   d. Options snapshot if options trade (for IV, Greeks)
5. Server calculates all levels, VWAP, volume context
6. MarketContextSnapshot stored in trading_journal_entries.market_context (JSONB)
7. Entry detail view renders enriched data automatically
```

**Cost impact:** Zero additional cost — all data included in existing $597/month subscription. Enrichment queries are cached and batched.

### 9.4 Trade Replay

Rebuild the exact market conditions of any past trade using Massive.com historical minute data.

```typescript
interface TradeReplayData {
  entryId: string;                 // Journal entry being replayed
  symbol: string;
  tradeDate: string;
  bars: {                          // 1-minute OHLCV bars for full trading day
    time: number;                  // Unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  overlays: {
    entryPoint: { time: number; price: number; };
    exitPoint: { time: number; price: number; };
    vwapLine: { time: number; value: number; }[];
    levels: {
      pdh: number; pdl: number; pdc: number;
      pivotPP: number; pivotR1: number; pivotS1: number;
    };
  };
  replaySpeed: 1 | 2 | 5 | 10;    // Playback speed multiplier
}
```

**UI: Trade Replay Widget (inside Entry Detail Sheet)**
```
Container: Glass Card Heavy, min-height 300px
Chart: TradingView Lightweight Charts (already in dependencies)
  Candlestick chart showing 1-minute bars
  Entry marker: Green triangle (up for long, down for short)
  Exit marker: Red triangle
  VWAP line: Blue dashed
  PDH/PDL lines: Horizontal dashed with labels
  Pivot PP: Horizontal dotted champagne

Controls (below chart):
  [▶ Play] [⏸ Pause] [⏮ Reset] — transport controls
  Speed: [1x] [2x] [5x] [10x] — pill selector
  Scrubber: Timeline slider for manual navigation
  Current time: Geist Mono timestamp

  "Candles reveal one at a time during playback"
  "Entry/exit markers appear when timeline reaches those points"

Loading state: "Loading market data..." with skeleton chart
Error state: "Historical data unavailable for this date"
```

**Data source:** GET /api/members/journal/replay/:entryId
  → Fetches 1-min bars from Massive.com for trade date
  → Calculates VWAP overlay from minute data
  → Fetches daily bars for PDH/PDL/pivot calculations
  → Returns TradeReplayData

**Cache:** Replay data cached for 24 hours in Redis (historical data doesn't change)

### 9.5 Smart Auto-Tags from Market Context

When a journal entry is enriched with market context, the system automatically suggests tags based on real data patterns — not manual tagging.

```typescript
interface SmartTagRule {
  tag: string;
  condition: (context: MarketContextSnapshot) => boolean;
}

const smartTagRules: SmartTagRule[] = [
  // Price-level based
  { tag: "PDH Break", condition: (c) => c.entryContext.distanceFromPDH < c.entryContext.atr14 * 0.3 },
  { tag: "PDL Bounce", condition: (c) => c.entryContext.distanceFromPDL < c.entryContext.atr14 * 0.3 },
  { tag: "VWAP Play", condition: (c) => Math.abs(c.entryContext.price - c.entryContext.vwap) < c.entryContext.atr14 * 0.2 },
  { tag: "Pivot Bounce", condition: (c) => c.entryContext.nearestLevel.name.includes("Pivot") && c.entryContext.nearestLevel.distance < 0.3 },

  // Volume based
  { tag: "High Volume", condition: (c) => c.entryContext.volumeVsAvg >= 1.5 },
  { tag: "Low Volume", condition: (c) => c.entryContext.volumeVsAvg < 0.7 },
  { tag: "Volume Surge", condition: (c) => c.entryContext.volumeVsAvg >= 2.0 },

  // Session context
  { tag: "Opening Range", condition: (c) => {
    const entryMinutes = new Date(c.entryContext.timestamp).getUTCMinutes() + new Date(c.entryContext.timestamp).getUTCHours() * 60;
    return entryMinutes >= 570 && entryMinutes <= 600; // 9:30-10:00 AM ET
  }},
  { tag: "Power Hour", condition: (c) => {
    const entryMinutes = new Date(c.entryContext.timestamp).getUTCMinutes() + new Date(c.entryContext.timestamp).getUTCHours() * 60;
    return entryMinutes >= 930 && entryMinutes <= 960; // 3:30-4:00 PM ET
  }},
  { tag: "Trend Day", condition: (c) => c.dayContext.sessionType === 'trending' },
  { tag: "Range Day", condition: (c) => c.dayContext.sessionType === 'range-bound' },

  // Options-specific
  { tag: "High IV Entry", condition: (c) => c.optionsContext?.ivRankAtEntry ? c.optionsContext.ivRankAtEntry >= 70 : false },
  { tag: "Low IV Entry", condition: (c) => c.optionsContext?.ivRankAtEntry ? c.optionsContext.ivRankAtEntry <= 20 : false },
  { tag: "IV Crush", condition: (c) => c.optionsContext ? c.optionsContext.ivAtExit < c.optionsContext.ivAtEntry * 0.8 : false },
  { tag: "0-DTE", condition: (c) => c.optionsContext?.dteAtEntry === 0 },
  { tag: "Same-Day Exp", condition: (c) => c.optionsContext?.dteAtEntry ? c.optionsContext.dteAtEntry <= 1 : false },
];
```

**UX:** After enrichment, smart tags appear as suggested pills below the manual tags section with a sparkle icon (✨). The member can accept (click to add) or dismiss (X) each suggestion. Accepted smart tags are stored alongside manual tags.

### 9.6 One-Click Trade Logging with Live Prices

Instead of manual price entry, members can log trades with one tap using live Massive.com prices.

**Flow:**
```
1. Member taps "+ Log Trade" on dashboard or journal
2. Entry sheet opens with LIVE price feed active
3. Member selects symbol (SPX, NDX, SPY, QQQ)
4. Current live price shown in large Geist Mono: $6,042.50 (updating)
5. Member taps "Entered LONG at $6,042.50" — one tap
   → entry_price auto-filled, entry_timestamp recorded
   → Entry remains "open" in journal with live P&L updating

6. Later, member returns and taps "Close Position"
7. Current live price shown: $6,058.75
8. Member taps "Exited at $6,058.75" — one tap
   → exit_price auto-filled, exit_timestamp recorded
   → P&L auto-calculated: +$16.25 per contract
   → Entry moves to "closed" status
   → Auto-enrichment triggers in background
```

**Live P&L for Open Positions (new dashboard widget):**
```
If member has open (unclosed) journal entries:
  Show "Open Positions" card on dashboard
  Each open position shows:
    Symbol + Direction + Entry Price + Current Price (live) + Unrealized P&L (live)
    Time held: "2h 14m"
    [Close Position] button

This creates a real-time portfolio tracker feel without being a full brokerage.
```

### 9.7 Historical IV Context for AI Analysis

When the AI Coach analyzes a trade (via screenshot or journal entry), enrich the analysis prompt with actual market data:

```typescript
// Enhanced AI analysis prompt enrichment
function buildEnrichedAnalysisPrompt(entry: JournalEntry, context: MarketContextSnapshot): string {
  return `
    MARKET CONTEXT AT TIME OF TRADE:
    - Entry price: $${context.entryContext.price} | VWAP was at $${context.entryContext.vwap}
    - ATR(14): $${context.entryContext.atr14} — position was ${(Math.abs(entry.pnl || 0) / context.entryContext.atr14).toFixed(1)} ATR in P&L
    - Volume was ${(context.entryContext.volumeVsAvg * 100).toFixed(0)}% of 20-day average
    - Nearest level: ${context.entryContext.nearestLevel.name} at $${context.entryContext.nearestLevel.price} (${context.entryContext.nearestLevel.distance.toFixed(2)} ATR away)
    - Day type: ${context.dayContext.sessionType} | Market trend: ${context.dayContext.marketTrend}
    ${context.optionsContext ? `
    - IV at entry: ${(context.optionsContext.ivAtEntry * 100).toFixed(1)}% | IV Rank: ${context.optionsContext.ivRankAtEntry}th percentile
    - Delta at entry: ${context.optionsContext.deltaAtEntry.toFixed(3)} | Theta: $${context.optionsContext.thetaAtEntry.toFixed(2)}/day
    - DTE at entry: ${context.optionsContext.dteAtEntry} days
    ` : ''}

    Use this real market data to provide specific, data-driven analysis rather than generic feedback.
    Reference actual levels and conditions in your coaching notes.
  `;
}
```

This transforms AI analysis from "good entry timing" to "You entered 0.2 ATR from PDH with 180% average volume — that's a high-conviction breakout setup and your sizing was appropriate for the ATR."

### 9.8 Massive.com Data in Social Trade Cards

Trade cards become verifiable and educational when they include real market data:

**Enhanced Trade Card Data Overlay (optional toggle in card builder):**
```
Show/Hide toggles (in addition to existing ones):
  ☑ Market Context Badge
    → Shows: "Entered at PDH retest | 1.8x Avg Volume | IV Rank: 42%"
  ☑ Level Proximity
    → Shows entry price relative to key levels on a mini horizontal bar
  ☑ Verified Badge
    → Shows: "✓ Verified by TradeITM" if entry/exit prices match Massive.com data within $1
  ☐ Mini Chart
    → Shows: Embedded sparkline of 1-hour bars with entry/exit markers
```

**Verification logic:**
```typescript
interface TradeVerification {
  isVerified: boolean;
  confidence: 'exact' | 'close' | 'unverifiable';
  entryPriceMatch: boolean;       // Member's entry price within $1 of market at timestamp
  exitPriceMatch: boolean;        // Same for exit
  priceSource: 'massive-1min';    // Data source used for verification
  verifiedAt: string;
}

// Verification runs during enrichment:
// 1. Fetch 1-min bar for entry timestamp from Massive.com
// 2. Check if member's reported entry_price falls within that bar's high-low range
// 3. Same for exit
// 4. If both match: "Verified by TradeITM" badge available on trade card
// 5. This prevents fake P&L screenshots — real data backs the claim
```

**Social impact:** When a TITM member shares a trade card on Twitter/Discord with a "Verified by TradeITM" badge and real market context data, it becomes a recruiting tool. Viewers see that TITM is a platform where performance claims are backed by institutional data.

---

## 10. AI Coach Integration Points

### 10.1 Integration Philosophy

The AI Coach has its own implementation roadmap. This spec defines the **integration points** where the Member platform connects to AI Coach capabilities, not the AI Coach internals themselves.

### 10.2 Journal -> AI Coach Integration

```
1. "Analyze with AI" in journal entry form
   -> POST /api/members/journal/analyze (existing edge function)
   -> Returns structured analysis + grade
   -> Auto-fills form fields

2. "Discuss with AI Coach" button in journal entries
   -> Navigate to /members/ai-coach
   -> Pre-populate chat with context:
     "I just logged a {direction} trade on {symbol}.
      Entry: ${entry_price}, Exit: ${exit_price}, P&L: ${pnl}.
      My AI analysis grade was {grade}.
      Can you help me understand what I did well and where I can improve?"
   -> This uses URL query params: /members/ai-coach?context=journal&entryId={id}

3. Dashboard AI Insights card
   -> Aggregates recent ai_analysis fields
   -> Shows patterns detected across multiple trades
   -> "Chat with Coach" CTA with context
```

### 10.3 Dashboard -> AI Coach Integration

```
1. AI Insights card uses aggregate journal data
2. Quick Action "Ask AI Coach" navigates directly
3. Market status indicator shared between dashboard and AI Coach
```

### 10.4 AI Analysis Response Schema

```typescript
interface AITradeAnalysis {
  summary: string;
  trend_analysis: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    notes: string;
  };
  entry_analysis: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    observations: string[];
    improvements: string[];
  };
  exit_analysis: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    observations: string[];
    improvements: string[];
  };
  risk_management: {
    score: number;  // 1-10
    observations: string[];
    suggestions: string[];
  };
  market_structure: {
    key_levels: string[];
    patterns: string[];
    notes: string;
  };
  coaching_notes: string;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  tags: string[];
  analyzed_at: string;
  model: string;
}
```

---

## 11. Admin Platform Architecture

### 11.1 Layout Structure

```
/admin/layout.tsx
├── AdminAuthGuard (server-side is_admin check)
│   ├── AdminLayoutShell (client component)
│   │   ├── AdminSidebar (desktop: fixed left 288px)
│   │   │   ├── Brand Header ("TradeITM" + "Command Center")
│   │   │   ├── Navigation (grouped sections)
│   │   │   └── Admin Profile Footer
│   │   ├── AdminTopBar (mobile: hamburger + breadcrumb)
│   │   ├── Content Area (with page transitions)
│   │   │   └── {children}
│   │   └── AdminCommandPalette (Cmd+K global search)
```

### 11.2 Admin Sidebar Redesign

```
Width: 288px (slightly wider than member sidebar for admin density)
Background: rgba(5, 5, 5, 0.98)
Border-right: 1px solid rgba(255, 255, 255, 0.06)

Brand Section:
  Logo: TITM SparkleLogoSvg
  Title: "TradeITM" (Playfair Display, ivory)
  Subtitle: "Command Center" (Inter, champagne, text-xs)

Navigation Groups:

  OVERVIEW
  ├── Dashboard (LayoutDashboard icon)

  GROWTH & REVENUE
  ├── Leads Pipeline (UserPlus icon)
  ├── Live Chat (MessageSquare icon)
  └── Packages & Pricing (CreditCard icon)

  MEMBER EXPERIENCE
  ├── Tab Configuration (Sliders icon) ← NEW
  ├── Role Permissions (Shield icon)
  ├── Journal Config (BookOpen icon) ← NEW
  └── Social Sharing Config (Share2 icon) ← NEW

  CONTENT
  ├── Course Library (GraduationCap icon)
  ├── Knowledge Base (Library icon)
  └── Studio Hub (Palette icon)

  SYSTEM
  ├── Analytics (BarChart3 icon)
  ├── Discord Settings (Hash icon)
  └── Settings (Settings icon)

Active state: Same champagne left-border glow as current
Group labels: text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50, px-6, mt-6 mb-2
```

### 11.3 Admin Command Palette (New)

```
Trigger: Cmd+K (Mac) / Ctrl+K (Windows)
UI: cmdk library (already in dependencies)

Container: Centered modal, max-w-lg
Background: Glass Card Heavy
Search input: Large, auto-focused

Quick commands:
  "go to leads" -> Navigate to /admin/leads
  "add course" -> Open course creation
  "view member {name}" -> Jump to member detail
  "sync discord" -> Trigger Discord role sync
  "system status" -> Show system health
  "settings" -> Navigate to settings

Recent items: Last 5 admin actions
```

---

## 12. Admin Dashboard

### 12.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Command Center" (Playfair) + Date + Refresh       │
├─────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Members │ Revenue  │ Engagement│  Churn  │ System Health   │
│  (stat) │  (stat)  │  (stat)  │  (stat) │   (stat)        │
├─────────┴──────────┴──────────┴──────────┴─────────────────┤
│                                                              │
│  ┌─ Revenue Chart (50%) ────────┐ ┌─ Member Growth (50%) ─┐ │
│  │  MRR, ARR, growth rate       │ │  New members by week   │ │
│  │  Stacked area chart          │ │  By tier breakdown     │ │
│  └──────────────────────────────┘ └────────────────────────┘ │
│                                                              │
│  ┌─ Recent Activity Feed (60%) ──┐ ┌─ Quick Actions (40%)─┐ │
│  │  New signups                   │ │  View all leads       │ │
│  │  Tier upgrades                 │ │  Manage roles         │ │
│  │  Journal entries logged        │ │  System check         │ │
│  │  AI Coach sessions             │ │  Export data          │ │
│  └────────────────────────────────┘ └──────────────────────┘ │
│                                                              │
│  ┌─ System Diagnostics (full width) ───────────────────────┐ │
│  │  Database | API | Discord | AI Coach | Storage          │ │
│  │  Each with status indicator and latency                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Stat Cards

| Card | Data Source | Details |
|------|-----------|---------|
| Total Members | subscribers table + Discord member count | Number + growth % from last month |
| Revenue MTD | packages table + Stripe (if integrated) | Dollar amount + vs last month |
| Engagement | trading_journal_entries + ai_coach_sessions | Active members this week / total |
| Churn Rate | subscriber cancellations / total | Percentage with trend arrow |
| System Health | /api/admin/system diagnostic | Percentage score, colored |

### 12.3 Activity Feed

```typescript
interface ActivityItem {
  type: 'signup' | 'upgrade' | 'journal_entry' | 'ai_session' | 'lead' | 'purchase';
  user: { name: string; avatar: string; };
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

```
Feed: Vertical list, max 20 items, real-time via Supabase realtime
Each item:
  Avatar (24px) + Description text + Timestamp (relative)
  Type icon with color coding:
    signup: UserPlus, emerald
    upgrade: ArrowUp, champagne
    journal_entry: BookOpen, blue
    ai_session: Bot, purple
    lead: Mail, amber
    purchase: CreditCard, emerald
```

---

## 13. Admin Tab Configuration System

### 13.1 Overview

This is the **most critical new admin feature**. It replaces hardcoded tab arrays with a visual configurator that controls which tabs appear in the member sidebar based on Discord roles/tiers.

### 13.2 Tab Configuration Page

**Route:** `/admin/tabs` (new page)

```
┌─ Tab Configuration ──────────────────────────────────────┐
│                                                           │
│  Header: "Member Experience Tabs" (Playfair)              │
│  Subtitle: "Configure which tabs members see based on     │
│  their membership tier"                                   │
│                                                           │
│  ┌─ Tier Selector ──────────────────────────────────────┐ │
│  │  [Core Sniper] [Pro Sniper] [Executive Sniper]       │ │
│  │  (tab pills, active has emerald highlight)            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Available Tabs ─────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Drag-and-drop sortable list:                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ ☰ [✓] Dashboard    | LayoutDashboard | Required │ │ │
│  │  │ ☰ [✓] Trade Journal| BookOpen        | ──────── │ │ │
│  │  │ ☰ [✓] AI Coach     | Bot             | Pro+     │ │ │
│  │  │ ☰ [ ] Training Lib | GraduationCap   | Pro+     │ │ │
│  │  │ ☰ [ ] Trade Studio | Palette         | Exec     │ │ │
│  │  │ ☰ [✓] Profile      | UserCircle      | Required │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  For each tab, configure:                             │ │
│  │    ☑ Enabled for this tier                            │ │
│  │    Label: [editable text input]                       │ │
│  │    Badge: [None ▾] or text + variant                  │ │
│  │    Show on mobile bottom nav: [toggle]                │ │
│  │    Description tooltip: [text input]                   │ │
│  │                                                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Preview ────────────────────────────────────────────┐ │
│  │  Live preview of member sidebar with current config   │ │
│  │  Shows exactly what a {tier} member would see        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  [Save Configuration] [Reset to Defaults]                 │
└──────────────────────────────────────────────────────────┘
```

### 13.3 Database: tab_configurations

```sql
CREATE TABLE tab_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id TEXT NOT NULL,               -- 'dashboard', 'journal', 'ai-coach', etc.
  label TEXT NOT NULL,                 -- Display name
  icon TEXT NOT NULL,                  -- Lucide icon name
  path TEXT NOT NULL,                  -- Route path (e.g., '/members/journal')
  required_tier TEXT NOT NULL          -- 'core', 'pro', or 'executive'
    CHECK (required_tier IN ('core', 'pro', 'executive')),
  badge_text TEXT,                     -- e.g., 'Beta', 'New'
  badge_variant TEXT                   -- 'emerald', 'champagne', 'destructive'
    CHECK (badge_variant IN ('emerald', 'champagne', 'destructive', NULL)),
  description TEXT,                    -- Tooltip text
  mobile_visible BOOLEAN DEFAULT true, -- Show in mobile bottom nav
  sort_order INTEGER NOT NULL DEFAULT 0, -- Display order
  is_required BOOLEAN DEFAULT false,   -- Can't be disabled (dashboard, profile)
  is_active BOOLEAN DEFAULT true,      -- Master enable/disable
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tab_id)
);

-- Seed with defaults
INSERT INTO tab_configurations (tab_id, label, icon, path, required_tier, sort_order, is_required, mobile_visible) VALUES
  ('dashboard', 'Command Center', 'LayoutDashboard', '/members', 'core', 0, true, true),
  ('journal', 'Trade Journal', 'BookOpen', '/members/journal', 'core', 1, false, true),
  ('ai-coach', 'AI Coach', 'Bot', '/members/ai-coach', 'pro', 2, false, true),
  ('library', 'Training Library', 'GraduationCap', '/members/library', 'pro', 3, false, false),
  ('studio', 'Trade Studio', 'Palette', '/members/studio', 'executive', 4, false, false),
  ('profile', 'Profile', 'UserCircle', '/members/profile', 'core', 99, true, true);

-- RLS: Only admins can read/write
ALTER TABLE tab_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON tab_configurations
  FOR ALL USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean)
  );
-- Members read via API (no direct table access)
```

### 13.4 API: Tab Configuration

```
GET /api/config/tabs
  Public endpoint (cached, used by MemberAuthContext)
  Returns: TabConfig[] ordered by sort_order
  Cache: 5 minutes (revalidate on save)

GET /api/admin/tabs
  Admin-only
  Returns: Full tab configurations with all fields

PUT /api/admin/tabs
  Admin-only
  Body: { tabs: TabConfig[] }
  Updates all tab configurations
  Invalidates cache
```

### 13.5 Admin Journal Configuration

**Route:** `/admin/journal-config` (new page)

```
Configure journal-wide settings:

1. Quick Tags Management:
   - Add/remove/reorder predefined quick tags
   - Group tags by category (Strategy, Pattern, Condition)
   - Tags are shared across all members

2. AI Analysis Settings:
   - Enable/disable AI analysis feature
   - Configure which AI model to use
   - Set analysis prompt customization
   - View usage stats (analyses this month, cost estimate)

3. Rating System:
   - Enable/disable star rating
   - Customize rating labels (1="Poor" to 5="Perfect")

4. Export Settings:
   - Enable/disable CSV export
   - Configure which fields to include in export

5. Social Sharing Settings:
   - Enable/disable trade card sharing
   - Configure available templates
   - Set default watermark text
   - Moderate shared cards (approve/reject for gallery)
```

---

## 14. Admin Settings & Discord Management

### 14.1 Settings Page Redesign

The settings page needs visual polish to match the luxury aesthetic. Current functionality is retained but reskinned:

```
┌─ Settings ───────────────────────────────────────────────┐
│                                                           │
│  Header: "System Settings" (Playfair)                     │
│                                                           │
│  Tabs: [Discord] [AI Configuration] [Tier Mapping]       │
│        [Branding] [Notifications]                         │
│                                                           │
│  ─── Discord Configuration ──────────────────────────     │
│  (Existing functionality, reskinned with glass cards)     │
│  Each setting in its own glass card row:                  │
│    Label | Input (with reveal toggle for secrets) |       │
│  Test Connection button (with live status indicator)      │
│  Save button with success feedback                        │
│                                                           │
│  ─── AI Configuration ───────────────────────────────     │
│  System Prompt editor (glass card, larger textarea)       │
│  Token count indicator                                    │
│  "Preview Response" test button                           │
│  Model selection dropdown (if applicable)                 │
│                                                           │
│  ─── Tier Mapping ───────────────────────────────────     │
│  (Existing functionality, reskinned)                      │
│  Visual tier cards with Discord role ID mapping           │
│  Drag-drop reordering                                     │
│                                                           │
│  ─── Branding (NEW) ────────────────────────────────     │
│  Customize member-facing text:                            │
│    Welcome message                                        │
│    Tier names (display names for Core/Pro/Executive)      │
│    Footer text                                            │
│    Support contact info                                   │
│                                                           │
│  ─── Notifications (NEW) ───────────────────────────     │
│  Configure admin notification preferences:                │
│    New member signup: [email] [discord] [none]            │
│    New lead: [email] [discord] [none]                     │
│    System alert: [email] [discord] [none]                 │
│    Daily digest: [on/off] + time picker                   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 14.2 Roles Page Redesign

Current functionality is solid. Visual improvements:

```
Changes:
1. Replace plain form with glass card per role mapping
2. Permission badges use emerald/champagne color coding by category:
   - Content access: emerald badges
   - Feature access: champagne badges
   - Admin access: blue badges
3. Role templates shown as pre-built glass cards with "Apply Template" button
4. Better empty state with clear instructions
5. Animated transitions when adding/removing roles
6. Confirmation dialog on delete with role name display
```

---

## 15. Admin Analytics & Insights

### 15.1 Analytics Dashboard

**Route:** `/admin/analytics`

```
┌─ Analytics ──────────────────────────────────────────────┐
│                                                           │
│  Date Range Selector: [Last 7 Days ▾] [Custom Range]     │
│                                                           │
│  ┌─ Key Metrics Row ────────────────────────────────────┐│
│  │ DAU | WAU | MAU | Retention | Avg Session | AI Usage ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌─ Member Activity (60%) ──────┐ ┌─ Tier Breakdown(40%)│
│  │  Daily active users line      │ │  Donut chart:       │
│  │  chart over time              │ │  Core / Pro / Exec  │
│  └──────────────────────────────┘ └─────────────────────┘│
│                                                           │
│  ┌─ Feature Usage (full width) ─────────────────────────┐│
│  │  Bar chart: which features are most used              ││
│  │  Journal entries | AI Coach sessions | Library views  ││
│  │  Social shares | Studio uses                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌─ Journal Analytics ──────────────────────────────────┐│
│  │  Total entries logged this period                     ││
│  │  Avg entries per active member                        ││
│  │  AI analysis usage rate                               ││
│  │  Most common symbols traded                           ││
│  │  Avg win rate across members                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌─ AI Coach Analytics ─────────────────────────────────┐│
│  │  Total sessions | Messages | Avg session length       ││
│  │  Most asked topics                                    ││
│  │  User satisfaction (if tracked)                       ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 15.2 Data Sources

```typescript
// Analytics queries (new RPC functions needed)
interface AdminAnalytics {
  members: {
    total: number;
    byTier: { core: number; pro: number; executive: number; };
    newThisPeriod: number;
    dailyActive: { date: string; count: number; }[];
  };
  journal: {
    totalEntries: number;
    avgEntriesPerMember: number;
    aiAnalysisRate: number;  // % of entries with AI analysis
    topSymbols: { symbol: string; count: number; }[];
    avgWinRate: number;
  };
  aiCoach: {
    totalSessions: number;
    totalMessages: number;
    avgSessionLength: number;  // in messages
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    retentionRate: number;
  };
}
```

---

## 16. Database Schema Changes

### 16.1 New Tables

```sql
-- 1. Tab Configuration (Section 12.3)
-- See full SQL in Section 12.3

-- 2. Shared Trade Cards
CREATE TABLE shared_trade_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES trading_journal_entries(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT 'dark-elite',
  card_config JSONB NOT NULL DEFAULT '{}',   -- Show/hide toggles, custom message, etc.
  image_url TEXT,                              -- Supabase Storage URL of generated image
  share_platform TEXT,                        -- 'twitter', 'discord', 'download', 'clipboard'
  shared_at TIMESTAMPTZ DEFAULT now(),
  is_public BOOLEAN DEFAULT false,            -- Visible in community gallery
  is_featured BOOLEAN DEFAULT false,          -- Admin-featured
  likes_count INTEGER DEFAULT 0,

  CONSTRAINT valid_template CHECK (template IN ('dark-elite', 'emerald-gradient', 'champagne-premium', 'minimal', 'story'))
);

CREATE INDEX idx_shared_cards_user ON shared_trade_cards(user_id);
CREATE INDEX idx_shared_cards_public ON shared_trade_cards(is_public, shared_at DESC);

-- RLS
ALTER TABLE shared_trade_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cards" ON shared_trade_cards
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public cards readable" ON shared_trade_cards
  FOR SELECT USING (is_public = true);

-- 3. Admin Activity Log
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,                       -- 'update_settings', 'modify_roles', 'feature_toggle'
  target_type TEXT,                           -- 'tab_config', 'role_mapping', 'settings', 'member'
  target_id TEXT,                             -- ID of affected resource
  details JSONB DEFAULT '{}',                 -- Before/after values
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_log_time ON admin_activity_log(created_at DESC);

-- 4. Journal Quick Tags (admin-managed)
CREATE TABLE journal_quick_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                     -- 'strategy', 'pattern', 'condition'
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(category, label)
);

-- Seed default tags
INSERT INTO journal_quick_tags (category, label, sort_order) VALUES
  ('strategy', 'Breakout', 0),
  ('strategy', 'Reversal', 1),
  ('strategy', 'Support Bounce', 2),
  ('strategy', 'Momentum', 3),
  ('strategy', 'Scalp', 4),
  ('strategy', 'Swing', 5),
  ('strategy', 'Gap Fill', 6),
  ('pattern', 'Double Top', 0),
  ('pattern', 'Double Bottom', 1),
  ('pattern', 'Head & Shoulders', 2),
  ('pattern', 'Triangle', 3),
  ('pattern', 'Flag', 4),
  ('pattern', 'Channel', 5),
  ('condition', 'High Volume', 0),
  ('condition', 'Low Volume', 1),
  ('condition', 'News Catalyst', 2),
  ('condition', 'Earnings', 3),
  ('condition', 'FOMC', 4),
  ('condition', 'Expiration Day', 5);

-- 5. Member analytics events
CREATE TABLE member_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,                   -- 'page_view', 'feature_use', 'trade_logged', etc.
  event_data JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analytics_user_time ON member_analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_type_time ON member_analytics_events(event_type, created_at DESC);
```

### 16.2 Table Modifications

```sql
-- Add to trading_journal_entries (if not already present):
ALTER TABLE trading_journal_entries
  ADD COLUMN IF NOT EXISTS screenshot_storage_path TEXT,  -- Supabase Storage path
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
  -- NEW: Massive.com market data enrichment
  ADD COLUMN IF NOT EXISTS market_context JSONB,           -- MarketContextSnapshot (see Section 9.3)
  ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ,    -- Exact entry time (for enrichment lookup)
  ADD COLUMN IF NOT EXISTS exit_timestamp TIMESTAMPTZ,     -- Exact exit time
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false,  -- Open position (not yet exited)
  ADD COLUMN IF NOT EXISTS smart_tags TEXT[] DEFAULT '{}',  -- Auto-detected tags from market context
  ADD COLUMN IF NOT EXISTS verification JSONB,              -- TradeVerification result (see Section 9.8)
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;         -- When market_context was populated

-- Add to journal_streaks:
ALTER TABLE journal_streaks
  ADD COLUMN IF NOT EXISTS best_ai_grade TEXT,
  ADD COLUMN IF NOT EXISTS avg_ai_grade TEXT,
  ADD COLUMN IF NOT EXISTS total_ai_analyses INTEGER DEFAULT 0;

-- NEW: Index for open positions (live P&L dashboard widget)
CREATE INDEX IF NOT EXISTS idx_journal_open_positions
  ON trading_journal_entries(user_id, is_open)
  WHERE is_open = true;

-- NEW: Index for enrichment queue (unenriched entries)
CREATE INDEX IF NOT EXISTS idx_journal_unenriched
  ON trading_journal_entries(created_at)
  WHERE market_context IS NULL AND is_open = false;
```

### 16.3 New RPC Functions

```sql
-- Get comprehensive journal stats for dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID, p_period TEXT DEFAULT 'month')
RETURNS JSON AS $$
DECLARE
  result JSON;
  start_date DATE;
BEGIN
  start_date := CASE p_period
    WHEN 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN 'month' THEN DATE_TRUNC('month', CURRENT_DATE)
    WHEN 'quarter' THEN DATE_TRUNC('quarter', CURRENT_DATE)
    WHEN 'year' THEN DATE_TRUNC('year', CURRENT_DATE)
    ELSE DATE_TRUNC('month', CURRENT_DATE)
  END;

  SELECT json_build_object(
    'total_trades', COUNT(*),
    'winning_trades', COUNT(*) FILTER (WHERE is_winner = true),
    'losing_trades', COUNT(*) FILTER (WHERE is_winner = false),
    'win_rate', ROUND(
      COUNT(*) FILTER (WHERE is_winner = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1
    ),
    'total_pnl', COALESCE(SUM(pnl), 0),
    'avg_pnl', ROUND(COALESCE(AVG(pnl), 0)::numeric, 2),
    'best_trade_pnl', MAX(pnl),
    'worst_trade_pnl', MIN(pnl),
    'avg_winner', ROUND(COALESCE(AVG(pnl) FILTER (WHERE is_winner = true), 0)::numeric, 2),
    'avg_loser', ROUND(COALESCE(AVG(pnl) FILTER (WHERE is_winner = false), 0)::numeric, 2),
    'profit_factor', ROUND(
      COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0)::numeric /
      NULLIF(ABS(COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0)), 0)::numeric, 2
    ),
    'avg_ai_grade', (
      SELECT ai_analysis->>'grade'
      FROM trading_journal_entries
      WHERE user_id = p_user_id AND ai_analysis IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    )
  ) INTO result
  FROM trading_journal_entries
  WHERE user_id = p_user_id AND trade_date >= start_date;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get equity curve data
CREATE OR REPLACE FUNCTION get_equity_curve(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(trade_date DATE, daily_pnl NUMERIC, cumulative_pnl NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tje.trade_date,
    SUM(tje.pnl)::NUMERIC as daily_pnl,
    SUM(SUM(tje.pnl)) OVER (ORDER BY tje.trade_date)::NUMERIC as cumulative_pnl
  FROM trading_journal_entries tje
  WHERE tje.user_id = p_user_id
    AND tje.trade_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY tje.trade_date
  ORDER BY tje.trade_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get calendar heatmap data
CREATE OR REPLACE FUNCTION get_trading_calendar(p_user_id UUID, p_months INTEGER DEFAULT 6)
RETURNS TABLE(trade_date DATE, total_pnl NUMERIC, trade_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tje.trade_date,
    SUM(tje.pnl)::NUMERIC as total_pnl,
    COUNT(*)::INTEGER as trade_count
  FROM trading_journal_entries tje
  WHERE tje.user_id = p_user_id
    AND tje.trade_date >= CURRENT_DATE - (p_months || ' months')::INTERVAL
  GROUP BY tje.trade_date
  ORDER BY tje.trade_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin analytics
CREATE OR REPLACE FUNCTION get_admin_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM auth.users),
    'new_members', (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL),
    'total_journal_entries', (SELECT COUNT(*) FROM trading_journal_entries WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL),
    'ai_analysis_count', (SELECT COUNT(*) FROM trading_journal_entries WHERE ai_analysis IS NOT NULL AND created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL),
    'ai_coach_sessions', (SELECT COUNT(*) FROM ai_coach_sessions WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL),
    'ai_coach_messages', (SELECT COUNT(*) FROM ai_coach_messages WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 17. API Routes Specification

### 17.1 New API Routes

```
Member APIs:
  GET    /api/members/dashboard/stats         → get_dashboard_stats RPC
  GET    /api/members/dashboard/equity-curve   → get_equity_curve RPC
  GET    /api/members/dashboard/calendar       → get_trading_calendar RPC
  GET    /api/members/dashboard/live-prices    → SSE stream of live SPX/NDX prices (WebSocket relay)
  GET    /api/members/dashboard/open-positions → Get open (unclosed) journal entries with live P&L
  GET    /api/members/journal/tags             → Get unique tags for autocomplete
  POST   /api/members/journal/upload-screenshot → Upload to Supabase Storage
  POST   /api/members/journal/enrich/:id      → Trigger Massive.com enrichment for entry (NEW)
  GET    /api/members/journal/replay/:id      → Get trade replay data (1-min bars + overlays) (NEW)
  POST   /api/members/journal/quick-entry     → One-click trade log with live price (NEW)
  PATCH  /api/members/journal/close/:id       → Close open position with live exit price (NEW)
  GET    /api/members/journal/smart-tags/:id  → Get auto-suggested tags from market context (NEW)
  POST   /api/members/social/generate-card     → Generate trade card image
  POST   /api/members/social/share             → Log share event
  GET    /api/members/social/gallery           → Get public trade cards

Admin APIs:
  GET    /api/admin/tabs                       → Get all tab configurations
  PUT    /api/admin/tabs                       → Update tab configurations
  GET    /api/admin/journal-config             → Get journal settings
  PUT    /api/admin/journal-config             → Update journal settings
  GET    /api/admin/journal-config/tags        → Get quick tags
  POST   /api/admin/journal-config/tags        → Add quick tag
  DELETE /api/admin/journal-config/tags/:id    → Remove quick tag
  GET    /api/admin/analytics                  → get_admin_analytics RPC
  GET    /api/admin/analytics/daily-active     → DAU time series
  GET    /api/admin/analytics/feature-usage    → Feature usage breakdown
  GET    /api/admin/activity-log               → Recent admin actions

Config APIs (public, cached):
  GET    /api/config/tabs                      → Tab configs (for MemberAuthContext)
  GET    /api/config/quick-tags                → Journal quick tags

Backend APIs (Express.js — extended):
  GET    /api/market/live                      → SSE endpoint for real-time prices (WebSocket → SSE relay)
  GET    /api/market/context/:symbol/:date     → Market context snapshot for enrichment (NEW)
  GET    /api/market/replay/:symbol/:date      → 1-min OHLCV bars for trade replay (NEW)
  GET    /api/market/verify/:symbol/:timestamp/:price → Verify price against Massive.com data (NEW)
  GET    /api/market/iv-rank/:symbol           → Current IV rank from options chain (NEW)
```

### 17.2 API Response Patterns

All APIs follow this response pattern:

```typescript
// Success
{
  success: true,
  data: { ... },
  meta?: { total: number, page: number, limit: number }
}

// Error
{
  success: false,
  error: {
    code: string,        // e.g., 'UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR'
    message: string,     // Human-readable message
    details?: any        // Additional error details
  }
}
```

---

## 18. Mobile-First Responsive Strategy

### 18.1 Breakpoint System

```
Mobile:    < 640px  (sm)   - Single column, bottom nav, swipe gestures
Tablet:    640-1023px (md)  - Adapted layouts, side sheets, hamburger menu
Desktop:   >= 1024px (lg)   - Full sidebar, multi-column, hover effects
Wide:      >= 1280px (xl)   - Wider content, more columns
UltraWide: >= 1536px (2xl)  - Maximum content density
```

### 18.2 Mobile-Specific Patterns

**Touch Targets:** Minimum 44x44px for all interactive elements

**Swipe Gestures:**
- Swipe left on journal card: Reveal share + edit actions
- Swipe right on journal card: Quick delete (with confirmation)
- Swipe down on dashboard: Pull to refresh
- Horizontal scroll: Stat cards, filter chips, tags

**Bottom Sheet Pattern:**
- Used for: Filters, entry detail, card builder controls
- Snap points: 50% height, 90% height, closed
- Drag handle: 32px wide, 4px tall, centered, bg-white/20
- Backdrop: bg-black/60 with tap-to-close

**Performance:**
- Reduced blur: 20px instead of 40-60px on mobile
- Disabled hover effects (touch devices)
- Simplified animations (no 3D transforms)
- Lazy-loaded images with blur placeholder
- Infinite scroll instead of pagination on mobile

### 18.3 Component Responsive Rules

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Navigation | Bottom nav (5 items max) | Hamburger + drawer | Fixed sidebar |
| Dashboard stats | 2x2 grid, scroll for 5th | 3+2 grid | 5-column row |
| Journal view | Card view default | Card or table toggle | Table view default |
| Entry form | Full-screen sheet | Side sheet (80% width) | Side sheet (600px) |
| Trade cards | Stacked, preview full-width | Side-by-side preview | Split panel layout |
| Filters | Bottom sheet | Inline collapsible | Inline always visible |
| Charts | Full width, shorter height | Full width | Flexible in grid |

---

## 19. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Design system extension + core infrastructure

Tasks:
1. Create new database migrations (tab_configurations, shared_trade_cards, journal_quick_tags, member_analytics_events, admin_activity_log)
2. Create RPC functions (get_dashboard_stats, get_equity_curve, get_trading_calendar, get_admin_analytics)
3. Create Supabase Storage bucket: 'trade-screenshots' with proper RLS policies
4. Build new API routes: /api/config/tabs, /api/members/dashboard/*, /api/admin/tabs
5. Update MemberAuthContext to use tab_configurations instead of hardcoded tabs
6. Remove legacy permission system code
7. Create shared component library extensions:
   - StatCard component
   - GlassCard variants
   - DataTable component (sortable, paginated)
   - EmptyState component
   - SkeletonLoader variants

**Files created/modified:**
```
supabase/migrations/YYYYMMDD_tab_configurations.sql
supabase/migrations/YYYYMMDD_shared_trade_cards.sql
supabase/migrations/YYYYMMDD_journal_quick_tags.sql
supabase/migrations/YYYYMMDD_analytics_events.sql
supabase/migrations/YYYYMMDD_dashboard_rpc_functions.sql
app/api/config/tabs/route.ts
app/api/members/dashboard/stats/route.ts
app/api/members/dashboard/equity-curve/route.ts
app/api/members/dashboard/calendar/route.ts
app/api/admin/tabs/route.ts
contexts/MemberAuthContext.tsx (modified)
components/ui/stat-card.tsx (new)
components/ui/data-table.tsx (new)
components/ui/empty-state.tsx (new)
components/ui/skeleton-variants.tsx (new)
```

### Phase 2: Member Layout & Dashboard (Week 3-4)

**Goal:** New member layout + fully functional dashboard with live market data

Tasks:
1. Redesign member layout (layout.tsx) with new sidebar, mobile nav, top bar
2. Build responsive sidebar with dynamic tab rendering from API
3. Build mobile bottom nav with filtered tabs
4. Build mobile slide-over drawer
5. **Build Massive.com WebSocket relay service** (backend SSE endpoint)
6. **Build Live Market Ticker component** (WebSocket-powered)
7. Implement dashboard page with all widgets:
   - **Live Market Ticker (SPX/NDX real-time prices, VWAP, ATR, IV Rank)**
   - Welcome header with market status
   - Stat cards row (5 cards)
   - P&L equity curve chart (Recharts)
   - Quick actions card
   - **Open Positions widget (live P&L from Massive.com prices)**
   - Recent trades list
   - AI Insights card
   - Trading calendar heatmap
8. Implement loading skeletons for all dashboard components
9. Test responsive behavior across all breakpoints

**Files created/modified:**
```
app/members/layout.tsx (rewrite)
components/members/member-sidebar.tsx (new)
components/members/mobile-top-bar.tsx (new)
components/members/mobile-bottom-nav.tsx (rewrite)
components/members/mobile-drawer.tsx (new)
app/members/page.tsx (rewrite)
components/dashboard/welcome-header.tsx (new)
components/dashboard/live-market-ticker.tsx (new)      ← Massive.com WebSocket
components/dashboard/open-positions.tsx (new)           ← Live P&L
components/dashboard/stat-cards.tsx (new)
components/dashboard/equity-curve.tsx (new)
components/dashboard/quick-actions.tsx (new)
components/dashboard/recent-trades.tsx (rewrite)
components/dashboard/ai-insights.tsx (new)
components/dashboard/calendar-heatmap.tsx (new)
components/dashboard/market-status.tsx (new)
backend/src/services/market/websocket-relay.ts (new)    ← Massive.com WS → SSE
backend/src/routes/market.ts (new)                      ← /api/market/* routes
app/api/members/dashboard/live-prices/route.ts (new)
app/api/members/dashboard/open-positions/route.ts (new)
lib/massive-websocket.ts (new)                          ← Client-side SSE consumer
```

### Phase 3: Trade Journal Redesign (Week 5-7)

**Goal:** Complete trade journal with auto-enrichment, trade replay, AI analysis, and one-click logging

Tasks:
1. Build journal page with new layout (filter bar, stats, table/cards)
2. Implement filter bar with all filter types
3. Build sortable, paginated data table
4. Build card view with mobile optimization
5. Implement new entry/edit sheet with:
   - File upload via react-dropzone + Supabase Storage
   - AI analysis integration
   - Quick tags with autocomplete
   - Tabbed notes section
   - Star rating
   - **One-click trade logging with live Massive.com prices**
   - **Entry/exit timestamp capture for enrichment**
6. Build entry detail sheet with:
   - **Trade Replay chart (TradingView Lightweight Charts + Massive.com 1-min data)**
   - **Market Context panel (auto-enriched data display)**
   - **Verified trade badge**
7. **Build auto-enrichment service** (Massive.com context snapshot on save)
8. **Build smart auto-tag engine** (market context → suggested tags)
9. **Build trade replay API route** (1-min bars + overlay data)
10. Implement CSV export
11. Build inline row expansion for table view
12. Add loading skeletons and empty states

**Files created/modified:**
```
app/members/journal/page.tsx (rewrite)
components/journal/journal-filter-bar.tsx (new)
components/journal/journal-stats-row.tsx (new)
components/journal/journal-data-table.tsx (new)
components/journal/journal-card-view.tsx (new)
components/journal/entry-sheet.tsx (new, replaces entry-modal.tsx)
components/journal/entry-detail-sheet.tsx (new)
components/journal/trade-replay.tsx (new)               ← Massive.com 1-min replay
components/journal/market-context-panel.tsx (new)       ← Auto-enriched data display
components/journal/quick-entry-button.tsx (new)          ← One-click with live price
components/journal/smart-tags-suggestions.tsx (new)      ← AI-suggested tags
components/journal/screenshot-upload.tsx (new)
components/journal/ai-analysis-panel.tsx (new)
components/journal/quick-tags-input.tsx (new)
components/journal/star-rating.tsx (new)
components/journal/journal-export.tsx (new)
app/api/members/journal/upload-screenshot/route.ts (new)
app/api/members/journal/tags/route.ts (new)
app/api/members/journal/enrich/[id]/route.ts (new)      ← Trigger enrichment
app/api/members/journal/replay/[id]/route.ts (new)      ← Trade replay data
app/api/members/journal/quick-entry/route.ts (new)      ← One-click entry
app/api/members/journal/close/[id]/route.ts (new)       ← Close open position
app/api/members/journal/smart-tags/[id]/route.ts (new)  ← Smart tag suggestions
backend/src/services/market/enrichment.ts (new)          ← Market context builder
backend/src/services/market/verification.ts (new)        ← Price verification
backend/src/routes/market.ts (extended)                   ← /context, /replay, /verify
app/actions/journal.ts (modified - add pagination, filtering, enrichment trigger)
lib/journal-helpers.ts (new - smart tag rules)
```

### Phase 4: Social Sharing & Trade Cards (Week 8-9)

**Goal:** Complete trade card builder with verified market data overlays

Tasks:
1. Build trade card React components for each template:
   - Dark Elite
   - Emerald Gradient
   - Champagne Premium
   - Minimal
   - Story (vertical)
2. Build trade card builder interface (preview + controls)
3. **Add market context data overlay toggles** (verified badge, level proximity, IV data)
4. **Implement "Verified by TradeITM" badge** using Massive.com price verification
5. **Add mini sparkline chart option** to trade cards (1-hr bars from Massive.com)
6. Implement html-to-image generation
7. Implement share actions (download, clipboard, Twitter, Discord)
8. Build share tracking (log share events)
9. Add "Share" buttons to journal entries (one-tap share for winning trades)
10. Create API routes for share events

**Files created/modified:**
```
components/social/trade-card-builder.tsx (new)
components/social/trade-card-dark-elite.tsx (new)
components/social/trade-card-emerald.tsx (new)
components/social/trade-card-champagne.tsx (new)
components/social/trade-card-minimal.tsx (new)
components/social/trade-card-story.tsx (new)
components/social/market-context-overlay.tsx (new)      ← Market data on cards
components/social/verified-badge.tsx (new)               ← "Verified by TradeITM"
components/social/mini-sparkline.tsx (new)               ← Embedded chart on card
components/social/share-actions.tsx (new)
app/api/members/social/generate-card/route.ts (new)
app/api/members/social/share/route.ts (new)
lib/social-share.ts (new)
```

### Phase 5: Admin Platform Redesign (Week 10-12)

**Goal:** Complete admin redesign with new features

Tasks:
1. Redesign admin layout with updated sidebar and command palette
2. Rebuild admin dashboard with real analytics
3. Build Tab Configuration page (drag-and-drop, per-tier config)
4. Build Journal Configuration page
5. Build Social Sharing Configuration page
6. Redesign Settings page with tabs
7. Redesign Roles page with visual improvements
8. Build Analytics page with charts
9. Build Activity Log viewer
10. Implement admin command palette (cmdk)

**Files created/modified:**
```
app/admin/layout.tsx (modified)
components/admin/admin-sidebar.tsx (rewrite)
components/admin/admin-layout-shell.tsx (modified)
components/admin/command-palette.tsx (new)
app/admin/page.tsx (rewrite)
app/admin/tabs/page.tsx (new)
app/admin/journal-config/page.tsx (new)
app/admin/social-config/page.tsx (new)
app/admin/settings/page.tsx (rewrite)
app/admin/roles/page.tsx (modified)
app/admin/analytics/page.tsx (rewrite)
app/api/admin/tabs/route.ts (new)
app/api/admin/journal-config/route.ts (new)
app/api/admin/analytics/route.ts (new)
app/api/admin/activity-log/route.ts (new)
```

### Phase 6: Polish & Testing (Week 13-14)

**Goal:** End-to-end testing, performance optimization, final polish

Tasks:
1. Write E2E tests for all new flows (Playwright)
2. Performance audit and optimization
3. Accessibility audit (WCAG 2.1 AA)
4. Mobile testing on real devices (iOS Safari, Android Chrome)
5. Loading state verification for all async operations
6. Error state verification for all failure modes
7. Animation performance verification (60fps)
8. Bundle size optimization (code splitting per route)
9. Supabase query optimization (check for N+1, add indexes)
10. Final visual QA pass against homepage design standard

---

## 20. File Structure & Organization

### 20.1 New Files Summary

```
app/
├── members/
│   ├── layout.tsx                    (REWRITE)
│   ├── page.tsx                      (REWRITE - dashboard)
│   ├── journal/
│   │   └── page.tsx                  (REWRITE)
│   ├── ai-coach/
│   │   └── page.tsx                  (MINIMAL CHANGES - integration points only)
│   ├── library/
│   │   └── page.tsx                  (RESTYLE ONLY)
│   ├── studio/
│   │   └── page.tsx                  (RESTYLE ONLY)
│   └── profile/
│       └── page.tsx                  (RESTYLE + add upgrade section)
├── admin/
│   ├── layout.tsx                    (MODIFY)
│   ├── page.tsx                      (REWRITE - dashboard)
│   ├── tabs/
│   │   └── page.tsx                  (NEW)
│   ├── journal-config/
│   │   └── page.tsx                  (NEW)
│   ├── social-config/
│   │   └── page.tsx                  (NEW)
│   ├── settings/
│   │   └── page.tsx                  (REWRITE)
│   ├── roles/
│   │   └── page.tsx                  (MODIFY)
│   ├── analytics/
│   │   └── page.tsx                  (REWRITE)
│   └── [other existing pages]        (RESTYLE)
├── api/
│   ├── config/
│   │   ├── tabs/route.ts             (NEW)
│   │   └── quick-tags/route.ts       (NEW)
│   ├── members/
│   │   ├── dashboard/
│   │   │   ├── stats/route.ts        (NEW)
│   │   │   ├── equity-curve/route.ts (NEW)
│   │   │   └── calendar/route.ts     (NEW)
│   │   ├── journal/
│   │   │   ├── upload-screenshot/route.ts (NEW)
│   │   │   └── tags/route.ts         (NEW)
│   │   └── social/
│   │       ├── generate-card/route.ts (NEW)
│   │       └── share/route.ts        (NEW)
│   └── admin/
│       ├── tabs/route.ts             (NEW)
│       ├── journal-config/route.ts   (NEW)
│       ├── analytics/route.ts        (NEW)
│       └── activity-log/route.ts     (NEW)

components/
├── members/
│   ├── member-sidebar.tsx            (NEW)
│   ├── mobile-top-bar.tsx            (NEW)
│   ├── mobile-bottom-nav.tsx         (REWRITE)
│   └── mobile-drawer.tsx             (NEW)
├── dashboard/
│   ├── welcome-header.tsx            (NEW)
│   ├── stat-cards.tsx                (NEW)
│   ├── equity-curve.tsx              (NEW)
│   ├── quick-actions.tsx             (NEW)
│   ├── recent-trades.tsx             (REWRITE)
│   ├── ai-insights.tsx               (NEW)
│   ├── calendar-heatmap.tsx          (NEW)
│   └── market-status.tsx             (NEW)
├── journal/
│   ├── journal-filter-bar.tsx        (NEW)
│   ├── journal-stats-row.tsx         (NEW)
│   ├── journal-data-table.tsx        (NEW)
│   ├── journal-card-view.tsx         (NEW)
│   ├── entry-sheet.tsx               (NEW - replaces entry-modal)
│   ├── entry-detail-sheet.tsx        (NEW)
│   ├── screenshot-upload.tsx         (NEW)
│   ├── ai-analysis-panel.tsx         (NEW)
│   ├── quick-tags-input.tsx          (NEW)
│   ├── star-rating.tsx               (NEW)
│   └── journal-export.tsx            (NEW)
├── social/
│   ├── trade-card-builder.tsx        (NEW)
│   ├── trade-card-dark-elite.tsx     (NEW)
│   ├── trade-card-emerald.tsx        (NEW)
│   ├── trade-card-champagne.tsx      (NEW)
│   ├── trade-card-minimal.tsx        (NEW)
│   ├── trade-card-story.tsx          (NEW)
│   └── share-actions.tsx             (NEW)
├── admin/
│   ├── admin-sidebar.tsx             (REWRITE)
│   ├── admin-layout-shell.tsx        (MODIFY)
│   ├── command-palette.tsx           (NEW)
│   ├── tab-configurator.tsx          (NEW)
│   ├── journal-config-panel.tsx      (NEW)
│   └── activity-feed.tsx             (NEW)
└── ui/
    ├── stat-card.tsx                 (NEW)
    ├── data-table.tsx                (NEW)
    ├── empty-state.tsx               (NEW)
    └── skeleton-variants.tsx         (NEW)

contexts/
└── MemberAuthContext.tsx              (MODIFY - remove legacy permissions)

lib/
├── social-share.ts                   (NEW)
└── journal-helpers.ts                (NEW)

supabase/
└── migrations/
    ├── YYYYMMDD_tab_configurations.sql       (NEW)
    ├── YYYYMMDD_shared_trade_cards.sql       (NEW)
    ├── YYYYMMDD_journal_quick_tags.sql       (NEW)
    ├── YYYYMMDD_analytics_events.sql         (NEW)
    ├── YYYYMMDD_admin_activity_log.sql       (NEW)
    └── YYYYMMDD_dashboard_rpc_functions.sql  (NEW)
```

---

## 21. Testing Strategy

### 21.1 E2E Tests (Playwright)

```
New test specs:
  e2e/specs/member-dashboard.spec.ts
    - Dashboard loads with real data
    - Stat cards display correct values
    - Equity curve renders
    - Recent trades link to journal
    - Mobile layout renders correctly

  e2e/specs/trade-journal.spec.ts
    - Create new entry flow (with all fields)
    - Edit existing entry
    - Delete entry with confirmation
    - Filter by date range
    - Filter by symbol
    - Filter by direction
    - Sort by columns
    - Pagination works
    - Table/card view toggle
    - Screenshot upload
    - AI analysis trigger
    - CSV export downloads file

  e2e/specs/social-sharing.spec.ts
    - Open trade card builder
    - Select template
    - Toggle show/hide fields
    - Download PNG generates file
    - Copy to clipboard works

  e2e/specs/admin-tabs.spec.ts
    - Load tab configuration page
    - Enable/disable tabs
    - Change sort order
    - Save and verify member sidebar updates

  e2e/specs/admin-dashboard.spec.ts
    - Dashboard loads with analytics
    - Charts render
    - Activity feed shows events

  e2e/specs/mobile-navigation.spec.ts
    - Bottom nav shows correct tabs
    - Hamburger opens drawer
    - Drawer shows all navigation
    - Swipe gestures work
```

### 21.2 Component Tests

```
Each new component should have basic render tests verifying:
- Renders without errors
- Accepts and displays props correctly
- Handles loading state
- Handles error state
- Handles empty state
- Responds to user interaction
```

---

## 22. Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Dashboard data load | < 500ms | Network tab |
| Journal page load | < 800ms | Network tab |
| Journal filter response | < 200ms | Client-side |
| Trade card generation | < 2s | html-to-image |
| Page transitions | 60fps | Chrome DevTools |
| Mobile blur performance | Consistent 60fps | DevTools |
| Bundle size per route | < 200KB gzipped | Build output |

### Optimization Strategies

1. **Route-based code splitting**: Each member/admin page lazy-loaded
2. **Server Components**: Use where no interactivity needed (data fetching)
3. **Image optimization**: Next.js Image component + Supabase CDN
4. **Query caching**: React Query or SWR for client-side data caching
5. **Skeleton loading**: Immediate visual feedback before data arrives
6. **Mobile blur reduction**: 20px on mobile vs 40-60px on desktop
7. **Virtualized lists**: For journal entries > 50 items
8. **Debounced filters**: 300ms debounce on text inputs

---

## 23. Accessibility Requirements

### WCAG 2.1 AA Compliance

1. **Color Contrast**: All text meets 4.5:1 ratio (ivory on onyx = 16.7:1, excellent)
2. **Focus Management**: Visible focus rings (emerald, 2px) on all interactive elements
3. **Keyboard Navigation**: Full tab navigation through all controls
4. **Screen Readers**: Proper ARIA labels on all custom components
5. **Motion Sensitivity**: Respect `prefers-reduced-motion` media query
6. **Touch Targets**: Minimum 44x44px on mobile
7. **Form Labels**: All inputs have associated labels
8. **Error Announcements**: Errors announced to screen readers via aria-live
9. **Skip Navigation**: Skip link for main content area
10. **Semantic HTML**: Proper heading hierarchy, landmarks, lists

### Motion Sensitivity Implementation

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```typescript
// In Framer Motion
const shouldAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageTransition = shouldAnimate ? springTransition : { duration: 0 };
```

---

## Appendix A: Component Naming Conventions

```
Files: kebab-case (e.g., equity-curve.tsx, trade-card-builder.tsx)
Components: PascalCase (e.g., EquityCurve, TradeCardBuilder)
Hooks: camelCase with "use" prefix (e.g., useJournalFilters, useDashboardStats)
Types: PascalCase with descriptive name (e.g., JournalEntry, TabConfig, DashboardStats)
API routes: kebab-case folders (e.g., /api/members/dashboard/equity-curve)
Database: snake_case (e.g., tab_configurations, shared_trade_cards)
CSS classes: Follow Tailwind conventions + custom classes from globals.css
```

## Appendix B: Environment Variables (No Changes)

All existing environment variables remain. No new environment variables are required for this redesign. All configuration is stored in the database (Supabase).

## Appendix C: Third-Party Dependencies

**No new dependencies required.** The redesign uses only libraries already in `package.json`:

- `recharts` (charts)
- `framer-motion` (animations)
- `react-dropzone` (file upload)
- `html-to-image` (trade card generation)
- `react-day-picker` (date picker)
- `cmdk` (command palette)
- `@radix-ui/*` (UI primitives)
- `lucide-react` (icons)
- `date-fns` (date formatting)
- `sonner` (toasts)

---

**END OF SPECIFICATION**

This document is the complete blueprint for implementing the TITM Member & Admin Platform Redesign. Every component, every interaction, every database field, every API route is specified. Claude Code should be able to implement this spec from Phase 1 through Phase 6 using spec-driven development without ambiguity.
