# Sniper Zone — Dashboard Audit & Refactor Prompt

> **Scope:** Rename the first member tab from "Command Center" → **"Sniper Zone"**, then audit and refactor the entire dashboard page for data accuracy, visual presentation, and responsive layout. The goal: make this the page a day trader opens at 8:30 AM and immediately knows what matters today.

---

## CONTEXT — Architecture Already Mapped

**Route:** `/members` (main dashboard — `app/members/page.tsx`)
**Tab ID:** `dashboard` (sort_order: 0, required_tier: `core`, `is_required: true`)
**Current Label:** "Command Center" → rename to **"Sniper Zone"**
**Design System:** Emerald Standard — `var(--emerald-elite)` primary, `var(--champagne)` accent, dark mode only, `glass-card-heavy` containers.
**Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, Supabase, Shadcn/UI, Lucide React, Framer Motion.

### Component Tree (13 components)
```
MemberDashboard (app/members/page.tsx)
├── WelcomeHeader              → Greeting, date, market status, ET clock
├── LiveMarketTicker           → SPX/NQ/RUT prices, VWAP, ATR, IV Rank, market status
├── DashboardStatCards         → Win rate, P&L MTD, streak, AI grade, trades MTD (5 cards)
├── [Grid: 1fr / 280px sidebar]
│   ├── EquityCurve            → Cumulative P&L chart (7D/30D/90D/YTD/All) via Recharts
│   └── QuickActions           → Log Trade, Ask AI Coach, Share Last Win
├── RecentTrades               → Last 5 trades (symbol, direction, P&L, AI grade, time)
├── [Grid: 3-col]
│   ├── MarketBriefCard        → AI summary, economic events, watchlist earnings, open risk
│   ├── AIInsights             → AI analysis, patterns, suggestions
│   └── CalendarHeatmap        → Trading P&L heatmap (month/quarter/year)
└── [Grid: 3-col]
    ├── EarningsRadarCard      → Upcoming earnings (EPS/revenue estimates)
    ├── MarketAnalyticsCard    → Regime, index performance, breadth, signals
    ├── MarketMoversCard       → Top 5 gainers/losers
    └── StockSplitsCalendar    → Upcoming stock splits
```

### Data Sources
| Component | API Endpoint | Refresh | Source |
|-----------|-------------|---------|--------|
| LiveMarketTicker | `useMarketIndices()` → `/api/market/indices` | 10s | Massive.com |
| LiveMarketTicker | `useMarketStatus()` → `/api/market/status` | 60s | Backend calc |
| DashboardStatCards | `/api/members/dashboard/stats?period=month` | On-load | Supabase |
| EquityCurve | `/api/members/dashboard/equity-curve?days={n}` | On-load | Supabase |
| RecentTrades | `/api/members/journal?limit=5&sort=created_at&order=desc` | On-load | Supabase |
| MarketBriefCard | `getMorningBrief()` (authenticated) | On-load | AI Coach backend |
| AIInsights | 3 parallel calls to `/api/members/journal` + `/analytics` | On-load | Supabase |
| CalendarHeatmap | `/api/members/dashboard/calendar?view={view}` | On-load | Supabase |
| MarketAnalyticsCard | `useMarketAnalytics()` → `/api/market/analytics` | 30s | Backend calc |
| MarketMoversCard | `useMarketMovers(5)` → `/api/market/movers?limit=5` | 60s | Massive.com |
| EarningsRadarCard | `getEarningsCalendar()` (30-day window) | On-load | Backend |
| StockSplitsCalendar | `useUpcomingSplits()` | On-load | Backend |
| WelcomeHeader | **Client-side only** (local clock) | 30s | None |
| QuickActions | **Fully static** | Never | None |

### Known Bugs (Pre-Identified)
| Severity | Component | Issue |
|----------|-----------|-------|
| **CRITICAL** | WelcomeHeader | Market status is **hardcoded client-side** (checks local clock against fixed hours). Doesn't account for holidays, early closes, or clock drift. Should use `useMarketStatus()` hook like LiveMarketTicker does. |
| **CRITICAL** | QuickActions | "Share Last Win" button has **no onClick handler** — completely non-functional. No logic to detect if a "last win" even exists. |
| **HIGH** | AIInsights | **Inconsistent API params**: first call uses `sort=created_at&order=desc`, third call uses `sortBy` and `sortDir` — likely one pattern is wrong. |
| **HIGH** | RecentTrades | Handles both `{ success, data }` wrapper and raw array responses — API contract is inconsistent. |
| **HIGH** | EquityCurve | YTD is hardcoded as `days=365` instead of calculating actual days since Jan 1. |
| **MEDIUM** | EquityCurve | Gradient color `#10B981` is hardcoded instead of using `var(--emerald-elite)`. |
| **MEDIUM** | CalendarHeatmap | No mobile touch/tap support for cell details — hover-only tooltips. Cell size (11-13px) too small for mobile. |
| **MEDIUM** | RecentTrades | Timestamp column `hidden sm:block` — mobile users lose temporal context entirely. |
| **MEDIUM** | MarketBriefCard | Economic events hard-sliced to 3, earnings to 4, open risks to 3 — no "show more" option. |
| **LOW** | WelcomeHeader | Greeting uses local hour but market status uses ET — inconsistent timezone basis. |
| **LOW** | DashboardStatCards | P&L formatted with 0 decimals (`maximumFractionDigits: 0`) — inconsistent with other currency displays. |

---

## PHASE 1 — RENAME: "Command Center" → "Sniper Zone"

Update all user-facing references. **Do NOT rename** file paths, route slugs, component variable names, or API endpoints.

**Exact locations to update:**
1. `app/api/config/tabs/route.ts` — Change `label: 'Command Center'` to `'Sniper Zone'` for the `dashboard` tab (sort_order 0)
2. Any `DEFAULT_TABS` fallback array that contains `'Command Center'`
3. `app/members/page.tsx` — Any page title, metadata, or heading text
4. `components/dashboard/welcome-header.tsx` — If any "Command Center" text appears in the greeting area
5. `lib/member-navigation.ts` — Any fallback label mapping for `'dashboard'` tab_id
6. `components/members/member-sidebar.tsx` — Any hardcoded label override
7. `components/members/mobile-bottom-nav.tsx` — Any hardcoded label override
8. Any aria-labels referencing "Command Center" (check all `role="region"` in page.tsx)

**Do NOT touch:** Internal event names, component function names, file names, CSS class names.

---

## PHASE 2 — DATA ACCURACY AUDIT

Read every component in the tree. For each, trace the data flow and verify accuracy. Output a structured audit report BEFORE writing any code.

### Component-Specific Audit Checklist:

**WelcomeHeader** (`welcome-header.tsx`)
- [ ] Market status: Replace hardcoded client-side hour checks with `useMarketStatus()` hook (already used by LiveMarketTicker — reuse it)
- [ ] Greeting timezone: Should greeting be based on ET (market time) or local time? Pick one and be consistent
- [ ] Username fallback: `split(' ')[0]` is fragile — what if username has no space?

**LiveMarketTicker** (`live-market-ticker.tsx`)
- [ ] Verify SPX/NQ/RUT prices update every 10s via `useMarketIndices()`
- [ ] Verify VWAP, ATR, IV Rank render conditionally (`metrics?.vwap != null`) — good pattern, confirm it works
- [ ] Verify stale/error state: `marketFeedUnavailable` shows red dot + "Data Unavailable" — confirm this fires on actual API failure
- [ ] Clock display: `new Date().toLocaleTimeString()` recalculates on every render but has no interval — stale?

**DashboardStatCards** (`dashboard-stat-cards.tsx`)
- [ ] Win Rate: `winRate.toFixed(1)%` — what if API returns null? Currently falls back to `0` which displays "0.0%" — is that misleading vs "—"?
- [ ] P&L MTD: `maximumFractionDigits: 0` — should match other currency formatting (2 decimals)
- [ ] AI Grade: `startsWith('A')` color logic — what about 'A+', 'A-'? Does the API return those?
- [ ] pnl_change_pct trend: Currently attached to the Win Rate card, not the P&L card — is that intentional or a bug?
- [ ] All 5 cards use `?? 0` or `?? '—'` fallbacks — verify no `NaN` possible

**EquityCurve** (`equity-curve.tsx`)
- [ ] YTD button: Fix from `days=365` to actual days since Jan 1 of current year
- [ ] Gradient: Replace hardcoded `#10B981` with CSS variable reference
- [ ] `Number(point.cumulative_pnl)` coercion: What if API returns string "null"? → NaN on chart
- [ ] Empty state: What renders when user has zero trades? Confirm it's not a blank chart area

**QuickActions** (`quick-actions.tsx`)
- [ ] "Share Last Win" — either implement with real data or remove/replace with functional action
- [ ] Consider: What actions actually help a day trader at 8:30 AM? "Log Trade" is reactive (post-trade). Consider replacing with "Morning Brief", "Open AI Coach", "Review Watchlist"

**RecentTrades** (`recent-trades.tsx`)
- [ ] API response: Normalize to handle both `{ success, data }` and raw array
- [ ] Timestamp on mobile: Instead of `hidden sm:block`, show relative time ("2h ago") on mobile
- [ ] AI grade color: Verify grade-to-color mapping handles all possible grades
- [ ] Empty state: Confirm "No trades logged yet" renders with a CTA to log first trade

**MarketBriefCard** (`market-brief-card.tsx`)
- [ ] `parseClockTime` / `getEtClock` — test with non-standard time formats (what if API sends "TBD"?)
- [ ] Countdown interval (60s) — should this be more frequent for events < 15 min away?
- [ ] Line-clamp truncation: Important AI summary content may be cut off. Add "Read more" expand?
- [ ] Hard-sliced lists (3 events, 4 earnings, 3 risks) — add "show more" or paginate

**AIInsights** (`ai-insights.tsx`)
- [ ] Fix API parameter inconsistency: `sort`/`order` vs `sortBy`/`sortDir` — determine which the API actually accepts
- [ ] Patterns limited to first 3 — is there a UI reason or arbitrary?
- [ ] Silent JSON parse failures — add error state UI

**CalendarHeatmap** (`calendar-heatmap.tsx`)
- [ ] Mobile: Add tap support (not just hover) for cell details
- [ ] Cell size: increase from 11-13px to minimum 20px on mobile, or switch to a list view
- [ ] Annotation logic: `tilt` (3+ loss streak) and `streak` (every 3 wins) thresholds — are these configurable or arbitrary?
- [ ] Week alignment: Verify it matches ISO week standards

**MarketAnalyticsCard** (`market-analytics-card.tsx`)
- [ ] `Array.isArray(analytics.indices)` defensive checks — log a warning if the API returns unexpected shapes
- [ ] Regime color/icon mapping: Verify all 3 regimes (Risk-On, Risk-Off, Neutral) render distinctly

**MarketMoversCard** (`market-movers-card.tsx`)
- [ ] Fixed `280px` ScrollArea height — should adapt to content or screen size
- [ ] Tab state doesn't persist — minor but note it

**EarningsRadarCard** (`earnings-radar-card.tsx`)
- [ ] Revenue formatting: B/M thresholds — what about T (trillions) or values < 1M?
- [ ] Source labels: Only 4 recognized — add fallback for unknown sources
- [ ] Date confirmation: "Unconfirmed" status should be more visually prominent (amber badge?)

**StockSplitsCalendar** (`stock-splits-calendar.tsx`)
- [ ] Fixed `280px` ScrollArea — should adapt
- [ ] `new Date().toLocaleDateString()` — timezone-sensitive? Should use ET

### Required Report Format:
```markdown
## Sniper Zone — Data Audit Report

### Critical (must fix before rename ships)
- [C1] Component — Description — File:line — Fix

### High (degrades trader experience)
- [H1] Component — Description — File:line — Fix

### Medium (polish before next release)
- [M1] Component — Description — File:line — Fix

### Low (backlog)
- [L1] Component — Description — File:line — Fix

### Data Flow Map
Component → Hook/Fetch → Endpoint → Backend Source → Transformation Applied

### Hardcoded/Mock Values
- File:line — Current value — Should source from ___
```

---

## PHASE 3 — DATA ACCURACY FIXES

Fix every issue from the Phase 2 report. Priority order: Critical → High → Medium.

### Formatting Standards (enforce across ALL components):

| Data Type | Format | Example | Implementation |
|-----------|--------|---------|----------------|
| Currency (display) | `$X,XXX.XX` | `$1,243.50` | `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` |
| Currency (P&L) | `+$X,XXX.XX` / `-$X,XXX.XX` | `+$340.00` | Prefix sign explicitly |
| Percentage | `XX.X%` | `74.2%` | 1 decimal, always suffix `%` |
| Large $ amounts | `$X.XM` / `$XXK` | `$1.2M` | For values > $10K, use compact notation |
| Index prices | `X,XXX.XX` | `5,842.31` | 2 decimals, comma separators |
| Timestamps | `h:mm A ET` | `3:42 PM ET` | Always ET timezone, always labeled |
| Dates | `MMM D` or `MMM D, YYYY` | `Feb 18` | Short month, no leading zero |
| Null/missing | `—` (em dash) | `—` | Never show `NaN`, `undefined`, `null`, or blank |
| Empty arrays | Styled empty state | "No trades yet" | Never a blank container |
| Zero denominator | `—` | `—` | Never show `Infinity` or `NaN` |

### Specific Fixes to Implement:

1. **WelcomeHeader → useMarketStatus()**: Replace the hardcoded hour-based market status with the existing `useMarketStatus()` hook. This is the highest-priority fix — the current implementation will show wrong status on holidays and early closes.

2. **QuickActions → Make functional or replace**: Either wire "Share Last Win" to real data, or replace the 3 actions with morning-workflow actions: "Morning Brief" (scrolls to MarketBriefCard), "Open AI Coach" (navigates to coach), "Review Watchlist" (navigates to watchlist). All buttons must have working onClick handlers.

3. **EquityCurve → Fix YTD**: Replace `days=365` with:
   ```ts
   const now = new Date()
   const ytdDays = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000)
   ```

4. **AIInsights → Fix API params**: Audit the journal API to determine correct sort param name, then make all 3 calls consistent.

5. **RecentTrades → Normalize response + mobile timestamp**: Handle both response shapes with a normalizer, and show relative time on mobile instead of hiding the column.

6. **DashboardStatCards → P&L formatting**: Change to `minimumFractionDigits: 2, maximumFractionDigits: 2` to match currency standards. Also: verify `pnl_change_pct` is on the right card.

---

## PHASE 4 — VISUAL HIERARCHY & DATA PRESENTATION

Redesign how information is visually prioritized. A day trader opening this page at 8:30 AM should be able to answer these questions in order, within seconds:

**1. "What's the market doing right now?"** (0-2 seconds)
→ LiveMarketTicker: SPX/NQ/RUT prices, market status. This is already well-built — keep it.

**2. "How am I performing?"** (2-5 seconds)
→ DashboardStatCards: Win rate, P&L, streak. These should be the visual anchor of the page.
  - Make P&L MTD the **largest number** in the stat cards (it's the trader's scorecard)
  - Win rate and streak are supporting metrics — slightly smaller
  - AI Grade: consider making this a visual badge (letter in a circle) not just text
  - Trades count: least important — can be smallest

**3. "What should I focus on today?"** (5-10 seconds)
→ MarketBriefCard: AI morning brief, economic events, earnings.
  - This should be **elevated in the layout** — not buried in the third row
  - Consider moving it to directly below stat cards, full width
  - Economic event countdowns should be visually prominent (amber pill with countdown)

**4. "What happened recently?"** (10-15 seconds)
→ RecentTrades + EquityCurve: Recent performance context.

**5. "What else is going on?"** (scroll to explore)
→ MarketMovers, Analytics, Earnings, Splits, Calendar: Supplementary intelligence.

### Specific Visual Improvements:

- **Stat cards**: Currently all same size. Make P&L card span 2 columns on desktop (hero position). Other 4 cards fit in remaining 3 columns.
- **Color consistency**: Enforce the color table from CLAUDE.md across ALL components:
  | Meaning | Color |
  |---------|-------|
  | Positive / Profit / Bullish | `text-emerald-400` / `var(--emerald-elite)` |
  | Negative / Loss / Bearish | `text-red-400` |
  | Neutral / Unchanged | `text-zinc-500` |
  | Accent / Highlight / Hot streak | `var(--champagne)` / `text-champagne` |
  | Warning / Caution / Unconfirmed | `text-amber-400` |

- **Cards with fixed `280px` heights** (MarketMovers, StockSplits): Replace with `max-h-[280px]` so they can shrink on smaller viewports.
- **Trend indicators**: Every metric that has a comparison value should show ▲ ▼ or — with appropriate color. Currently only some cards do this.
- **Number alignment**: All numeric values in tables and cards should be right-aligned and use `tabular-nums font-mono` for alignment.

---

## PHASE 5 — RESPONSIVE LAYOUT REFACTOR

### Mobile (< 768px)

**Above the fold (no scrolling required):**
1. Market status pill + ET clock (compact, single line)
2. SPX / NQ / RUT prices with change % (horizontal scroll ticker)
3. P&L MTD (hero number, large)
4. Win Rate + Streak (compact row beneath P&L)

**Below the fold (scroll to explore):**
5. Morning Brief (AI summary, economic events) — full width
6. Recent Trades — card list, NOT a table (show relative time like "2h ago")
7. Equity Curve — full width, touch-friendly time range selector
8. Market Movers — tabs (gainers/losers), card list
9. Calendar Heatmap — switch to list view on mobile (daily P&L list instead of tiny grid)
10. Remaining cards stacked full-width

**Mobile-specific rules:**
- No horizontal scroll on the page body (ticker can scroll internally)
- All tap targets ≥ 44x44px
- `CalendarHeatmap` cells: either increase to 24px+ or switch to list view
- `QuickActions` sidebar: convert to horizontal pill bar or FAB menu on mobile
- Sticky element: market ticker should stick to top on scroll (lightweight, not the full header)

### Desktop (≥ 768px)

**Layout grid:**
```
Row 1: WelcomeHeader (full width)
Row 2: LiveMarketTicker (full width)
Row 3: DashboardStatCards — P&L hero (2 cols) + 4 stat cards (3 cols) = 5-col grid
Row 4: MarketBriefCard (2/3 width) + QuickActions (1/3 width)
Row 5: EquityCurve (2/3 width) + RecentTrades (1/3 width)
Row 6: [3-col grid] MarketAnalytics | MarketMovers | EarningsRadar
Row 7: [3-col grid] CalendarHeatmap | AIInsights | StockSplits
```

**Desktop-specific rules:**
- Hover states on all cards (subtle `border-white/[0.12]` on hover)
- Tables stay as tables (full columns visible)
- CalendarHeatmap: full grid with hover tooltips
- Maximum content width: `max-w-[1440px]` centered

### Both
- `glass-card-heavy` on all card containers
- Consistent `rounded-xl` border radius
- Spacing: `gap-3` within card grids, `gap-6` between major sections
- Framer Motion animations: keep existing `FADE_UP_VARIANT` and `STAGGER_CHILDREN` — they're good
- Accessibility: maintain `role="region"` and `aria-label` on all sections (already present — don't regress)

---

## PHASE 6 — FINAL VERIFICATION

After all changes, verify every item:

**Rename:**
- [ ] All user-facing "Command Center" text now reads "Sniper Zone"
- [ ] Tab config API returns `label: "Sniper Zone"` for dashboard tab
- [ ] Sidebar and mobile nav display "Sniper Zone"
- [ ] Route `/members` still works (no routing changes)

**Data Accuracy:**
- [ ] WelcomeHeader uses `useMarketStatus()` — no client-side hour checks remain
- [ ] All stat card values source from `/api/members/dashboard/stats` — no hardcoded zeros displayed as real data
- [ ] EquityCurve YTD calculates actual days since Jan 1
- [ ] AIInsights API calls use consistent parameter names
- [ ] RecentTrades handles both API response shapes
- [ ] QuickActions buttons all have working onClick handlers
- [ ] Every null/undefined displays `—`, never `NaN` or blank
- [ ] All currency values formatted with 2 decimals and comma separators
- [ ] All timestamps show ET timezone with label

**Layout:**
- [ ] 375px (mobile): single column, no horizontal scroll, P&L visible above fold
- [ ] 768px (tablet): grid stacks properly, no overflow
- [ ] 1280px (desktop): full grid layout, hover states work
- [ ] CalendarHeatmap is usable on mobile (list view or larger cells)
- [ ] All tap targets ≥ 44x44px on mobile

**Visual:**
- [ ] Color usage matches the color table (green=positive, red=negative, champagne=accent, amber=warning)
- [ ] P&L is the most visually prominent number in stat cards
- [ ] `glass-card-heavy` on all card containers
- [ ] `rounded-xl` consistent across all cards
- [ ] No hardcoded hex colors — all use CSS variables or Tailwind classes

**Stability:**
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No console warnings or errors
- [ ] Framer Motion animations still fire on load
- [ ] All existing API calls still function
- [ ] Loading skeletons render during data fetches
- [ ] Error states render when APIs fail

---

## CONSTRAINTS (NON-NEGOTIABLE)

1. **No route changes.** Path stays `/members`. Tab ID stays `dashboard`.
2. **No file renames.** All component files, hook files, API routes keep current names.
3. **No data removal.** Every currently displayed data point stays. Reorganize and restyle, never remove.
4. **No new dependencies** unless critical and justified in a comment. Recharts, Framer Motion, Lucide — all already present.
5. **Presentation-layer only** unless a data bug requires a fix (e.g., WelcomeHeader market status, EquityCurve YTD).
6. **Emerald Standard only.** `var(--emerald-elite)`, `var(--champagne)`, `glass-card-heavy`. Never `#D4AF37`.
7. **Existing patterns.** `next/image` for images, Lucide for icons, Shadcn/UI base, `SpotlightCard` wrappers where used.
8. **No backend changes.** All fixes are frontend. If a backend endpoint is missing or broken, render a styled "Data unavailable" placeholder — never a fake number.

---

**Begin with Phase 1 (rename) and Phase 2 (audit report). Output the complete audit report as a markdown block before proceeding to any code changes.**
