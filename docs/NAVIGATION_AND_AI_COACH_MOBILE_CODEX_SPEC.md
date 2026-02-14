# Navigation & AI Coach — Full Codex Implementation Spec

## Chat-First Luxury Rearchitecture: Mobile + Desktop (Path B)

**Version:** 3.0
**Date:** February 14, 2026
**Author:** Claude (Sr. UX Architect / Sr. Engineer)
**Status:** READY FOR CODEX EXECUTION
**Companion Audit:** `TITM-AI-Coach-Mobile-UX-Audit.html` (v2)

---

## TABLE OF CONTENTS

### Part A — Mobile Rearchitecture (Phases 1-7)
1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Existing Codebase Context](#3-existing-codebase-context)
4. [Architecture Decision](#4-architecture-decision)
5. [Implementation Order (Critical)](#5-implementation-order-critical)
6. [Phase 1: Mobile Event Bridge & State Unification](#6-phase-1-mobile-event-bridge--state-unification)
7. [Phase 2: Inline Chart Cards in Chat](#7-phase-2-inline-chart-cards-in-chat)
8. [Phase 3: Full-Screen Tool Sheets](#8-phase-3-full-screen-tool-sheets)
9. [Phase 4: Kill the Toggle — Chat-First Surface](#9-phase-4-kill-the-toggle--chat-first-surface)
10. [Phase 5: Quick-Access Bar & Welcome Slim](#10-phase-5-quick-access-bar--welcome-slim)
11. [Phase 6: Navigation System Fixes](#11-phase-6-navigation-system-fixes)
12. [Phase 7: Polish, Accessibility & Swipe](#12-phase-7-polish-accessibility--swipe)

### Part B — Desktop Enhancement (Phases 8-13)
13. [Phase 8: Widget Action Feedback Pulse](#13-phase-8-widget-action-feedback-pulse)
14. [Phase 9: Inline Chart Cards on Desktop](#14-phase-9-inline-chart-cards-on-desktop)
15. [Phase 10: Context Strip — Replace Welcome Dashboard](#15-phase-10-context-strip--replace-welcome-dashboard)
16. [Phase 11: Floating Mini-Chat on Collapse](#16-phase-11-floating-mini-chat-on-collapse)
17. [Phase 12: Grouped Tab Rail & Session Restore](#17-phase-12-grouped-tab-rail--session-restore)
18. [Phase 13: Cross-Panel Hover Coordination](#18-phase-13-cross-panel-hover-coordination)

### Part C — Widget Optimization (Phase 14)
19. [Phase 14: Widget Action Optimization](#19-phase-14-widget-action-optimization)

### Shared Sections
20. [Testing Requirements](#20-testing-requirements)
21. [Acceptance Criteria](#21-acceptance-criteria)
22. [Files Touched Summary](#22-files-touched-summary)
23. [Validation Commands](#23-validation-commands)

---

## 1. EXECUTIVE SUMMARY

The AI Coach mobile experience currently has **three competing navigation systems** (binary Chat/Chart toggle, 12-tab rail, floating Tools sheet) that expose the same 14+ destinations through different entry points. Users encounter dead-end widget actions, unmounted state on toggle, and a Welcome view that acts as a second dashboard competing with the chat empty state.

This spec implements a **chat-first luxury rearchitecture** across both mobile and desktop:

### Mobile (Phases 1-7)
- Chat is the **permanent** mobile surface (never unmounts)
- Charts and data appear **inline** within chat as interactive cards
- Tools open as **full-screen sheets** that slide over chat (preserving state)
- A slim **quick-access bar** replaces the Welcome dashboard, toggle, tab rail, and Tools FAB

### Desktop (Phases 8-13)
- **Widget action feedback pulse** — CenterPanel border flashes when a widget fires, so users know something changed
- **Inline chart cards in desktop chat** — same mini chart cards as mobile, clicking focuses CenterPanel
- **Context strip replaces Welcome dashboard** — slim SPX ticker + market status + next setup always visible above CenterPanel, default view is Chart instead of Welcome
- **Floating mini-chat on collapse** — when chat panel is collapsed, a draggable mini-chat overlay shows recent messages and input
- **Grouped tab rail** — tab clusters with persistent group labels, dropdown on narrow desktops
- **Cross-panel hover coordination** — hover a level name in chat → pulses chart annotation, hover chart level → highlights chat message
- **Session restore** — persist `activeView`, `chartSymbol`, `chartTimeframe` to preferences and restore on mount

**Estimated effort:** 20–25 hours mobile (Phases 1-7) + 15–20 hours desktop (Phases 8-13) = ~35-45 hours total.

---

## 2. PROBLEM STATEMENT

### The Three Layers Problem

| Layer | What it does | Mobile UX issue |
|-------|-------------|-----------------|
| **Toggle Bar** (page.tsx L188-213) | Binary Chat ↔ "Chart" switch | Unmounts inactive view, destroying state. Label says "Chart" but leads to 14-view CenterPanel. |
| **Tab Rail** (center-panel.tsx L681-796) | 12 tabs + Home + Settings | Only visible when CenterPanel is mounted AND not on Welcome. Hidden on mobile unless toggle is on "Chart". |
| **Tools FAB/Sheet** (center-panel.tsx L1000-1078) | Floating button → bottom sheet with 13 tools | Only visible when CenterPanel is mounted. Overlaps with tab rail and Welcome quick-access cards. |

### Dead Widget Actions on Mobile

5 of 7 widget action types (`chartAction`, `optionsAction`, `alertAction`, `analyzeAction`, `viewAction` in `widget-actions.ts`) dispatch `CustomEvent`s that are caught by `AICoachWorkflowContext`, which sets `activeCenterView`. But on mobile the CenterPanel is unmounted when viewing chat, so **widget buttons are dead** — the user taps "Show on Chart" and nothing happens.

### Root Cause

```
page.tsx L101: const [mobileView, setMobileView] = useState<'chat' | 'center'>('chat')
page.tsx L281: {mobileView === 'chat' ? <ChatArea/> : <CenterPanel/>}
```

Conditional rendering unmounts the inactive component. No bridge exists between widget `CustomEvent`s and the page-level `mobileView` state.

---

## 3. EXISTING CODEBASE CONTEXT

### Tech Stack (Must Match)
- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- **UI:** Shadcn/UI base, Radix primitives, Framer Motion, Lucide React
- **State:** React Context (`AICoachWorkflowContext`), component-level `useState`
- **Chat:** `useAICoachChat` hook (streaming, sessions, image upload)
- **Charts:** `TradingChart` (dynamic import, Lightweight Charts)
- **Backend:** Express.js + OpenAI function calling, Supabase PostgreSQL
- **Data:** Massive.com API (stocks, options, indices)
- **Design System:** Emerald Standard (#10B981), Champagne (#F3E5AB), dark-only (#0A0A0B)
- **Testing:** Vitest (unit), Playwright (E2E)

### Key Files
| File | Lines | Role |
|------|-------|------|
| `app/members/ai-coach/page.tsx` | ~897 | Page layout, mobile toggle, ChatArea, EmptyState |
| `components/ai-coach/center-panel.tsx` | ~1745 | CenterPanel: 16 views, tab rail, tools sheet, welcome |
| `components/ai-coach/chat-message.tsx` | ~265 | Chat bubble renderer, MarkdownRenderer, TypingIndicator |
| `components/ai-coach/widget-cards.tsx` | ~800+ | Inline widget cards from function calls |
| `components/ai-coach/widget-actions.ts` | ~175 | Widget action dispatchers (CustomEvent) |
| `components/ai-coach/follow-up-chips.tsx` | ~152 | Context-aware suggestion pills |
| `contexts/AICoachWorkflowContext.tsx` | ~300+ | Workflow state, widget event listeners |
| `hooks/use-ai-coach-chat.ts` | ~500+ | Chat state, streaming, chartRequest extraction |
| `components/members/mobile-bottom-nav.tsx` | ~200+ | Member bottom nav (hardcoded tabs) |
| `contexts/MemberAuthContext.tsx` | ~970+ | Auth, `getMobileTabs()` (unused by bottom nav) |

### Existing Tests
- **Vitest unit:** `components/ai-coach/__tests__/chart-level-utils.test.ts`, `chart-level-labels.test.ts`
- **Playwright E2E:** `e2e/specs/ai-coach/` (6 spec files: api, reasoning, views, chart-labels, workflow, widget-actions-audit, fibonacci-levels)
- **Playwright config:** `ai-coach` project (Desktop Chrome), `mobile` project (iPhone 13), `mobile-members` project (Pixel 7)

---

## 4. ARCHITECTURE DECISION

### Before (Current)

```
Mobile AI Coach
├── Toggle Bar: [Chat] [Chart]  ← Binary, unmounts inactive
├── Chat Surface (when toggle = chat)
│   ├── Sessions sidebar
│   ├── Messages with widget cards
│   ├── Follow-up chips → dispatch events → DEAD (CenterPanel unmounted)
│   └── Input bar
└── CenterPanel (when toggle = center)
    ├── Welcome View (acts as second dashboard)
    │   ├── SPX ticker, market status
    │   ├── 4 prompt cards → fire prompt → boomerang to chat
    │   ├── 8 quick-access cards → navigate to tool views
    │   └── 4 "More Tools" secondary cards
    ├── Tab Rail (12 tabs + Home + Settings)
    ├── 14 tool views (chart, options, journal, etc.)
    └── Tools FAB → bottom sheet (13 buttons, same as tab rail)
```

### After (Path B)

```
Mobile AI Coach
├── Quick-Access Bar (slim, always visible above input)
│   ├── 5–6 icon-only buttons: Chart, Options, Scanner, Brief, Journal, More
│   └── "More" opens categorized tool sheet
├── Chat Surface (ALWAYS mounted, never unmounts)
│   ├── Collapsible sessions drawer
│   ├── Messages with:
│   │   ├── Widget cards (existing)
│   │   ├── NEW: Inline chart cards (mini TradingChart, tappable for full-screen)
│   │   └── Follow-up chips → work correctly via event bridge
│   └── Input bar
└── Full-Screen Tool Sheets (slide up OVER chat, don't replace it)
    ├── Sheet: Chart (full TradingChart with toolbar)
    ├── Sheet: Options Chain
    ├── Sheet: Position Tracker
    ├── Sheet: Scanner
    ├── Sheet: Journal
    ├── Sheet: Alerts
    ├── Sheet: Morning Brief
    ├── Sheet: LEAPS / Earnings / Macro / Watchlist / Tracked
    └── Sheet: Preferences
```

### Key Principles

1. **Chat never unmounts.** All mobile navigation happens via overlays/sheets.
2. **Charts appear inline first**, then tap-to-expand to full-screen sheet.
3. **One navigation layer** on mobile (quick-access bar), not three.
4. **Desktop is unchanged.** All changes are gated behind `lg:hidden` / `lg:flex` / `useMediaQuery`.
5. **Widget events work everywhere** because ChatArea is always mounted.

---

## 5. IMPLEMENTATION ORDER (CRITICAL)

Each phase must produce a working, testable state. Phases are sequential — later phases depend on earlier ones.

```
── Part A: Mobile ──────────────────────────────────────────────────
Phase 1:  Event Bridge       → Widget actions work on mobile (fixes 5 dead actions)
Phase 2:  Inline Chart Cards → Charts render inside chat messages
Phase 3:  Tool Sheets        → Full-screen overlays for all 14 views
Phase 4:  Kill the Toggle    → Chat-first surface, CenterPanel always mounted (hidden)
Phase 5:  Quick-Access Bar   → Slim navigation replaces toggle, tab rail, FAB
Phase 6:  Nav System Fixes   → Bottom nav uses admin config, dead links fixed
Phase 7:  Polish             → Swipe gestures, accessibility, animations

── Part B: Desktop ─────────────────────────────────────────────────
Phase 8:  Feedback Pulse     → Visual indicator when widget action changes CenterPanel
Phase 9:  Desktop Inline     → Same InlineMiniChart in desktop chat panel
Phase 10: Context Strip      → Slim persistent header replaces Welcome dashboard
Phase 11: Mini-Chat Float    → Draggable overlay when chat panel is collapsed
Phase 12: Tab Rail & Restore → Grouped tabs with labels, session view persistence
Phase 13: Hover Coordination → Cross-panel level/symbol highlighting
```

**Dependency note:** Phases 8-13 can be implemented after Phases 1-7, or in parallel on a separate branch. Phase 9 depends on Phase 2 (reuses `InlineMiniChart`). All other desktop phases are independent of mobile phases.

---

## 6. PHASE 1: MOBILE EVENT BRIDGE & STATE UNIFICATION

**Goal:** Make all 7 widget action types work on mobile by bridging `CustomEvent`s to page-level state.

### Task 1.1: Add `useMobileToolSheet` hook

**Create:** `hooks/use-mobile-tool-sheet.ts`

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'

export type MobileToolView =
  | 'chart'
  | 'options'
  | 'position'
  | 'screenshot'
  | 'journal'
  | 'alerts'
  | 'brief'
  | 'scanner'
  | 'tracked'
  | 'leaps'
  | 'earnings'
  | 'macro'
  | 'watchlist'
  | 'preferences'

interface MobileToolSheetState {
  activeSheet: MobileToolView | null
  sheetSymbol: string | null
  sheetParams: Record<string, unknown>
}

export function useMobileToolSheet() {
  const [state, setState] = useState<MobileToolSheetState>({
    activeSheet: null,
    sheetSymbol: null,
    sheetParams: {},
  })

  const openSheet = useCallback((view: MobileToolView, symbol?: string, params?: Record<string, unknown>) => {
    setState({
      activeSheet: view,
      sheetSymbol: symbol ?? null,
      sheetParams: params ?? {},
    })
  }, [])

  const closeSheet = useCallback(() => {
    setState({ activeSheet: null, sheetSymbol: null, sheetParams: {} })
  }, [])

  // Listen for widget events and bridge them to sheet state
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Only activate on mobile
    const isMobile = () => window.innerWidth < 1024

    const handleChart = (e: Event) => {
      if (!isMobile()) return
      const detail = (e as CustomEvent).detail
      openSheet('chart', detail?.symbol, {
        level: detail?.level,
        timeframe: detail?.timeframe,
        label: detail?.label,
      })
    }

    const handleOptions = (e: Event) => {
      if (!isMobile()) return
      const detail = (e as CustomEvent).detail
      openSheet('options', detail?.symbol, {
        strike: detail?.strike,
        expiry: detail?.expiry,
      })
    }

    const handleAlert = (e: Event) => {
      if (!isMobile()) return
      const detail = (e as CustomEvent).detail
      openSheet('alerts', detail?.symbol, {
        price: detail?.price,
        alertType: detail?.alertType,
        notes: detail?.notes,
      })
    }

    const handleAnalyze = (e: Event) => {
      if (!isMobile()) return
      const detail = (e as CustomEvent).detail
      openSheet('position', detail?.setup?.symbol, { setup: detail?.setup })
    }

    const handleView = (e: Event) => {
      if (!isMobile()) return
      const detail = (e as CustomEvent).detail
      const view = detail?.view as MobileToolView | undefined
      if (view) openSheet(view, detail?.symbol)
    }

    window.addEventListener('ai-coach-widget-chart', handleChart)
    window.addEventListener('ai-coach-widget-options', handleOptions)
    window.addEventListener('ai-coach-widget-alert', handleAlert)
    window.addEventListener('ai-coach-widget-analyze', handleAnalyze)
    window.addEventListener('ai-coach-widget-view', handleView)

    return () => {
      window.removeEventListener('ai-coach-widget-chart', handleChart)
      window.removeEventListener('ai-coach-widget-options', handleOptions)
      window.removeEventListener('ai-coach-widget-alert', handleAlert)
      window.removeEventListener('ai-coach-widget-analyze', handleAnalyze)
      window.removeEventListener('ai-coach-widget-view', handleView)
    }
  }, [openSheet])

  return { ...state, openSheet, closeSheet }
}
```

### Task 1.2: Wire hook into page.tsx

**File:** `app/members/ai-coach/page.tsx`

1. Import the new hook at the top:
```typescript
import { useMobileToolSheet, type MobileToolView } from '@/hooks/use-mobile-tool-sheet'
```

2. Inside `AICoachPage()`, after `const chat = useAICoachChat()` (line ~100), add:
```typescript
const mobileSheet = useMobileToolSheet()
```

3. Pass `mobileSheet` down to the mobile container (will be used in Phase 3).

### Task 1.3: Unit test for event bridge

**Create:** `hooks/__tests__/use-mobile-tool-sheet.test.ts`

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMobileToolSheet } from '../use-mobile-tool-sheet'

describe('useMobileToolSheet', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    // Simulate mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true })
  })

  it('starts with no active sheet', () => {
    const { result } = renderHook(() => useMobileToolSheet())
    expect(result.current.activeSheet).toBeNull()
    expect(result.current.sheetSymbol).toBeNull()
  })

  it('opens sheet when chart widget event fires on mobile', () => {
    const { result } = renderHook(() => useMobileToolSheet())
    act(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-chart', {
        detail: { symbol: 'SPX', level: 6100, timeframe: '5m' },
      }))
    })
    expect(result.current.activeSheet).toBe('chart')
    expect(result.current.sheetSymbol).toBe('SPX')
    expect(result.current.sheetParams).toMatchObject({ level: 6100, timeframe: '5m' })
  })

  it('ignores widget events on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true })
    const { result } = renderHook(() => useMobileToolSheet())
    act(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-chart', {
        detail: { symbol: 'SPX' },
      }))
    })
    expect(result.current.activeSheet).toBeNull()
  })

  it('closes sheet correctly', () => {
    const { result } = renderHook(() => useMobileToolSheet())
    act(() => result.current.openSheet('options', 'AAPL'))
    expect(result.current.activeSheet).toBe('options')
    act(() => result.current.closeSheet())
    expect(result.current.activeSheet).toBeNull()
  })

  it('bridges all 5 widget event types', () => {
    const { result } = renderHook(() => useMobileToolSheet())

    const events = [
      { name: 'ai-coach-widget-chart', expected: 'chart' },
      { name: 'ai-coach-widget-options', expected: 'options' },
      { name: 'ai-coach-widget-alert', expected: 'alerts' },
      { name: 'ai-coach-widget-analyze', expected: 'position' },
      { name: 'ai-coach-widget-view', expected: 'brief' },
    ]

    for (const { name, expected } of events) {
      act(() => {
        const detail = name === 'ai-coach-widget-view'
          ? { view: 'brief', symbol: 'SPX' }
          : name === 'ai-coach-widget-analyze'
            ? { setup: { symbol: 'SPX', type: 'call' } }
            : { symbol: 'SPX' }
        window.dispatchEvent(new CustomEvent(name, { detail }))
      })
      expect(result.current.activeSheet).toBe(expected)
      act(() => result.current.closeSheet())
    }
  })
})
```

---

## 7. PHASE 2: INLINE CHART CARDS IN CHAT

**Goal:** When the AI returns a chart request, render a mini interactive chart card inside the chat message instead of silently switching to the CenterPanel chart view.

### Task 2.1: Create `InlineMiniChart` component

**Create:** `components/ai-coach/inline-mini-chart.tsx`

This component renders a 200px-tall, non-interactive TradingChart preview with key levels, inside a chat bubble. Tapping it opens the full chart sheet (Phase 3).

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { CandlestickChart, Maximize2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChartSkeleton } from './skeleton-loaders'
import type { ChartRequest } from './center-panel'
import type { ChartBar } from '@/lib/api/ai-coach'

// Dynamic import for the chart — only loads when needed
const TradingChart = dynamic(
  () => import('./trading-chart').then(mod => ({ default: mod.TradingChart })),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> }
)

interface InlineMiniChartProps {
  chartRequest: ChartRequest
  accessToken?: string
  onExpand?: () => void
  className?: string
}

export function InlineMiniChart({ chartRequest, accessToken, onExpand, className }: InlineMiniChartProps) {
  const [bars, setBars] = useState<ChartBar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChart = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const { getChartData } = await import('@/lib/api/ai-coach')
      const data = await getChartData(
        chartRequest.symbol,
        chartRequest.timeframe,
        accessToken
      )
      setBars(data.bars)
    } catch {
      setError('Chart unavailable')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, chartRequest.symbol, chartRequest.timeframe])

  useEffect(() => {
    void loadChart()
  }, [loadChart])

  // Build level annotations from chartRequest
  const levels = buildLevelAnnotations(chartRequest)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-white/10 bg-black/30 overflow-hidden mt-2',
        'cursor-pointer hover:border-emerald-500/30 transition-colors group',
        className
      )}
      onClick={onExpand}
      role="button"
      aria-label={`Expand ${chartRequest.symbol} chart to full screen`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExpand?.() }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white">{chartRequest.symbol}</span>
          <span className="text-[10px] text-white/40">{chartRequest.timeframe}</span>
        </div>
        <Maximize2 className="w-3 h-3 text-white/30 group-hover:text-emerald-400 transition-colors" />
      </div>

      {/* Chart area */}
      <div className="h-[200px] relative">
        {isLoading ? (
          <ChartSkeleton height={200} />
        ) : error ? (
          <div className="flex items-center justify-center h-full text-xs text-white/30">{error}</div>
        ) : (
          <TradingChart
            symbol={chartRequest.symbol}
            bars={bars}
            levels={levels}
            height={200}
            horzTouchDrag={false}
            vertTouchDrag={false}
            timeVisible={false}
            rightPriceScale={{ visible: true, borderVisible: false }}
          />
        )}
      </div>
    </motion.div>
  )
}

// Helper: convert ChartRequest levels to LevelAnnotation[]
function buildLevelAnnotations(req: ChartRequest) {
  // Implementation: map req.levels.resistance, req.levels.support, req.levels.fibonacci
  // into the LevelAnnotation[] format used by TradingChart
  // Use the existing LEVEL_COLORS map from center-panel.tsx
  const annotations: Array<{
    price: number
    label: string
    color: string
    lineWidth: number
    lineStyle: 'solid' | 'dashed'
  }> = []

  const LEVEL_COLORS: Record<string, string> = {
    PDH: '#ef4444', PMH: '#f97316', R1: '#ef4444', R2: '#dc2626',
    PDL: '#10B981', PML: '#22d3ee', S1: '#10B981', S2: '#059669',
    PP: '#f3e5ab', VWAP: '#eab308',
  }

  for (const level of req.levels?.resistance ?? []) {
    const key = level.name?.toUpperCase().replace(/\s+/g, '') ?? 'R'
    annotations.push({
      price: level.price,
      label: level.displayLabel || level.name || 'Resistance',
      color: LEVEL_COLORS[key] || '#ef4444',
      lineWidth: level.strength === 'strong' || level.strength === 'critical' ? 2 : 1,
      lineStyle: level.strength === 'dynamic' ? 'dashed' : 'solid',
    })
  }

  for (const level of req.levels?.support ?? []) {
    const key = level.name?.toUpperCase().replace(/\s+/g, '') ?? 'S'
    annotations.push({
      price: level.price,
      label: level.displayLabel || level.name || 'Support',
      color: LEVEL_COLORS[key] || '#10B981',
      lineWidth: level.strength === 'strong' || level.strength === 'critical' ? 2 : 1,
      lineStyle: level.strength === 'dynamic' ? 'dashed' : 'solid',
    })
  }

  for (const fib of req.levels?.fibonacci ?? []) {
    annotations.push({
      price: fib.price,
      label: fib.name,
      color: '#a78bfa',
      lineWidth: fib.isMajor ? 2 : 1,
      lineStyle: 'dashed',
    })
  }

  if (req.levels?.indicators?.vwap) {
    annotations.push({
      price: req.levels.indicators.vwap,
      label: 'VWAP',
      color: '#eab308',
      lineWidth: 2,
      lineStyle: 'solid',
    })
  }

  return annotations
}
```

### Task 2.2: Integrate inline chart into chat message

**File:** `components/ai-coach/chat-message.tsx`

After the widget cards section (line ~101), add inline chart rendering:

1. Add import at top:
```typescript
import { InlineMiniChart } from './inline-mini-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
```

2. Update `ChatMessageProps`:
```typescript
interface ChatMessageProps {
  message: ChatMessage
  onSendPrompt?: (prompt: string) => void
  onExpandChart?: (chartRequest: ChartRequest) => void
}
```

3. Inside `ChatMessageBubble`, after the widgets section (~line 101), add:
```typescript
{/* Inline chart card */}
{!isUser && message.chartRequest && (
  <InlineMiniChart
    chartRequest={message.chartRequest}
    accessToken={session?.access_token}
    onExpand={() => onExpandChart?.(message.chartRequest!)}
  />
)}
```

### Task 2.3: Attach `chartRequest` to messages

**File:** `hooks/use-ai-coach-chat.ts`

Currently `extractChartRequest()` returns a single `chartRequest` at the hook level. We need to also attach it to individual messages:

1. In the `ChatMessage` type, add:
```typescript
chartRequest?: ChartRequest | null
```

2. When a streaming message completes (the `done` event), run `extractChartRequest()` on that message's function calls and attach the result:
```typescript
// Inside the stream event handler, when type === 'done':
const completedMessage = { ...currentMessage }
completedMessage.chartRequest = extractChartRequest(completedMessage.functionCalls)
```

---

## 8. PHASE 3: FULL-SCREEN TOOL SHEETS

**Goal:** Create a reusable full-screen sheet component that slides up from the bottom on mobile, rendering any CenterPanel view without unmounting the chat.

### Task 3.1: Create `MobileToolSheet` component

**Create:** `components/ai-coach/mobile-tool-sheet.tsx`

```typescript
'use client'

import { useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MobileToolView } from '@/hooks/use-mobile-tool-sheet'

interface MobileToolSheetProps {
  activeSheet: MobileToolView | null
  onClose: () => void
  children: React.ReactNode
}

const SHEET_LABELS: Record<MobileToolView, string> = {
  chart: 'Live Chart',
  options: 'Options Chain',
  position: 'Position Analyzer',
  screenshot: 'Screenshot Upload',
  journal: 'Trade Journal',
  alerts: 'Alerts',
  brief: 'Daily Brief',
  scanner: 'Opportunity Scanner',
  tracked: 'Tracked Setups',
  leaps: 'LEAPS Dashboard',
  earnings: 'Earnings',
  macro: 'Macro Context',
  watchlist: 'Watchlist',
  preferences: 'Settings',
}

export function MobileToolSheet({ activeSheet, onClose, children }: MobileToolSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!activeSheet) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSheet, onClose])

  // Trap focus inside sheet
  useEffect(() => {
    if (!activeSheet || !sheetRef.current) return
    const firstFocusable = sheetRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }, [activeSheet])

  return (
    <AnimatePresence>
      {activeSheet && (
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0A0A0B]"
          role="dialog"
          aria-modal="true"
          aria-label={SHEET_LABELS[activeSheet]}
        >
          {/* Sheet header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-medium text-white">
              {SHEET_LABELS[activeSheet]}
            </h3>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs text-white/45 hover:text-white transition-colors rounded-lg px-2 py-1.5 hover:bg-white/5"
              aria-label="Close sheet"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Close
            </button>
          </div>

          {/* Sheet content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Task 3.2: Render tool views inside sheet

**File:** `app/members/ai-coach/page.tsx`

In the mobile section, after the `ChatArea` render, add:

```typescript
import { MobileToolSheet } from '@/components/ai-coach/mobile-tool-sheet'

// Inside the mobile container (currently L276-302), REPLACE the conditional render with:
<div className="lg:hidden h-full relative">
  {/* Chat is ALWAYS mounted on mobile */}
  <ChatArea
    messages={chat.messages}
    sessions={chat.sessions}
    currentSessionId={chat.currentSessionId}
    isSending={chat.isSending}
    isLoadingSessions={chat.isLoadingSessions}
    isLoadingMessages={chat.isLoadingMessages}
    error={chat.error}
    rateLimitInfo={chat.rateLimitInfo}
    onSendMessage={chat.sendMessage}
    onNewSession={chat.newSession}
    onSelectSession={chat.selectSession}
    onDeleteSession={chat.deleteSession}
    onClearError={chat.clearError}
    onAppendUserMessage={chat.appendUserMessage}
    onAppendAssistantMessage={chat.appendAssistantMessage}
  />

  {/* Full-screen tool sheets — slide over chat */}
  <MobileToolSheet
    activeSheet={mobileSheet.activeSheet}
    onClose={mobileSheet.closeSheet}
  >
    {mobileSheet.activeSheet && (
      <CenterPanel
        onSendPrompt={handleSendPrompt}
        chartRequest={chat.chartRequest}
        forcedView={mobileSheet.activeSheet}
        sheetParams={mobileSheet.sheetParams}
      />
    )}
  </MobileToolSheet>
</div>
```

### Task 3.3: Add `forcedView` prop to CenterPanel

**File:** `components/ai-coach/center-panel.tsx`

1. Update `CenterPanelProps`:
```typescript
interface CenterPanelProps {
  onSendPrompt?: (prompt: string) => void
  chartRequest?: ChartRequest | null
  forcedView?: CenterView   // NEW: when set, CenterPanel renders this view directly
  sheetParams?: Record<string, unknown>  // NEW: params from widget events
}
```

2. In the component body, add a `useEffect` that respects `forcedView`:
```typescript
useEffect(() => {
  if (forcedView && forcedView !== activeView) {
    setActiveView(forcedView)
    setCenterView(forcedView as Parameters<typeof setCenterView>[0])
    if (forcedView === 'chart') {
      fetchChartData(chartSymbol, chartTimeframe)
    }
  }
}, [forcedView])
```

3. When `forcedView` is set, **hide** the tab rail, Welcome view, and Tools FAB:
```typescript
const isSheetMode = !!forcedView

// Wrap tab rail condition:
{activeView !== 'welcome' && activeView !== 'onboarding' && !isSheetMode && (
  // ... existing tab rail
)}

// Wrap Tools FAB:
{!isSheetMode && (
  <motion.button onClick={() => setIsToolsSheetOpen(true)} ... />
)}
```

---

## 9. PHASE 4: KILL THE TOGGLE — CHAT-FIRST SURFACE

**Goal:** Remove the binary `Chat`/`Chart` toggle on mobile. Chat is the default and only surface. Tool sheets replace the toggle.

### Task 4.1: Remove mobile toggle bar

**File:** `app/members/ai-coach/page.tsx`

1. **Delete** the toggle bar block (lines ~188-213):
```typescript
// DELETE this entire block:
<div className="flex gap-1 p-1 mx-4 mt-2 rounded-lg bg-white/5 border border-white/10 lg:hidden">
  ... Chat button ...
  ... Chart button ...
</div>
```

2. **Remove** the `mobileView` state variable (line ~101):
```typescript
// DELETE: const [mobileView, setMobileView] = useState<'chat' | 'center'>('chat')
```

3. **Remove** `setMobileView('chat')` from `handleSendPrompt` (line ~108):
```typescript
// BEFORE:
const handleSendPrompt = useCallback((prompt: string) => {
  chat.sendMessage(prompt)
  setMobileView('chat')  // DELETE this line
}, [chat])

// AFTER:
const handleSendPrompt = useCallback((prompt: string) => {
  chat.sendMessage(prompt)
}, [chat])
```

4. **Remove** `setMobileView` from keyboard handler (lines ~153-154):
```typescript
// DELETE: setMobileView('chat') in the Cmd+K handler
```

5. **Remove** the swipe gesture handlers (`handleMobileTouchStart`, `handleMobileTouchEnd`, lines ~127-143) since there's no toggle to swipe between.

6. **Remove** the conditional render (lines ~281-301) — already replaced in Phase 3.

### Task 4.2: Remove swipe touch handlers

**File:** `app/members/ai-coach/page.tsx`

Delete:
- `mobileTouchStartRef` (line ~104)
- `handleMobileTouchStart` (lines ~127-130)
- `handleMobileTouchEnd` (lines ~132-143)
- `onTouchStart` / `onTouchEnd` on the mobile container div (lines ~278-279)

### Task 4.3: Close sheet when `handleSendPrompt` fires

When a user taps a prompt from inside a tool sheet, the sheet should close and the chat should show:

```typescript
const handleSendPrompt = useCallback((prompt: string) => {
  chat.sendMessage(prompt)
  mobileSheet.closeSheet()  // NEW: close any open tool sheet
}, [chat, mobileSheet])
```

---

## 10. PHASE 5: QUICK-ACCESS BAR & WELCOME SLIM

**Goal:** Add a slim icon bar above the chat input on mobile that gives quick access to the most-used tools. Replace the Welcome dashboard with a slim greeting in the empty state.

### Task 5.1: Create `MobileQuickAccessBar` component

**Create:** `components/ai-coach/mobile-quick-access-bar.tsx`

```typescript
'use client'

import { useState } from 'react'
import {
  CandlestickChart,
  TableProperties,
  Search,
  Sunrise,
  BookOpen,
  Grid3X3,
  Bell,
  Calculator,
  Clock,
  Globe,
  Calendar,
  ListChecks,
  List,
  Settings,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MobileToolView } from '@/hooks/use-mobile-tool-sheet'

interface QuickAccessBarProps {
  onOpenSheet: (view: MobileToolView) => void
  hasActiveChart?: boolean
}

const PRIMARY_TOOLS: Array<{ view: MobileToolView; icon: typeof CandlestickChart; label: string }> = [
  { view: 'chart', icon: CandlestickChart, label: 'Chart' },
  { view: 'options', icon: TableProperties, label: 'Options' },
  { view: 'scanner', icon: Search, label: 'Scanner' },
  { view: 'brief', icon: Sunrise, label: 'Brief' },
  { view: 'journal', icon: BookOpen, label: 'Journal' },
]

const ALL_TOOLS: Array<{
  group: string
  items: Array<{ view: MobileToolView; icon: typeof CandlestickChart; label: string }>
}> = [
  {
    group: 'Analyze',
    items: [
      { view: 'chart', icon: CandlestickChart, label: 'Live Chart' },
      { view: 'options', icon: TableProperties, label: 'Options Chain' },
      { view: 'position', icon: Calculator, label: 'Position Analyzer' },
      { view: 'scanner', icon: Search, label: 'Opportunity Scanner' },
    ],
  },
  {
    group: 'Portfolio',
    items: [
      { view: 'journal', icon: BookOpen, label: 'Trade Journal' },
      { view: 'tracked', icon: ListChecks, label: 'Tracked Setups' },
    ],
  },
  {
    group: 'Monitor',
    items: [
      { view: 'alerts', icon: Bell, label: 'Alerts' },
      { view: 'watchlist', icon: List, label: 'Watchlist' },
      { view: 'brief', icon: Sunrise, label: 'Daily Brief' },
    ],
  },
  {
    group: 'Research',
    items: [
      { view: 'leaps', icon: Clock, label: 'LEAPS' },
      { view: 'earnings', icon: Calendar, label: 'Earnings' },
      { view: 'macro', icon: Globe, label: 'Macro Context' },
    ],
  },
]

export function MobileQuickAccessBar({ onOpenSheet }: QuickAccessBarProps) {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {/* Slim quick-access bar */}
      <div className="lg:hidden flex items-center gap-1 px-3 py-1.5 border-t border-white/5">
        {PRIMARY_TOOLS.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            onClick={() => onOpenSheet(view)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            aria-label={label}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ml-auto',
            showMore
              ? 'text-emerald-300 bg-emerald-500/10'
              : 'text-white/40 hover:text-white/60'
          )}
          aria-label="More tools"
          aria-expanded={showMore}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* More tools sheet (bottom sheet) */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-white/5"
          >
            <div className="px-3 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
              {ALL_TOOLS.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/25 mb-1.5">{group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(({ view, icon: Icon, label }) => (
                      <button
                        key={view}
                        onClick={() => {
                          onOpenSheet(view)
                          setShowMore(false)
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/3 text-white/60 hover:text-white hover:bg-white/5 hover:border-emerald-500/20 transition-all text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-emerald-400/60" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  onOpenSheet('preferences')
                  setShowMore(false)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/3 text-white/40 hover:text-white transition-all w-full text-left"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="text-xs">Settings</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```

### Task 5.2: Wire quick-access bar into page

**File:** `app/members/ai-coach/page.tsx`

In the mobile `ChatArea` container, add the quick-access bar between the messages area and the input:

```typescript
import { MobileQuickAccessBar } from '@/components/ai-coach/mobile-quick-access-bar'

// Inside the mobile container, after ChatArea:
<MobileQuickAccessBar onOpenSheet={mobileSheet.openSheet} />
```

Alternatively, the quick-access bar should render **inside** `ChatArea` on mobile, just above the input form. This requires either:
- Passing `onOpenSheet` to `ChatArea` as a prop, or
- Using a context to provide `openSheet`

Recommended approach: Pass as prop.

1. Add to `ChatAreaProps`:
```typescript
onOpenSheet?: (view: MobileToolView) => void
```

2. Inside `ChatArea`, just before the input `<form>`, render:
```typescript
{onOpenSheet && <MobileQuickAccessBar onOpenSheet={onOpenSheet} />}
```

### Task 5.3: Slim down EmptyState for mobile

**File:** `app/members/ai-coach/page.tsx`

The current `EmptyState` (lines ~859-897) is fine for both mobile and desktop — it's already a clean grid of quick prompts. No changes needed here since the Welcome dashboard was part of CenterPanel, which is no longer the default mobile surface.

However, add a time-aware greeting to `EmptyState`:

```typescript
function EmptyState({ onSendPrompt }: { onSendPrompt: (prompt: string) => void }) {
  const bucket = getEasternPlaceholderBucket()
  const contextLine = bucket === 'pre_market' ? 'Pre-market prep mode'
    : bucket === 'session' ? 'Markets are open'
    : bucket === 'after_hours' ? 'After-hours review'
    : 'Markets are closed'

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm">
        {/* ... existing BrainCircuit animation ... */}
        <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-400/60 mb-2">{contextLine}</p>
        <h3 className="text-base font-medium text-white mb-2">
          What are you trading today?
        </h3>
        {/* ... rest unchanged ... */}
      </div>
    </div>
  )
}
```

---

## 11. PHASE 6: NAVIGATION SYSTEM FIXES

**Goal:** Fix the member-wide navigation issues identified in the navigation audit.

### Task 6.1: Wire `getMobileTabs()` into bottom nav

**File:** `components/members/mobile-bottom-nav.tsx`

**Problem:** `PRIMARY_TABS` is hardcoded (line ~27-32), ignoring `getMobileTabs()` from `MemberAuthContext`.

**Fix:**
1. Import and use the context:
```typescript
import { useMemberAuth } from '@/contexts/MemberAuthContext'

// Inside MemberBottomNav:
const { getMobileTabs } = useMemberAuth()
const dynamicTabs = getMobileTabs?.() ?? []
```

2. Map dynamic tabs to `NavTab[]`, falling back to `PRIMARY_TABS` if empty:
```typescript
const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  journal: BookOpen,
  'ai-coach': Bot,
  library: GraduationCap,
  social: Users,
  profile: UserCircle,
}

const tabs: NavTab[] = dynamicTabs.length > 0
  ? dynamicTabs.map(tab => ({
      id: tab.key,
      label: tab.label,
      href: tab.path,
      icon: ICON_MAP[tab.key] ?? LayoutDashboard,
    }))
  : PRIMARY_TABS
```

### Task 6.2: Fix dead settings link

**File:** `components/members/mobile-bottom-nav.tsx`

In the "More" menu, the Settings link points to `/members/profile?view=settings` which is a dead route.

**Fix:** Change to `/members/profile` (the profile page has a settings section):
```typescript
// Find the Settings link in the MORE_ITEMS array and fix the href:
{ label: 'Settings', href: '/members/profile', icon: Settings }
```

### Task 6.3: Remove duplicate `isLibraryPath()`

**File:** `components/members/mobile-bottom-nav.tsx`

The `isLibraryPath` function (line ~34) is duplicated from `components/members/member-left-nav.tsx`. Extract to shared utility:

**Create:** `lib/navigation-utils.ts`
```typescript
export function isLibraryPath(pathname: string): boolean {
  return pathname === '/members/library' || pathname.startsWith('/members/academy')
}
```

Import in both files instead of duplicating.

---

## 12. PHASE 7: POLISH, ACCESSIBILITY & SWIPE

### Task 7.1: Add swipe-down-to-close on tool sheets

**File:** `components/ai-coach/mobile-tool-sheet.tsx`

Add a drag gesture to the sheet header that dismisses on 100px+ downward drag:

```typescript
// On the sheet container:
<motion.div
  drag="y"
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => {
    if (info.offset.y > 100) onClose()
  }}
  ...
>
```

### Task 7.2: Reduce motion for `prefers-reduced-motion`

Add a `useReducedMotion()` hook check to the sheet animations. When reduced motion is preferred, use `opacity` only (no slide):

```typescript
import { useReducedMotion } from 'framer-motion'

// Inside MobileToolSheet:
const shouldReduce = useReducedMotion()
const sheetVariants = shouldReduce
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
  : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
```

### Task 7.3: ARIA improvements

1. **Quick-access bar:** Add `role="toolbar"` and `aria-label="Quick tools"`.
2. **Tool sheets:** Already have `role="dialog"` and `aria-modal` from Phase 3.
3. **Inline chart cards:** Already have `role="button"` and keyboard support from Phase 2.
4. **Follow-up chips:** Add `role="group"` and `aria-label="Suggested follow-ups"` to the container in `follow-up-chips.tsx` (line ~139).

### Task 7.4: Add notification dot for active chart on quick-access bar

When a chart is currently loaded (from an AI response), show a small emerald dot on the Chart button in the quick-access bar:

```typescript
// In MobileQuickAccessBar, accept a prop:
// On the Chart button, render a dot indicator (uses `hasActiveChart` from QuickAccessBarProps):
{hasActiveChart && view === 'chart' && (
  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
)}
```

---

# PART B — DESKTOP ENHANCEMENT (Phases 8-13)

## 13. PHASE 8: WIDGET ACTION FEEDBACK PULSE

**Goal:** When a widget action fires from chat (e.g., "Show on Chart"), provide clear visual feedback on the CenterPanel so the user knows where to look.

### Task 8.1: Create `usePanelAttentionPulse` hook

**Create:** `hooks/use-panel-attention-pulse.ts`

```typescript
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

export function usePanelAttentionPulse() {
  const [isPulsing, setIsPulsing] = useState(false)
  const [pulseLabel, setPulseLabel] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerPulse = useCallback((label?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPulsing(true)
    setPulseLabel(label ?? null)
    timerRef.current = setTimeout(() => {
      setIsPulsing(false)
      setPulseLabel(null)
    }, 1200)
  }, [])

  // Listen for all widget events that change CenterPanel
  useEffect(() => {
    const events = [
      'ai-coach-widget-chart',
      'ai-coach-widget-options',
      'ai-coach-widget-alert',
      'ai-coach-widget-analyze',
      'ai-coach-widget-view',
      'ai-coach-show-chart',
    ]

    const LABELS: Record<string, string> = {
      'ai-coach-widget-chart': 'Chart updated',
      'ai-coach-widget-options': 'Options loaded',
      'ai-coach-widget-alert': 'Alert panel open',
      'ai-coach-widget-analyze': 'Analyzing position',
      'ai-coach-widget-view': 'View changed',
      'ai-coach-show-chart': 'Chart updated',
    }

    const handler = (e: Event) => {
      // Only on desktop
      if (window.innerWidth < 1024) return
      triggerPulse(LABELS[e.type])
    }

    for (const name of events) {
      window.addEventListener(name, handler)
    }
    return () => {
      for (const name of events) {
        window.removeEventListener(name, handler)
      }
    }
  }, [triggerPulse])

  return { isPulsing, pulseLabel }
}
```

### Task 8.2: Apply pulse to CenterPanel wrapper

**File:** `app/members/ai-coach/page.tsx`

1. Import the hook:
```typescript
import { usePanelAttentionPulse } from '@/hooks/use-panel-attention-pulse'
```

2. Inside `AICoachPage()`, add:
```typescript
const pulse = usePanelAttentionPulse()
```

3. On the desktop CenterPanel `<Panel>` wrapper (line ~258), add a dynamic border class:
```typescript
<Panel defaultSize={60} minSize={35}>
  <div className={cn(
    'h-full transition-all duration-300',
    pulse.isPulsing && 'ring-1 ring-emerald-500/40 rounded-lg'
  )}>
    {/* Pulse toast label */}
    <AnimatePresence>
      {pulse.isPulsing && pulse.pulseLabel && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute top-2 right-3 z-30 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] text-emerald-300"
        >
          {pulse.pulseLabel}
        </motion.div>
      )}
    </AnimatePresence>
    <CenterPanel onSendPrompt={handleSendPrompt} chartRequest={chat.chartRequest} />
  </div>
</Panel>
```

### Task 8.3: Scroll active tab into view on widget fire

**File:** `components/ai-coach/center-panel.tsx`

When `activeCenterView` changes (line ~342-351), also scroll the tab rail:

```typescript
useEffect(() => {
  if (activeCenterView === 'preferences') {
    setIsPreferencesOpen(true)
    setCenterView(null)
    return
  }
  if (activeCenterView && activeCenterView !== activeView) {
    setActiveView(activeCenterView as CenterView)
    // Scroll the activated tab into view
    const tabEl = document.getElementById(`ai-coach-tab-${activeCenterView}`)
    tabEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
}, [activeCenterView, activeView, setCenterView])
```

---

## 14. PHASE 9: INLINE CHART CARDS ON DESKTOP

**Goal:** Render the same `InlineMiniChart` component (from Phase 2) inside the desktop chat panel. Clicking it focuses the CenterPanel chart view.

### Task 9.1: Wire `onExpandChart` in desktop `ChatArea`

**File:** `app/members/ai-coach/page.tsx`

The `ChatArea` already receives `onExpandChart` from Phase 2. On desktop, the expand action should:
1. Set the CenterPanel view to `chart` via workflow context
2. Push the chart request into the CenterPanel
3. Trigger the attention pulse

Update the desktop `ChatArea` render (line ~231):
```typescript
<ChatArea
  {...chatProps}
  onExpandChart={(chartReq) => {
    // Dispatch chart event so CenterPanel picks it up
    window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
      detail: chartReq,
    }))
  }}
/>
```

### Task 9.2: Ensure InlineMiniChart renders on all viewports

**File:** `components/ai-coach/chat-message.tsx`

The `InlineMiniChart` from Phase 2 should NOT have any `lg:hidden` class — it should render on both mobile and desktop. Verify the component has no viewport-gating classes.

The only difference is what `onExpand` does:
- **Mobile:** Opens tool sheet (via `useMobileToolSheet.openSheet('chart', ...)`)
- **Desktop:** Dispatches `ai-coach-show-chart` event (handled in Task 9.1)

The parent (`ChatArea`) passes the correct handler based on which context it's in. This is already wired via the `onExpandChart` prop.

---

## 15. PHASE 10: CONTEXT STRIP — REPLACE WELCOME DASHBOARD

**Goal:** Replace the full-page Welcome view on desktop with a slim persistent context strip that shows above whatever CenterPanel view is active. Default view becomes Chart instead of Welcome.

### Task 10.1: Create `DesktopContextStrip` component

**Create:** `components/ai-coach/desktop-context-strip.tsx`

```typescript
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowUpRight, ArrowDownRight, RefreshCw, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getChartData, scanOpportunities, type ScanOpportunity } from '@/lib/api/ai-coach'

interface DesktopContextStripProps {
  accessToken?: string
  onSendPrompt?: (prompt: string) => void
}

type MarketStatus = 'Pre-Market' | 'Open' | 'After Hours' | 'Closed'

function getMarketStatus(): MarketStatus {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const m = hour * 60 + minute
  if (weekday === 'Sat' || weekday === 'Sun') return 'Closed'
  if (m >= 570 && m < 960) return 'Open'
  if (m >= 240 && m < 570) return 'Pre-Market'
  if (m >= 960 && m < 1200) return 'After Hours'
  return 'Closed'
}

const STATUS_CLASSES: Record<MarketStatus, string> = {
  'Open': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Pre-Market': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'After Hours': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'Closed': 'bg-white/10 text-white/60 border-white/20',
}

export function DesktopContextStrip({ accessToken, onSendPrompt }: DesktopContextStripProps) {
  const [spx, setSpx] = useState<{ price: number | null; change: number | null; changePct: number | null; loading: boolean }>({
    price: null, change: null, changePct: null, loading: true,
  })
  const [topSetup, setTopSetup] = useState<{ opp: ScanOpportunity | null; loading: boolean }>({
    opp: null, loading: true,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const status = useMemo(() => getMarketStatus(), [tick])

  const loadSPX = useCallback(async () => {
    if (!accessToken) return
    try {
      let data = await getChartData('SPX', '1m', accessToken)
      if (data.bars.length < 2) data = await getChartData('SPX', '1D', accessToken)
      if (data.bars.length === 0) throw new Error('No bars')
      const last = data.bars[data.bars.length - 1]
      const prev = data.bars.length > 1 ? data.bars[data.bars.length - 2] : null
      const change = prev ? last.close - prev.close : 0
      const changePct = prev && prev.close !== 0 ? (change / prev.close) * 100 : null
      setSpx({ price: Number(last.close.toFixed(2)), change: Number(change.toFixed(2)), changePct: changePct != null ? Number(changePct.toFixed(2)) : null, loading: false })
    } catch {
      setSpx(p => ({ ...p, loading: false }))
    }
  }, [accessToken])

  const loadSetup = useCallback(async () => {
    if (!accessToken) return
    try {
      const scan = await scanOpportunities(accessToken, { symbols: ['SPX', 'NDX', 'QQQ', 'SPY'], includeOptions: true })
      const top = [...scan.opportunities].sort((a, b) => b.score - a.score)[0] ?? null
      setTopSetup({ opp: top, loading: false })
    } catch {
      setTopSetup(p => ({ ...p, loading: false }))
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    void loadSPX()
    const interval = setInterval(() => void loadSPX(), 60_000)
    return () => clearInterval(interval)
  }, [accessToken, loadSPX])

  useEffect(() => {
    if (!accessToken) return
    void loadSetup()
    const interval = setInterval(() => void loadSetup(), 120_000)
    return () => clearInterval(interval)
  }, [accessToken, loadSetup])

  const positive = (spx.change ?? 0) >= 0

  return (
    <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-[#0B0D10]">
      {/* Market status badge */}
      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border shrink-0', STATUS_CLASSES[status])}>
        {status}
      </span>

      {/* SPX ticker */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-white/50">SPX</span>
        {spx.loading ? (
          <span className="text-white/30">...</span>
        ) : spx.price ? (
          <>
            <span className="text-white font-medium">{spx.price.toLocaleString()}</span>
            {spx.change != null && (
              <span className={cn('flex items-center gap-0.5', positive ? 'text-emerald-400' : 'text-red-400')}>
                {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {positive ? '+' : ''}{spx.change.toFixed(2)}
                {spx.changePct != null ? ` (${positive ? '+' : ''}${spx.changePct.toFixed(2)}%)` : ''}
              </span>
            )}
          </>
        ) : (
          <span className="text-white/30">Unavailable</span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      {/* Top setup chip */}
      {topSetup.loading ? (
        <span className="text-[10px] text-white/30">Scanning...</span>
      ) : topSetup.opp ? (
        <button
          onClick={() => {
            onSendPrompt?.(`Expand this setup: ${topSetup.opp!.symbol} ${topSetup.opp!.setupType} (${topSetup.opp!.direction}). Full trade plan with entry, stop, target.`)
          }}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white hover:border-emerald-500/25 transition-colors"
        >
          <Target className="w-3 h-3 text-emerald-400" />
          {topSetup.opp.symbol} · {topSetup.opp.setupType}
          <span className={cn(
            'rounded px-1 py-0.5',
            topSetup.opp.direction !== 'bearish' ? 'text-emerald-300 bg-emerald-500/15' : 'text-red-300 bg-red-500/15'
          )}>
            {Math.round(topSetup.opp.score)}
          </span>
        </button>
      ) : (
        <span className="text-[10px] text-white/30">No setup found</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh */}
      <button
        onClick={() => { void loadSPX(); void loadSetup() }}
        className="text-white/30 hover:text-white/60 transition-colors"
        aria-label="Refresh context strip"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  )
}
```

### Task 10.2: Mount context strip in CenterPanel

**File:** `components/ai-coach/center-panel.tsx`

1. Import the component:
```typescript
import { DesktopContextStrip } from './desktop-context-strip'
```

2. In the CenterPanel render (line ~672), add the strip ABOVE the tab rail, visible on all views except onboarding:

```typescript
return (
  <div className="h-full flex flex-col relative">
    {/* Desktop context strip — always visible */}
    {activeView !== 'onboarding' && (
      <DesktopContextStrip
        accessToken={session?.access_token}
        onSendPrompt={onSendPrompt}
      />
    )}

    {activeView !== 'onboarding' && (
      <WorkflowBreadcrumb ... />
    )}

    {/* Tab bar ... */}
```

### Task 10.3: Change CenterPanel default view from Welcome to Chart

**File:** `components/ai-coach/center-panel.tsx`

Change the initial state (line ~316):

```typescript
// BEFORE:
const [activeView, setActiveView] = useState<CenterView>('welcome')

// AFTER:
const [activeView, setActiveView] = useState<CenterView>('chart')
```

Also trigger initial chart load on mount:

```typescript
useEffect(() => {
  if (!hasCompletedOnboarding()) {
    setActiveView('onboarding')
    return
  }
  // Load default chart on mount
  fetchChartData(chartSymbol, chartTimeframe)
}, [])  // eslint-disable-line react-hooks/exhaustive-deps
```

### Task 10.4: Remove duplicate data fetching

The Welcome view (`WelcomeView`) currently fetches SPX ticker and next-setup independently. Since the `DesktopContextStrip` now handles this, the Welcome view on desktop becomes redundant. However, **keep the Welcome view accessible** via the Home button on the tab rail — it's still useful as a "view all tools at once" page. Just remove the duplicate SPX ticker and Next Best Setup sections from it when the context strip is showing.

Add a prop to `WelcomeView`:
```typescript
interface WelcomeViewProps {
  // ... existing props
  hideContextData?: boolean  // When true, skip SPX ticker and Next Best Setup (context strip handles it)
}
```

In the CenterPanel, pass `hideContextData` on desktop:
```typescript
{activeView === 'welcome' && (
  <WelcomeView
    {...welcomeProps}
    hideContextData={typeof window !== 'undefined' && window.innerWidth >= 1024}
  />
)}
```

Inside `WelcomeView`, conditionally skip the header grid (lines ~1499-1606):
```typescript
{!hideContextData && (
  <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    {/* SPX Live card and Next Best Setup card */}
  </div>
)}
```

---

## 16. PHASE 11: FLOATING MINI-CHAT ON COLLAPSE

**Goal:** When the user collapses the chat panel with Cmd+B, replace the static "Chat" button with a floating, draggable mini-chat overlay.

### Task 11.1: Create `MiniChatOverlay` component

**Create:** `components/ai-coach/mini-chat-overlay.tsx`

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Send, Maximize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'

interface MiniChatOverlayProps {
  messages: ChatMessage[]
  isSending: boolean
  onSendMessage: (text: string) => void
  onExpand: () => void   // Expands chat panel back
  onClose: () => void    // Hides mini-chat (user wants full CenterPanel)
}

export function MiniChatOverlay({
  messages,
  isSending,
  onSendMessage,
  onExpand,
  onClose,
}: MiniChatOverlayProps) {
  const [inputValue, setInputValue] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const recentMessages = messages.slice(-5)

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    const text = inputValue.trim()
    if (!text || isSending) return
    onSendMessage(text)
    setInputValue('')
  }, [inputValue, isSending, onSendMessage])

  if (isMinimized) {
    return (
      <motion.button
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 left-4 z-40 hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#0F1013]/95 backdrop-blur-md px-3 py-2 shadow-[0_8px_30px_rgba(16,185,129,0.2)] cursor-move"
        onClick={() => setIsMinimized(false)}
        aria-label="Expand mini chat"
      >
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-white/70">
          {messages.length > 0 ? `${messages.length} messages` : 'Chat'}
        </span>
        {isSending && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </motion.button>
    )
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-4 left-4 z-40 hidden lg:flex flex-col w-[320px] h-[400px] rounded-2xl border border-white/10 bg-[#0D0F13]/95 backdrop-blur-xl shadow-[0_16px_60px_rgba(0,0,0,0.4)] overflow-hidden cursor-move"
      role="complementary"
      aria-label="Mini chat overlay"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-white/5 cursor-move"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white">AI Coach</span>
          {isSending && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExpand}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            aria-label="Expand to full chat panel"
            title="Expand (Ctrl/Cmd+B)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            aria-label="Minimize chat"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Messages (last 5) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {recentMessages.length === 0 ? (
          <p className="text-xs text-white/25 text-center pt-8">No messages yet</p>
        ) : (
          recentMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'text-xs leading-relaxed rounded-lg px-2.5 py-1.5 max-w-[90%]',
                msg.role === 'user'
                  ? 'ml-auto bg-emerald-500/15 text-white/80 border border-emerald-500/20'
                  : 'bg-white/5 text-white/70 border border-white/5'
              )}
            >
              {msg.content.length > 200 ? `${msg.content.slice(0, 200)}...` : msg.content}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isSending ? 'Processing...' : 'Ask anything...'}
          disabled={isSending}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 disabled:opacity-40"
          aria-label="Mini chat input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isSending}
          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg disabled:opacity-20 transition-colors"
          aria-label="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  )
}
```

### Task 11.2: Wire into page.tsx

**File:** `app/members/ai-coach/page.tsx`

Replace the static collapsed chat button (lines ~263-272) with the mini-chat overlay:

```typescript
import { MiniChatOverlay } from '@/components/ai-coach/mini-chat-overlay'

// REPLACE the existing collapsed button:
{isChatCollapsed && (
  <MiniChatOverlay
    messages={chat.messages}
    isSending={chat.isSending}
    onSendMessage={chat.sendMessage}
    onExpand={toggleChatPanelCollapse}
    onClose={() => {}}  // Already collapsed, just minimize overlay
  />
)}
```

---

## 17. PHASE 12: GROUPED TAB RAIL & SESSION RESTORE

**Goal:** Improve the tab rail with persistent group labels and restore the user's last active view on mount.

### Task 12.1: Persistent group labels on tab rail

**File:** `components/ai-coach/center-panel.tsx`

The current tab rail shows group labels only on hover via CSS opacity. Change to always-visible labels:

Replace the group label rendering (lines ~739-749):

```typescript
// BEFORE: opacity-0 transition-opacity group-hover/segment:opacity-100
// AFTER: Always visible

{previousGroup === null && (
  <span className="pointer-events-none absolute -top-2 left-2 text-[9px] uppercase tracking-[0.1em] text-white/30">
    {TAB_GROUP_LABELS[tab.group]}
  </span>
)}
{showDivider && (
  <>
    <div className="w-px h-5 bg-white/10 mx-1.5" aria-hidden />
    <span className="pointer-events-none absolute -top-2 left-4 text-[9px] uppercase tracking-[0.1em] text-white/30">
      {TAB_GROUP_LABELS[tab.group]}
    </span>
  </>
)}
```

Also increase the tab rail top padding to make room for the labels:
```typescript
// On the tab rail container, change py to accommodate labels:
<div className="flex items-center gap-1 min-w-max pt-3" role="tablist" aria-label="AI Coach tools">
```

### Task 12.2: Session view persistence

**File:** `components/ai-coach/preferences.ts`

Add session restore fields to the preferences type:

```typescript
export interface AICoachPreferences {
  // ... existing fields
  lastActiveView?: CenterView     // NEW
  lastChartSymbol?: string         // NEW
  lastChartTimeframe?: ChartTimeframe  // NEW
}

export const DEFAULT_AI_COACH_PREFERENCES: AICoachPreferences = {
  // ... existing defaults
  lastActiveView: undefined,
  lastChartSymbol: undefined,
  lastChartTimeframe: undefined,
}
```

### Task 12.3: Persist and restore in CenterPanel

**File:** `components/ai-coach/center-panel.tsx`

1. On mount, restore from preferences:
```typescript
useEffect(() => {
  if (!hasCompletedOnboarding()) {
    setActiveView('onboarding')
    return
  }
  // Restore last session state
  const restored = loadAICoachPreferences()
  if (restored.lastActiveView && restored.lastActiveView !== 'welcome' && restored.lastActiveView !== 'onboarding') {
    setActiveView(restored.lastActiveView as CenterView)
  } else {
    setActiveView('chart')
  }
  if (restored.lastChartSymbol) {
    setChartSymbol(restored.lastChartSymbol)
  }
  if (restored.lastChartTimeframe) {
    setChartTimeframe(restored.lastChartTimeframe)
  }
  fetchChartData(
    restored.lastChartSymbol || chartSymbol,
    restored.lastChartTimeframe || chartTimeframe
  )
}, [])  // eslint-disable-line react-hooks/exhaustive-deps
```

2. On view/symbol/timeframe change, persist:
```typescript
useEffect(() => {
  if (activeView === 'onboarding') return
  setPreferences(prev => ({
    ...prev,
    lastActiveView: activeView,
    lastChartSymbol: chartSymbol,
    lastChartTimeframe: chartTimeframe,
  }))
}, [activeView, chartSymbol, chartTimeframe])
```

---

## 18. PHASE 13: CROSS-PANEL HOVER COORDINATION

**Goal:** When the user hovers a level name in chat, pulse the corresponding annotation on the chart. When hovering a chart level, highlight the chat message that introduced it.

### Task 13.1: Create `useHoverCoordination` hook

**Create:** `hooks/use-hover-coordination.ts`

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'

interface HoverTarget {
  type: 'level' | 'symbol'
  value: string        // e.g. "PDH" or "AAPL"
  price?: number       // for level targets
  sourcePanel: 'chat' | 'center'
  messageId?: string   // which chat message
}

export function useHoverCoordination() {
  const [activeHover, setActiveHover] = useState<HoverTarget | null>(null)

  const hoverLevel = useCallback((value: string, price: number | undefined, sourcePanel: 'chat' | 'center', messageId?: string) => {
    setActiveHover({ type: 'level', value, price, sourcePanel, messageId })
  }, [])

  const clearHover = useCallback(() => {
    setActiveHover(null)
  }, [])

  // Broadcast hover via CustomEvent so components in different trees can listen
  useEffect(() => {
    if (activeHover) {
      window.dispatchEvent(new CustomEvent('ai-coach-hover-coordinate', { detail: activeHover }))
    } else {
      window.dispatchEvent(new CustomEvent('ai-coach-hover-clear'))
    }
  }, [activeHover])

  return { activeHover, hoverLevel, clearHover }
}
```

### Task 13.2: Add hover handlers to chat widget cards

**File:** `components/ai-coach/widget-cards.tsx`

For level-related widget cards (`key_levels`, `gex_profile`, `spx_game_plan`), add `onMouseEnter`/`onMouseLeave` to level rows:

```typescript
// On each level row in the key_levels card:
<div
  onMouseEnter={() => {
    window.dispatchEvent(new CustomEvent('ai-coach-hover-coordinate', {
      detail: { type: 'level', value: level.name, price: level.price, sourcePanel: 'chat' }
    }))
  }}
  onMouseLeave={() => {
    window.dispatchEvent(new CustomEvent('ai-coach-hover-clear'))
  }}
  className="cursor-pointer hover:bg-white/5 transition-colors rounded px-1 -mx-1"
>
  {/* existing level row content */}
</div>
```

### Task 13.3: Listen for hover in CenterPanel chart

**File:** `components/ai-coach/center-panel.tsx`

Add a state for the highlighted level and listen for coordination events:

```typescript
const [highlightedLevel, setHighlightedLevel] = useState<{ value: string; price?: number } | null>(null)

useEffect(() => {
  const handleHover = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.sourcePanel === 'chat' && detail?.type === 'level') {
      setHighlightedLevel({ value: detail.value, price: detail.price })
    }
  }
  const handleClear = () => setHighlightedLevel(null)

  window.addEventListener('ai-coach-hover-coordinate', handleHover)
  window.addEventListener('ai-coach-hover-clear', handleClear)
  return () => {
    window.removeEventListener('ai-coach-hover-coordinate', handleHover)
    window.removeEventListener('ai-coach-hover-clear', handleClear)
  }
}, [])
```

Pass `highlightedLevel` to the `ChartView` component, which can use it to temporarily boost the opacity/width of the matching `LevelAnnotation` on the TradingChart. Implementation detail: find the annotation in `chartLevels` whose `label` matches `highlightedLevel.value`, and temporarily change its `lineWidth` to `3` and `color` to a brighter variant.

### Task 13.4: Listen for chart hover in chat messages

**File:** `components/ai-coach/chat-message.tsx`

Add a listener for hover events originating from the chart:

```typescript
const [isHighlighted, setIsHighlighted] = useState(false)

useEffect(() => {
  const handleHover = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.sourcePanel === 'center' && detail?.messageId === message.id) {
      setIsHighlighted(true)
    }
  }
  const handleClear = () => setIsHighlighted(false)

  window.addEventListener('ai-coach-hover-coordinate', handleHover)
  window.addEventListener('ai-coach-hover-clear', handleClear)
  return () => {
    window.removeEventListener('ai-coach-hover-coordinate', handleHover)
    window.removeEventListener('ai-coach-hover-clear', handleClear)
  }
}, [message.id])

// Apply highlight ring to the message bubble:
<div className={cn(
  'rounded-2xl ...',
  isHighlighted && 'ring-1 ring-emerald-500/30 bg-emerald-500/5'
)}>
```

---

## 19. PHASE 14: WIDGET ACTION OPTIMIZATION

**Goal:** Restructure the widget action system to eliminate confusing, redundant, and contextually wrong actions across all 17 card types. Introduce a tiered action model (Primary → Quick → Overflow), unify the dual chart dispatch paths, make per-row actions tap-accessible, and remove chatAction from action bars (follow-up chips handle it).

### Problem Summary

| Issue | Severity | Cards Affected |
|-------|----------|----------------|
| "Set Alert" on `currentPrice` fires instantly (useless) | HIGH | Key Levels, Current Price |
| `chatAction` in action bar duplicates follow-up chips | HIGH | 12 of 17 cards |
| `copyAction` burns a visible slot on every card, rarely used | MEDIUM | 15 of 17 cards |
| Two chart dispatch paths (`openKeyLevelsChart` vs `chartAction`) for same UX | MEDIUM | Key Levels, SPX Game Plan vs others |
| "View Options" on contextually wrong cards (Macro, Alerts row) | MEDIUM | Macro Context, Alert Status rows |
| Per-row context menus invisible (right-click only, broken on mobile) | HIGH | 8 card types with data rows |
| `viewAction` uses same icon for 7 different destinations | LOW | P&L, Market, Alert, Macro, Scan, Earnings, Journal cards |
| `normalizeActions` silently drops actions beyond 5 | LOW | Position Summary (5 actions at limit) |
| `analyzeAction` label "Analyze" is vague | LOW | Position Summary, Scan Results, Earnings Analysis |

### Architecture: Tiered Action Model

```
Tier 1 — Primary (card click):
  The whole card is a button. Clicking/tapping the card executes the single
  most useful action. No separate button needed.

Tier 2 — Quick Actions (2-3 visible buttons):
  Context-aware actions that make sense for THIS specific card's data.
  Shown as icon+label buttons in the action bar.

Tier 3 — Overflow (⋯ menu):
  Copy, niche view navigations, and any secondary actions.
  Accessed via a ⋯ button at the end of the action bar.
  Opens a Radix Popover (not a context menu) — works on tap AND click.
```

### Task 14.1: Create `WidgetActionBarV2` component

**Create:** `components/ai-coach/widget-action-bar-v2.tsx`

This replaces `widget-action-bar.tsx`. It renders Tier 2 actions as visible buttons and Tier 3 actions in a popover overflow menu.

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

export interface TieredActions {
  /** 2-3 visible buttons — the most useful actions for this card */
  quick: WidgetAction[]
  /** Actions behind the ⋯ overflow menu */
  overflow: WidgetAction[]
}

interface WidgetActionBarV2Props {
  actions: TieredActions
  compact?: boolean
  className?: string
}

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

export function WidgetActionBarV2({ actions, compact = false, className }: WidgetActionBarV2Props) {
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)

  const runAction = async (action: WidgetAction) => {
    try {
      const result = action.action()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoadingLabel(action.label)
        await result
      }
    } finally {
      setLoadingLabel((current) => (current === action.label ? null : current))
    }
  }

  if (actions.quick.length === 0 && actions.overflow.length === 0) return null

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1.5',
        className,
      )}
    >
      <div className={cn('flex items-center gap-1.5', compact && 'overflow-x-auto pb-0.5 sm:overflow-visible')}>
        {/* Quick actions — always visible */}
        {actions.quick.map((action) => {
          const Icon = action.icon
          const isLoading = loadingLabel === action.label
          return (
            <motion.button
              key={action.label}
              type="button"
              onClick={() => void runAction(action)}
              disabled={action.disabled || isLoading}
              title={action.tooltip || action.label}
              aria-label={action.label}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-2.5 py-1 text-[10px] font-medium transition-colors min-h-[30px]',
                action.variant === 'primary' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15',
                action.variant === 'danger' && 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15',
                (!action.variant || action.variant === 'secondary') && 'border-white/10 bg-white/5 text-white/60 hover:text-white/75 hover:bg-white/10',
                (action.disabled || isLoading) && 'opacity-40 cursor-not-allowed',
              )}
              {...PRESSABLE_PROPS}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              <span>{action.label}</span>
            </motion.button>
          )
        })}

        {/* Overflow menu — ⋯ button with Popover */}
        {actions.overflow.length > 0 && (
          <Popover.Root open={overflowOpen} onOpenChange={setOverflowOpen}>
            <Popover.Trigger asChild>
              <motion.button
                type="button"
                aria-label="More actions"
                className="inline-flex shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors w-[30px] h-[30px]"
                {...PRESSABLE_PROPS}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </motion.button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="end"
                sideOffset={6}
                className="z-50 min-w-[180px] rounded-lg border border-white/15 bg-[#111216] p-1 shadow-2xl animate-in fade-in-0 zoom-in-95"
              >
                {actions.overflow.map((action) => {
                  const Icon = action.icon
                  const isLoading = loadingLabel === action.label
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        void runAction(action)
                        setOverflowOpen(false)
                      }}
                      disabled={action.disabled || isLoading}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs outline-none transition-colors',
                        action.disabled
                          ? 'cursor-not-allowed text-white/25'
                          : 'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                      <span>{action.label}</span>
                    </button>
                  )
                })}
                <Popover.Arrow className="fill-[#111216]" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  )
}
```

### Task 14.2: Create `WidgetRowActions` component

**Create:** `components/ai-coach/widget-row-actions.tsx`

Replaces the right-click-only `WidgetContextMenu` on data rows with a visible ⋯ button that opens a Popover on tap or click. Falls back gracefully on mobile.

```typescript
'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { MoreVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

interface WidgetRowActionsProps {
  actions: WidgetAction[]
  children: React.ReactNode
  className?: string
}

export function WidgetRowActions({ actions, children, className }: WidgetRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)

  if (actions.length === 0) return <>{children}</>

  const runAction = async (action: WidgetAction) => {
    try {
      const result = action.action()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoadingLabel(action.label)
        await result
      }
    } finally {
      setLoadingLabel((current) => (current === action.label ? null : current))
      setOpen(false)
    }
  }

  return (
    <div className={cn('group/row relative flex items-center', className)}>
      <div className="flex-1 min-w-0">{children}</div>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Row actions"
            data-card-ignore="true"
            className="shrink-0 ml-1 p-0.5 rounded text-white/20 opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:text-white/50 hover:bg-white/5 transition-all"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="left"
            align="start"
            sideOffset={4}
            className="z-50 min-w-[160px] rounded-lg border border-white/15 bg-[#111216] p-1 shadow-2xl animate-in fade-in-0 zoom-in-95"
          >
            {actions.map((action) => {
              const Icon = action.icon
              const isLoading = loadingLabel === action.label
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => void runAction(action)}
                  disabled={action.disabled || isLoading}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs outline-none transition-colors',
                    action.disabled
                      ? 'cursor-not-allowed text-white/25'
                      : 'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                  <span>{action.label}</span>
                </button>
              )
            })}
            <Popover.Arrow className="fill-[#111216]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
```

### Task 14.3: Unify chart dispatch — merge `openKeyLevelsChart` into `chartAction`

**File:** `components/ai-coach/widget-actions.ts`

Currently two separate chart dispatch paths exist:
- `chartAction()` → dispatches `ai-coach-widget-chart` with `{ symbol, level, timeframe, label }`
- `openKeyLevelsChart()` → dispatches `ai-coach-show-chart` with `{ symbol, timeframe, levels: { resistance, support, indicators } }`

Merge into a single `chartAction` that accepts an optional `levels` parameter:

```typescript
// REPLACE the existing chartAction (lines 30-53) with:

export interface ChartActionLevels {
  resistance?: Array<{ name: string; price: number; distance?: string }>
  support?: Array<{ name: string; price: number; distance?: string }>
  indicators?: { vwap?: number; atr14?: number }
}

export function chartAction(
  symbol: string,
  options?: {
    level?: number
    timeframe?: ChartTimeframe
    label?: string
    buttonLabel?: string
    levels?: ChartActionLevels
  },
): WidgetAction {
  const { level, timeframe = '5m', label, buttonLabel, levels } = options ?? {}
  return {
    label: buttonLabel || (levels ? 'Show on Chart' : typeof level === 'number' ? 'Show on Chart' : 'Open Chart'),
    icon: CandlestickChart,
    variant: 'primary',
    tooltip: typeof level === 'number'
      ? `${symbol} @ ${level.toFixed(2)} (${timeframe})`
      : `${symbol} chart (${timeframe})`,
    action: () => {
      dispatchWidgetEvent('ai-coach-show-chart', {
        symbol,
        timeframe,
        level,
        label,
        levels: levels ?? undefined,
      })
    },
  }
}
```

Then **delete** the standalone `openKeyLevelsChart()` function and `openScannerSetupChart()` from `widget-cards.tsx`. All chart dispatch goes through `chartAction()`.

**Update callers:**

In `KeyLevelsCard`, replace `openKeyLevelsChart(...)` with:
```typescript
const openCardChart = () => {
  chartAction(symbol, {
    timeframe: '5m',
    levels: { resistance, support, indicators: { vwap, atr14: atr } },
  }).action()
}
```

In `SPXGamePlanCard`, same pattern. In `ScanResultsCard`, replace `scannerChartAction()` with:
```typescript
chartAction(opp.symbol, {
  timeframe: '15m',
  levels: { resistance: buildResistance(opp), support: buildSupport(opp) },
})
```

### Task 14.4: Add destination-specific icons to `viewAction`

**File:** `components/ai-coach/widget-actions.ts`

Replace the single `LayoutDashboard` icon with context-aware icons:

```typescript
import {
  Bell,
  BookOpen,
  CandlestickChart,
  Calculator,
  Calendar,
  Copy,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sunrise,
  TableProperties,
  TrendingUp,
} from 'lucide-react'

const VIEW_ICONS: Record<string, LucideIcon> = {
  position: Calculator,
  journal: BookOpen,
  alerts: Bell,
  scanner: Search,
  brief: Sunrise,
  macro: Globe,
  tracked: TrendingUp,
  earnings: Calendar,
  watchlist: TableProperties,
}

export function viewAction(
  view: WorkflowCenterView,
  buttonLabel = 'Open View',
  symbol?: string,
): WidgetAction {
  return {
    label: buttonLabel,
    icon: VIEW_ICONS[view] || LayoutDashboard,
    variant: 'secondary',
    tooltip: `Open ${buttonLabel}`,
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-view', { view, symbol, label: buttonLabel })
    },
  }
}
```

### Task 14.5: Fix smart alert targets (stop alerting on current price)

**File:** `components/ai-coach/widget-cards.tsx`

For **Key Levels** card-level actions, replace `alertAction(symbol, currentPrice)` with the nearest significant level:

```typescript
// BEFORE (useless — alerts on current price):
alertAction(symbol, currentPrice, 'level_approach', `${symbol} key-level sweep`)

// AFTER (smart — alerts on the closest resistance or support that isn't at current price):
const nearestAlert = findNearestAlertLevel(currentPrice, resistance, support)

function findNearestAlertLevel(
  spot: number,
  resistance: KeyLevelLike[],
  support: KeyLevelLike[],
): { price: number; name: string; type: 'price_above' | 'price_below' } {
  // Find closest resistance above spot
  const resAbove = resistance
    .filter(r => r.price > spot * 1.001) // at least 0.1% above
    .sort((a, b) => a.price - b.price)[0]
  // Find closest support below spot
  const supBelow = support
    .filter(s => s.price < spot * 0.999) // at least 0.1% below
    .sort((a, b) => b.price - a.price)[0]

  if (!resAbove && !supBelow) {
    return { price: spot, name: 'Spot', type: 'price_above' }
  }
  const resDist = resAbove ? resAbove.price - spot : Infinity
  const supDist = supBelow ? spot - supBelow.price : Infinity

  if (resDist <= supDist && resAbove) {
    return { price: resAbove.price, name: resAbove.name, type: 'price_above' }
  }
  return { price: supBelow!.price, name: supBelow!.name, type: 'price_below' }
}
```

For **Current Price** card, remove `alertAction` entirely from the quick tier — it always fires on current price. Move to overflow with a smarter label: "Alert if price moves ±2%".

### Task 14.6: Reassign actions per card using tiered model

**File:** `components/ai-coach/widget-cards.tsx`

Replace every `normalizeActions([...])` call with the new `TieredActions` structure. Replace `<WidgetActionBar>` with `<WidgetActionBarV2>`. Replace `<WidgetContextMenu>` with `<WidgetRowActions>`.

**Complete reassignment table:**

```
KEY LEVELS
  Quick: [Chart w/ levels (primary), Alert @ nearest level]
  Overflow: [Options, Copy levels]
  Rows: [Chart @ level, Alert @ level, Copy level]

POSITION SUMMARY
  Quick: [Analyze position (primary), Chart @ strike]
  Overflow: [Options, Risk plan (chatAction), Copy]
  Rows: None

P&L TRACKER
  Quick: [Open Analyzer (primary), Open Journal]
  Overflow: [Copy portfolio summary]
  Rows: None

MARKET OVERVIEW
  Quick: [SPX Chart (primary), Open Brief/Macro (context-aware)]
  Overflow: [Copy status]
  Rows: None

ALERT STATUS
  Quick: [Chart first alert (primary), Manage Alerts]
  Overflow: [Copy alerts]
  Rows: [Chart @ target, Alert details, Copy]

CURRENT PRICE
  Quick: [Chart (primary), Options]
  Overflow: [Alert ±2%, Copy]
  Rows: None

MACRO CONTEXT
  Quick: [Chart/Macro view (primary)]
  Overflow: [Copy macro summary]
  Rows: [Chart/view per event, Copy event]

OPTIONS CHAIN
  Quick: [Options (primary), Chart]
  Overflow: [Alert @ ATM, Copy chain]
  Rows: [Chart @ strike, Options @ strike, Copy row]

GEX PROFILE
  Quick: [Chart w/ GEX overlay (primary), Options @ max gamma]
  Overflow: [Copy GEX context]
  Rows: [Chart @ strike, Options, Alert, Copy]

SPX GAME PLAN
  Quick: [Chart w/ all levels (primary), Alert @ gamma flip]
  Overflow: [Options, Copy plan]
  Rows: [Chart @ level, Alert @ level, Copy]

SCAN RESULTS
  Quick: [Chart top setup (primary), Analyze trade]
  Overflow: [Track setup, Copy]
  Rows: [Chart, Options, Analyze, Copy]

ZERO DTE ANALYSIS
  Quick: [Chart (primary), Options]
  Overflow: [Copy 0DTE summary]
  Rows: [Chart @ strike, Options @ strike, Copy]

IV ANALYSIS
  Quick: [Options (primary), Chart]
  Overflow: [Copy IV summary]
  Rows: [Options @ expiry, Copy]

EARNINGS CALENDAR
  Quick: [Open Earnings view (primary)]
  Overflow: [Copy watchlist]
  Rows: [Chart, Options @ date, Copy]

EARNINGS ANALYSIS
  Quick: [Options (primary), Chart]
  Overflow: [Alert/Earnings view, Copy]
  Rows: [Analyze strategy, Copy]

JOURNAL INSIGHTS
  Quick: [Open Journal (primary)]
  Overflow: [Copy summary]
  Rows: None

TRADE HISTORY
  Quick: [Open Journal (primary), Chart (if specific symbol)]
  Overflow: [Copy stats]
  Rows: [Chart trade, Copy]
```

### Task 14.7: Remove `chatAction` from all action bars

**File:** `components/ai-coach/widget-cards.tsx`

Remove every `chatAction(...)` from the action arrays in all 17 cards. The follow-up chips system (`follow-up-chips.tsx`) already generates context-aware AI prompts below every assistant message.

This eliminates the duplicate "Ask AI" / "Get Advice" / "Build Plan" / "Risk Plan" / "Review Alerts" buttons that compete with the chips.

**Exception:** Keep `chatAction` available in the overflow menu for exactly 2 card types where the follow-up chips cannot generate a sufficiently specific prompt:
- **Earnings Analysis** → overflow: `chatAction("Rank the pre-earnings strategies...")` (too specific for generic chips)
- **SPX Game Plan** → overflow: `chatAction("Turn this SPX game plan into actionable 0DTE trades...")` (unique workflow)

### Task 14.8: Delete deprecated files

After all cards are migrated:
1. **Delete** `components/ai-coach/widget-context-menu.tsx` — replaced by `WidgetRowActions`
2. **Delete** `components/ai-coach/widget-action-bar.tsx` — replaced by `WidgetActionBarV2`
3. **Remove** `openKeyLevelsChart()`, `openScannerSetupChart()`, and `scannerChartAction()` from `widget-cards.tsx` — unified into `chartAction`
4. **Remove** the `normalizeActions()` helper — no longer needed with explicit tiered assignment

### Task 14.9: Update `WidgetActionBar` import references

**Files to update imports:**
- `components/ai-coach/widget-cards.tsx` — change all `WidgetActionBar` → `WidgetActionBarV2`, `WidgetContextMenu` → `WidgetRowActions`
- Remove the "Right-click rows for more" hint text (no longer applicable)

### Vitest: `WidgetActionBarV2`

**Create:** `components/ai-coach/__tests__/widget-action-bar-v2.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

describe('WidgetActionBarV2', () => {
  const mockQuick = [
    { label: 'Show on Chart', icon: () => <span data-testid="icon-chart" />, variant: 'primary' as const, action: vi.fn() },
    { label: 'Set Alert', icon: () => <span data-testid="icon-alert" />, variant: 'secondary' as const, action: vi.fn() },
  ]
  const mockOverflow = [
    { label: 'Copy', icon: () => <span data-testid="icon-copy" />, variant: 'secondary' as const, action: vi.fn() },
    { label: 'View Options', icon: () => <span data-testid="icon-options" />, variant: 'secondary' as const, action: vi.fn() },
  ]

  it('renders quick actions as visible buttons', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: mockOverflow }} />)

    expect(screen.getByLabelText('Show on Chart')).toBeDefined()
    expect(screen.getByLabelText('Set Alert')).toBeDefined()
  })

  it('does not render overflow actions directly', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: mockOverflow }} />)

    expect(screen.queryByLabelText('Copy')).toBeNull()
    expect(screen.queryByLabelText('View Options')).toBeNull()
  })

  it('shows overflow actions when ⋯ button is clicked', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: mockOverflow }} />)

    fireEvent.click(screen.getByLabelText('More actions'))

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeDefined()
      expect(screen.getByText('View Options')).toBeDefined()
    })
  })

  it('calls action and closes overflow when overflow item clicked', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: mockOverflow }} />)

    fireEvent.click(screen.getByLabelText('More actions'))
    await waitFor(() => screen.getByText('Copy'))
    fireEvent.click(screen.getByText('Copy'))

    expect(mockOverflow[0].action).toHaveBeenCalledOnce()
  })

  it('calls quick action on click', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: mockOverflow }} />)

    fireEvent.click(screen.getByLabelText('Show on Chart'))
    expect(mockQuick[0].action).toHaveBeenCalledOnce()
  })

  it('hides overflow button when no overflow actions', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    render(<WidgetActionBarV2 actions={{ quick: mockQuick, overflow: [] }} />)

    expect(screen.queryByLabelText('More actions')).toBeNull()
  })

  it('renders nothing when no actions at all', async () => {
    const { WidgetActionBarV2 } = await import('../widget-action-bar-v2')
    const { container } = render(<WidgetActionBarV2 actions={{ quick: [], overflow: [] }} />)

    expect(container.firstChild).toBeNull()
  })
})
```

### Vitest: `WidgetRowActions`

**Create:** `components/ai-coach/__tests__/widget-row-actions.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

describe('WidgetRowActions', () => {
  const mockActions = [
    { label: 'Chart @ R1', icon: () => <span />, variant: 'primary' as const, action: vi.fn() },
    { label: 'Set Alert', icon: () => <span />, variant: 'secondary' as const, action: vi.fn() },
  ]

  it('renders children and a ⋮ button', async () => {
    const { WidgetRowActions } = await import('../widget-row-actions')
    render(
      <WidgetRowActions actions={mockActions}>
        <span>R1 $192.50</span>
      </WidgetRowActions>,
    )

    expect(screen.getByText('R1 $192.50')).toBeDefined()
    expect(screen.getByLabelText('Row actions')).toBeDefined()
  })

  it('shows action menu on ⋮ click', async () => {
    const { WidgetRowActions } = await import('../widget-row-actions')
    render(
      <WidgetRowActions actions={mockActions}>
        <span>R1 $192.50</span>
      </WidgetRowActions>,
    )

    fireEvent.click(screen.getByLabelText('Row actions'))

    await waitFor(() => {
      expect(screen.getByText('Chart @ R1')).toBeDefined()
      expect(screen.getByText('Set Alert')).toBeDefined()
    })
  })

  it('calls action and closes menu on item click', async () => {
    const { WidgetRowActions } = await import('../widget-row-actions')
    render(
      <WidgetRowActions actions={mockActions}>
        <span>R1 $192.50</span>
      </WidgetRowActions>,
    )

    fireEvent.click(screen.getByLabelText('Row actions'))
    await waitFor(() => screen.getByText('Chart @ R1'))
    fireEvent.click(screen.getByText('Chart @ R1'))

    expect(mockActions[0].action).toHaveBeenCalledOnce()
  })

  it('renders just children when no actions', async () => {
    const { WidgetRowActions } = await import('../widget-row-actions')
    render(
      <WidgetRowActions actions={[]}>
        <span>R1 $192.50</span>
      </WidgetRowActions>,
    )

    expect(screen.getByText('R1 $192.50')).toBeDefined()
    expect(screen.queryByLabelText('Row actions')).toBeNull()
  })
})
```

---

## 20. TESTING REQUIREMENTS (renumbered from 19)

### New Test Files

| File | Type | Purpose |
|------|------|---------|
| `hooks/__tests__/use-mobile-tool-sheet.test.ts` | Vitest | Event bridge, state management (spec in Phase 1) |
| `components/ai-coach/__tests__/inline-mini-chart.test.tsx` | Vitest | Chart card rendering, loading/error states |
| `components/ai-coach/__tests__/mobile-tool-sheet.test.tsx` | Vitest | Sheet open/close, keyboard dismiss, focus trap |
| `components/ai-coach/__tests__/mobile-quick-access-bar.test.tsx` | Vitest | Button clicks dispatch correct views, More sheet toggle |
| `hooks/__tests__/use-panel-attention-pulse.test.ts` | Vitest | Pulse state lifecycle, auto-clear timer, concurrent event handling |
| `components/ai-coach/__tests__/desktop-context-strip.test.tsx` | Vitest | SPX data display, setup rendering, loading/error states |
| `components/ai-coach/__tests__/mini-chat-overlay.test.tsx` | Vitest | Drag position, minimize toggle, message rendering, input dispatch |
| `hooks/__tests__/use-hover-coordination.test.ts` | Vitest | Hover event dispatch/listen, debounce, cleanup |
| `components/ai-coach/__tests__/widget-action-bar-v2.test.tsx` | Vitest | Overflow toggle, tiered rendering, empty states, action dispatch |
| `components/ai-coach/__tests__/widget-row-actions.test.tsx` | Vitest | Popover open/close, action dispatch, keyboard navigation |
| `e2e/specs/ai-coach/ai-coach-mobile.spec.ts` | Playwright | End-to-end mobile AI Coach flows |

### Playwright E2E Mobile Spec

**Create:** `e2e/specs/ai-coach/ai-coach-mobile.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.use({
  ...require('@playwright/test').devices['iPhone 13'],
  extraHTTPHeaders: { 'x-e2e-bypass-auth': '1' },
})

test.describe('AI Coach Mobile — Chat-First', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members/ai-coach')
    await page.waitForSelector('[aria-label="Message the AI coach"]')
  })

  test('chat is always visible on mobile', async ({ page }) => {
    const input = page.locator('[aria-label="Message the AI coach"]')
    await expect(input).toBeVisible()
  })

  test('no Chat/Chart toggle exists on mobile', async ({ page }) => {
    const toggle = page.locator('button:has-text("Chart")').first()
    // The toggle should not exist (removed in Phase 4)
    await expect(toggle).toHaveCount(0)
  })

  test('quick-access bar opens chart sheet', async ({ page }) => {
    const chartButton = page.locator('[aria-label="Chart"]')
    await chartButton.click()
    await expect(page.locator('[aria-label="Live Chart"]')).toBeVisible()
  })

  test('tool sheet closes with close button', async ({ page }) => {
    const chartButton = page.locator('[aria-label="Chart"]')
    await chartButton.click()
    await expect(page.locator('[aria-label="Live Chart"]')).toBeVisible()

    const closeBtn = page.locator('[aria-label="Close sheet"]')
    await closeBtn.click()
    await expect(page.locator('[aria-label="Live Chart"]')).not.toBeVisible()
    // Chat is still visible
    await expect(page.locator('[aria-label="Message the AI coach"]')).toBeVisible()
  })

  test('tool sheet closes on Escape key', async ({ page }) => {
    const chartButton = page.locator('[aria-label="Chart"]')
    await chartButton.click()
    await expect(page.locator('[aria-label="Live Chart"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[aria-label="Live Chart"]')).not.toBeVisible()
  })

  test('more tools button reveals categorized grid', async ({ page }) => {
    const moreBtn = page.locator('[aria-label="More tools"]')
    await moreBtn.click()
    await expect(page.locator('text=Analyze')).toBeVisible()
    await expect(page.locator('text=Portfolio')).toBeVisible()
    await expect(page.locator('text=Monitor')).toBeVisible()
    await expect(page.locator('text=Research')).toBeVisible()
  })

  test('sending prompt from tool sheet closes sheet and shows chat', async ({ page }) => {
    // Open scanner sheet
    const moreBtn = page.locator('[aria-label="More tools"]')
    await moreBtn.click()
    await page.locator('text=Opportunity Scanner').click()
    await expect(page.locator('[aria-label="Opportunity Scanner"]')).toBeVisible()

    // Interact with scanner to trigger a prompt (via onSendPrompt)
    // After prompt fires, sheet should close
    // Verify chat input is visible
    await expect(page.locator('[aria-label="Message the AI coach"]')).toBeVisible()
  })
})

test.describe('AI Coach Mobile — Widget Event Bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members/ai-coach')
    await page.waitForSelector('[aria-label="Message the AI coach"]')
  })

  test('chart widget event opens chart sheet on mobile', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-chart', {
        detail: { symbol: 'SPX', timeframe: '5m' }
      }))
    })
    await expect(page.locator('[aria-label="Live Chart"]')).toBeVisible()
  })

  test('options widget event opens options sheet on mobile', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-options', {
        detail: { symbol: 'AAPL', strike: 200 }
      }))
    })
    await expect(page.locator('[aria-label="Options Chain"]')).toBeVisible()
  })
})
```

### Vitest Unit Tests — Remaining Components

**Create:** `components/ai-coach/__tests__/inline-mini-chart.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ChartRequest } from '../center-panel'

// Mock dynamic TradingChart import
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockChart = () => <div data-testid="mock-trading-chart" />
    MockChart.displayName = 'MockTradingChart'
    return MockChart
  },
}))

// Mock getChartData
vi.mock('@/lib/api/ai-coach', () => ({
  getChartData: vi.fn().mockResolvedValue({
    bars: [
      { time: 1700000000, open: 6000, high: 6050, low: 5980, close: 6020 },
      { time: 1700000060, open: 6020, high: 6060, low: 6010, close: 6045 },
    ],
  }),
}))

describe('InlineMiniChart', () => {
  const baseChartRequest: ChartRequest = {
    symbol: 'SPX',
    timeframe: '5m',
    levels: {
      resistance: [{ price: 6100, name: 'PDH' }],
      support: [{ price: 5950, name: 'PDL' }],
    },
  }

  it('renders chart header with symbol and timeframe', async () => {
    const { InlineMiniChart } = await import('../inline-mini-chart')
    render(
      <InlineMiniChart
        chartRequest={baseChartRequest}
        accessToken="test-token"
      />
    )
    expect(screen.getByText('SPX')).toBeDefined()
    expect(screen.getByText('5m')).toBeDefined()
  })

  it('renders expand icon', async () => {
    const { InlineMiniChart } = await import('../inline-mini-chart')
    render(
      <InlineMiniChart
        chartRequest={baseChartRequest}
        accessToken="test-token"
      />
    )
    expect(screen.getByLabelText(/expand.*chart/i)).toBeDefined()
  })

  it('calls onExpand when clicked', async () => {
    const { InlineMiniChart } = await import('../inline-mini-chart')
    const onExpand = vi.fn()
    render(
      <InlineMiniChart
        chartRequest={baseChartRequest}
        accessToken="test-token"
        onExpand={onExpand}
      />
    )
    screen.getByLabelText(/expand.*chart/i).click()
    expect(onExpand).toHaveBeenCalledOnce()
  })

  it('shows error state when chart data fails', async () => {
    const { getChartData } = await import('@/lib/api/ai-coach')
    vi.mocked(getChartData).mockRejectedValueOnce(new Error('Network error'))

    const { InlineMiniChart } = await import('../inline-mini-chart')
    render(
      <InlineMiniChart
        chartRequest={baseChartRequest}
        accessToken="test-token"
      />
    )
    // Wait for async error
    await vi.waitFor(() => {
      expect(screen.getByText('Chart unavailable')).toBeDefined()
    })
  })
})
```

**Create:** `components/ai-coach/__tests__/mobile-tool-sheet.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('MobileToolSheet', () => {
  it('renders nothing when activeSheet is null', async () => {
    const { MobileToolSheet } = await import('../mobile-tool-sheet')
    const { container } = render(
      <MobileToolSheet activeSheet={null} onClose={vi.fn()}>
        <div>Content</div>
      </MobileToolSheet>
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders dialog when activeSheet is set', async () => {
    const { MobileToolSheet } = await import('../mobile-tool-sheet')
    render(
      <MobileToolSheet activeSheet="chart" onClose={vi.fn()}>
        <div>Chart Content</div>
      </MobileToolSheet>
    )
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Live Chart')).toBeDefined()
    expect(screen.getByText('Chart Content')).toBeDefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const { MobileToolSheet } = await import('../mobile-tool-sheet')
    const onClose = vi.fn()
    render(
      <MobileToolSheet activeSheet="options" onClose={onClose}>
        <div>Options Content</div>
      </MobileToolSheet>
    )
    fireEvent.click(screen.getByLabelText('Close sheet'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', async () => {
    const { MobileToolSheet } = await import('../mobile-tool-sheet')
    const onClose = vi.fn()
    render(
      <MobileToolSheet activeSheet="brief" onClose={onClose}>
        <div>Brief Content</div>
      </MobileToolSheet>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders correct label for each sheet type', async () => {
    const { MobileToolSheet } = await import('../mobile-tool-sheet')
    const views = [
      { view: 'chart' as const, label: 'Live Chart' },
      { view: 'options' as const, label: 'Options Chain' },
      { view: 'journal' as const, label: 'Trade Journal' },
      { view: 'scanner' as const, label: 'Opportunity Scanner' },
      { view: 'alerts' as const, label: 'Alerts' },
    ]

    for (const { view, label } of views) {
      const { unmount } = render(
        <MobileToolSheet activeSheet={view} onClose={vi.fn()}>
          <div />
        </MobileToolSheet>
      )
      expect(screen.getByText(label)).toBeDefined()
      unmount()
    }
  })
})
```

**Create:** `components/ai-coach/__tests__/mobile-quick-access-bar.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('MobileQuickAccessBar', () => {
  it('renders 5 primary tool buttons', async () => {
    const { MobileQuickAccessBar } = await import('../mobile-quick-access-bar')
    render(<MobileQuickAccessBar onOpenSheet={vi.fn()} />)

    expect(screen.getByLabelText('Chart')).toBeDefined()
    expect(screen.getByLabelText('Options')).toBeDefined()
    expect(screen.getByLabelText('Scanner')).toBeDefined()
    expect(screen.getByLabelText('Brief')).toBeDefined()
    expect(screen.getByLabelText('Journal')).toBeDefined()
  })

  it('calls onOpenSheet with correct view when button clicked', async () => {
    const { MobileQuickAccessBar } = await import('../mobile-quick-access-bar')
    const onOpenSheet = vi.fn()
    render(<MobileQuickAccessBar onOpenSheet={onOpenSheet} />)

    fireEvent.click(screen.getByLabelText('Chart'))
    expect(onOpenSheet).toHaveBeenCalledWith('chart')

    fireEvent.click(screen.getByLabelText('Options'))
    expect(onOpenSheet).toHaveBeenCalledWith('options')
  })

  it('toggles more tools panel', async () => {
    const { MobileQuickAccessBar } = await import('../mobile-quick-access-bar')
    render(<MobileQuickAccessBar onOpenSheet={vi.fn()} />)

    const moreBtn = screen.getByLabelText('More tools')
    fireEvent.click(moreBtn)

    // Category headers should appear
    expect(screen.getByText('Analyze')).toBeDefined()
    expect(screen.getByText('Portfolio')).toBeDefined()
    expect(screen.getByText('Monitor')).toBeDefined()
    expect(screen.getByText('Research')).toBeDefined()
  })

  it('opens sheet and closes more panel when tool selected', async () => {
    const { MobileQuickAccessBar } = await import('../mobile-quick-access-bar')
    const onOpenSheet = vi.fn()
    render(<MobileQuickAccessBar onOpenSheet={onOpenSheet} />)

    // Open more panel
    fireEvent.click(screen.getByLabelText('More tools'))
    // Click a tool
    fireEvent.click(screen.getByText('LEAPS'))

    expect(onOpenSheet).toHaveBeenCalledWith('leaps')
    // More panel should close (categories hidden)
    expect(screen.queryByText('Research')).toBeNull()
  })

  it('renders More button with correct aria-expanded', async () => {
    const { MobileQuickAccessBar } = await import('../mobile-quick-access-bar')
    render(<MobileQuickAccessBar onOpenSheet={vi.fn()} />)

    const moreBtn = screen.getByLabelText('More tools')
    expect(moreBtn.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(moreBtn)
    expect(moreBtn.getAttribute('aria-expanded')).toBe('true')
  })
})
```

### Desktop Unit Tests (Phases 8-13)

**Create:** `hooks/__tests__/use-panel-attention-pulse.test.ts`

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

describe('usePanelAttentionPulse', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns idle state by default', async () => {
    const { usePanelAttentionPulse } = await import('../use-panel-attention-pulse')
    const { result } = renderHook(() => usePanelAttentionPulse())

    expect(result.current.isPulsing).toBe(false)
    expect(result.current.pulseLabel).toBe('')
  })

  it('activates pulse on widget event', async () => {
    const { usePanelAttentionPulse } = await import('../use-panel-attention-pulse')
    const { result } = renderHook(() => usePanelAttentionPulse())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-widget-chart', { detail: { symbol: 'AAPL' } }),
      )
    })

    expect(result.current.isPulsing).toBe(true)
    expect(result.current.pulseLabel).toContain('Chart')
  })

  it('auto-clears pulse after timeout', async () => {
    const { usePanelAttentionPulse } = await import('../use-panel-attention-pulse')
    const { result } = renderHook(() => usePanelAttentionPulse())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-widget-options', { detail: { symbol: 'SPY' } }),
      )
    })

    expect(result.current.isPulsing).toBe(true)

    act(() => { vi.advanceTimersByTime(2500) })

    expect(result.current.isPulsing).toBe(false)
  })

  it('replaces pulse when new event fires before timeout', async () => {
    const { usePanelAttentionPulse } = await import('../use-panel-attention-pulse')
    const { result } = renderHook(() => usePanelAttentionPulse())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-widget-chart', { detail: { symbol: 'AAPL' } }),
      )
    })
    expect(result.current.pulseLabel).toContain('Chart')

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-widget-options', { detail: { symbol: 'SPY' } }),
      )
    })
    expect(result.current.pulseLabel).toContain('Options')
  })

  it('cleans up listeners on unmount', async () => {
    const { usePanelAttentionPulse } = await import('../use-panel-attention-pulse')
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => usePanelAttentionPulse())

    unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

**Create:** `components/ai-coach/__tests__/desktop-context-strip.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock fetch for SPX data
const mockSPXData = {
  symbol: 'SPX',
  price: 5125.42,
  change: 12.5,
  changePct: 0.24,
}

const mockSetupData = {
  symbol: 'NVDA',
  direction: 'long',
  confidence: 'high',
  entry: 875.0,
}

describe('DesktopContextStrip', () => {
  it('renders SPX ticker with price and change', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSPXData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSetupData) }),
    )

    const { DesktopContextStrip } = await import('../desktop-context-strip')
    render(<DesktopContextStrip />)

    await waitFor(() => {
      expect(screen.getByText(/5,?125/)).toBeDefined()
    })
  })

  it('shows loading skeleton before data arrives', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const { DesktopContextStrip } = await import('../desktop-context-strip')
    const { container } = render(<DesktopContextStrip />)

    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })

  it('renders next best setup when available', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSPXData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSetupData) }),
    )

    const { DesktopContextStrip } = await import('../desktop-context-strip')
    render(<DesktopContextStrip />)

    await waitFor(() => {
      expect(screen.getByText(/NVDA/)).toBeDefined()
    })
  })

  it('handles fetch error gracefully without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { DesktopContextStrip } = await import('../desktop-context-strip')
    const { container } = render(<DesktopContextStrip />)

    await waitFor(() => {
      // Should render the strip shell without crashing
      expect(container.firstChild).toBeDefined()
    })
  })
})
```

**Create:** `components/ai-coach/__tests__/mini-chat-overlay.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockMessages = [
  { id: '1', role: 'user' as const, content: 'What are the key levels for SPX?' },
  { id: '2', role: 'assistant' as const, content: 'SPX key levels: PDH 5140, PDL 5105, Pivot 5122.' },
  { id: '3', role: 'user' as const, content: 'Show me the chart' },
  { id: '4', role: 'assistant' as const, content: 'Here is the SPX chart with key levels mapped.' },
  { id: '5', role: 'user' as const, content: 'What about GEX?' },
]

describe('MiniChatOverlay', () => {
  it('renders last 5 messages', async () => {
    const { MiniChatOverlay } = await import('../mini-chat-overlay')
    render(
      <MiniChatOverlay
        messages={mockMessages}
        onSendMessage={vi.fn()}
        onExpand={vi.fn()}
      />,
    )

    expect(screen.getByText(/key levels for SPX/)).toBeDefined()
    expect(screen.getByText(/GEX/)).toBeDefined()
  })

  it('calls onExpand when expand button is clicked', async () => {
    const { MiniChatOverlay } = await import('../mini-chat-overlay')
    const onExpand = vi.fn()
    render(
      <MiniChatOverlay
        messages={mockMessages}
        onSendMessage={vi.fn()}
        onExpand={onExpand}
      />,
    )

    fireEvent.click(screen.getByLabelText('Expand chat'))
    expect(onExpand).toHaveBeenCalledOnce()
  })

  it('minimizes to bubble when minimize is clicked', async () => {
    const { MiniChatOverlay } = await import('../mini-chat-overlay')
    render(
      <MiniChatOverlay
        messages={mockMessages}
        onSendMessage={vi.fn()}
        onExpand={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Minimize'))

    // Message list should be hidden, bubble visible
    expect(screen.queryByText(/key levels for SPX/)).toBeNull()
    expect(screen.getByLabelText('Open mini chat')).toBeDefined()
  })

  it('restores from bubble when clicked', async () => {
    const { MiniChatOverlay } = await import('../mini-chat-overlay')
    render(
      <MiniChatOverlay
        messages={mockMessages}
        onSendMessage={vi.fn()}
        onExpand={vi.fn()}
      />,
    )

    // Minimize then restore
    fireEvent.click(screen.getByLabelText('Minimize'))
    fireEvent.click(screen.getByLabelText('Open mini chat'))

    expect(screen.getByText(/key levels for SPX/)).toBeDefined()
  })

  it('dispatches message on input submit', async () => {
    const { MiniChatOverlay } = await import('../mini-chat-overlay')
    const onSendMessage = vi.fn()
    render(
      <MiniChatOverlay
        messages={mockMessages}
        onSendMessage={onSendMessage}
        onExpand={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText(/Quick message/)
    fireEvent.change(input, { target: { value: 'Show GEX profile' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSendMessage).toHaveBeenCalledWith('Show GEX profile')
  })
})
```

**Create:** `hooks/__tests__/use-hover-coordination.test.ts`

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

describe('useHoverCoordination', () => {
  afterEach(() => {
    // Clear any lingering event listeners
    vi.restoreAllMocks()
  })

  it('returns null highlight by default', async () => {
    const { useHoverCoordination } = await import('../use-hover-coordination')
    const { result } = renderHook(() => useHoverCoordination())

    expect(result.current.highlightedLevel).toBeNull()
    expect(result.current.highlightedMessageId).toBeNull()
  })

  it('updates highlight on hover event', async () => {
    const { useHoverCoordination } = await import('../use-hover-coordination')
    const { result } = renderHook(() => useHoverCoordination())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-hover-coordinate', {
          detail: { level: 5140, label: 'PDH', messageId: 'msg-1', source: 'chat' },
        }),
      )
    })

    expect(result.current.highlightedLevel).toBe(5140)
    expect(result.current.highlightedMessageId).toBe('msg-1')
  })

  it('clears highlight on clear event', async () => {
    const { useHoverCoordination } = await import('../use-hover-coordination')
    const { result } = renderHook(() => useHoverCoordination())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ai-coach-hover-coordinate', {
          detail: { level: 5140, label: 'PDH', messageId: 'msg-1', source: 'chat' },
        }),
      )
    })

    expect(result.current.highlightedLevel).toBe(5140)

    act(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-hover-clear'))
    })

    expect(result.current.highlightedLevel).toBeNull()
    expect(result.current.highlightedMessageId).toBeNull()
  })

  it('provides dispatch functions', async () => {
    const { useHoverCoordination } = await import('../use-hover-coordination')
    const { result } = renderHook(() => useHoverCoordination())
    const spy = vi.spyOn(window, 'dispatchEvent')

    act(() => {
      result.current.dispatchHover({
        level: 5105,
        label: 'PDL',
        messageId: 'msg-2',
        source: 'widget',
      })
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai-coach-hover-coordinate',
        detail: expect.objectContaining({ level: 5105, label: 'PDL' }),
      }),
    )

    spy.mockRestore()
  })

  it('cleans up listeners on unmount', async () => {
    const { useHoverCoordination } = await import('../use-hover-coordination')
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useHoverCoordination())

    unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

### Playwright Config Update

**File:** `playwright.config.ts`

Add a dedicated mobile AI Coach project. Insert this object into the `projects` array (line ~131, after the `mobile-members` project):

```typescript
// Add after the existing 'mobile-members' project:
{
  name: 'mobile-ai-coach',
  testMatch: /ai-coach-mobile\.spec\.ts/,
  use: {
    ...devices['iPhone 13'],
    extraHTTPHeaders: {
      'x-e2e-bypass-auth': '1',
    },
  },
},
```

---

## 21. ACCEPTANCE CRITERIA

### Blocking — Mobile (must pass before merge)

1. **Chat never unmounts on mobile** — navigating between tools always preserves chat messages and input state
2. **All 7 widget actions work on mobile** — tapping "Show on Chart", "View Options", "Set Alert", "Analyze", and "Open View" on a widget card opens the corresponding tool sheet
3. **Quick-access bar renders on mobile** — 5 primary tool icons + More button visible above input
4. **Tool sheets open and close** — full-screen overlay with slide animation, close via button/Escape/swipe-down
5. **Chat/Chart toggle is removed** — no binary toggle bar exists on mobile viewport
6. **Follow-up chip "Show Chart" works on mobile** — opens chart tool sheet instead of doing nothing
7. **EmptyState quick prompts fire correctly** — tapping a prompt sends the message
8. **Tool sheet close on prompt** — when `onSendPrompt` fires from inside a sheet, sheet closes and chat shows the response

### Blocking — Desktop (must pass before merge)

9. **Widget action feedback pulse** — clicking "Show on Chart" in chat causes a visible emerald ring flash on the CenterPanel + toast label
10. **Context strip always visible** — SPX ticker, market status badge, and top-setup chip render above the tab rail on all CenterPanel views (except onboarding)
11. **Default view is Chart** — CenterPanel starts on Chart view (not Welcome) on fresh page load
12. **Mini-chat overlay on collapse** — when chat panel is collapsed, a 320x400 draggable mini-chat appears with last 5 messages and input
13. **Tab rail groups always labeled** — group labels (Analyze, Portfolio, Monitor, Research) are permanently visible, not hover-only
14. **Session restore works** — closing and reopening the page restores `activeView`, `chartSymbol`, and `chartTimeframe`
15. **Inline chart cards render on desktop** — same `InlineMiniChart` appears in desktop chat, clicking focuses CenterPanel chart view

### Blocking — Shared

16. **No TypeScript errors** — `pnpm tsc --noEmit` passes
17. **Vitest suite passes** — all new and existing unit tests pass
18. **Playwright `mobile-ai-coach` passes** — all mobile E2E tests pass
19. **Playwright `ai-coach` passes** — all desktop AI Coach E2E tests still pass

### Should-Pass (high priority)

20. **Inline mini chart renders** — when AI returns chart data, a 200px chart card appears in chat on both mobile and desktop
21. **Tapping mini chart opens full chart sheet (mobile)** — expands to full-screen tool sheet
22. **Clicking mini chart focuses CenterPanel (desktop)** — navigates CenterPanel to chart view with pulse
23. **More tools sheet categorized** — tools grouped into Analyze, Portfolio, Monitor, Research
24. **Notification dot on chart button** — appears when a chart has been loaded from AI response
25. **ARIA roles correct** — toolbar, dialog, button, complementary roles present on new components
26. **Reduced motion respected** — sheets and pulse use opacity-only animation when `prefers-reduced-motion`
27. **Bottom nav uses admin config** — `getMobileTabs()` drives tabs when available
28. **Welcome view hides duplicate data** — when context strip is visible (desktop), Welcome view skips SPX ticker and Next Best Setup sections
29. **Tab scrolls to activated view** — when widget action fires, tab rail scrolls the activated tab into view

### Nice-to-Have

30. **Swipe down to close tool sheets** — 100px+ downward drag dismisses sheet
31. **Focus trapped inside tool sheets** — Tab key cycles within sheet
32. **Shared `isLibraryPath()` utility** — no duplication between nav components
33. **Cross-panel hover coordination** — hovering a level in chat pulses the chart annotation, hovering a chart level highlights the chat message
34. **Mini-chat minimizable** — overlay can collapse to a small bubble

### Blocking — Widget Optimization (Phase 14)

35. **Tiered action bar renders** — quick actions visible as buttons, overflow behind ⋯ menu
36. **No chatAction in action bars** — "Ask AI" / "Get Advice" buttons removed; follow-up chips handle all AI prompts
37. **Alert targets are smart** — Key Levels and Current Price cards alert on nearest significant level, not current price
38. **Per-row actions accessible via tap** — ⋮ button visible on hover/focus for every data row, opens Popover (not right-click-only)
39. **Single chart dispatch path** — all chart actions go through unified `chartAction()` dispatching `ai-coach-show-chart`
40. **View icons are contextual** — Journal gets BookOpen, Alerts gets Bell, Scanner gets Search, etc.
41. **Copy moved to overflow** — never in the visible quick action buttons
42. **Old components deleted** — `widget-action-bar.tsx` and `widget-context-menu.tsx` removed, no orphan imports

---

## 22. FILES TOUCHED SUMMARY

### New Files (22)
| File | Phase | Description |
|------|-------|-------------|
| `hooks/use-mobile-tool-sheet.ts` | 1 | Mobile widget event → sheet bridge |
| `hooks/__tests__/use-mobile-tool-sheet.test.ts` | 1 | Unit tests |
| `components/ai-coach/inline-mini-chart.tsx` | 2 | 200px chart card for chat messages |
| `components/ai-coach/__tests__/inline-mini-chart.test.tsx` | 2 | Unit tests |
| `components/ai-coach/mobile-tool-sheet.tsx` | 3 | Full-screen sheet overlay |
| `components/ai-coach/__tests__/mobile-tool-sheet.test.tsx` | 3 | Unit tests |
| `components/ai-coach/mobile-quick-access-bar.tsx` | 5 | Slim tool bar above input |
| `components/ai-coach/__tests__/mobile-quick-access-bar.test.tsx` | 5 | Unit tests |
| `e2e/specs/ai-coach/ai-coach-mobile.spec.ts` | 7 | Playwright mobile E2E |
| `lib/navigation-utils.ts` | 6 | Shared `isLibraryPath()` |
| `hooks/use-panel-attention-pulse.ts` | 8 | Desktop widget feedback pulse |
| `hooks/__tests__/use-panel-attention-pulse.test.ts` | 8 | Unit tests |
| `components/ai-coach/desktop-context-strip.tsx` | 10 | Persistent SPX/status/setup strip |
| `components/ai-coach/__tests__/desktop-context-strip.test.tsx` | 10 | Unit tests |
| `components/ai-coach/mini-chat-overlay.tsx` | 11 | Floating mini-chat on collapse |
| `components/ai-coach/__tests__/mini-chat-overlay.test.tsx` | 11 | Unit tests |
| `hooks/use-hover-coordination.ts` | 13 | Cross-panel hover state |
| `hooks/__tests__/use-hover-coordination.test.ts` | 13 | Unit tests |
| `components/ai-coach/widget-action-bar-v2.tsx` | 14 | Tiered action bar with overflow menu |
| `components/ai-coach/__tests__/widget-action-bar-v2.test.tsx` | 14 | Unit tests |
| `components/ai-coach/widget-row-actions.tsx` | 14 | Per-row tap-accessible action Popover |
| `components/ai-coach/__tests__/widget-row-actions.test.tsx` | 14 | Unit tests |

### Deleted Files (2)
| File | Phase | Reason |
|------|-------|--------|
| `components/ai-coach/widget-action-bar.tsx` | 14 | Replaced by `widget-action-bar-v2.tsx` |
| `components/ai-coach/widget-context-menu.tsx` | 14 | Replaced by `widget-row-actions.tsx` |

### Modified Files (11)
| File | Phases | Changes |
|------|--------|---------|
| `app/members/ai-coach/page.tsx` | 1,3,4,5,8,9,11 | Remove toggle, add sheet + quick-access bar, always-mount chat, add pulse wrapper, wire desktop expand, replace collapse button with mini-chat |
| `components/ai-coach/center-panel.tsx` | 3,8,10,12,13 | Add `forcedView` prop, hide tab rail/FAB in sheet mode, mount context strip, change default to chart, persistent tab labels, scroll tab on activate, session restore, highlighted level state |
| `components/ai-coach/chat-message.tsx` | 2,13 | Add `onExpandChart` prop, render InlineMiniChart, hover coordination highlight |
| `hooks/use-ai-coach-chat.ts` | 2 | Attach `chartRequest` to individual messages |
| `components/ai-coach/follow-up-chips.tsx` | 7 | Add ARIA role="group" |
| `components/members/mobile-bottom-nav.tsx` | 6 | Use `getMobileTabs()`, fix dead links, extract `isLibraryPath` |
| `components/ai-coach/widget-cards.tsx` | 13,14 | Add hover handlers for level rows; replace all `normalizeActions` with `TieredActions`, swap `WidgetActionBar` → `WidgetActionBarV2`, swap `WidgetContextMenu` → `WidgetRowActions`, remove `chatAction` from bars, fix alert targets, unify chart dispatch, delete `openKeyLevelsChart`/`openScannerSetupChart`/`scannerChartAction`/`normalizeActions` |
| `components/ai-coach/widget-actions.ts` | 14 | Unify `chartAction` with levels support, add `ChartActionLevels` type, add per-view icons to `viewAction`, single dispatch path via `ai-coach-show-chart` |
| `components/ai-coach/preferences.ts` | 12 | Add `lastActiveView`, `lastChartSymbol`, `lastChartTimeframe` |
| `playwright.config.ts` | 7 | Add `mobile-ai-coach` project |
| `contexts/AICoachWorkflowContext.tsx` | 14 | Listen for unified `ai-coach-show-chart` event (replaces dual `ai-coach-widget-chart` + `ai-coach-show-chart` listeners) |

### Unchanged Files
- `contexts/AICoachWorkflowContext.tsx` — events still fire for desktop, no changes needed
- `components/ai-coach/trading-chart.tsx` — receives level data as before
- All CenterPanel sub-views (options-chain, position-tracker, etc.)
- `backend/src/chatkit/*` — no backend changes

---

## 23. VALIDATION COMMANDS

```bash
# Type checking
pnpm tsc --noEmit

# Unit tests (all)
pnpm vitest run

# Specific new tests — mobile
pnpm vitest run hooks/__tests__/use-mobile-tool-sheet.test.ts
pnpm vitest run components/ai-coach/__tests__/inline-mini-chart.test.tsx
pnpm vitest run components/ai-coach/__tests__/mobile-tool-sheet.test.tsx
pnpm vitest run components/ai-coach/__tests__/mobile-quick-access-bar.test.tsx

# Specific new tests — desktop
pnpm vitest run hooks/__tests__/use-panel-attention-pulse.test.ts
pnpm vitest run components/ai-coach/__tests__/desktop-context-strip.test.tsx
pnpm vitest run components/ai-coach/__tests__/mini-chat-overlay.test.tsx
pnpm vitest run hooks/__tests__/use-hover-coordination.test.ts

# Specific new tests — widget optimization (Phase 14)
pnpm vitest run components/ai-coach/__tests__/widget-action-bar-v2.test.tsx
pnpm vitest run components/ai-coach/__tests__/widget-row-actions.test.tsx

# E2E — all AI Coach tests (desktop)
pnpm test:e2e --project=ai-coach

# E2E — mobile AI Coach specifically
pnpm test:e2e --project=mobile-ai-coach

# E2E — mobile members (bottom nav)
pnpm test:e2e --project=mobile-members

# Lint
pnpm lint

# Full validation (both mobile + desktop)
pnpm tsc --noEmit && pnpm vitest run && pnpm lint && pnpm test:e2e --project=ai-coach && pnpm test:e2e --project=mobile-ai-coach
```

---

## APPENDIX A: MIGRATION NOTES

### What Gets Deleted (Mobile — Phases 1-7)
- `mobileView` state in `page.tsx`
- Binary toggle bar JSX in `page.tsx`
- Swipe gesture handlers in `page.tsx`
- `setMobileView('chat')` calls in `page.tsx`
- Conditional render `{mobileView === 'chat' ? ... : ...}` in `page.tsx`

### What Gets Changed (Desktop — Phases 8-13)
- Static "Chat" collapse button → `MiniChatOverlay` component
- CenterPanel default `'welcome'` → `'chart'`
- Hover-only tab group labels → always-visible labels
- Welcome view duplicate data (SPX ticker, Next Setup) → hidden when context strip is present
- Static widget action handling → adds pulse feedback
- No preferences persistence → `lastActiveView` / `lastChartSymbol` / `lastChartTimeframe` saved

### What Gets Preserved
- Desktop resizable panels (same `PanelGroup` / `Panel` / `PanelResizeHandle`)
- CenterPanel internals (all 14 views work identically)
- All widget card types and their action dispatchers
- Chat sessions, streaming, image upload
- `AICoachWorkflowContext` event listeners
- Tab rail structure (tabs themselves unchanged, only label visibility changes)
- Welcome view (still accessible via Home button, just no longer the default)

### Backward Compatibility
- **Desktop:** Enhanced, not broken. Resizable panels preserved. Context strip and mini-chat are additive.
- **Mobile:** Toggle removed, all functionality accessible via quick-access bar and tool sheets. No features lost.
- **Tablet (768px-1023px):** Gets the mobile treatment. Consider adding a `md:` breakpoint variant in a future phase if tablet usage warrants side-by-side layout.

### Performance Considerations
- `InlineMiniChart` uses `dynamic()` import for TradingChart — chart library only loads when a chart message appears
- `MobileToolSheet` uses `AnimatePresence` — CenterPanel inside it only renders when `activeSheet` is non-null
- `DesktopContextStrip` fetches SPX/setup data independently with 60s/120s intervals — replaces (not duplicates) Welcome view fetching when context strip is visible
- `MiniChatOverlay` shows only last 5 messages to keep DOM light
- `useHoverCoordination` uses debounced CustomEvents — no re-renders unless actively hovering
- Chat messages remain scrollable; inline charts add ~200px height per chart message
