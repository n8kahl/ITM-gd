# TITM AI Coach — Comprehensive UX Audit & Implementation Spec

> **Polish, Premium Touches, Navigation, Animation & Desktop/Mobile Audit**
>
> Date: February 9, 2026
> Prepared for: Nate (TITM Engineering)
> UX Audit by: Claude (Senior UX Design Review)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Chat Panel: Empty State & Broken Buttons](#2-chat-panel-empty-state--broken-buttons)
3. [Center Panel: Welcome View & Example Prompts](#3-center-panel-welcome-view--example-prompts)
4. [Morning Brief: From Data Dump to Command Center](#4-morning-brief-from-data-dump-to-command-center)
5. [SPX-Heavy Analysis: The Star Feature](#5-spx-heavy-analysis-the-star-feature)
6. [Chat Interface: Polish & Premium Touches](#6-chat-interface-polish--premium-touches)
7. [Navigation & Tab Architecture](#7-navigation--tab-architecture)
8. [Animations, Transitions & Loading States](#8-animations-transitions--loading-states)
9. [Desktop & Mobile Audit](#9-desktop--mobile-audit)
10. [Labels, Copy & Microcopy Audit](#10-labels-copy--microcopy-audit)
11. [Implementation Priority & Phasing](#11-implementation-priority--phasing)
12. [File-by-File Change Map](#12-file-by-file-change-map)

---

## 1. Executive Summary

This document is a comprehensive page-by-page, button-by-button UX audit of the TITM AI Coach feature, followed by a detailed implementation specification that can be passed directly to Claude Code for production-quality implementation.

The AI Coach is a powerful feature with deep capabilities: 20+ AI functions, live charting, full options chains with Greeks, GEX analysis, position tracking, trade journaling, and more. However, the current UX does not surface this power effectively. The issues fall into five categories:

- **Broken Interactions:** Chat empty-state buttons do nothing (no onClick wiring). The 4 center-panel prompt cards work, but the chat-side ones are dead.
- **Wrong Default Content:** The 4 example prompts (Key Levels, Market Status, ATR Analysis, VWAP Check) are low-value utility queries, not the high-impact analyses TITM users actually need. SPX-heavy analysis and morning workflow are buried.
- **Lackluster Morning Brief:** The brief is a flat data dump with no visual hierarchy, no actionable call-to-action flow, no overnight gap visualization, and no SPX/SPY correlation insight.
- **Missing Polish & Transitions:** No page-level animations, no skeleton loading states, inconsistent hover feedback, no empty-state illustrations, and the mobile experience lacks gesture support.
- **Navigation Confusion:** 13 tabs in a horizontal scroll bar is overwhelming. No tab grouping, no visual hierarchy between primary and secondary features, and the "Home" button is barely visible at the far right.

**Total issues found: 47** across all pages. Of these, 8 are CRITICAL (broken functionality), 14 are HIGH (significant UX degradation), 16 are MEDIUM (polish/premium), and 9 are LOW/ENHANCEMENT.

---

## 2. Chat Panel: Empty State & Broken Buttons

### 2.1 The Bug: Dead Buttons in Chat Empty State

**File:** `app/members/ai-coach/page.tsx`, lines 438–468 (`EmptyState` component)

The `EmptyState` component renders 4 suggestion buttons in a 2×2 grid. These buttons have **NO onClick handler**. They are purely visual. When a user clicks them, nothing happens. This is the #1 most damaging UX bug because it is the very first interaction a new user has with the AI Coach.

**Current Code (Broken):**
The buttons are plain `<button>` elements with static text and hover styles, but no `onClick` prop is wired. The `EmptyState` function receives no props for sending messages.

**Root Cause:**
The `EmptyState` component is defined as a standalone function with zero props. It has no reference to `onSendMessage` or any dispatch function. The `ChatArea` component renders `<EmptyState />` with no prop drilling.

### 2.2 Implementation Spec: Fix Chat Empty State

| Element | Specification | Priority |
|---------|--------------|----------|
| `EmptyState` component | Add `onSendPrompt` prop of type `(prompt: string) => void`. Pass it from `ChatArea` which already has `onSendMessage`. | **CRITICAL** |
| Suggestion buttons | Wire `onClick={() => onSendPrompt(prompt)}` to each button. Use the same prompt strings as the center panel `EXAMPLE_PROMPTS` but with updated text (see Section 3). | **CRITICAL** |
| Button content | Replace the 4 generic prompts with high-value TITM prompts: (1) "SPX Game Plan" — full levels + GEX + expected move, (2) "Morning Brief" — triggers brief view, (3) "Best Setup Right Now" — runs scanner, (4) "SPX vs SPY Correlation" — new dedicated analysis. | **HIGH** |
| Button animation | Add framer-motion stagger animation: `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, with 75ms stagger delay per button. | **MEDIUM** |
| Visual feedback | On click, flash `emerald-500/20` background for 150ms, then transition to normal state as the message is sent. | **MEDIUM** |
| Empty state icon | Replace generic `BrainCircuit` icon with a custom animated SVG that subtly pulses the emerald glow. Consider Lottie animation of a trading chart forming. | **ENHANCEMENT** |

---

## 3. Center Panel: Welcome View & Example Prompts

### 3.1 Audit: The 4 Example Prompts Are Wrong

**File:** `components/ai-coach/center-panel.tsx`, lines 125–150 (`EXAMPLE_PROMPTS` constant)

Current prompts and why they fail TITM users:

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | Key Levels prompt | "Where's PDH for SPX today?" — Asks for a single data point. A TITM user wants the full picture: all levels, GEX context, expected move, and what to watch. This is too narrow. | **HIGH** |
| 2 | Market Status prompt | "What's the current market status?" — Returns a single sentence about market hours. Users can see if the market is open from any broker. Zero analytical value. | **HIGH** |
| 3 | ATR Analysis prompt | "What's the ATR for SPX and NDX?" — Returns two numbers. No context on how to use them, no position sizing guidance, no historical comparison. | **HIGH** |
| 4 | VWAP Check prompt | "Where is VWAP for SPX right now?" — Another single number. VWAP is already shown on the chart. This doesn't demonstrate AI capability. | **HIGH** |
| 5 | No SPX deep analysis | There is no prompt that triggers the impressive multi-tool SPX analysis (levels + GEX + 0DTE + expected move + chart). This is the killer feature, hidden behind knowing the right question. | **CRITICAL** |
| 6 | No Morning Brief entry | The Morning Brief is buried in tabs. It should be front-and-center as a primary CTA, especially pre-market. | **HIGH** |
| 7 | No "What's the play?" prompt | TITM users want "What should I be watching?" or "Best setup right now." The scanner exists but is never surfaced on the welcome screen. | **HIGH** |
| 8 | No SPX/SPY correlation | Users specifically need to understand SPX-to-SPY correlation, expected move translation, and which to trade. This is a core TITM use case with no entry point. | **CRITICAL** |

### 3.2 Implementation Spec: New Example Prompts

Replace the 4 `EXAMPLE_PROMPTS` with these high-impact, multi-tool prompts that showcase what the AI Coach can really do:

| Element | Specification | Priority |
|---------|--------------|----------|
| **Prompt 1: "SPX Game Plan"** | Icon: `Target`. Label: "SPX Game Plan". Prompt: `"Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart."` Description: "Complete SPX analysis with levels, GEX, and trade setups". This fires `get_key_levels` + `get_gamma_exposure` + `show_chart` in one flow. | **CRITICAL** |
| **Prompt 2: "Morning Brief"** | Icon: `Sunrise`. Label: "Morning Brief". Prompt: triggers `onShowBrief()` directly instead of sending a chat message (navigates to the Brief panel view). Description: "Pre-market overview, overnight gaps, key levels & events". Time-aware: before 9:30am ET show "Good morning — here's your brief", during market hours show "Market Pulse". | **CRITICAL** |
| **Prompt 3: "Best Setup Now"** | Icon: `Search` (or `Crosshair`). Label: "Best Setup Now". Prompt: `"Scan SPX, NDX, QQQ, SPY, AAPL, TSLA, NVDA for the best setups right now. Show me the highest-probability trade with entry, target, and stop."` Description: "AI scans 7 symbols for the highest-conviction setup". This fires `scan_opportunities` with a curated watchlist. | **HIGH** |
| **Prompt 4: "SPX vs SPY"** | Icon: `Activity` (or `GitCompare`). Label: "SPX vs SPY". Prompt: `"Compare SPX and SPY right now: price levels, expected move, GEX context, and which has the better risk/reward for day trading today. Include the SPX-to-SPY price ratio."` Description: "Head-to-head comparison for day trading". This fires `get_key_levels` for both + `get_gamma_exposure` for both. | **CRITICAL** |

### 3.3 Implementation Spec: Welcome View Layout Overhaul

The welcome view needs to establish visual hierarchy and make the AI Coach feel like a premium command center, not a list of links.

| Element | Specification | Priority |
|---------|--------------|----------|
| Hero section | Replace the generic "Welcome to AI Coach" with a dynamic greeting: "Good [morning/afternoon], [Name]" with current SPX price displayed live (call `get_current_price` on mount). Show market status pill (Pre-Market / Market Open / After Hours / Closed) with appropriate color coding. | **HIGH** |
| SPX Live Ticker | Add a mini SPX price bar below the greeting: current price, change from open, change %, and a 1-sentence AI status ("SPX holding above PDH, positive gamma regime"). Auto-refreshes every 60s. This immediately signals "this tool has live data." | **HIGH** |
| Primary CTA row | The 4 example prompt cards should be in a 2×2 grid on desktop, single column on mobile. Each card: 64px height, icon left, text right, emerald gradient border on hover, slight `scale(1.02)` on hover. The entire card is clickable. | **MEDIUM** |
| Quick Access grid | Reduce from 12 cards to 8 by grouping: (1) Chart, (2) Options, (3) Analyze, (4) Journal, (5) Brief, (6) Scanner, (7) LEAPS, (8) Macro. Move Alerts, Tracked, Earnings, Prefs into a "More Tools" expandable section or into the tab bar only. | **MEDIUM** |
| Animation on mount | Stagger fade-in for all elements: hero (0ms), SPX ticker (100ms), prompt cards (200ms + 75ms each), quick access grid (400ms). Use framer-motion with spring physics. | **MEDIUM** |
| Header bar buttons | The top-right buttons (Chart, Options, Analyze, Brief, Prefs) are redundant with both the tab bar and the quick access grid. Remove them. Let the tab bar and quick access cards handle navigation. This declutters the header significantly. | **MEDIUM** |

---

## 4. Morning Brief: From Data Dump to Command Center

### 4.1 Audit: Current Morning Brief Issues

**File:** `components/ai-coach/morning-brief.tsx` (290 lines)

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | No visual hierarchy | All 6 sections (Summary, Watchlist, Key Levels, Events, Positions, Watch Items) have identical `glass-card` styling. Nothing draws the eye. The most important info (AI summary, gap analysis) looks the same as low-priority data. | **HIGH** |
| 2 | AI Summary is buried | The AI-generated market context paragraph is in a small box at the top with `text-sm text-white/75`. This should be the hero of the brief — large, prominent, with a clear "here's what matters today" framing. | **HIGH** |
| 3 | No gap visualization | `overnightSummary` has `futuresDirection`, `gapSize`, `gapPct`, and `atrRatio` data but **none of it is rendered in the UI**. The overnight gap is the single most important pre-market data point for day traders. | **CRITICAL** |
| 4 | No SPX/SPY correlation | Brief shows SPX, NDX, SPY, QQQ levels in separate rows but never correlates them. TITM users need to see the SPX-SPY relationship at a glance (e.g., "SPX expected move = 42pts, translating to ~$4.20 on SPY"). | **HIGH** |
| 5 | Key Levels are flat text | Levels show as "Pivot 5930 \| PDH 5950 \| PDL 5910 \| ATR 42" in plain text. No color coding for above/below current price, no mini-chart or level ladder visualization, no "nearest level" highlighting. | **HIGH** |
| 6 | Watchlist is just chips | Watchlist symbols are small emerald chips. No prices, no change %, no visual indication of which are up/down overnight. Should show mini price + change. | **MEDIUM** |
| 7 | No "Plan the Day" CTA | After reading the brief, users need a clear next action: "Ask AI Coach for today's SPX game plan" or "Set alerts on these levels." Currently the brief is a dead-end. | **HIGH** |
| 8 | Earnings section is generic | Shows earnings with BMO/AMC timing but no expected move visualization, no IV rank bar, no suggested strategy. The `earnings_analysis` function exists but isn't leveraged here. | **MEDIUM** |
| 9 | No time-awareness | Brief looks the same at 6am (pre-market) as it does at 2pm (mid-session). Should adapt: pre-market emphasizes gaps/overnight; mid-session emphasizes levels tested/remaining range. | **MEDIUM** |
| 10 | "Mark Viewed" is confusing | Users don't understand what "Mark Viewed" does or why it matters. The label is unclear. Should be automatic (mark viewed on scroll to bottom) or removed entirely. | **LOW** |

### 4.2 Implementation Spec: Morning Brief Redesign

#### 4.2.1 New Layout Structure (Top to Bottom)

| Element | Specification | Priority |
|---------|--------------|----------|
| Header bar | Date + market status pill + auto-refresh indicator (last updated X min ago). Remove "Mark Viewed" button. Auto-mark as viewed when user scrolls past 50% of content. | **HIGH** |
| Hero: AI Summary | Full-width card with larger text (`text-base`), `emerald-500/5` background, left emerald border accent. Bold the key takeaway sentence. Max 3 sentences. Include a "Ask AI to elaborate" link button. | **HIGH** |
| Overnight Gap Card | **NEW:** Render `overnightSummary` data. Show futures direction arrow (green up / red down), gap size in points AND percentage, ATR ratio ("Gap = 0.6x ATR"), historical fill rate ("67% of similar gaps fill by 11am"). Use a horizontal bar chart showing gap relative to ATR. | **CRITICAL** |
| SPX Focus Card | **NEW:** Dedicated SPX section (since it's the primary instrument). Show: current price, change from PDC, position relative to levels (above/below PDH, PDL, pivot, VWAP), gamma regime indicator (positive/negative), expected move bar. Include "View SPX Chart" and "SPX Options Chain" quick-action buttons. | **CRITICAL** |
| SPX/SPY Correlation Row | **NEW:** Side-by-side mini cards for SPX and SPY. Show price, expected move, and the conversion factor ("SPX 5930 ≈ SPY $593.00, EM ~$4.20"). Color-code if divergence exists. | **HIGH** |
| Level Ladder | Replace flat text with a vertical "level ladder" visualization for each symbol. Current price shown as a horizontal marker, resistance levels above in red, support below in green. Nearest level highlighted with a pulsing indicator. Each level clickable to set alert. | **HIGH** |
| Economic Events | Keep existing but add: countdown timer for next HIGH-impact event, red/amber/green left-border color coding, and a "Set reminder" button for each event. | **MEDIUM** |
| Earnings Preview | Enhance with: IV rank as a visual bar (0–100), expected move as ±price range, and one-line strategy suggestion ("IV Rank 85 — consider selling premium"). Link to Earnings Dashboard. | **MEDIUM** |
| Bottom CTA Bar | **NEW:** Sticky bottom bar with 3 action buttons: "Get SPX Game Plan" (sends prompt to chat), "Set Level Alerts" (opens alerts panel with pre-filled levels from brief), "Scan for Setups" (opens scanner). This is the "what's next" after reading the brief. | **HIGH** |

#### 4.2.2 Backend Enhancements Required

| Element | Specification | Priority |
|---------|--------------|----------|
| SPX/SPY correlation calc | Add to `morningBrief` service: calculate SPX-to-SPY ratio, translate expected move, flag divergences. Store as `spxSpyCorrelation` field in brief data. | **HIGH** |
| Overnight gap rendering | The `overnightSummary` data already exists in the `MorningBrief` interface but is not rendered by the frontend. No backend change needed — just wire it up. | **CRITICAL** |
| Gamma regime flag | Add `gammaRegime: "positive" \| "negative" \| "neutral"` to `keyLevelsToday` for SPX. Derive from existing GEX flip point vs current price. Already calculable from `get_gamma_exposure` function handler. | **HIGH** |
| Time-aware brief mode | Add `briefMode` field: `"pre_market"` (4am–9:30am), `"session"` (9:30am–4pm), `"post_market"` (4pm+). Frontend uses this to show/hide relevant sections and adjust language. | **MEDIUM** |

---

## 5. SPX-Heavy Analysis: The Star Feature

### 5.1 Audit: Current SPX Support

The AI Coach already supports SPX with all tools (`get_key_levels`, `get_gamma_exposure`, `get_zero_dte_analysis`, `get_options_chain`, `show_chart`, etc.). However, there is no dedicated "SPX Analysis" experience. Users must know to ask the right questions. The system prompt treats SPX the same as any other ticker.

What TITM users actually want when they think "SPX analysis":

- Where are we relative to key levels (PDH, PDL, pivot, VWAP, PMH, PML)?
- What is the GEX regime? Above or below flip point? Implications for range/breakout.
- What is the expected move today? How much has been used?
- What does the 0DTE structure look like? Where is the gamma risk?
- How does this translate to SPY for those trading the ETF?
- What is the best setup / next trade in SPX right now?
- What is the big-picture trend (weekly/monthly)?

### 5.2 Implementation Spec: SPX Power Analysis

#### 5.2.1 New "SPX Game Plan" Composite Function

| Element | Specification | Priority |
|---------|--------------|----------|
| New backend function: `get_spx_game_plan` | A composite function handler that orchestrates: (1) `get_key_levels("SPX")`, (2) `get_gamma_exposure("SPX")`, (3) `get_zero_dte_analysis("SPX")`, (4) `get_current_price("SPX")`, (5) `get_current_price("SPY")` in parallel. Returns a unified SPX analysis object with all data pre-joined. This avoids 5 sequential function calls and gives the AI everything it needs in one shot. | **CRITICAL** |
| SPX/SPY correlation data | Include in game plan response: `spx_price`, `spy_price`, `ratio` (SPX/SPY), `expected_move_spx`, `expected_move_spy` (translated), `gamma_regime`, `flip_point`, and a `setup_context` string that describes the current setup in 1–2 sentences. | **HIGH** |
| System prompt enhancement | Add to system prompt: "When asked about SPX game plan, levels, or analysis, ALWAYS call `get_spx_game_plan`. Lead with the setup context sentence, then show key levels, then GEX context, then expected move status, then next-best setup. Always mention SPY translation for day traders." | **HIGH** |
| Widget card: `SPXGamePlanCard` | **NEW** widget type `"spx_game_plan"` rendered inline in chat. Shows: (1) Price bar with level annotations, (2) GEX regime badge, (3) Expected move usage bar, (4) SPY translation row, (5) "What to watch" bullet points, (6) Action buttons: View Chart, Options Chain, Set Alerts. | **HIGH** |

#### 5.2.2 "Always-On" SPX Intelligence

| Element | Specification | Priority |
|---------|--------------|----------|
| SPX Persistent Ticker | Add a small persistent SPX price + change ticker to the chat header area. Shows: `SPX 5,930.45 +12.30 (+0.21%)`. Updates every 30s via polling. Clicking it sends "SPX game plan" to chat. | **HIGH** |
| SPX Context in All Responses | When user asks about ANY symbol, the AI should note if there is a relevant SPX context (e.g., "Note: SPX is in positive gamma above 5,920 flip point, which supports a range-bound regime that could affect AAPL."). Add to system prompt. | **MEDIUM** |
| "Next Best Setup" Auto-Refresh | On the welcome view, show a "Next Best SPX Setup" card that auto-generates every 15 minutes during market hours. Uses `scan_opportunities` + `get_key_levels` to identify the nearest actionable trade. Shows entry level, direction, target, and stop. | **ENHANCEMENT** |

---

## 6. Chat Interface: Polish & Premium Touches

### 6.1 Audit Findings

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | No message entrance animation | Messages appear instantly with no animation. Should slide/fade in for visual continuity. Compare to ChatGPT and Perplexity which both animate message appearance. | **MEDIUM** |
| 2 | Typing indicator is basic | 3 bouncing dots is functional but not premium. Consider a more sophisticated "thinking" animation that shows what the AI is doing ("Fetching SPX levels...", "Analyzing gamma exposure..."). | **MEDIUM** |
| 3 | No skeleton loading for sessions | Session sidebar shows a spinner when loading. Should show skeleton placeholder rows that match the session item shape. | **LOW** |
| 4 | Textarea doesn't grow smoothly | Auto-resize jumps between heights. Should use smooth CSS transition on height changes. | **LOW** |
| 5 | No quick-action buttons after response | After AI responds about SPX levels, there should be suggested follow-up actions: "Show chart", "See options chain", "Set alerts on these levels". Currently the user must type everything. | **HIGH** |
| 6 | Widget cards lack interactivity polish | Widget action bars exist but have no hover tooltips, no keyboard navigation, and no visual feedback on click beyond color change. | **MEDIUM** |
| 7 | Image upload has no analysis feedback | Screenshot upload stages the image but the `TODO` comment in `handleImageAnalysis` shows integration is incomplete. Backend has `analyzeScreenshot` but it's not wired into the streaming chat flow. | **HIGH** |
| 8 | Rate limit banner is alarming | Shows "X/Y queries used" in amber which feels like a warning. Should be a calm progress indicator that only turns amber at 80% and red at 95%. | **LOW** |

### 6.2 Implementation Spec: Chat Polish

| Element | Specification | Priority |
|---------|--------------|----------|
| Message entrance animation | Wrap each `ChatMessageBubble` in framer-motion: `initial={{ opacity: 0, y: 12, scale: 0.97 }}`, `animate={{ opacity: 1, y: 0, scale: 1 }}`, `transition={{ duration: 0.25, ease: "easeOut" }}`. User messages slide from right, AI from left. | **MEDIUM** |
| Rich typing indicator | Replace bouncing dots with a status-aware indicator. Use `message.streamStatus` to show: "Thinking..." (brain icon pulse), "Fetching SPX data..." (database icon), "Analyzing..." (chart icon), "Writing response..." (pencil icon). Each status has its own icon and subtle animation. | **MEDIUM** |
| Suggested follow-up chips | After each AI response, parse the response content to generate 2–3 follow-up action chips. E.g., after levels response: `["Show SPX Chart", "Options Chain", "Set Level Alerts"]`. These are clickable and send the appropriate prompt. Render below the message as small emerald-outlined pills. | **HIGH** |
| Smart image analysis | Complete the `TODO` in `handleImageAnalysis`. When user stages an image and sends, (1) show the image inline in the chat as a user message attachment, (2) call the backend `analyzeScreenshot` API, (3) stream the analysis response. The backend endpoint already exists. | **HIGH** |
| Textarea smooth resize | Add CSS: `transition: height 0.15s ease`. On the textarea auto-resize `onChange` handler, wrap the height update in `requestAnimationFrame` for smoother rendering. | **LOW** |
| Session skeleton loader | When `isLoadingSessions`, render 4 skeleton rows instead of spinner: `div` with `animate-pulse`, `h-10`, `rounded-lg`, `bg-white/5` with varying widths (80%, 60%, 90%, 70%). | **LOW** |

---

## 7. Navigation & Tab Architecture

### 7.1 Audit: Current Navigation Issues

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | 13 tabs is overwhelming | The tab bar contains: Chart, Options, Positions, Journal, Screenshot, Alerts, Brief, Scanner, Tracked, LEAPS, Earnings, Macro, Prefs. This is too many for a horizontal scroll. Users cannot see all options at once, especially on smaller screens. | **HIGH** |
| 2 | "Home" is barely visible | The "Home" button is a text-only link at the far right of the tab bar, styled as `text-white/30` (nearly invisible). It blends into the tab bar. Users may not know how to get back to the welcome view. | **HIGH** |
| 3 | No tab grouping | Chart, Options, and Scanner are "analysis" tools. Positions, Journal, and LEAPS are "portfolio" tools. Alerts and Tracked are "monitoring" tools. Brief and Macro are "research." They should be visually grouped. | **MEDIUM** |
| 4 | No mobile bottom nav for tabs | Mobile only shows Chat vs Chart toggle. The 13 center panel tabs are hidden behind a horizontal scroll that is hard to discover and use with touch. | **HIGH** |
| 5 | Tab bar has no active indicator animation | Active tab changes instantly with no transition. Should have a sliding underline indicator that animates between tabs (like Material Design tabs). | **MEDIUM** |
| 6 | No keyboard navigation | Tabs are not navigable via arrow keys. No `aria-labels` or `tablist` role. Accessibility audit would flag this. | **MEDIUM** |
| 7 | Breadcrumb is underused | `WorkflowBreadcrumb` shows history but is only visible during workflow navigation. It should persist as a "you are here" indicator showing: Home → Chart → SPX 1D. | **LOW** |

### 7.2 Implementation Spec: Navigation Redesign

| Element | Specification | Priority |
|---------|--------------|----------|
| Grouped tabs | Reorganize 13 tabs into 4 groups with visual separators: **ANALYZE** (Chart, Options, Scanner), **PORTFOLIO** (Positions, Journal, LEAPS, Tracked), **MONITOR** (Alerts, Earnings), **RESEARCH** (Brief, Macro). Groups separated by subtle vertical divider (1px `white/10`). Group labels shown as `text-[9px] text-white/20` above the group on hover. | **HIGH** |
| Home button | Move Home from far-right text to a dedicated icon button (`Home` icon from lucide-react) at the **LEFT** of the tab bar, before all groups. Style: `w-8 h-8`, `rounded-lg`, `bg-white/5`, `border border-white/10`, `hover:bg-emerald-500/10 hover:border-emerald-500/30`. Always visible. | **HIGH** |
| Tab underline animation | Add a framer-motion `layoutId` animated underline that slides between active tabs. Use a 2px `emerald-500` bottom border with a spring animation (`stiffness: 500, damping: 30`). This adds the premium feel of a polished tabbar. | **MEDIUM** |
| Tab overflow on desktop | If window is narrow, show left/right arrow buttons at edges of tab bar that scroll by one group. Fade edges to indicate scrollability. | **MEDIUM** |
| Mobile tab drawer | On mobile, replace horizontal tab scroll with a bottom-sheet drawer triggered by a "Tools" button. Shows all 13 tabs in a 3-column grid with icons + labels. Slides up from bottom with backdrop blur. Close on selection or swipe down. | **HIGH** |
| Prefs into settings icon | Remove Prefs from the main tab bar. Add a gear icon (Settings) to the far right of the tab bar header, next to Home. This opens Preferences as an overlay/modal rather than a full view. | **LOW** |
| Screenshot into chat | Remove Screenshot from tabs. It's a chat feature (upload image and analyze). Move the upload trigger into the chat input area (it's already partially there via `ChatImageUpload`). Remove the dedicated center panel view. | **LOW** |

---

## 8. Animations, Transitions & Loading States

### 8.1 Audit: Missing or Weak Animations

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | No page transition animation | Switching between center panel views (chart, options, brief, etc.) is an instant swap. No fade, no slide. Feels jarring and cheap. Every view change should have a transition. | **HIGH** |
| 2 | No skeleton loaders | Chart, options chain, morning brief, and other data-heavy views show a centered spinner while loading. Should show skeleton placeholders that match the content shape (like LinkedIn or YouTube loading states). | **MEDIUM** |
| 3 | Tab switch is instant | Covered in navigation section — needs sliding underline and content crossfade. | **MEDIUM** |
| 4 | Widget cards pop in | Inline widget cards (key levels, GEX profile, etc.) appear instantly when the AI response streams in. They should fade-in and scale up subtly as they enter the viewport. | **MEDIUM** |
| 5 | No micro-interactions | Buttons have hover color changes but no scale feedback, no haptic-like feedback, no subtle spring animations that make the interface feel alive. | **LOW** |
| 6 | Chart loads with no transition | When chart data arrives, candlesticks appear all at once. Consider a left-to-right reveal animation or a brief scale-in to add drama. | **LOW** |

### 8.2 Implementation Spec: Animation System

| Element | Specification | Priority |
|---------|--------------|----------|
| View transition wrapper | Create a `<ViewTransition>` component wrapping the center panel content area. Uses framer-motion `AnimatePresence` with `mode="wait"`. Each view enters with: `initial={{ opacity: 0, x: 20 }}`, `animate={{ opacity: 1, x: 0 }}`, `exit={{ opacity: 0, x: -20 }}`, `transition={{ duration: 0.2 }}`. Direction-aware: forward navigation slides left, backward slides right. | **HIGH** |
| Skeleton loaders per view | Create skeleton components for: `ChartSkeleton` (rectangle + toolbar bars), `OptionsSkeleton` (table rows), `BriefSkeleton` (card outlines), `ScannerSkeleton` (list items). Each uses `animate-pulse` with `bg-white/5` shapes. Show for minimum 300ms to avoid flash. | **MEDIUM** |
| Widget card entrance | Wrap `WidgetCard` in framer-motion: `initial={{ opacity: 0, y: 8, scale: 0.95 }}`, `animate={{ opacity: 1, y: 0, scale: 1 }}`, `transition={{ duration: 0.3, delay: index * 0.1 }}`. Cards stagger in with a slight bounce. | **MEDIUM** |
| Button micro-interactions | Add to all interactive buttons: `whileTap={{ scale: 0.97 }}`, `whileHover={{ scale: 1.02 }}`, `transition={{ type: "spring", stiffness: 400, damping: 17 }}`. Use framer-motion's `motion.button` wrapper. | **LOW** |
| Loading shimmer | Replace all `Loader2 animate-spin` instances in main content areas with shimmer skeletons. Keep spinner only for small inline indicators (e.g., refresh button, send button). Global: create a `useIsLoading` hook that returns skeleton-friendly loading states. | **MEDIUM** |

---

## 9. Desktop & Mobile Audit

### 9.1 Desktop Issues

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | Chat panel min-width too aggressive | Chat panel `minSize={30}` (30%) can make it too narrow on smaller desktop screens. At 1280px width, 30% = 384px which is fine. But the max of 55% can leave the center panel at only 45% = 576px, too tight for options chain or chart. | **LOW** |
| 2 | No panel collapse option | Users should be able to fully collapse the chat panel to maximize the center panel (for charting), and vice versa. Currently locked to 30–55% / 45–70%. | **MEDIUM** |
| 3 | Resize handle is hard to discover | The 1.5px resize handle between panels is nearly invisible. Should be wider (4px) with a visible grip indicator (3 dots) that appears on hover. | **MEDIUM** |
| 4 | No keyboard shortcuts | No `Cmd+K` for search, no `Cmd+/` for chat focus, no `Esc` to close panels, no `Cmd+1-9` for tab switching. Premium tools have keyboard shortcuts. | **MEDIUM** |

### 9.2 Mobile Issues

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | Two-mode toggle is limiting | Mobile only offers Chat or Chart view. All 13 center panel features (options, journal, alerts, etc.) require switching to "Chart" mode then scrolling through tabs. This is a significant UX barrier. | **HIGH** |
| 2 | No swipe gesture support | Cannot swipe between chat and center panel. Must tap the toggle. Swipe gestures are expected on mobile for panel switching. | **MEDIUM** |
| 3 | Chat input is at bottom but keyboard pushes it up | On mobile, the keyboard pushes the chat input up. If the input area is too close to content, messages can be obscured. Need proper viewport handling. | **MEDIUM** |
| 4 | Welcome view buttons are too small on mobile | The 4-column quick access grid results in tiny touch targets on mobile. Buttons are approximately 80px wide, below the 44px minimum touch target recommendation. | **HIGH** |
| 5 | Tab bar horizontal scroll lacks visual cues | On mobile, the center panel tab bar has `overflow-x-auto` but no visual indicator that more tabs exist to the right. Need edge fade gradients. | **MEDIUM** |
| 6 | No pull-to-refresh | Morning brief, positions, and alerts should support pull-to-refresh on mobile for a native-app feel. | **LOW** |

### 9.3 Implementation Spec: Responsive Fixes

| Element | Specification | Priority |
|---------|--------------|----------|
| Mobile view architecture | Replace the binary Chat/Chart toggle with a 3-mode system: Chat (default), Canvas (center panel), Split (side-by-side on tablets). Add a "Tools" floating action button that opens a bottom-sheet drawer with all 13 features as a grid. | **HIGH** |
| Swipe navigation | Implement horizontal swipe between Chat and Canvas using framer-motion drag gesture: `drag="x"`, `dragConstraints={{ left: 0, right: 0 }}`, `onDragEnd` to determine direction. Requires 50px minimum swipe distance. | **MEDIUM** |
| Mobile quick access | On mobile, change the 4-column grid to 2 columns. Each button minimum 44px height with 12px padding. Icon + text stacked vertically. Touch target area extends to full cell. | **HIGH** |
| Collapsible chat panel (desktop) | Add a collapse button to the chat panel header. When collapsed, chat becomes a narrow sidebar (48px) showing only the session icon and a "New Chat" button. Double-click resize handle to toggle collapse. Store preference in localStorage. | **MEDIUM** |
| Resize handle enhancement | Width: 6px (from 1.5px). Add 3 horizontal grip dots centered vertically, visible on hover. Cursor: `col-resize`. Hover: `bg-emerald-500/30` with 200ms transition. Active: `bg-emerald-500/50`. | **MEDIUM** |
| Tab edge fade on mobile | Add gradient fade overlay on left/right edges of tab bar when content is scrollable: a 24px wide gradient from transparent to `bg-[#0A0A0B]`. Hides when scrolled to edge. | **LOW** |

---

## 10. Labels, Copy & Microcopy Audit

### 10.1 Label Issues Found

| # | Issue | Detail / Current State | Severity |
|---|-------|----------------------|----------|
| 1 | "AI Coach Center" header | The welcome view header says "AI Coach Center" with subtitle "Charts, options & analytics." This is descriptive but not inspiring. Should feel like a command center or mission control, not a documentation page. | **LOW** |
| 2 | "What can I help you with?" | Chat empty state heading is generic. For a trading tool, this should be action-oriented: "What are you trading today?" or "Ready to analyze?" | **LOW** |
| 3 | Tab labels are abbreviations | "Prefs" is unclear. "Tracked" doesn't specify what. "Brief" assumes knowledge. Better: "Settings", "Watchlist", "Daily Brief." | **LOW** |
| 4 | Morning Brief "Watch Items" | The section header "Watch Items" reads like a database field name. Should be "What to Watch" or "Eyes On." | **LOW** |
| 5 | "Mark Viewed" button | Users don't care about marking things viewed. If tracking is needed for analytics, do it automatically. Remove the button. | **LOW** |
| 6 | Placeholder text is generic | Chat textarea placeholder: "Ask about any ticker, levels, options..." is okay but doesn't inspire. Rotate through contextual placeholders: pre-market shows "What's the gap looking like?", during session shows "How's SPX holding up?", after hours shows "Recap today's session." | **MEDIUM** |
| 7 | Error messages are technical | "Failed to load chart data" is developer-speak. Should be "Chart data unavailable — trying again..." with automatic retry. | **MEDIUM** |

### 10.2 Implementation Spec: Copy Improvements

| Element | Specification | Priority |
|---------|--------------|----------|
| Welcome header | Change "AI Coach Center" to "Command Center". Subtitle: dynamic based on time — "Pre-Market Prep" (4–9:30am), "Live Session" (9:30am–4pm), "After-Hours Review" (4pm+), "Market Closed" (weekends/holidays). | **LOW** |
| Chat empty state | Change "What can I help you with?" to "What are you trading today?" with subtitle "Ask me about any ticker — levels, options, setups, and more." | **LOW** |
| Tab labels | Rename: "Tracked" → "Watchlist", "Prefs" → settings icon (no text), "Brief" → "Daily Brief". Keep others as-is. | **LOW** |
| Rotating placeholder | Create a `PLACEHOLDER_PROMPTS` array keyed by market status. Rotate every 10 seconds with a fade transition. Examples: "Where are the GEX levels for SPX?", "Scan for the best setup right now", "How's my AAPL LEAPS position doing?" | **MEDIUM** |
| Error messages | Replace all user-facing error strings with friendly, actionable copy. "Failed to load X" becomes "X is temporarily unavailable. [Retry]". Auto-retry after 3 seconds with exponential backoff. Show retry count. | **MEDIUM** |

---

## 11. Implementation Priority & Phasing

### Phase 1: Critical Fixes (Ship This Week)

These are broken features or severely missing functionality. Zero polish, just make it work correctly.

- **[CRITICAL]** Fix dead buttons in chat `EmptyState` — wire `onClick` to `onSendMessage`
- **[CRITICAL]** Replace 4 example prompts with SPX Game Plan, Morning Brief, Best Setup Now, SPX vs SPY
- **[CRITICAL]** Render `overnightSummary` data in morning brief (already in API, just not displayed)
- **[CRITICAL]** Build `get_spx_game_plan` composite function on backend
- **[CRITICAL]** Add SPX/SPY correlation to morning brief

### Phase 2: High-Impact UX (Ship Next Week)

These are the high-value improvements that make the AI Coach feel premium and differentiated.

- **[HIGH]** Welcome view hero redesign with live SPX ticker and dynamic greeting
- **[HIGH]** Morning brief redesign: AI summary hero, overnight gap card, SPX focus card, level ladder, bottom CTA bar
- **[HIGH]** Suggested follow-up chips after AI responses
- **[HIGH]** Navigation grouped tabs with Home button fix
- **[HIGH]** Mobile view architecture: 3-mode system with Tools FAB
- **[HIGH]** Mobile quick access 2-column grid with proper touch targets
- **[HIGH]** Complete screenshot analysis integration in chat
- **[HIGH]** `SPXGamePlanCard` widget for inline chat display
- **[HIGH]** View transition animations between center panel views

### Phase 3: Polish & Premium (Ship Week 3)

The premium touches that make the AI Coach feel like a $200/month institutional tool.

- **[MEDIUM]** Message entrance animations with stagger
- **[MEDIUM]** Rich typing indicator with tool-awareness
- **[MEDIUM]** Skeleton loaders for all data-heavy views
- **[MEDIUM]** Tab underline sliding animation
- **[MEDIUM]** Widget card entrance animations
- **[MEDIUM]** Collapsible chat panel with collapse/expand button
- **[MEDIUM]** Resize handle visual enhancement
- **[MEDIUM]** Rotating chat placeholder text
- **[MEDIUM]** Mobile swipe gesture navigation
- **[MEDIUM]** Friendly error messages with auto-retry
- **[MEDIUM]** Button micro-interactions (spring scale)
- **[MEDIUM]** Time-aware morning brief mode (pre-market vs session)

### Phase 4: Enhancements (Backlog)

- **[LOW/ENHANCEMENT]** Keyboard shortcuts (`Cmd+K`, `Cmd+/`, etc.)
- **[LOW/ENHANCEMENT]** Next Best SPX Setup auto-refresh on welcome view
- **[LOW/ENHANCEMENT]** Animated empty state icon (Lottie or SVG)
- **[LOW/ENHANCEMENT]** Pull-to-refresh on mobile data views
- **[LOW/ENHANCEMENT]** Label and copy refinements throughout
- **[LOW/ENHANCEMENT]** Accessibility audit (aria-labels, keyboard nav, screen reader)

---

## 12. File-by-File Change Map

For Claude Code implementation, here is every file that needs to be touched, grouped by phase:

### Frontend Files

#### `app/members/ai-coach/page.tsx`
- Fix `EmptyState`: add `onSendPrompt` prop, wire button `onClick` handlers
- Add message entrance animations (framer-motion wrapper)
- Add suggested follow-up chips after AI responses
- Add SPX persistent ticker to chat header
- Implement smooth textarea resize
- Session sidebar skeleton loader
- Rotating placeholder text for chat input

#### `components/ai-coach/center-panel.tsx`
- Replace `EXAMPLE_PROMPTS` constant with new 4 prompts
- Redesign `WelcomeView`: dynamic greeting, live SPX ticker, new layout
- Add `ViewTransition` wrapper around content area
- Reorganize `TABS` constant into grouped structure
- Move Home button to left of tab bar
- Remove header bar redundant buttons
- Add tab underline sliding animation

#### `components/ai-coach/morning-brief.tsx`
- Redesign entire component layout per Section 4.2
- Add overnight gap card (new sub-component)
- Add SPX focus card (new sub-component)
- Add SPX/SPY correlation row
- Add level ladder visualization
- Add bottom CTA sticky bar
- Remove Mark Viewed button, auto-track on scroll
- Add time-aware brief mode

#### `components/ai-coach/widget-cards.tsx`
- Add new `SPXGamePlanCard` widget type
- Add widget entrance animations
- Add hover tooltips to action bar buttons

#### `components/ai-coach/chat-message.tsx`
- Add message entrance animation wrapper
- Enhance `TypingIndicator` with tool-awareness

#### **NEW:** `components/ai-coach/skeleton-loaders.tsx`
- `ChartSkeleton`, `OptionsSkeleton`, `BriefSkeleton`, `ScannerSkeleton`

#### **NEW:** `components/ai-coach/view-transition.tsx`
- `AnimatePresence` wrapper with direction-aware animations

#### **NEW:** `components/ai-coach/follow-up-chips.tsx`
- Parse AI response, generate contextual follow-up action pills

#### **NEW:** `components/ai-coach/spx-ticker.tsx`
- Persistent SPX price + change display with auto-refresh

#### **NEW:** `components/ai-coach/overnight-gap-card.tsx`
- Gap visualization with ATR ratio bar for morning brief

#### **NEW:** `components/ai-coach/level-ladder.tsx`
- Vertical level visualization for morning brief

### Backend Files

#### `backend/src/chatkit/functions.ts`
- Add `get_spx_game_plan` function definition

#### `backend/src/chatkit/functionHandlers.ts`
- Add `get_spx_game_plan` handler that orchestrates parallel calls

#### `backend/src/chatkit/systemPrompt.ts`
- Add SPX game plan routing instruction
- Add SPX context awareness for all symbol responses
- Add SPY translation instruction

#### `backend/src/services/morningBrief/index.ts`
- Add SPX/SPY correlation calculation
- Add gamma regime flag to key levels
- Add `briefMode` field (`pre_market` / `session` / `post_market`)
- Ensure `overnightSummary` is always populated

---

**Total new files:** 6 frontend components.
**Total modified files:** 10 frontend + 4 backend = 14.
**Estimated LOC:** ~2,500–3,500 lines of new/modified code across all phases.

---

*End of document. This spec is ready to be passed to Claude Code for implementation.*
