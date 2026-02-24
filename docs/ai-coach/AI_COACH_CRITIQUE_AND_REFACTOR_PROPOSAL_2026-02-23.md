# AI Coach: Strategic Critique & Refactor Proposal

**Date:** 2026-02-23
**Author:** Claude (Orchestrator Agent)
**Status:** Proposal — Awaiting Approval
**Companion Spec:** SPX Command Center Phase 18 Execution Spec (same date)

---

## Executive Summary

The AI Coach is TradeITM's most ambitious feature — a GPT-4o-powered trading assistant with 37 callable functions, 46 React components, 14 center-panel views, and deep integrations across options, positions, earnings, macro, and journaling. It aspires to be a Bloomberg Terminal meets ChatGPT for retail options traders.

**The problem:** It's become a feature buffet instead of a coaching experience. The center panel tries to be a dashboard app (position tracker, LEAPS manager, alerts CRUD, watchlist, opportunity scanner) while the chat tries to be the connective tissue. The result is neither a great dashboard nor a great conversational coach — it's a confusing hybrid where users don't know whether to click or type.

**The recommendation:** Collapse the AI Coach to a **two-panel conversational experience** — chat on the left, a context-aware chart on the right — and let the AI's 37 functions render their outputs as rich inline cards within the chat stream rather than as full-page panel takeovers. Strip 8 of the 14 center-panel views entirely. Make earnings, macro, and morning brief pure chat flows. Let the chart be the single visual anchor that responds to whatever the conversation is about.

---

## Part 1: What's Wrong Today

### 1.1 The Identity Crisis: Dashboard vs. Coach

The AI Coach page has a split personality. The left panel is a conversational AI. The right panel is a mini-app with 14 switchable views — each one a standalone dashboard that could exist on its own page. The user experience fractures along this seam:

When you ask the AI "show me AAPL earnings," it can either respond conversationally in chat (with an inline widget card) *or* flip the entire center panel to the EarningsDashboard component. Currently it does both — the chat responds AND the panel switches — which creates a jarring, disorienting experience where the user's reading flow is interrupted by a full panel transition they didn't explicitly request.

The `WorkflowCenterView` type tells the story: `'chart' | 'options' | 'position' | 'screenshot' | 'journal' | 'alerts' | 'brief' | 'scanner' | 'tracked' | 'leaps' | 'earnings' | 'macro' | 'watchlist' | 'preferences'`. That's 14 views. A user would need to discover and learn 14 different panel states, most of which are accessible both via chat commands and via the toolbar. This is cognitive overload.

### 1.2 Massive Feature Overlap with SPX Command Center

The SPX Command Center already provides real-time SPX/SPY charting, key levels, GEX visualization, setup detection, position management concepts, and a full decision engine. The AI Coach duplicates much of this:

- **Position Tracker** — The SPX Command Center already tracks active setups. A standalone position tracker in the AI Coach is a parallel system with no shared state.
- **Tracked Setups Panel** — Directly overlaps with the SPX Command Center's setup lifecycle.
- **Opportunity Scanner** — The SPX Command Center's setup detector IS the opportunity scanner. Having a separate one in the AI Coach creates conflicting signals.
- **Watchlist Panel** — Generic watchlist management is a utility, not a coaching feature.
- **Alerts Panel** — CRUD for price alerts is utility infrastructure, not conversational AI.

### 1.3 The "Sub-Tab" Anti-Pattern

Morning Brief, Macro Context, and Earnings Dashboard are currently full panel views — each with its own component, its own data fetching, its own UI. But the user's mental model for these is simple: "What's the morning brief?" "What's happening with NVDA earnings?" "What's the macro picture?"

These are *questions*. They should be answered in *chat*. Making them dedicated panels implies they're persistent dashboards worth monitoring — but a morning brief is consumed once, macro context changes slowly, and earnings are episodic. The panel paradigm doesn't match the information lifecycle.

### 1.4 The 46-Component Maintenance Burden

The `components/ai-coach/` directory contains 46 `.tsx` files. Many of these are substantial standalone applications:

- `earnings-dashboard.tsx` — Full earnings calendar with historical moves, IV context
- `leaps-dashboard.tsx` — Long-dated options analysis with Greeks projection
- `macro-context.tsx` — Economic indicator dashboard
- `morning-brief.tsx` — Pre-market analysis panel
- `position-tracker.tsx` — Active position management
- `opportunity-scanner.tsx` — Multi-symbol scanning engine
- `watchlist-panel.tsx` — Symbol watchlist CRUD
- `alerts-panel.tsx` — Price alert management
- `tracked-setups-panel.tsx` — Setup lifecycle tracking

Each of these requires ongoing maintenance, bug fixes, styling updates, and data pipeline support. The backend has dedicated routes for each (`/api/alerts`, `/api/leaps`, `/api/trackedSetups`, `/api/watchlist`, `/api/scanner`, `/api/brief`, `/api/earnings`, `/api/macro`). That's 8+ backend routes supporting features that should be conversational.

### 1.5 Mobile Experience Fragmentation

The current architecture handles mobile via `MobileToolSheet` — a bottom-sheet overlay that presents the center panel views. With 14 possible views, the mobile experience becomes a maze of sheets stacking on sheets. The `MobileQuickAccessBar` tries to provide shortcuts, but shortcuts to 14 destinations isn't a shortcut — it's a menu.

### 1.6 The 37-Function Paradox

The AI has 37 callable functions — an impressive toolkit. But many of these functions exist primarily to populate the center panel views rather than to enhance the conversation. Functions like `set_alert`, `get_alerts`, `scan_opportunities`, `analyze_leaps_position` are CRUD operations dressed up as AI capabilities. The truly valuable functions — `get_spx_game_plan`, `get_key_levels`, `get_options_chain`, `get_gamma_exposure`, `get_zero_dte_analysis`, `get_macro_context`, `get_earnings_analysis` — are analytical tools that produce rich data the AI can interpret and explain.

The refactor should lean into the analytical functions and let CRUD operations be handled through simpler UI patterns or removed entirely.

---

## Part 2: The Refactored Vision

### 2.1 The Two-Panel Architecture

```
+------------------------------------------+----------------------------------------+
|                                          |                                        |
|            CHAT PANEL (40%)              |          CHART PANEL (60%)             |
|                                          |                                        |
|  [Session History]                       |  +------------------------------------+|
|                                          |  |                                    ||
|  User: What's the SPX game plan?         |  |    TradingView-style Chart         ||
|                                          |  |    with context-aware overlays     ||
|  Coach: Here's today's setup...          |  |                                    ||
|  ┌─────────────────────────┐             |  |    • Key levels (from chat)        ||
|  │ SPX Game Plan Card      │             |  |    • GEX zones (from chat)         ||
|  │ Key: 5,842 | GEX Flip   │             |  |    • Entry/exit markers            ||
|  │ Bias: Bullish > 5,820   │             |  |    • Earnings dates                ||
|  │ [Show on Chart]         │             |  |    • Position P&L zones            ||
|  └─────────────────────────┘             |  |                                    ||
|                                          |  +------------------------------------+|
|  User: What about NVDA earnings?         |  |  Chart Toolbar (symbol, timeframe) ||
|                                          |  +------------------------------------+|
|  Coach: NVDA reports Thursday BMO...     |                                        |
|  ┌─────────────────────────┐             |                                        |
|  │ Earnings Analysis Card  │             |                                        |
|  │ Expected: ±4.2%         │             |                                        |
|  │ IV Rank: 78th           │             |                                        |
|  │ [Show NVDA Chart]       │             |                                        |
|  └─────────────────────────┘             |                                        |
|                                          |                                        |
|  [Image Upload] [CSV Upload] [Send]     |                                        |
+------------------------------------------+----------------------------------------+
```

**The rule is simple:** Chat is the interface. Chart is the visual. Everything else is a card in the chat stream.

### 2.2 What Gets Stripped (8 Center Panel Views → Removed)

| Current View | Disposition | Rationale |
|---|---|---|
| `position` (PositionTracker) | **REMOVE** | Overlaps with SPX Command Center. Position questions answered via chat using `analyze_position`. |
| `leaps` (LEAPSDashboard) | **REMOVE** | Niche feature. LEAPS analysis via `analyze_leaps_position` function renders as chat card. |
| `alerts` (AlertsPanel) | **REMOVE** | CRUD utility. `set_alert` / `get_alerts` functions work through chat. Simple toast confirmation. |
| `scanner` (OpportunityScanner) | **REMOVE** | Overlaps with SPX setup detector. `scan_opportunities` returns results as chat cards. |
| `tracked` (TrackedSetupsPanel) | **REMOVE** | Overlaps with SPX Command Center tracked setups. |
| `watchlist` (WatchlistPanel) | **REMOVE** | Generic utility. Symbol switching done via chart toolbar or chat ("show me AAPL"). |
| `brief` (MorningBriefPanel) | **REMOVE as panel** | Becomes pure chat flow. User says "morning brief" → AI responds with rich brief card. |
| `macro` (MacroContext) | **REMOVE as panel** | Becomes pure chat flow. User says "macro context" → AI responds with macro analysis card. |
| `earnings` (EarningsDashboard) | **REMOVE as panel** | Becomes pure chat flow. "NVDA earnings?" → AI responds with earnings card. |

### 2.3 What Stays (6 Views → Reduced to 3)

| Current View | Disposition | Notes |
|---|---|---|
| `chart` (TradingChart) | **KEEP — PRIMARY** | The single visual anchor. Always visible. Responds to chat context. |
| `options` (OptionsChain) | **KEEP — OVERLAY** | Opens as a slide-over or modal on the chart panel when user asks about options chains. Not a full panel switch. |
| `screenshot` (ScreenshotUpload) | **KEEP — INLINE** | Screenshot upload stays in chat input area. Analysis results render as chat cards. Chart shows extracted levels. |
| `journal` (TradeJournal) | **KEEP — OVERLAY** | Journal review opens as a slide-over. "Review my journal" triggers it. Could also link out to `/members/journal`. |
| `preferences` (PreferencesPanel) | **KEEP — MODAL** | Settings modal, not a panel view. Gear icon opens it. |
| `onboarding` (Onboarding) | **KEEP — MODAL** | First-run modal, unchanged. |

### 2.4 The New `CenterView` Type

```typescript
// BEFORE: 14 views
type WorkflowCenterView =
  | 'chart' | 'options' | 'position' | 'screenshot' | 'journal'
  | 'alerts' | 'brief' | 'scanner' | 'tracked' | 'leaps'
  | 'earnings' | 'macro' | 'watchlist' | 'preferences'

// AFTER: 3 views + 2 overlays
type CenterView = 'chart'  // default, always-on
type ChartOverlay = 'options' | 'journal'  // slide-over panels on top of chart
type ChatModal = 'preferences' | 'onboarding'  // modal dialogs
```

### 2.5 Smart Chart Overlays (The Key Innovation)

Instead of switching the entire center panel, the chart becomes the permanent canvas and the AI paints context onto it:

**Conversation-driven overlays:**
- User asks about key levels → Chart draws horizontal lines at PDH, PDL, VWAP, pivots
- User asks about GEX → Chart shades gamma zones, marks flip point
- User asks about earnings → Chart marks earnings date, shows expected move range
- User asks about a position → Chart highlights entry price, stop, target zones
- User asks about macro → Chart shows economic event markers on timeline
- User asks to compare symbols → Chart switches to the requested symbol

**The AI's `show_chart` function already supports this** — it accepts levels, annotations, and symbol/timeframe params. The refactor just makes the chart the *only* visual target instead of one of 14.

### 2.6 Rich Chat Cards (Replacing Panel Views)

The `widget-cards.tsx` component already renders inline data cards for AI function responses. The refactor doubles down on this pattern. Every function that currently populates a center panel view should instead render a rich card in the chat stream:

**Card types needed:**
- `GamePlanCard` — SPX game plan with levels, bias, key zones (exists as widget)
- `EarningsCard` — Earnings date, expected move, IV rank, historical context
- `MacroCard` — Key economic indicators, Fed stance, sector rotation
- `MorningBriefCard` — Overnight gaps, pre-market levels, what to watch
- `OptionsChainCard` — Compact chain snapshot with key strikes highlighted
- `PositionAnalysisCard` — P&L, Greeks, risk metrics, management advice
- `ScanResultsCard` — Top 3 opportunities with entry/target/stop
- `AlertConfirmationCard` — Simple toast: "Alert set: SPX > 5,850"

Each card has a `[Show on Chart]` action that paints the relevant data onto the chart without switching views.

### 2.7 The Simplified Function Registry

**Keep (analytical/coaching):** 22 functions
- `get_spx_game_plan`, `get_key_levels`, `get_fibonacci_levels`, `get_current_price`, `get_market_status`, `compare_symbols`
- `get_options_chain`, `get_gamma_exposure`, `get_zero_dte_analysis`, `get_iv_analysis`, `get_unusual_activity`
- `get_ticker_news`, `get_company_profile`, `get_market_breadth`, `get_dividend_info`
- `get_earnings_calendar`, `get_earnings_analysis`, `get_macro_context`, `get_economic_calendar`
- `get_journal_insights`, `get_trade_history`
- `show_chart`
- `analyze_position` (chat-only, no panel)

**Deprecate (CRUD/utility):** 8 functions
- `set_alert`, `get_alerts` → Simplify to chat-based: "Alert me when SPX hits 5850" → toast confirmation
- `scan_opportunities` → Merge into `get_spx_game_plan` or keep as chat-only with card response
- `analyze_leaps_position` → Keep as chat-only, remove dedicated panel
- `analyze_swing_trade` → Keep as chat-only
- `calculate_roll_decision` → Keep as chat-only
- `get_position_advice` → Keep as chat-only
- `get_long_term_trend` → Merge into chart overlays

**Net:** 37 → ~25-28 functions (remove pure CRUD, consolidate overlapping ones)

---

## Part 3: Architecture — Before & After

### 3.1 Component Count Reduction

```
BEFORE (46 components):
  center-panel.tsx          → REWRITE (simplified)
  trading-chart.tsx         → KEEP
  chart-toolbar.tsx         → KEEP
  chart-indicators.ts       → KEEP
  chart-level-labels.tsx    → KEEP
  chart-level-groups.tsx    → KEEP (utility)
  chart-realtime.ts         → KEEP (utility)
  options-chain.tsx         → KEEP (as overlay)
  gex-chart.tsx             → KEEP (as chart sub-component)
  iv-dashboard.tsx          → REFACTOR (into chat card)
  zero-dte-dashboard.tsx    → REFACTOR (into chat card)
  earnings-dashboard.tsx    → DELETE (chat card replaces)
  macro-context.tsx         → DELETE (chat card replaces)
  morning-brief.tsx         → DELETE (chat card replaces)
  position-tracker.tsx      → DELETE
  position-form.tsx         → DELETE
  leaps-dashboard.tsx       → DELETE
  alerts-panel.tsx          → DELETE
  opportunity-scanner.tsx   → DELETE
  tracked-setups-panel.tsx  → DELETE
  watchlist-panel.tsx       → DELETE
  widget-cards.tsx          → ENHANCE (more card types)
  widget-action-bar.tsx     → SIMPLIFY
  widget-action-bar-v2.tsx  → MERGE into v1 or delete
  widget-row-actions.tsx    → SIMPLIFY
  widget-actions.ts         → SIMPLIFY
  widget-context-menu.tsx   → SIMPLIFY
  chat-message.tsx          → KEEP
  chat-panel.tsx            → KEEP
  chat-image-upload.tsx     → KEEP
  message-bubble.tsx        → KEEP
  follow-up-chips.tsx       → KEEP
  screenshot-upload.tsx     → KEEP (inline in chat)
  symbol-search.tsx         → KEEP (in chart toolbar)
  inline-mini-chart.tsx     → KEEP
  skeleton-loaders.tsx      → KEEP
  error-boundary.tsx        → KEEP
  view-transition.tsx       → SIMPLIFY (fewer transitions)
  onboarding.tsx            → KEEP
  preferences-panel.tsx     → KEEP (as modal)
  preferences.ts            → KEEP
  mobile-tool-sheet.tsx     → REWRITE (simplified)
  mobile-quick-access-bar.tsx → DELETE (unnecessary with 3 views)
  mini-chat-overlay.tsx     → KEEP (mobile)
  desktop-context-strip.tsx → SIMPLIFY
  workflow-breadcrumb.tsx   → DELETE (no workflow paths needed)
  journal-insights.tsx      → REFACTOR (into chat card)
  overnight-gap-card.tsx    → KEEP (chat card)
  level-ladder.tsx          → KEEP (chart sub-component)
  options-heatmap.tsx       → KEEP (options overlay sub-component)

AFTER: ~28-30 components (down from 46)
  - 11 deleted entirely
  - 5 refactored into chat cards
  - 2 merged
  - 28 remaining
```

### 3.2 Backend Route Reduction

```
BEFORE (8 dedicated AI Coach routes):
  /api/alerts       → DELETE route (chat function only)
  /api/leaps        → DELETE route (chat function only)
  /api/trackedSetups → DELETE route (remove feature)
  /api/watchlist    → DELETE route (remove feature)
  /api/scanner      → SIMPLIFY (keep as chat function backend)
  /api/brief        → KEEP (chat function calls it)
  /api/earnings     → KEEP (chat function calls it)
  /api/macro        → KEEP (chat function calls it)

AFTER: Remove 4 routes, simplify 1, keep 3
```

### 3.3 Context Simplification

```typescript
// BEFORE: Complex workflow state
interface AICoachWorkflowState {
  activeSymbol: string | null
  activeExpiry: string | null
  activeStrike: number | null
  activeSetup: Record<string, unknown> | null
  activeLevels: WorkflowLevel[] | null
  openPositions: PositionInput[] | null
  chartAnnotations: WorkflowChartAnnotation[] | null
  activeCenterView: WorkflowCenterView | null  // 14 possible views
  pendingAlert: WorkflowAlertPrefill | null
  workflowPath: WorkflowStep[]  // breadcrumb history
}

// AFTER: Simple chart-focused state
interface AICoachState {
  activeSymbol: string
  chartTimeframe: ChartTimeframe
  chartLevels: ChartLevel[]
  chartAnnotations: ChartAnnotation[]
  chartOverlay: 'options' | 'journal' | null
  conversationContext: {
    lastTopic: string
    mentionedSymbols: string[]
    activeAnalysis: 'gameplan' | 'earnings' | 'macro' | 'position' | null
  }
}
```

### 3.4 Mobile Architecture (Simplified)

```
BEFORE:
  Desktop: Chat (40%) | Center Panel with 14 views (60%)
  Mobile: Chat → MobileToolSheet (bottom sheet for any of 14 views)
           + MobileQuickAccessBar (shortcuts to 14 views)
           + MiniChatOverlay (chat bubble over tool sheets)

AFTER:
  Desktop: Chat (40%) | Chart with overlays (60%)
  Mobile: Chat (full screen, default)
          → Tap chart icon → Chart (full screen) with mini-chat overlay
          → Options/Journal as bottom sheets (only 2 possible sheets)
```

---

## Part 4: Implementation Phases

### Phase 1: Chat Card Enhancement (3-4 days)
- Enhance `widget-cards.tsx` with new card types for earnings, macro, morning brief, position analysis
- Each card gets a `[Show on Chart]` action that sends levels/annotations to the chart
- No panel switching — cards render inline in chat
- Keep all existing panels functional during migration (no breaking changes)

### Phase 2: Chart as Permanent Canvas (2-3 days)
- Modify `center-panel.tsx` to always render the chart as base layer
- Options chain becomes a slide-over panel (overlays the chart, doesn't replace it)
- Journal becomes a slide-over panel
- Remove view switching logic for deleted views
- Chart accepts annotations from chat context (levels, zones, markers)

### Phase 3: Strip Removed Panels (2-3 days)
- Delete: `position-tracker.tsx`, `position-form.tsx`, `leaps-dashboard.tsx`, `alerts-panel.tsx`, `opportunity-scanner.tsx`, `tracked-setups-panel.tsx`, `watchlist-panel.tsx`, `workflow-breadcrumb.tsx`, `mobile-quick-access-bar.tsx`
- Convert to chat-only: `earnings-dashboard.tsx` → card, `macro-context.tsx` → card, `morning-brief.tsx` → card
- Remove corresponding backend routes for alerts, leaps, trackedSetups, watchlist
- Update `WorkflowCenterView` type to simplified version

### Phase 4: Context & Mobile Cleanup (2-3 days)
- Simplify `AICoachWorkflowContext` to new `AICoachState`
- Rewrite `MobileToolSheet` for 2-overlay model (options, journal only)
- Delete `MobileQuickAccessBar`
- Simplify `desktop-context-strip.tsx` (fewer actions)
- Clean up function registry (deprecate CRUD functions)

### Phase 5: Polish & Verify (1-2 days)
- End-to-end testing of all chat flows
- Verify chart overlay interactions
- Mobile responsive testing
- Performance audit (should see significant bundle size reduction)

**Total estimate: 10-15 days**

---

## Part 5: What This Unlocks

### 5.1 A True Coaching Experience
With the dashboard clutter removed, the AI can focus on what it does best: interpret data, explain context, and guide decisions. The conversation becomes the primary interface, and the chart becomes the shared visual workspace. This mirrors how a real trading coach works — they talk to you while pointing at a chart.

### 5.2 Dramatically Simpler Onboarding
New users see: a chat box and a chart. That's it. They type a question, they get an answer with a visual. No 14-view discovery problem. No "where do I find my alerts?" confusion.

### 5.3 Mobile-First Simplicity
Mobile becomes: chat (default) or chart (one tap). Two states instead of fourteen. The mini-chat overlay on the chart view means users never lose conversational context.

### 5.4 Reduced Maintenance Surface
11 fewer components. 4 fewer backend routes. Simpler state management. Fewer edge cases. Less testing surface. The team (or autonomous agents) can focus on making the chat smarter and the chart richer instead of maintaining 14 panel views.

### 5.5 Better AI Function Utilization
With chat as the primary interface, the AI's 25+ analytical functions get more exposure. Users discover capabilities by asking questions rather than hunting through sub-tabs. The AI can proactively suggest analyses ("I notice NVDA earnings are Thursday — want me to analyze the expected move?") instead of waiting for users to navigate to the right panel.

### 5.6 SPX Command Center Synergy (No Overlap)
The AI Coach becomes the *conversational* layer. The SPX Command Center remains the *operational* layer. Clear separation: if you want to monitor and execute, go to SPX CC. If you want to ask questions, analyze, and learn, talk to the Coach. No more duplicate position trackers, setup scanners, or alert managers.

---

## Part 6: Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Users rely on removed panels (alerts, positions) | Medium | Announce deprecation, ensure chat equivalents work well before removing panels |
| Chat cards feel less powerful than full panels | Medium | Invest in card interactivity — expandable sections, mini-charts in cards, one-click chart annotations |
| Options chain as overlay feels cramped | Low | Use a generous 70% width slide-over, not a narrow sidebar |
| Journal access feels buried | Low | Keep journal as a prominent quick-prompt chip; slide-over provides full functionality |
| Mobile chart experience on small screens | Medium | Ensure chart is touch-optimized, pinch-to-zoom, swipe between chat and chart |

---

## Part 7: Complete Repo Cleanup Plan

This section ensures zero orphaned code, zero dead imports, and a clean dependency graph after the refactor. Every file touched is accounted for.

### 7.1 Frontend: Component Deletion (13 files)

```
DELETE entirely:
  components/ai-coach/position-tracker.tsx
  components/ai-coach/position-form.tsx
  components/ai-coach/leaps-dashboard.tsx
  components/ai-coach/alerts-panel.tsx
  components/ai-coach/opportunity-scanner.tsx
  components/ai-coach/tracked-setups-panel.tsx
  components/ai-coach/watchlist-panel.tsx
  components/ai-coach/workflow-breadcrumb.tsx
  components/ai-coach/mobile-quick-access-bar.tsx
  components/ai-coach/widget-action-bar-v2.tsx
  components/ai-coach/earnings-dashboard.tsx   (after chat card replacement)
  components/ai-coach/macro-context.tsx         (after chat card replacement)
  components/ai-coach/morning-brief.tsx         (after chat card replacement)
```

### 7.2 Frontend: Import & Reference Cleanup

**`components/ai-coach/center-panel.tsx`** (heaviest surgery):
- Remove 12 import statements (lines 39-52): PositionTracker, AlertsPanel, OpportunityScanner, LEAPSDashboard, MacroContext, EarningsDashboard, MorningBriefPanel, TrackedSetupsPanel, WatchlistPanel, WorkflowBreadcrumb
- Remove 9 entries from `TABS` array (lines 236-254): position, scanner, tracked, alerts, watchlist, brief, leaps, earnings, macro
- Remove 9 entries from `ROUTABLE_VIEWS` set (lines 268-281)
- Remove 9 rendering blocks from view switch statement (lines 1232-1355)
- Remove 8 `onShow*` callback props from WelcomeView (lines 1137-1186)
- Simplify `CenterView` type union from 14 → 3 values

**`contexts/AICoachWorkflowContext.tsx`**:
- Remove 9 values from `WorkflowCenterView` type union (lines 14-28)
- Remove `pendingAlert: WorkflowAlertPrefill` from state interface
- Remove `createAlertAtLevel()` callback (line 298)
- Remove `trackPosition()` callback (line 376)
- Remove `analyzeSetup()` panel-switch behavior (line 354) — keep as chat-only
- Delete `WorkflowAlertPrefill` interface entirely
- Simplify `workflowPath: WorkflowStep[]` — remove breadcrumb trail logic

**`components/ai-coach/widget-actions.ts`**:
- Remove `alertAction()` export (lines 78-99)
- Remove `viewAction()` cases for deleted views
- Keep `chartAction()`, `optionsAction()`, `chatAction()`

**`components/ai-coach/desktop-context-strip.tsx`**:
- Remove `loadTopSetup()` hook and `topSetup` state (driven by `scanOpportunities()`)
- Remove "Next Best Setup" badge JSX
- Simplify to: symbol display, timeframe selector, chart controls only

**`app/members/ai-coach/page.tsx`**:
- Remove any references to deleted view types in search params handling
- Simplify `MobileToolSheet` usage (only 2 possible overlays)
- Remove `MobileQuickAccessBar` import and rendering

### 7.3 API Client Cleanup: `lib/api/ai-coach.ts`

This file is 2400+ lines. The following blocks become dead code:

```
DELETE — Alert APIs (lines 1913-2048):
  Types:     AlertType, AlertStatus, AlertEntry, AlertCreateInput, AlertsListResponse
  Functions: getAlerts(), createAlert(), cancelAlert(), deleteAlert()

DELETE — Scanner APIs (lines 2050-2113):
  Types:     ScanOpportunity, ScanResult
  Functions: scanOpportunities()

DELETE — Watchlist APIs (lines 2116-2254):
  Types:     Watchlist, WatchlistResponse
  Functions: getWatchlists(), createWatchlist(), updateWatchlist(),
             deleteWatchlist(), addSymbolToWatchlist(), removeSymbolFromWatchlist()

DELETE — Tracked Setups APIs (lines 2335-2490):
  Types:     TrackedSetupStatus, TrackedSetupsListStatus, TrackedSetup
  Functions: getTrackedSetups(), trackSetup(), updateTrackedSetup(),
             deleteTrackedSetup(), deleteTrackedSetupsBulk()

KEEP BUT MODIFY — Morning Brief APIs (lines 2265-2332):
  Keep:     getMorningBrief() (chat function still calls it)
  Delete:   setMorningBriefViewed() (no panel to mark as viewed)

KEEP — Position Analysis APIs:
  Keep:     analyzePosition(), getPositionAdvice(), getLivePositions()
            (used by screenshot upload, journal, and chat functions)
```

**Estimated reduction:** ~500 lines removed from `lib/api/ai-coach.ts`

### 7.4 Shared Library Cleanup

```
DELETE entirely:
  lib/ai-coach/tracked-setups.ts
    (filterTrackedSetups, sortTrackedSetups, loadTrackedSetupsPreferences,
     saveTrackedSetupsPreferences — only used by deleted tracked-setups-panel.tsx)

KEEP:
  lib/ai-coach/screenshot-monitoring.ts  (used by chat image upload)
  lib/ai-coach/                          (other files serve chat functions)
```

### 7.5 Backend Route Deletion

**Route files to delete (7 files):**
```
backend/src/routes/alerts.ts          (~150 lines — CRUD for price alerts)
backend/src/routes/scanner.ts         (~72 lines — scan endpoint)
backend/src/routes/trackedSetups.ts   (~200 lines — tracked setup CRUD)
backend/src/routes/watchlist.ts       (~200 lines — watchlist CRUD)
backend/src/routes/leaps.ts           (LEAPS analysis endpoint)

KEEP (chat functions still call these):
  backend/src/routes/earnings.ts      (chat function get_earnings_analysis calls it)
  backend/src/routes/brief.ts         (chat function get_morning_brief calls it)
  backend/src/routes/macro.ts         (chat function get_macro_context calls it)
```

**Route registration cleanup (`backend/src/index.ts` or `backend/src/app.ts`):**
- Remove `app.use('/api/alerts', alertsRouter)`
- Remove `app.use('/api/scanner', scannerRouter)`
- Remove `app.use('/api/tracked-setups', trackedSetupsRouter)`
- Remove `app.use('/api/watchlist', watchlistRouter)`
- Remove `app.use('/api/leaps', leapsRouter)`

### 7.6 Backend Schema/Validation Deletion

```
DELETE:
  backend/src/schemas/alertsValidation.ts
  backend/src/schemas/alerts.ts
  backend/src/schemas/trackedSetupsValidation.ts
  backend/src/schemas/watchlistValidation.ts
```

### 7.7 Backend Service Cleanup

```
DELETE entirely:
  backend/src/services/leaps/           (LEAPS-specific service — no panel to serve)

KEEP (chat functions still call these):
  backend/src/services/scanner/         (scanOpportunities used by chat function)
  backend/src/services/macro/           (getMacroContext used by chat function)
  backend/src/services/earnings/        (getEarningsAnalysis used by chat function)
  backend/src/services/morningBrief/    (morningBriefService used by chat function)

MODIFY:
  backend/src/services/setupPushChannel.ts
    — Remove publishSetupStatusUpdate() if only tracked setups consumed it
    — Keep publishSetupDetected() if SPX Command Center uses it
```

### 7.8 ChatKit Function Registry Cleanup

**`backend/src/chatkit/functions.ts`** — Remove function definitions:
- `set_alert` — No alerts panel; simplify to chat confirmation toast
- `get_alerts` — No alerts panel to populate

**`backend/src/chatkit/functionHandlers.ts`** — Remove handlers:
- `set_alert` handler
- `get_alerts` handler

**Keep all analytical functions** — they return data as chat cards now:
- `scan_opportunities`, `get_earnings_analysis`, `get_macro_context`, `get_morning_brief`, `analyze_leaps_position`, `analyze_position`, `get_position_advice`, `calculate_roll_decision`

### 7.9 Database Table Archival

**Tables to archive (not drop immediately):**
```sql
-- Rename to archived_ prefix, keep data for 90 days
ALTER TABLE ai_coach_alerts RENAME TO archived_ai_coach_alerts;
ALTER TABLE ai_coach_watchlists RENAME TO archived_ai_coach_watchlists;
ALTER TABLE ai_coach_tracked_setups RENAME TO archived_ai_coach_tracked_setups;
ALTER TABLE ai_coach_leaps_positions RENAME TO archived_ai_coach_leaps_positions;
ALTER TABLE ai_coach_opportunities RENAME TO archived_ai_coach_opportunities;

-- Drop RLS policies on archived tables
-- Create migration: supabase/migrations/YYYYMMDD_archive_deleted_ai_coach_tables.sql
```

**After 90-day grace period, create a follow-up migration to DROP archived tables.**

### 7.10 Test File Cleanup

```
DELETE test files for deleted routes:
  backend/src/routes/__tests__/alerts.test.ts
  backend/src/routes/__tests__/scanner.test.ts
  backend/src/routes/__tests__/trackedSetups.test.ts
  backend/src/routes/__tests__/watchlist.test.ts

UPDATE test files that reference deleted features:
  backend/src/schemas/__tests__/validation.test.ts  (remove deleted schema tests)
  backend/src/chatkit/__tests__/*                   (remove deleted handler tests)

E2E tests:
  e2e/ai-coach-*.spec.ts                           (remove panel navigation tests)
```

### 7.11 Type Export Audit

After all deletions, run a dead-export scan:
```bash
# Find exported types/functions with zero consumers
pnpm exec tsc --noEmit                    # Ensure clean compile
pnpm exec eslint . --rule 'no-unused-vars: error'  # Catch unused imports
```

Any remaining orphaned exports in `lib/api/ai-coach.ts`, `contexts/AICoachWorkflowContext.tsx`, or `components/ai-coach/widget-actions.ts` get deleted in a final cleanup pass.

### 7.12 Bundle Size Verification

After cleanup:
```bash
pnpm run build
pnpm analyze    # Compare before/after bundle
```

**Expected reductions:**
- 11 deleted components (~15-25KB estimated)
- ~500 lines from API client
- Simpler context = less React re-rendering
- Fewer dynamic imports = smaller route chunk

### 7.13 Cleanup Execution Order

To avoid breaking the build at any intermediate step:

1. **Phase A — Chat cards first** (add new, break nothing)
   - Build enhanced widget-cards for earnings, macro, brief, position analysis
   - Verify chat functions render cards correctly

2. **Phase B — Stop routing to deleted views** (soft removal)
   - Remove deleted views from TABS, ROUTABLE_VIEWS, WelcomeView callbacks
   - Redirect any URL params for deleted views to 'chart'
   - Components still exist but are unreachable

3. **Phase C — Delete frontend components** (13 files)
   - Delete component files
   - Remove all imports from center-panel.tsx
   - Clean up WorkflowCenterView type
   - Run `tsc --noEmit` — fix any remaining references

4. **Phase D — Delete API client dead code** (~500 lines)
   - Remove types, interfaces, functions from lib/api/ai-coach.ts
   - Delete lib/ai-coach/tracked-setups.ts
   - Run `tsc --noEmit`

5. **Phase E — Delete backend routes & schemas** (5 route files + 4 schema files)
   - Delete route files
   - Remove route registrations from app entry
   - Delete schema/validation files
   - Delete backend service directories (leaps/)
   - Run backend `tsc --noEmit`

6. **Phase F — Clean chatkit function registry**
   - Remove set_alert/get_alerts from functions.ts and functionHandlers.ts
   - Update handler tests

7. **Phase G — Database migration**
   - Create archive migration for 6 tables
   - Apply via `npx supabase db push`
   - Run `get_advisors(type: "security")` to verify

8. **Phase H — Delete tests & final verification**
   - Delete test files for removed routes
   - Update E2E specs
   - Full validation gate: `eslint . && tsc --noEmit && pnpm build && vitest run`
   - Bundle size comparison

---

## Appendix A: Files to Delete

```
components/ai-coach/position-tracker.tsx
components/ai-coach/position-form.tsx
components/ai-coach/leaps-dashboard.tsx
components/ai-coach/alerts-panel.tsx
components/ai-coach/opportunity-scanner.tsx
components/ai-coach/tracked-setups-panel.tsx
components/ai-coach/watchlist-panel.tsx
components/ai-coach/workflow-breadcrumb.tsx
components/ai-coach/mobile-quick-access-bar.tsx
components/ai-coach/widget-action-bar-v2.tsx  (merge into v1)
components/ai-coach/earnings-dashboard.tsx     (after chat card replacement)
components/ai-coach/macro-context.tsx          (after chat card replacement)
components/ai-coach/morning-brief.tsx          (after chat card replacement)
```

## Appendix B: Backend Routes to Remove

```
backend/src/routes/alerts.ts        (or reduce to chat-function-only handler)
backend/src/routes/leaps.ts
backend/src/routes/trackedSetups.ts
backend/src/routes/watchlist.ts
```

## Appendix C: Function Registry Changes

**Remove from AI function registry:**
- `set_alert` → replace with simple chat confirmation flow
- `get_alerts` → remove (no alerts panel to populate)

**Keep but simplify:**
- `scan_opportunities` → returns chat card, no panel switch
- `analyze_leaps_position` → returns chat card, no panel switch
- `analyze_position` → returns chat card with `[Show on Chart]` action
- `get_position_advice` → returns chat card

**Consolidate:**
- `get_trade_history` + `get_trade_history_for_symbol` → single function with optional symbol param
- `get_journal_insights` → returns chat card with key patterns, `[Review Journal]` opens slide-over
