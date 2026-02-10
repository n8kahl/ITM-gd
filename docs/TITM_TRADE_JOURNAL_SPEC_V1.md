# TITM Trade Journal — Feature Gap Analysis, UI/UX Audit & Implementation Specification

> **Prepared for:** Nate Kahl, TradeITM
> **Date:** February 9, 2026
> **Version:** 1.0 | Classification: Internal
> **Purpose:** Production-ready specification designed to be handed directly to Claude Code for end-to-end implementation.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Landscape Analysis](#2-competitive-landscape-analysis)
3. [UI/UX Audit Report](#3-uiux-audit-report)
4. [Implementation Specification](#4-implementation-specification)
5. [Database Schema Changes](#5-database-schema-changes)
6. [API Specification](#6-api-specification)
7. [Implementation Timeline & Effort Estimates](#7-implementation-timeline--effort-estimates)
8. [Competitive Moat Analysis](#8-competitive-moat-analysis)
9. [Success Metrics & Acceptance Criteria](#9-success-metrics--acceptance-criteria)
10. [Appendix](#10-appendix)

---

## 1. Executive Summary

### 1.1 Purpose

This specification document delivers three integrated analyses for the TradeITM (TITM) platform: a competitive feature gap analysis benchmarking TITM against the 10 leading trade journal and AI trading platforms; a comprehensive UI/UX audit identifying 28 issues across desktop and mobile; and a detailed implementation specification with production-ready requirements for every recommended enhancement.

The objective is singular: make TITM the undisputed leader in AI-powered trade journaling, surpassing every competitor in journal depth, AI intelligence, and user experience quality.

### 1.2 Key Findings

#### 1.2.1 Competitive Position

TITM currently holds a unique position in the market as the only platform that deeply integrates an AI Coach with real-time market data (Massive.com), options analytics (GEX, 0DTE, IV), proactive intelligence (morning briefs, setup detection), and trade journaling in a single interface. No competitor offers this combination.

However, critical gaps exist in journal-specific features where dedicated platforms like TradesViz (600+ metrics, full Greeks), TraderSync (Cypher AI coach, 900+ broker integrations), and Edgewonk (psychology analytics via Tiltmeter) outperform TITM in their respective specialties.

#### 1.2.2 UI/UX Assessment

**Overall Rating: 6.5/10.** Strong luxury aesthetic (Emerald Standard design system) with critical UX execution gaps. The design system is sophisticated and cohesive, but user flows for trade entry, navigation, and mobile experience contain friction that causes drop-off. Two issues are rated Critical, nine are High priority.

#### 1.2.3 Implementation Scope

This spec defines 7 implementation phases spanning approximately 12–16 weeks of development. Phase 1 (Critical UX Fixes) and Phase 2 (Journal Feature Parity) should be prioritized to close the most impactful competitive gaps while improving retention. Phases 3–7 build TITM's unique advantages into an unassailable moat.

### 1.3 Strategic Thesis

TITM should not try to replicate TradesViz's 600 metrics or TraderSync's 900 broker integrations. Instead, TITM should dominate at the intersection of AI intelligence and journaling—a space no competitor owns. The vision: every trade logged in TITM gets smarter over time, with AI that learns the trader's patterns, detects psychological drift, suggests improvements proactively, and connects journal insights to live market conditions. This is the defensible moat.

---

## 2. Competitive Landscape Analysis

### 2.1 Market Overview

The trade journal market segments into four tiers: dedicated journal platforms (TradeZella, Tradervue, Edgewonk, TradesViz, TraderSync), social trading journals (Kinfo), free/lightweight tools (Stonk Journal), and AI-first analysis platforms with journal capabilities (TrendSpider, Journalytix). TradingView occupies a separate category as a charting platform with replay features.

Key market trends driving competitive dynamics include: AI integration becoming table-stakes rather than differentiating; options-specific analytics emerging as a premium differentiator; mobile-first experiences becoming mandatory; and psychology/behavioral analytics as an underserved niche.

### 2.2 Feature Comparison Matrix

#### 2.2.1 Journal & Trade Logging

| Feature | TITM | TradeZella | TraderSync | TradesViz | Edgewonk |
|---|---|---|---|---|---|
| Manual Trade Entry | Yes | Yes | Yes | Yes | Yes |
| Broker Auto-Sync | No | 20+ brokers | 900+ brokers | 40+ brokers | 200+ brokers |
| Screenshot AI Analysis | Yes (GPT-4o) | Basic | Basic | Basic | Basic |
| CSV/Excel Import | Yes (500 max) | Yes | Yes | Yes | Yes |
| Voice Notes/Dictation | No | No | No | No | No |
| Auto-Journal from AI Coach | Partial | No | No | No | No |
| Smart Tag Generation | Yes (market context) | No | Partial | No | No |
| Trade Verification | Yes (vs Massive data) | No | No | No | No |
| Open Position Tracking | Schema only | Yes | Yes | Yes | Yes |
| Multi-Asset Support | Stocks + Options | All | All | All | All |

#### 2.2.2 AI Capabilities

| Feature | TITM | TraderSync | Edgewonk | TrendSpider | Journalytix |
|---|---|---|---|---|---|
| AI Chat Coach | Yes (GPT-4o) | Cypher AI | No | Sidekick AI | No |
| Proactive Alerts | Yes (setup detect) | Partial | No | Yes | Yes |
| Pattern Recognition | Partial | Yes | Edge Finder | Yes | Partial |
| Psychology Analytics | No | Yes | Tiltmeter | No | No |
| Behavioral Drift Detection | No | Partial | Yes | No | No |
| AI Trade Grading | Schema only | Yes | Yes | No | No |
| Morning Briefing | Yes | No | No | No | No |
| Real-time Market Data | Yes (Massive) | No | No | Yes | Yes |
| Function Calling/Tools | Yes (ChatKit) | No | No | No | No |
| Personalized Insights | Partial | Yes | Yes | Partial | No |

#### 2.2.3 Analytics & Statistics

| Feature | TITM | TradesViz | TraderSync | Edgewonk | Tradervue |
|---|---|---|---|---|---|
| Total Metrics Available | ~15 | 600+ | 200+ | ~80 | ~100 |
| Win Rate / P&L / Profit Factor | Yes | Yes | Yes | Yes | Yes |
| Equity Curve | Yes | Yes | Yes | Yes | Yes |
| R-Multiple Analysis | No | Yes | Yes | Yes | Yes |
| Expectancy | No | Yes | Yes | Yes | Yes |
| MFE/MAE (Max Fav/Adv Excursion) | No | Yes | Yes | No | Yes |
| Drawdown Analysis | No | Yes | Yes | Yes | Yes |
| Calendar Heatmap | Yes | Yes | Yes | Yes | No |
| Strategy Breakdown | No | Yes | Yes | Yes | Yes |
| Time-of-Day Analysis | No | Yes | Yes | Partial | Partial |

#### 2.2.4 Options-Specific Features

| Feature | TITM (AI Coach) | TITM (Journal) | TradesViz | TraderSync |
|---|---|---|---|---|
| Greeks Tracking (Delta/Theta/Gamma/Vega) | Yes (live) | No | Yes (full) | Limited |
| IV Analysis & Rank | Yes (live) | No | Yes | No |
| GEX (Gamma Exposure) | Yes (live) | No | No | No |
| 0DTE Toolkit | Yes (live) | No | No | No |
| Options Chain View | Yes (live) | No | Yes | No |
| Spread Strategy Detection | No | No | Yes | Yes |
| IV at Entry/Exit (Journal) | Schema only | No | Yes | No |
| DTE Tracking in Journal | No | No | Yes | No |
| Options P&L with Greeks | No | No | Yes | Partial |

#### 2.2.5 Visualization & Replay

| Feature | TITM | TradesViz | TraderSync | TradeZella | TradingView |
|---|---|---|---|---|---|
| Trade Replay | Yes (1-min bars) | Yes | Market Replay Terminal | Tick-by-tick | Bar Replay |
| Interactive Charts | TradingView Lightweight | 100+ indicators | Advanced | Advanced | Full TradingView |
| Heatmaps | Calendar only | Multi-dimensional | Calendar | No | No |
| Custom Dashboards | No | Yes | Yes | Yes | Limited |
| Pivot/Grid Charts | No | Yes (unique) | No | No | No |
| Performance Benchmarking | No | Yes | Yes | No | No |

#### 2.2.6 Mobile & Social

| Feature | TITM | TradeZella | TraderSync | TradesViz | Kinfo |
|---|---|---|---|---|---|
| Native iOS App | No (PWA) | Yes | Yes | Yes | Yes |
| Native Android App | No (PWA) | Yes | Yes | Yes | Yes |
| Mobile Feature Parity | Partial | Full | Full | Partial | Limited |
| Trade Sharing | No | Yes | Yes | No | Primary feature |
| Leaderboard/Rankings | No | No | No | No | Yes |
| Community Insights | No | Yes | Yes | No | Yes |
| Mentor/Group Spaces | No | Yes | Yes | No | No |

### 2.3 Critical Gap Summary

| Gap | Severity | Competitive Impact | Recommended Priority |
|---|---|---|---|
| Broker Auto-Import | High | TraderSync has 900+, TradesViz 40+. TITM has 0. | Phase 3 |
| Advanced Journal Analytics (R-mult, MFE/MAE, Expectancy, Drawdown) | Critical | Every serious competitor offers these. TITM has ~15 metrics vs 600+. | Phase 2 |
| AI Trade Grading System | Critical | TraderSync and Edgewonk both have AI grading. TITM has schema only. | Phase 2 |
| Psychology/Behavioral Analytics | High | Only Edgewonk (Tiltmeter) offers this. Massive opportunity. | Phase 4 |
| Options Greeks in Journal Entries | High | TradesViz is only competitor with full Greeks. TITM has live data but does not persist to journal. | Phase 2 |
| Journal-to-AI-Coach Bridge | Medium | No competitor has this. TITM's unique advantage if built. | Phase 5 |
| Customizable Dashboard | Medium | TradesViz, TraderSync, TradeZella all offer this. | Phase 6 |
| Open Position Management | High | All major competitors support live P&L tracking. | Phase 3 |
| Strategy/Playbook System | Medium | TradeZella Playbooks and Edgewonk setups are popular. | Phase 4 |
| Mobile-First Experience | High | TradeZella, TraderSync have native apps. TITM is web-only. | Phase 7 |

---

## 3. UI/UX Audit Report

### 3.1 Audit Methodology

This audit was conducted through comprehensive code review of all frontend components, layout files, navigation patterns, and responsive breakpoint implementations. Each issue is rated Critical, High, Medium, or Low based on user impact and frequency. The audit covers 8 focus areas: Information Architecture, Navigation, Journal UX, AI Coach UX, Mobile Experience, Visual Consistency, Accessibility, and Interaction Design.

### 3.2 Strengths

- **Emerald Standard Design System:** Cohesive luxury aesthetic with well-defined color palette (Emerald #10B981, Champagne #F3E5AB, Onyx #0A0A0B), glassmorphism patterns, and consistent typography (Playfair Display headings, Inter body, Geist Mono for prices).
- **Component Architecture:** Well-organized React components with clear separation of concerns. Context API usage is appropriate and performant.
- **Motion Design:** Framer Motion animations are tasteful and purposeful (spring transitions, layout animations, presence animations).
- **Icon Consistency:** Lucide React icons used throughout with consistent stroke width (1.5) and sizing.
- **Color Contrast:** Primary text (Ivory on Onyx) achieves WCAG AAA compliance at 18:1 contrast ratio.

### 3.3 Critical Issues

#### 3.3.1 CRITICAL: Mobile Navigation is Fragmented

**Impact:** Three separate navigation components (MobileTopBar, MobileDrawer, MemberBottomNav) create cognitive overload. Users have two overlapping ways to navigate: a hamburger-triggered drawer AND a bottom tab bar. When the drawer opens, the bottom nav remains visible underneath at reduced opacity, creating visual confusion about what is interactive.

**Recommendation:** Consolidate to a single bottom navigation pattern (Instagram/Spotify model). Delete the drawer component entirely. Repurpose the hamburger icon for secondary actions only (profile settings, sync roles). The bottom nav should contain: Dashboard, Journal, AI Coach, Library, and Profile.

**Files Affected:** `mobile-drawer.tsx` (DELETE), `mobile-bottom-nav.tsx` (ENHANCE), `mobile-top-bar.tsx` (SIMPLIFY)

#### 3.3.2 CRITICAL: Trade Entry Form is Overwhelming

**Impact:** The TradeEntrySheet packs 50+ interactive elements into a single sliding panel: date picker, symbol input, direction toggle, entry/exit prices, position size, P&L fields, screenshot dropzone with upload progress, AI analysis section, three-tab notes area (Setup/Execution/Lessons), 10 quick-tag toggles, and a 5-star rating system. New users abandon the form.

**Recommendation:** Implement a progressive disclosure pattern with a Quick Entry mode (5 essential fields: Date, Symbol, Direction, Entry Price, Exit Price) and an Advanced mode that expands to show all remaining fields. Allow saving with just the quick fields. Show a post-save prompt to add screenshot, notes, and tags incrementally rather than all at once.

### 3.4 High Priority Issues

#### 3.4.1 No Breadcrumb Navigation

Users cannot orient themselves within the app hierarchy. Especially problematic in AI Coach (which has 12 sub-views: chart, options, position, journal, screenshot, alerts, brief, scanner, tracked, LEAPS, macro) and Journal (when filters are applied). Users rely solely on the sidebar active state indicator (a 3px emerald bar) which is insufficient for complex flows.

**Recommendation:** Add breadcrumb navigation to all pages 2+ levels deep. Example: `Dashboard > AI Coach > Chart > SPX Analysis`. The AI Coach already has a workflow context system (`AICoachWorkflowContext`) that tracks breadcrumb path but it is not rendered visually.

#### 3.4.2 Center Panel Views Are Unexplained

The AI Coach center panel has 12 different views but no explanation of what each does. New users see tab icons without labels or tooltips. There is no categorization (Analytics vs Actions vs Research vs Tracking) and no recommended starting view. The onboarding modal exists but is not loaded by default.

**Recommendation:** Group views into categories with labels. Show onboarding modal on first visit. Add tooltips to each view tab explaining its purpose in one sentence. Default to Chart view with a welcome overlay for first-time users.

#### 3.4.3 Journal Table Unusable on Mobile

The journal table view uses `min-width: 900px`, forcing horizontal scroll on mobile devices. While the app defaults to card view on mobile, the view preference does not persist. Users who set table view on desktop find it broken on mobile with no graceful fallback or compact table alternative.

**Recommendation:** Create a compact mobile table view that stacks key information vertically. Persist view preference in localStorage but auto-override to card/compact-table on viewports below 768px.

#### 3.4.4 Generic Error Messages

All network errors display the same toast: "Failed to load your trades. Please refresh." There is no distinction between network failures, permission errors, server errors, or rate limiting. Users have no retry action and must manually refresh the page.

**Recommendation:** Create a centralized error handler that categorizes errors and provides contextual messages with actionable buttons (Retry, Refresh, Contact Support). Include a visual retry button in the toast notification.

#### 3.4.5 Missing Accessibility Labels

Only 2 ARIA labels exist in the entire member area (menu open/close buttons). All icon-only buttons, data tables, chat messages, form controls, and interactive cards lack screen reader labels. This creates legal compliance risk and excludes users with assistive technologies.

**Recommendation:** Systematic audit and addition of `aria-label`, `role`, and `alt-text` attributes across all interactive elements. Implement `focus-trap` for modal dialogs (TradeEntrySheet, EntryDetailSheet). Add keyboard navigation with logical tab order.

#### 3.4.6 AI Coach Onboarding is Buried

The onboarding component exists but is gated behind a localStorage check that many users never trigger. New users land on a blank center panel with no context about what the AI Coach can do, how to interact with it, or what the various views offer.

**Recommendation:** Show a guided onboarding experience on first AI Coach visit. Highlight key capabilities (ask about any ticker, see live charts, track setups, get morning briefs). Suggest a starter prompt. Add a persistent "?" help button that re-launches the tour.

#### 3.4.7 Filter System Lacks Discoverability

The journal filter bar shows only symbol search, sort, and view toggle by default. Advanced filters (direction, P&L, tags, AI grade) are hidden. Active filter count is shown but not visually prominent. There is no "Clear All Filters" action and no filter preset system.

**Recommendation:** Show active filters as removable pills below the search bar. Add a "Clear All" button when any filter is active. Create quick filter presets (This Week's Losers, Best AI Grades, Recent Options Trades). Add filter count badge on the Advanced Filters button.

#### 3.4.8 Disabled Button States Indistinguishable

Disabled buttons use `opacity-20`, making them nearly invisible on the dark background. There is no visual difference between "form incomplete" (disabled) and "processing" (loading) states. The send button in AI Coach chat is particularly confusing when disabled during AI response streaming.

**Recommendation:** Use distinct visual treatments: disabled = muted background with "not-allowed" cursor; loading = original color with spinner icon and progress text. Add a subtle pulse animation to loading states.

### 3.5 Medium Priority Issues

Twelve medium-priority issues were identified:

- Padding and spacing inconsistency across breakpoints (px-4 to lg:px-8 jumps)
- Image upload state transitions not communicated (no progress, no success confirmation)
- Rate limit feedback lacks reset timer and progressive warning at 80% threshold
- Card view missing "click to expand" affordance (no chevron, no tooltip)
- Focus-visible ring not applied to most interactive elements despite CSS utilities existing
- Focus management missing in modal sheets (no focus-trap library)
- Tab order not logical in trade entry form
- Loading states inconsistent (some skeleton, some spinner, some silent)
- Mobile drawer doesn't dismiss on hash navigation
- Empty state messages are generic with no contextual guidance
- Tab configuration differs between mobile and desktop creating cognitive load
- View preference not persisted across sessions

### 3.6 Design System Recommendations

- Establish a responsive spacing scale: Mobile 16px, Tablet 24px, Desktop 32px padding
- Increase glass-card blur on mobile from 16px/20px to 30px/40px (modern devices handle this)
- Standardize border-radius: 12px (`rounded-xl`) for cards, 8px (`rounded-lg`) for inputs
- Add `prefers-reduced-motion` support to all Framer Motion animations
- Create a unified `LoadingState` component with spinner, skeleton, and shimmer variants
- Implement a centralized toast system with action buttons (retry, undo, navigate)

---

## 4. Implementation Specification

The following specification is organized into 7 implementation phases, ordered by impact and dependency. Each phase includes detailed requirements, affected files, database changes, API changes, and acceptance criteria. This document is designed to be passed directly to Claude Code for implementation.

### 4.1 Phase 1: Critical UX Fixes (Week 1–2)

Priority: **CRITICAL**. These fixes address the highest-friction issues that cause user drop-off. No new features; purely UX improvements to existing functionality.

#### 4.1.1 Consolidate Mobile Navigation

**Objective:** Replace the three-component mobile navigation (MobileTopBar + MobileDrawer + MemberBottomNav) with a single unified pattern.

**Requirements:**

1. Delete `mobile-drawer.tsx` entirely. Remove all references from `layout.tsx`.
2. Enhance `mobile-bottom-nav.tsx` to be the sole mobile navigation. Include: Dashboard, Journal, AI Coach, Library, and a More menu that opens a popover for Profile, Settings, and Sync Roles.
3. Simplify `mobile-top-bar.tsx` to show only: Logo (center, links to `/members`), and Profile avatar (right, links to `/members/profile`). Remove hamburger icon.
4. Ensure bottom nav respects `safe-area-inset` for notched phones. Use `env(safe-area-inset-bottom)` in padding.
5. Add haptic feedback on bottom nav tap (`navigator.vibrate(10)` where supported).
6. Active tab shows filled icon + emerald underline + label text. Inactive tabs show outline icon + muted text only.

**Affected Files:**

- `components/members/mobile-drawer.tsx` — DELETE
- `components/members/mobile-bottom-nav.tsx` — REWRITE
- `components/members/mobile-top-bar.tsx` — SIMPLIFY
- `app/members/layout.tsx` — Remove drawer references, update mobile layout

**Acceptance Criteria:**

- Single bottom nav visible on all mobile pages
- No drawer overlay on any mobile interaction
- All 5 primary destinations reachable in 1 tap
- Secondary actions (Sync Roles, Settings) accessible via More popover
- Bottom nav does not overlap content on any page including AI Coach

#### 4.1.2 Progressive Trade Entry Form

**Objective:** Redesign TradeEntrySheet to use progressive disclosure, reducing initial cognitive load from 50+ elements to 5.

**Requirements:**

1. Create two form modes: Quick Entry (default) and Full Entry (expandable).
2. Quick Entry shows only: Trade Date (default today), Symbol (with autocomplete from AI Coach symbol search), Direction (Long/Short toggle), Entry Price, Exit Price. One row layout on desktop, stacked on mobile.
3. Quick Entry calculates P&L automatically from entry/exit/direction. Show calculated P&L in real-time as a read-only preview below the price fields.
4. "Save & Close" button saves with just quick fields. "Save & Add Details" expands to full form.
5. Full Entry reveals (with smooth expand animation): Position Size, P&L Override fields, Screenshot Upload area, Notes (single textarea with section prompts), Quick Tags, Star Rating.
6. After saving a Quick Entry, show a toast: "Trade saved! Add a screenshot for AI analysis?" with an action button that opens the entry in edit mode with the screenshot section visible.
7. AI auto-filled fields show a soft champagne background (`#F3E5AB/10`) with a small "AI" badge. Each field has an accept/reject toggle.
8. Notes section: Replace 3-tab interface with a single rich textarea. Use placeholder text that cycles: "What was your setup thesis? How did you manage the trade? What did you learn?" Use Shift+Enter for new sections.

**Affected Files:**

- `components/journal/trade-entry-sheet.tsx` — MAJOR REWRITE
- `components/journal/quick-entry-form.tsx` — NEW COMPONENT
- `components/journal/full-entry-form.tsx` — NEW COMPONENT

**Acceptance Criteria:**

- Trade can be logged in under 10 seconds (symbol + direction + prices + save)
- Full form is discoverable but never required
- AI auto-fill fields are clearly distinguishable from manual input
- Form works identically on mobile and desktop
- No data loss when switching between quick and full modes

#### 4.1.3 Breadcrumb Navigation

**Objective:** Add breadcrumb navigation to all pages with sub-views, using the existing `AICoachWorkflowContext` breadcrumb data.

**Requirements:**

1. Create a reusable `Breadcrumb` component that renders a clickable path trail.
2. Render below the page header on: AI Coach (showing active center panel view), Journal (showing active filters as context).
3. Each breadcrumb segment is clickable and navigates to that level.
4. Use the Emerald Standard styling: `text-white/50` for inactive segments, `text-white` for current segment, `/` separator in `text-white/20`.
5. On mobile, collapse to show only the current segment with a back arrow to the previous level.
6. Wire into `AICoachWorkflowContext.workflowPath` which already stores the breadcrumb trail.

**Affected Files:**

- `components/ui/breadcrumb.tsx` — NEW COMPONENT
- `app/members/ai-coach/page.tsx` — Add breadcrumb below header
- `app/members/journal/page.tsx` — Add breadcrumb showing active filters
- `contexts/AICoachWorkflowContext.tsx` — Expose breadcrumb data

#### 4.1.4 Unified Error Handling

**Objective:** Replace generic error toasts with contextual error messages and retry actions.

**Requirements:**

1. Create a centralized error handler utility: `lib/error-handler.ts`.
2. Categorize errors: `NetworkError` (no connection), `ServerError` (500), `PermissionError` (401/403), `RateLimitError` (429), `ValidationError` (400), `UnknownError`.
3. Each error category has: a human-readable message, an icon, a color (red for errors, amber for warnings), and an optional action button (Retry, Refresh, Contact Support).
4. Implement retry with exponential backoff for network and server errors.
5. Replace all catch blocks in journal, AI coach, and dashboard with the centralized handler.
6. Rate limit errors show: queries used, total limit, and time until reset.

**Acceptance Criteria:**

- No generic "Something went wrong" messages anywhere in the app
- Every error toast has an actionable button (Retry or Refresh)
- Rate limit errors show countdown to reset
- Network errors are distinguishable from server errors

---

### 4.2 Phase 2: Journal Feature Parity (Week 3–5)

Priority: **HIGH**. These features close the most critical competitive gaps against TradesViz, TraderSync, and Edgewonk in journal analytics depth.

#### 4.2.1 Advanced Analytics Engine

**Objective:** Expand TITM's journal analytics from ~15 metrics to 50+ metrics, covering the most-requested analytics from competing platforms.

**New Metrics to Implement:**

| Metric | Formula | Category |
|---|---|---|
| Expectancy | (Win% × AvgWin) − (Loss% × AvgLoss) | Core |
| R-Multiple (per trade) | (Exit − Entry) / (Entry − StopLoss) | Risk |
| Average R-Multiple | Mean of all R-Multiples | Risk |
| R-Multiple Distribution | Histogram of R values | Risk |
| Max Favorable Excursion (MFE) | Highest unrealized P&L during trade | Execution |
| Max Adverse Excursion (MAE) | Lowest unrealized P&L during trade | Execution |
| MFE/MAE Efficiency | Actual Exit P&L / MFE | Execution |
| Sharpe Ratio | (AvgReturn − RiskFreeRate) / StdDev | Risk-Adjusted |
| Sortino Ratio | (AvgReturn − RiskFreeRate) / DownsideStdDev | Risk-Adjusted |
| Max Drawdown | Largest peak-to-trough decline in equity curve | Risk |
| Max Drawdown Duration | Days from peak to recovery | Risk |
| Profit Factor (per strategy) | Gross Profit / Gross Loss by strategy tag | Strategy |
| Recovery Factor | Net Profit / Max Drawdown | Risk |
| Consecutive Wins/Losses | Longest winning and losing streak | Behavioral |
| Average Hold Time | Mean duration of all trades | Execution |
| Time-of-Day P&L | P&L bucketed by hour of entry | Timing |
| Day-of-Week P&L | P&L bucketed by weekday of entry | Timing |
| Monthly P&L Breakdown | Net P&L by calendar month | Timing |
| Win Rate by Direction | Separate win rates for long vs short | Strategy |
| Win Rate by Symbol | Win rate broken down by ticker | Strategy |

**Database Requirements:**

1. Add columns to `journal_entries`: `stop_loss` NUMERIC, `initial_target` NUMERIC, `strategy` TEXT, `hold_duration_minutes` INTEGER.
2. Create new RPC function: `get_advanced_analytics(user_id, period)` that calculates all metrics above from `journal_entries`.
3. Create materialized view: `journal_analytics_cache` that pre-computes expensive metrics, refreshed on trade insert/update.
4. Add MFE/MAE columns: `mfe` NUMERIC, `mae` NUMERIC, populated during enrichment by scanning 1-min bars between entry and exit timestamps.

**Frontend Requirements:**

5. Create an Analytics Dashboard page at `/members/journal/analytics` (or tab within journal).
6. Layout: Top row of 6 KPI cards (Win Rate, Expectancy, Profit Factor, Sharpe Ratio, Max Drawdown, Avg R-Multiple). Below: Tabbed sections for Execution, Risk, Timing, and Strategy analytics.
7. Charts: Equity curve with drawdown shading, R-Multiple distribution histogram, MFE/MAE scatter plot, Time-of-day heatmap, Day-of-week bar chart.
8. All charts use the Emerald Standard palette. Use Recharts library (already available).

#### 4.2.2 AI Trade Grading System

**Objective:** Implement an AI-powered grading system that evaluates every trade on setup quality, execution, risk management, and outcome, producing a letter grade (A+ through F) and detailed feedback.

**Grading Criteria:**

| Dimension | Weight | Evaluation Factors |
|---|---|---|
| Setup Quality | 25% | Was entry near support/resistance? Was there a clear catalyst? Was direction aligned with trend? Did trader wait for confirmation? |
| Execution | 25% | Entry timing (MFE efficiency), exit timing (captured move vs left on table), slippage from planned levels |
| Risk Management | 25% | Position sizing relative to account, stop-loss placement (ATR-based), risk/reward ratio at entry, adherence to stated rules |
| Outcome Context | 25% | P&L relative to expected move, comparison to optimal exit, whether trade followed the plan vs improvised |

**Implementation:**

1. Create a GPT-4o function call: `grade_trade` that receives the full trade entry (prices, notes, screenshots, market context, MFE/MAE) and returns a structured grade object.
2. Grade object schema: `{ overall_grade: string (A+ to F), score: number (0-100), dimensions: { setup: { grade, score, feedback }, execution: { grade, score, feedback }, risk: { grade, score, feedback }, outcome: { grade, score, feedback } }, improvement_tips: string[], pattern_flags: string[] }`
3. Trigger grading: Automatically after enrichment completes (background job). Show "Grading..." indicator on entry card.
4. Store in `ai_analysis` JSONB field on `journal_entries` table.
5. Display: Grade badge on journal cards and table rows. Grade detail view in entry detail sheet showing radar chart of 4 dimensions + written feedback.
6. Aggregate: Calculate average grade per week/month. Track grade improvement over time as a line chart.

#### 4.2.3 Options Trade Context in Journal

**Objective:** Persist options-specific data (Greeks, IV, DTE) into journal entries so options traders can analyze their historical option performance.

**Requirements:**

1. Add to `journal_entries` table: `contract_type` TEXT (call/put/stock), `strike_price` NUMERIC, `expiration_date` DATE, `dte_at_entry` INTEGER, `dte_at_exit` INTEGER, `iv_at_entry` NUMERIC, `iv_at_exit` NUMERIC, `delta_at_entry` NUMERIC, `theta_at_entry` NUMERIC, `gamma_at_entry` NUMERIC, `vega_at_entry` NUMERIC, `underlying_price_at_entry` NUMERIC, `underlying_price_at_exit` NUMERIC.
2. During enrichment: If the trade symbol matches an options pattern (e.g., contains strike/expiry), fetch options chain data from Massive.com and populate Greeks fields.
3. In trade entry form: Add an "Options Details" expandable section (under Full Entry mode) with fields for contract type, strike, expiration. Auto-calculate DTE.
4. In analytics: Add options-specific metrics: Win rate by DTE bucket (0–7, 8–30, 30+), P&L by IV percentile at entry, Average theta decay captured, Delta exposure analysis.
5. In journal filter bar: Add filter for `contract_type` (Calls, Puts, Spreads, Stock Only).

#### 4.2.4 Strategy/Playbook System

**Objective:** Allow traders to define named strategies (Playbooks) and tag trades against them for strategy-level analytics.

**Requirements:**

1. Create new table: `playbooks` (id, user_id, name, description, rules JSON, entry_criteria TEXT, exit_criteria TEXT, risk_rules TEXT, created_at, updated_at).
2. In trade entry form: Add strategy dropdown that lists user's playbooks. Allow "Add New Strategy" inline.
3. In analytics: Strategy breakdown section showing win rate, expectancy, profit factor, and average R-multiple per playbook.
4. Strategy comparison view: Side-by-side comparison of 2–3 strategies on all metrics.
5. AI Coach integration: When user asks "which strategy is working best?", the AI can query playbook analytics.

---

### 4.3 Phase 3: Live Position & Import (Week 5–7)

Priority: **HIGH**. These features address the open position tracking gap and broker import capabilities that every major competitor offers.

#### 4.3.1 Open Position Tracker

**Objective:** Enable live P&L tracking for open positions with real-time price updates via WebSocket.

**Requirements:**

1. In trade entry form: Add "Open Trade" toggle that saves entry with `is_open = true` and no exit price.
2. Dashboard widget: "Open Positions" card showing all `is_open` entries with live P&L calculated from WebSocket price feed (already available from AI Coach).
3. P&L calculation: `(currentPrice - entryPrice) * positionSize` for longs, inverse for shorts. For options: use last traded price from options chain.
4. Update frequency: Every 15 seconds during market hours via existing WebSocket infrastructure.
5. Close trade action: Click "Close Position" which prompts for exit price (default: current market price), saves, and triggers enrichment + AI grading.
6. Alert integration: Set automatic alerts on open positions at stop-loss and target levels. Wire into existing alert worker.
7. Journal view: Open positions section at top of journal page, above historical trades. Distinct visual treatment (pulsing green border for profitable, red for losing).

#### 4.3.2 Broker Import Framework

**Objective:** Build a pluggable broker import system starting with CSV import improvements and preparing for direct broker API integrations.

**Requirements:**

1. Enhanced CSV import: Support format auto-detection for major brokers (Interactive Brokers, TD Ameritrade/Schwab, Robinhood, E*Trade, Fidelity, Webull). Each broker has a named parser that maps their column names to TITM fields.
2. Import wizard: 3-step process: (1) Upload file + select broker, (2) Preview mapped fields with conflict resolution, (3) Confirm import with duplicate detection.
3. Duplicate detection: Match on symbol + entry_date + entry_price within 1% tolerance. Show duplicates and let user skip or overwrite.
4. Batch enrichment: After import, queue all entries for background enrichment (rate-limited to avoid Massive.com throttling). Show progress bar.
5. Import history: Track all imports with timestamp, broker, record count, and status.

#### 4.3.3 MFE/MAE Calculation

**Objective:** Calculate Maximum Favorable Excursion and Maximum Adverse Excursion for every enriched trade using Massive.com 1-minute bar data.

**Requirements:**

1. During enrichment (enrich route): After fetching 1-min bars for the trade timeframe, calculate highest and lowest price points relative to entry.
2. For longs: `MFE = (highest high - entry) / entry * 100`. `MAE = (entry - lowest low) / entry * 100`.
3. For shorts: `MFE = (entry - lowest low) / entry * 100`. `MAE = (highest high - entry) / entry * 100`.
4. Store as `mfe_percent` NUMERIC and `mae_percent` NUMERIC on `journal_entries`.
5. Calculate MFE Efficiency: `actual_pnl_percent / mfe_percent` (how much of the available move was captured).
6. Visualization: MFE/MAE scatter plot in analytics where X = MAE, Y = MFE. Each dot is a trade. Quadrant analysis shows execution quality.

---

### 4.4 Phase 4: Psychology & Behavioral Analytics (Week 7–9)

Priority: **MEDIUM-HIGH**. This is the least-served competitive niche. Only Edgewonk offers psychology analytics (Tiltmeter). Building this into TITM creates a significant differentiator.

#### 4.4.1 Trading Psychology Tracker

**Objective:** Track emotional state, discipline adherence, and behavioral patterns across trading sessions to help traders identify and correct psychological weaknesses.

**Requirements:**

1. Add to `journal_entries`: `mood_before` TEXT (enum: confident, neutral, anxious, frustrated, excited, fearful), `mood_after` TEXT (same enum), `discipline_score` INTEGER (1–5 self-assessment), `followed_plan` BOOLEAN, `deviation_notes` TEXT.
2. In Quick Entry form: Add optional mood selector (emoji-based: confident, neutral, anxious) before and after trade. Default hidden; enable via user preference.
3. In Full Entry form: Add discipline section with: "Did you follow your plan?" (Yes/No toggle), "Discipline score" (1–5 slider), "What would you do differently?" (textarea).
4. Psychology Dashboard (new tab in analytics): Mood correlation with P&L, discipline score trend over time, win rate by mood state, common deviation patterns, tilt detection (consecutive losses + declining discipline scores).
5. Tilt Alert: When the system detects a potential tilt pattern (3+ consecutive losses with declining mood), show a proactive notification: "Your recent pattern suggests emotional trading. Consider stepping away." This is a gentle nudge, not a block.

#### 4.4.2 Behavioral Pattern AI Analysis

**Objective:** Use AI to analyze the trader's journal history and identify recurring behavioral patterns, both positive and negative.

**Requirements:**

1. Create a weekly AI analysis job that reviews the past 7 days of journal entries.
2. Analysis dimensions: Time-of-day performance patterns, overtrading detection (more trades than average with declining win rate), revenge trading detection (increased size after losses), FOMO patterns (entries after large moves), profit-taking consistency (MFE efficiency trends), stop-loss adherence (trades where MAE exceeded stated stop).
3. Store analysis in new table: `ai_behavioral_insights` (id, user_id, analysis_date, insight_type, title, description, evidence JSON, recommendation TEXT, severity TEXT).
4. Display in dashboard as insight cards with icons, severity colors (emerald for positive patterns, amber for warnings, red for critical behavioral issues).
5. AI Coach integration: When user asks about performance, AI can reference behavioral insights. Example: "I notice you tend to take larger positions after losses. Your win rate drops 15% on these revenge trades."

---

### 4.5 Phase 5: Journal–AI Coach Bridge (Week 9–11)

Priority: **MEDIUM**. This is TITM's unique moat. No competitor connects live AI market analysis with journal insights. Building this bridge creates an experience that cannot be replicated by any standalone journal or standalone AI tool.

#### 4.5.1 Contextual Trade Logging from AI Coach

**Objective:** Enable one-click trade logging directly from AI Coach analysis, pre-filled with all contextual data from the conversation.

**Requirements:**

1. In AI Coach chat: When the AI analyzes a trade setup or position, add a "Log This Trade" action button to the response widget.
2. Clicking "Log This Trade" opens the Quick Entry form pre-filled with: symbol (from context), direction (from analysis), entry price (from discussed level), stop-loss (from AI recommendation), target (from AI recommendation), strategy (from detected setup type, e.g., "ORB", "Break & Retest").
3. Store session context: Link the journal entry to the AI Coach session via `session_id` field. This allows replay of the AI conversation that led to the trade.
4. In journal entry detail: Show "AI Coach Context" section that displays the relevant chat messages from the session where the trade was planned.

#### 4.5.2 Journal Pattern Insights in AI Coach

**Objective:** Make the AI Coach aware of the trader's journal history so it can provide personalized advice based on their actual performance data.

**Requirements:**

1. Add a new ChatKit function: `get_journal_insights` that returns the trader's key metrics (win rate, best/worst symbols, best time of day, common mistakes, current streak).
2. Add function: `get_trade_history_for_symbol(symbol)` that returns the trader's past trades on that specific ticker.
3. When the user asks the AI Coach about a ticker they have traded before, the AI should proactively reference their history: "You have traded SPX 47 times with a 62% win rate. Your best results come from ORB setups in the first 30 minutes."
4. When the user discusses a new trade setup, the AI should check if it matches a pattern where the trader historically underperforms and warn them: "Heads up: your win rate on afternoon breakout trades is only 35%. Consider a smaller position."

#### 4.5.3 End-of-Day Auto-Journal

**Objective:** Automatically generate draft journal entries at end of day from AI Coach interactions and detected setups.

**Requirements:**

1. At market close (4:05 PM ET), analyze the day's AI Coach sessions for trade discussions.
2. For each detected trade discussion: Create a draft journal entry with `is_draft = true`, pre-filled with extracted data (symbol, direction, prices discussed, setup type).
3. Notification: Send a push notification or in-app alert: "We detected 3 trades from today. Review and confirm your journal entries."
4. Draft review interface: Show draft entries in journal with a "Confirm" / "Dismiss" action. Confirmed entries become full journal entries and trigger enrichment.
5. Store in `journal_entries` with `draft_status = 'pending' | 'confirmed' | 'dismissed'`. Auto-dismiss after 48 hours if not confirmed.

---

### 4.6 Phase 6: Enhanced Visualization & Dashboard (Week 11–13)

Priority: **MEDIUM**. These features create visual delight and analytical depth that rivals the best platforms.

#### 4.6.1 Customizable Analytics Dashboard

**Objective:** Allow traders to build their own dashboard layout by selecting which widgets to display and how to arrange them.

**Requirements:**

1. Widget library: Equity Curve, P&L Calendar Heatmap, Win Rate Gauge, Stat Cards (configurable), R-Multiple Distribution, MFE/MAE Scatter, Time-of-Day Heatmap, Day-of-Week Bar Chart, Strategy Comparison, Open Positions, Recent Trades, AI Insights, Streak Tracker, Psychology Mood Chart.
2. Drag-and-drop layout: Use `react-grid-layout` for responsive widget placement. Users can resize and reorder widgets.
3. Persist layout in user preferences (`ai_coach_user_preferences` table, new `dashboard_layout` JSONB column).
4. Default layouts: Provide 3 preset layouts: "Overview" (balanced), "Risk Focus" (drawdown, R-multiples, Sharpe), "Options Trader" (Greeks, IV analysis, DTE breakdown).
5. Mobile: Widgets stack in a single column. User can reorder via drag handle but not resize.

#### 4.6.2 Enhanced Calendar Heatmap

**Objective:** Upgrade the P&L calendar from basic to a rich, interactive visualization.

**Requirements:**

1. Color scale: Dark red (worst loss) through white (break-even) through dark emerald (best win). Use a continuous gradient, not discrete buckets.
2. Hover: Show tooltip with day's stats: total P&L, trade count, win rate, best/worst trade, mood (if tracked).
3. Click: Navigate to journal filtered to that day's trades.
4. View options: Month view (default), quarter view, year view. Year view shows 12 months in a GitHub-contribution-style grid.
5. Annotations: Mark days with icons: Star (personal best), Warning (tilt detected), Trophy (streak milestone), Calendar (no trades).

#### 4.6.3 Trade Replay Enhancement

**Objective:** Upgrade the trade replay from basic 1-min bars to a full interactive replay experience.

**Requirements:**

1. Playback controls: Play, Pause, Speed (1x, 2x, 5x, 10x), Skip to entry, Skip to exit.
2. Overlay trade markers: Entry arrow (green up for long, red down for short), Exit arrow (opposite), Stop-loss line (red dashed), Target line (emerald dashed).
3. P&L ticker: Real-time P&L display that updates as the replay progresses, showing what the P&L would have been at each candle.
4. MFE/MAE markers: Highlight the candle where MFE and MAE occurred.
5. Key level overlay: Show VWAP, pivot levels, and PDH/PDL from the trade's enrichment data.
6. Side panel: Show the trade's notes, AI grade, and tags alongside the replay.

---

### 4.7 Phase 7: Mobile & Accessibility (Week 13–16)

Priority: **MEDIUM**. These improvements ensure TITM is fully usable on all devices and meets accessibility standards.

#### 4.7.1 Mobile-Optimized Journal

**Objective:** Create a mobile-first journal experience that goes beyond responsive web to feel native.

**Requirements:**

1. Swipe gestures: Swipe left on a journal card to reveal Quick Actions (Edit, Delete, Share). Swipe right to mark as favorite.
2. Pull-to-refresh: Standard pull-down gesture to reload journal entries.
3. Compact card view: Optimized for mobile with larger touch targets (44px minimum), stacked layout, and swipeable photo carousel for screenshots.
4. Quick entry floating action button (FAB): Emerald circle with "+" icon, fixed bottom-right above the bottom nav. One tap opens the Quick Entry form as a bottom sheet.
5. Bottom sheet pattern: All modals on mobile use bottom sheet pattern (slide up from bottom) instead of right-slide panel.
6. Offline support: Cache recent journal entries in localStorage. Allow offline trade entry that syncs when connection returns.

#### 4.7.2 Comprehensive Accessibility

**Objective:** Achieve WCAG 2.1 AA compliance across the entire member area.

**Requirements:**

1. ARIA labels: Add `aria-label` to all icon-only buttons, form controls, data tables, and navigation elements.
2. Focus management: Implement `focus-trap` in all modal dialogs. Return focus to trigger element on close.
3. Keyboard navigation: Ensure all interactive elements are reachable via Tab key. Add Escape to close modals. Add Enter/Space to activate buttons.
4. Screen reader announcements: Use `aria-live` regions for toast notifications, loading states, and real-time P&L updates.
5. Color independence: Add + and − symbols to P&L displays alongside green/red colors. Add patterns to chart elements.
6. Reduced motion: Respect `prefers-reduced-motion` in all Framer Motion animations. Disable page transitions, blur effects, and spring animations.
7. Focus-visible rings: Apply the existing `focus-champagne` CSS utility to all interactive elements.

#### 4.7.3 Progressive Web App (PWA) Enhancement

**Objective:** Improve the PWA experience to bridge the gap until native apps are built.

**Requirements:**

1. Service worker: Cache static assets and recent API responses for offline browsing.
2. Web App Manifest: Configure for standalone display mode with TITM branding (emerald theme-color, custom icons).
3. Push notifications: Implement web push for trade alerts, morning briefs, and tilt warnings.
4. Install prompt: Show a custom "Add to Home Screen" prompt after 3rd visit.

---

## 5. Database Schema Changes

All database changes should be implemented as Supabase migrations with proper RLS policies. Each migration should be reversible.

### 5.1 journal_entries Table Additions

| Column | Type | Default | Phase | Purpose |
|---|---|---|---|---|
| stop_loss | NUMERIC | NULL | 2 | Stop loss price for R-multiple calculation |
| initial_target | NUMERIC | NULL | 2 | Target price for risk/reward |
| strategy | TEXT | NULL | 2 | Playbook/strategy name |
| mfe_percent | NUMERIC | NULL | 3 | Max favorable excursion % |
| mae_percent | NUMERIC | NULL | 3 | Max adverse excursion % |
| contract_type | TEXT | NULL | 2 | call/put/stock |
| strike_price | NUMERIC | NULL | 2 | Options strike price |
| expiration_date | DATE | NULL | 2 | Options expiration |
| dte_at_entry | INTEGER | NULL | 2 | Days to expiration at entry |
| dte_at_exit | INTEGER | NULL | 2 | Days to expiration at exit |
| iv_at_entry | NUMERIC | NULL | 2 | IV percentage at entry |
| iv_at_exit | NUMERIC | NULL | 2 | IV percentage at exit |
| delta_at_entry | NUMERIC | NULL | 2 | Option delta at entry |
| theta_at_entry | NUMERIC | NULL | 2 | Option theta at entry |
| gamma_at_entry | NUMERIC | NULL | 2 | Option gamma at entry |
| vega_at_entry | NUMERIC | NULL | 2 | Option vega at entry |
| underlying_at_entry | NUMERIC | NULL | 2 | Underlying price at entry |
| underlying_at_exit | NUMERIC | NULL | 2 | Underlying price at exit |
| mood_before | TEXT | NULL | 4 | Pre-trade mood enum |
| mood_after | TEXT | NULL | 4 | Post-trade mood enum |
| discipline_score | INTEGER | NULL | 4 | 1–5 self-assessment |
| followed_plan | BOOLEAN | NULL | 4 | Did trader follow plan? |
| deviation_notes | TEXT | NULL | 4 | What they did differently |
| session_id | UUID | NULL | 5 | AI Coach session reference |
| draft_status | TEXT | NULL | 5 | pending/confirmed/dismissed |
| hold_duration_min | INTEGER | NULL | 2 | Trade duration in minutes |

### 5.2 New Tables

#### 5.2.1 playbooks

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| user_id | UUID | REFERENCES auth.users NOT NULL |
| name | TEXT | NOT NULL |
| description | TEXT | |
| entry_criteria | TEXT | |
| exit_criteria | TEXT | |
| risk_rules | TEXT | |
| tags | TEXT[] | DEFAULT '{}' |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

#### 5.2.2 ai_behavioral_insights

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| user_id | UUID | REFERENCES auth.users NOT NULL |
| analysis_date | DATE | NOT NULL |
| insight_type | TEXT | NOT NULL (overtrading/revenge/fomo/tilt/positive_pattern) |
| title | TEXT | NOT NULL |
| description | TEXT | NOT NULL |
| evidence | JSONB | Supporting data |
| recommendation | TEXT | |
| severity | TEXT | info/warning/critical |
| is_dismissed | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### 5.2.3 import_history

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| user_id | UUID | REFERENCES auth.users NOT NULL |
| broker_name | TEXT | NOT NULL |
| file_name | TEXT | NOT NULL |
| record_count | INTEGER | NOT NULL |
| success_count | INTEGER | DEFAULT 0 |
| duplicate_count | INTEGER | DEFAULT 0 |
| error_count | INTEGER | DEFAULT 0 |
| status | TEXT | pending/processing/completed/failed |
| created_at | TIMESTAMPTZ | DEFAULT now() |

---

## 6. API Specification

All new API endpoints follow the existing pattern: Next.js API routes under `/api/members/` for frontend-facing endpoints, Express routes under `/api/` for backend services. All endpoints require authentication and return `{ success: boolean, data?: T, error?: string }`.

### 6.1 New Endpoints

| Method | Path | Phase | Purpose |
|---|---|---|---|
| GET | /api/members/journal/analytics | 2 | Advanced analytics with all metrics |
| POST | /api/members/journal/grade | 2 | Trigger AI grading for a trade |
| GET | /api/members/journal/grade/:entryId | 2 | Get grade for specific trade |
| GET | /api/members/playbooks | 2 | List user playbooks |
| POST | /api/members/playbooks | 2 | Create playbook |
| PATCH | /api/members/playbooks/:id | 2 | Update playbook |
| DELETE | /api/members/playbooks/:id | 2 | Delete playbook |
| GET | /api/members/journal/open-positions | 3 | List open positions with live P&L |
| POST | /api/members/journal/close-position | 3 | Close an open position |
| POST | /api/members/journal/import | 3 | Enhanced CSV import with broker detection |
| GET | /api/members/journal/import-history | 3 | List past imports |
| GET | /api/members/insights/behavioral | 4 | Get behavioral insights |
| POST | /api/members/insights/behavioral/dismiss | 4 | Dismiss an insight |
| POST | /api/members/journal/draft-from-session | 5 | Create draft entries from AI session |
| GET | /api/members/journal/drafts | 5 | List pending draft entries |
| POST | /api/members/journal/drafts/:id/confirm | 5 | Confirm a draft entry |
| GET | /api/members/dashboard/layout | 6 | Get saved dashboard layout |
| PUT | /api/members/dashboard/layout | 6 | Save dashboard layout |

### 6.2 New ChatKit Functions

| Function Name | Phase | Description |
|---|---|---|
| grade_trade | 2 | AI grades a trade on setup, execution, risk, and outcome |
| get_journal_insights | 5 | Returns trader's key metrics and patterns |
| get_trade_history_for_symbol | 5 | Returns past trades for a specific ticker |
| get_behavioral_patterns | 4 | Returns recent behavioral analysis |
| suggest_playbook | 2 | Suggests which playbook fits a described setup |
| compare_strategies | 2 | Compares two playbooks on performance metrics |

---

## 7. Implementation Timeline & Effort Estimates

| Phase | Name | Duration | Key Deliverables |
|---|---|---|---|
| 1 | Critical UX Fixes | Weeks 1–2 | Mobile nav consolidation, progressive trade entry, breadcrumbs, error handling |
| 2 | Journal Feature Parity | Weeks 3–5 | Advanced analytics (50+ metrics), AI grading, options context, playbook system |
| 3 | Live Position & Import | Weeks 5–7 | Open position tracker, broker CSV import, MFE/MAE calculation |
| 4 | Psychology & Behavioral | Weeks 7–9 | Mood tracking, tilt detection, behavioral pattern AI analysis |
| 5 | Journal–AI Coach Bridge | Weeks 9–11 | One-click logging from AI, journal-aware AI responses, auto-journal drafts |
| 6 | Enhanced Visualization | Weeks 11–13 | Customizable dashboard, interactive calendar heatmap, trade replay upgrade |
| 7 | Mobile & Accessibility | Weeks 13–16 | Mobile-optimized journal, WCAG AA compliance, PWA enhancement |

### 7.1 Dependency Graph

Phase 1 must complete first as it fixes foundational UX issues. Phases 2 and 3 can partially overlap. Phase 4 requires Phase 2's analytics engine. Phase 5 requires both Phase 2's grading system and Phase 4's behavioral data. Phase 6 requires Phase 2's analytics. Phase 7 can begin alongside Phase 5.

- **Critical Path:** Phase 1 → Phase 2 → Phase 4 → Phase 5
- **Parallel Track A:** Phase 3 (alongside Phase 2)
- **Parallel Track B:** Phase 6 (after Phase 2) + Phase 7 (after Phase 1)

---

## 8. Competitive Moat Analysis

### 8.1 After Implementation: TITM vs Market

| Capability | TITM (Post-Implementation) | Best Competitor | TITM Advantage |
|---|---|---|---|
| AI Coach + Journal Integration | Full bidirectional (log from AI, AI reads journal) | None exist | Unique — no competitor connects live AI analysis with journal insights |
| Real-time Market Data in Journal | Massive.com institutional data with auto-enrichment | TradesViz (delayed) | Only platform with institutional-grade data auto-populating journal entries |
| Options Analytics Depth | Full Greeks + GEX + 0DTE + IV in both live AI and journal history | TradesViz (journal only) | Only platform combining live options intelligence with historical options journal |
| Psychology Analytics | Mood tracking + tilt detection + behavioral AI patterns | Edgewonk (Tiltmeter only) | AI-powered behavioral analysis vs manual tilt tracking |
| Proactive Intelligence | Morning briefs, setup detection, auto-journal, behavioral alerts | Journalytix (basic alerts) | Most comprehensive proactive system in the market |
| Trade Grading | AI-powered 4-dimension grading with personalized improvement tips | TraderSync (Cypher) | Deeper grading model with journal-specific context |
| Advanced Metrics | 50+ metrics including MFE/MAE, R-multiples, psychology correlations | TradesViz (600+) | Fewer total metrics but uniquely includes psychology correlations |

### 8.2 Defensibility

TITM's moat is the integration layer. A trader using TradesViz for analytics, TraderSync for AI coaching, and Edgewonk for psychology must maintain three separate tools with no data flow between them. TITM unifies all three into a single experience where the AI Coach knows the journal history, the journal auto-populates from AI interactions, and behavioral patterns inform real-time trading advice.

This integration creates switching costs: once a trader has 6 months of enriched journal data with AI grades, behavioral insights, and playbook analytics, the cost of migrating to a competitor is prohibitive. The data network effect is the moat.

---

## 9. Success Metrics & Acceptance Criteria

### 9.1 Phase Completion Criteria

| Phase | Must Pass | Quality Gate |
|---|---|---|
| 1 | All 4 UX fixes deployed. Mobile nav has single bottom bar. Trade entry under 10 seconds. Breadcrumbs visible. No generic error messages. | Manual QA on iPhone 14 + Pixel 7 + Desktop Chrome. Zero critical bugs. |
| 2 | Analytics dashboard renders 20+ metrics. AI grading produces consistent grades across 50 test trades. Options fields persist correctly. | Analytics match manual calculations within 1% tolerance. Grading is deterministic on same input. |
| 3 | Open positions show live P&L updating every 15 seconds. CSV import handles 5 broker formats. MFE/MAE calculated on all enriched trades. | Load test: 100 open positions updating simultaneously. Import handles 500 records in under 30 seconds. |
| 4 | Mood tracking in entry form. Tilt detection triggers on test data. Weekly behavioral analysis runs successfully. | Behavioral AI analysis reviewed by human for quality. False positive rate below 20%. |
| 5 | One-click logging from AI Coach works. AI references journal history accurately. Auto-journal drafts created at EOD. | End-to-end test: start in AI Coach, discuss trade, log it, close it, see it graded, see AI reference it next session. |
| 6 | Dashboard customization saves and loads. Calendar heatmap interactive. Trade replay plays smoothly. | Dashboard loads in under 2 seconds. Replay renders at 60fps. No layout shift during widget resize. |
| 7 | All interactive elements have aria-labels. Keyboard navigation works end-to-end. PWA installable on iOS/Android. | Lighthouse accessibility score above 90. WAVE tool reports zero errors. |

### 9.2 North Star Metrics

- **Journal Entries per User per Week:** Target 10+ (current estimate: 3–5)
- **AI Coach to Journal Conversion:** Target 40% of AI Coach sessions result in a journal entry
- **Journal Retention** (users logging trades 4+ weeks): Target 70%
- **Mobile Usage Share:** Target 40% of journal entries from mobile
- **Average AI Grade Improvement:** Users should see grade improvement of 0.5 letter grades over 60 days

---

## 10. Appendix

### 10.1 Technology Stack Reference

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js (App Router) | 16 |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | 4 |
| UI Components | Shadcn/UI + Custom Glass Cards | Latest |
| Charts | Recharts + TradingView Lightweight Charts | Latest |
| Animation | Framer Motion | Latest |
| Backend | Express.js (Node.js) | Latest |
| Database | Supabase (PostgreSQL) | Latest |
| Real-time | WebSocket (ws library) | Latest |
| Market Data | Massive.com API | Institutional tier |
| AI | OpenAI GPT-4o | ChatKit function calling |
| Hosting (Frontend) | Vercel | Automatic deploy |
| Hosting (Backend) | Railway | Staging + Production |
| Cache | Redis (Upstash) | Free tier |

### 10.2 Competitive Pricing Comparison

| Platform | Free Tier | Entry Price | Full Price | Best For |
|---|---|---|---|---|
| TITM | No (membership) | Included | Included | AI-powered options trading |
| TradesViz | 3,000 trades/mo | $19/mo | $29/mo | Options analytics depth |
| TraderSync | Limited | $29.95/mo | $79.95/mo | AI coaching + broker breadth |
| TradeZella | No | $29/mo | $49/mo | Education + journaling |
| Edgewonk | No | $169/year | $169/year | Psychology + value |
| Tradervue | Basic free | $49/mo | $99/mo | Broker compatibility |
| Journalytix | 14-day trial | $47/mo | $399/year | Prop firms + automation |
| Kinfo | Free | Free | Premium | Social/verified performance |
| Stonk Journal | Free | Free | Free | Budget manual entry |
| TrendSpider | No | $34/mo | $199/mo | AI analysis (not a journal) |

### 10.3 File Reference

**Modified Files:**

- `components/journal/trade-entry-sheet.tsx` — Major rewrite (Phase 1)
- `components/members/mobile-bottom-nav.tsx` — Enhance (Phase 1)
- `components/members/mobile-top-bar.tsx` — Simplify (Phase 1)
- `app/members/layout.tsx` — Remove drawer, update mobile layout (Phase 1)
- `app/members/journal/page.tsx` — Add analytics tab, filter improvements (Phase 2)
- `app/members/ai-coach/page.tsx` — Add breadcrumbs, improve onboarding (Phase 1)
- `app/api/members/journal/enrich/route.ts` — Add MFE/MAE calculation (Phase 3)
- `backend/src/chatkit/` — Add new function definitions (Phase 2, 5)

**New Files:**

- `components/ui/breadcrumb.tsx` (Phase 1)
- `components/journal/quick-entry-form.tsx` (Phase 1)
- `components/journal/full-entry-form.tsx` (Phase 1)
- `lib/error-handler.ts` (Phase 1)
- `app/members/journal/analytics/page.tsx` (Phase 2)
- `components/journal/analytics-dashboard.tsx` (Phase 2)
- `components/journal/ai-grade-card.tsx` (Phase 2)
- `components/journal/playbook-manager.tsx` (Phase 2)
- `components/journal/open-positions-widget.tsx` (Phase 3)
- `components/journal/import-wizard.tsx` (Phase 3)
- `components/journal/psychology-tracker.tsx` (Phase 4)
- `components/journal/behavioral-insights.tsx` (Phase 4)
- `components/journal/trade-replay-player.tsx` (Phase 6)
- `components/dashboard/customizable-dashboard.tsx` (Phase 6)

**New Migrations:**

- `supabase/migrations/YYYYMMDD_journal_analytics_columns.sql` (Phase 2)
- `supabase/migrations/YYYYMMDD_playbooks_table.sql` (Phase 2)
- `supabase/migrations/YYYYMMDD_options_journal_columns.sql` (Phase 2)
- `supabase/migrations/YYYYMMDD_mfe_mae_columns.sql` (Phase 3)
- `supabase/migrations/YYYYMMDD_import_history_table.sql` (Phase 3)
- `supabase/migrations/YYYYMMDD_psychology_columns.sql` (Phase 4)
- `supabase/migrations/YYYYMMDD_behavioral_insights_table.sql` (Phase 4)
- `supabase/migrations/YYYYMMDD_draft_journal_columns.sql` (Phase 5)
- `supabase/migrations/YYYYMMDD_advanced_analytics_rpc.sql` (Phase 2)

---

*End of Specification Document — Version 1.0 | February 9, 2026 | Prepared for TradeITM*
