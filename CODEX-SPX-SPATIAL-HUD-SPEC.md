# SPX COMMAND CENTER: CHART-FORWARD SPATIAL HUD

## Autonomous Implementation Specification for Codex

**Version:** 2.0.0
**Route:** `/members/spx-command-center`
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Framer Motion, TradingView Lightweight Charts
**Objective:** Evolve from resizable panel layout to chart-dominant spatial canvas with collapsible intelligence sidebar

---

## TABLE OF CONTENTS

1. [Critical Context & Constraints](#1-critical-context--constraints)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Chart Expansion & Sidebar](#3-phase-1-chart-expansion--sidebar-days-1-6)
4. [Phase 2: Coordinate Sync & Spatial Overlays](#4-phase-2-coordinate-sync--spatial-overlays-days-7-12)
5. [Phase 3: Polish, Mobile & Telemetry](#5-phase-3-polish-mobile--telemetry-days-13-18)
6. [Component Specifications](#6-component-specifications)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Performance Requirements](#8-performance-requirements)
9. [Brand Compliance](#9-brand-compliance)
10. [Type Reference](#10-type-reference)
11. [File Manifest](#11-file-manifest)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. CRITICAL CONTEXT & CONSTRAINTS

### 1.1 What MUST Be Preserved

These systems are battle-tested production code. Do NOT rewrite, refactor, or bypass them:

- **5 nested context providers** — `SPXCommandCenterContext`, `SPXAnalyticsContext`, `SPXPriceContext`, `SPXSetupContext`, `SPXCoachContext`. Consume them; do not modify their interfaces.
- **Level stabilization algorithm** — `lib/spx/level-stability.ts` uses streak-based promotion (`FOCUSED_LEVEL_MIN_PROMOTE_STREAK = 2`) with churn tracking. The `SPXChart` component manages this. Do not alter the stabilization logic.
- **Price commit throttling** — `SPXChart` batches real-time price updates at 300ms intervals via `pendingPriceUpdateRef`. Do not change this cadence.
- **Layout state machine** — `lib/spx/layout-mode.ts` resolves `legacy | scan | evaluate | in_trade` from trade mode + selected setup. The new layout system must respect these modes.
- **Keyboard shortcuts** — J/K (cycle setups), Enter (trade focus), Esc (exit), 1-4 (quick actions), L (levels), F (flow), ? (help), ⌘K (palette). All must continue working.
- **Telemetry** — All user interactions emit events via `trackSPXTelemetryEvent()`. New features must emit telemetry too.
- **Mobile** — Smart stack mode + tab mode. Do not remove either. Enhance, don't replace.

### 1.2 Design System: "The Emerald Standard"

| Token | Value | Usage |
|-------|-------|-------|
| `--emerald-elite` | `#10B981` | Primary actions, bullish signals, support levels |
| `--champagne` | `#F5EDCC` | AI insights, fibonacci, spatial anchors |
| `--onyx` | `#0A0A0B` | All backgrounds (NEVER pure `#000000`) |
| Rose | `#FB7185` | Bearish signals, stops, risk warnings |
| **FORBIDDEN** | `#D4AF37` | Old gold hex. Refactor to emerald if found. |

### 1.3 Import Conventions

```typescript
// Always use @/ alias for absolute imports
import { cn } from '@/lib/utils'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { trackSPXTelemetryEvent, SPX_TELEMETRY_EVENT } from '@/lib/spx/telemetry'
```

### 1.4 Component Conventions

- All components are `'use client'` (client components)
- Use `glass-card-heavy` CSS class for floating containers
- Use `font-mono` (Geist Mono) for data, `font-serif` (Playfair) for headings
- Icons from `lucide-react` only
- Images via `next/image` only
- All interactive elements need `min-h-[36px]` or `min-h-[44px]` (mobile) touch targets

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Layout Modes

The existing state machine gains a new `immersive` dimension:

| Mode | Chart % | Sidebar | Trigger |
|------|---------|---------|---------|
| `scan` | 75% | 360px inline (pushes chart) | Default on page load |
| `evaluate` | 80% | 320px absolute overlay | Setup selected + ready/triggered |
| `in_trade` | 80% | 320px absolute overlay | `enterTrade()` called |
| `immersive` | 100% | 0px (hidden) | `I` key toggle |

The `immersive` flag is orthogonal to the layout mode — you can be in `scan + immersive` or `in_trade + immersive`.

### 2.2 Z-Index Stack

```
Z-0:  Chart canvas (TradingView Lightweight Charts) — position: absolute, inset: 0
Z-5:  Ambient data layer (GEX glow CSS gradients) — pointer-events: none
Z-10: Canvas overlays (native price lines, SVG cone) — pointer-events: none except interactive elements
Z-20: Spatial anchors (AI coach nodes, setup crosshairs) — pointer-events: auto on nodes
Z-30: Static HUD (header bar, action strip, sidebar) — pointer-events: auto
Z-40: Modals (command palette, shortcut help, trade confirm) — existing z-[70] system
```

### 2.3 New DOM Structure (page.tsx)

```
<SPXCommandCenterProvider>
  <div className="relative h-screen w-screen overflow-hidden bg-[#0A0A0B]">

    {/* Z-0: Chart fills available space */}
    <div className="absolute inset-0" style={{ right: sidebarOpen ? sidebarWidth : 0 }}>
      <ChartVignette />        {/* inset box-shadow overlay */}
      <GEXAmbientGlow />       {/* CSS gradient layer */}
      <SPXChart />             {/* Expanded, no glass-card wrapper */}
      <ProbabilityConeSVG />   {/* SVG overlay, z-10 */}
      <SpatialCoachNodes />    {/* HTML overlay, z-20 */}
    </div>

    {/* Z-30: Header */}
    <SPXHeader />              {/* Transparent overlay, top-0 */}

    {/* Z-30: Action Strip */}
    <ActionStrip />            {/* Transparent overlay, bottom-0 */}

    {/* Z-30: Collapsible Sidebar */}
    <SidebarPanel>
      {/* Content varies by layout mode */}
    </SidebarPanel>

    {/* Z-40: Modals */}
    <SPXCommandPalette />
    <ShortcutHelpModal />
  </div>
</SPXCommandCenterProvider>
```

---

## 3. PHASE 1: CHART EXPANSION & SIDEBAR (Days 1-6)

### 3.1 Task: Refactor page.tsx Layout

**File:** `app/members/spx-command-center/page.tsx`
**Current:** Uses `<PanelGroup direction="horizontal">` with `<Panel>` left (60%) and right (40%).
**Target:** Flex layout with expanded chart and collapsible sidebar.

#### Changes to `SPXCommandCenterContent`:

1. **Add state for immersive mode and sidebar:**

```typescript
const [immersiveMode, setImmersiveMode] = useState(false)
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
```

2. **Compute sidebar width from layout mode + immersive:**

```typescript
const sidebarWidth = useMemo(() => {
  if (immersiveMode || (isMobile && mobileSmartStackEnabled)) return 0
  if (sidebarCollapsed) return 0
  if (layoutMode === 'scan') return 360
  return 320
}, [immersiveMode, isMobile, mobileSmartStackEnabled, sidebarCollapsed, layoutMode])

const sidebarOpen = sidebarWidth > 0
```

3. **Replace desktop PanelGroup with new layout:**

The desktop branch (the `else` of `isMobile ?`) changes from:

```tsx
// REMOVE THIS:
<PanelGroup direction="horizontal" className="min-h-[68vh]">
  <Panel defaultSize={...} minSize={45}>
    {/* chart + flow + context */}
  </Panel>
  <PanelResizeHandle ... />
  <Panel defaultSize={...} minSize={30}>
    {/* setups + coach + contracts */}
  </Panel>
</PanelGroup>
```

To:

```tsx
<div className="relative h-[calc(100vh-56px)]"> {/* 56px for page chrome */}
  {/* Chart area: fills all space not used by sidebar */}
  <div
    className="absolute inset-0 transition-[right] duration-300 ease-out"
    style={{ right: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
  >
    {/* Vignette overlay for text legibility at edges */}
    <div className="pointer-events-none absolute inset-0 z-[1]"
      style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.7)' }}
    />

    {/* GEX Ambient Glow — see component spec */}
    {showGEXGlow && <GEXAmbientGlow />}

    {/* Main chart — no glass-card wrapper */}
    <SPXChart />

    {/* Probability cone SVG overlay — Phase 2 */}
    {showCone && <ProbabilityConeSVG />}

    {/* Spatial AI coach nodes — Phase 2 */}
    {showSpatialCoach && <SpatialCoachLayer />}

    {/* Level overlay modal (existing, triggered by L) */}
    {showLevelOverlay && (
      <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
        {/* ... existing LevelMatrix overlay code ... */}
      </div>
    )}
  </div>

  {/* Sidebar panel */}
  <SidebarPanel
    width={sidebarWidth}
    open={sidebarOpen}
    layoutMode={layoutMode}
    onClose={() => setSidebarCollapsed(true)}
  >
    {/* Sidebar content — varies by mode, see section 3.4 */}
  </SidebarPanel>
</div>
```

4. **Remove `react-resizable-panels` import.** The package is no longer used for the desktop layout. (Keep it if mobile tab layout uses it — check first. It does not; safe to remove entirely.)

5. **Keep mobile layout unchanged** — the `isMobile ?` branch stays exactly as-is for Phase 1.

### 3.2 Task: Modify SPXChart — Remove Card Wrapper, Expand

**File:** `components/spx-command-center/spx-chart.tsx`

#### Changes:

1. **Remove outer glass-card wrapper.** Change the root element from:

```tsx
<section className="glass-card-heavy rounded-2xl p-3.5 space-y-2.5">
```

To:

```tsx
<section className="relative h-full w-full">
```

2. **Remove timeframe buttons and level toggle from this component.** These move to ActionStrip (section 3.5). Remove the entire `<div className="flex flex-wrap items-center justify-between gap-2">` blocks that contain timeframe and focus/all buttons.

3. **Expand chart height.** Change:

```tsx
<div className="h-[400px] md:h-[500px]">
```

To:

```tsx
<div className="h-full">
```

4. **Remove the price feed badge and level count display** from SPXChart — these move to SPXHeader.

5. **Export timeframe and level toggle state** so ActionStrip can consume them. These are already in context (`useSPXPriceContext` for timeframe, local state for `showAllRelevantLevels`). Move `showAllRelevantLevels` to SPXSetupContext or lift it to page.tsx via a new shared ref/state.

### 3.3 Task: Redesign SPXHeader as Transparent Overlay

**File:** `components/spx-command-center/spx-header.tsx`

#### Current Behavior:
Renders as a `glass-card-heavy` section with regime bar, basis indicator, price display, and action buttons in a card layout.

#### New Behavior:
Fixed overlay bar at the top of the viewport, transparent gradient background.

```tsx
export function SPXHeader() {
  // ... existing context consumption unchanged ...

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="font-serif text-sm font-bold tracking-wider text-white">
            SPX COMMAND CENTER
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <span className="font-mono text-lg font-bold text-white">
          {spxPrice > 0 ? spxPrice.toFixed(2) : '--'}
        </span>
        {/* Regime badge */}
        <span className={cn(
          'rounded-md border px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em]',
          regime === 'trending'
            ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
            : regime === 'compression'
              ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
              : 'border-white/18 bg-white/[0.04] text-white/70'
        )}>
          {regime || 'Loading'}
        </span>
        {/* Data health indicator */}
        {dataHealth !== 'healthy' && (
          <span className={cn(
            'rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase',
            dataHealth === 'degraded'
              ? 'border-rose-300/40 bg-rose-500/12 text-rose-100'
              : 'border-amber-300/40 bg-amber-500/12 text-amber-100'
          )}>
            {dataHealth}
          </span>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/40">Basis</div>
          <div className="font-mono text-[11px] text-white/70">
            {basis ? `${basis.current >= 0 ? '+' : ''}${basis.current.toFixed(2)}` : '--'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/40">Feed</div>
          <div className={cn('font-mono text-[11px]',
            spxPriceSource === 'tick' ? 'text-emerald-400' : 'text-amber-400'
          )}>
            {spxPriceSource === 'tick' ? '● Live' : spxPriceSource === 'poll' ? '◐ Poll' : '○ Pending'}
          </div>
        </div>
        {/* ⌘K trigger */}
        <button
          type="button"
          onClick={() => setShowCommandPalette(true)}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <span className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[8px]">⌘K</span>
          Commands
        </button>
      </div>
    </header>
  )
}
```

**Note:** The `setShowCommandPalette` needs to be passed as a prop or lifted to context. Currently it's local state in page.tsx. Lift it via a callback prop: `onOpenCommandPalette: () => void`.

### 3.4 Task: Create SidebarPanel Component

**File (NEW):** `components/spx-command-center/sidebar-panel.tsx`

```typescript
'use client'

import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, PanelRightClose } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarPanelProps {
  width: number
  open: boolean
  layoutMode: 'legacy' | 'scan' | 'evaluate' | 'in_trade'
  onClose: () => void
  children: ReactNode
}

export function SidebarPanel({ width, open, layoutMode, onClose, children }: SidebarPanelProps) {
  const isOverlay = layoutMode === 'evaluate' || layoutMode === 'in_trade'

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'absolute top-0 right-0 bottom-0 z-30 flex flex-col overflow-hidden',
            isOverlay
              ? 'border-l border-white/8 bg-[#0A0A0B]/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.5)]'
              : 'border-l border-white/8 bg-[#0A0A0B]'
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5 shrink-0">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/50">
              {layoutMode === 'scan' ? 'Intelligence' : layoutMode === 'evaluate' ? 'Evaluation' : 'Trade Control'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
```

#### Sidebar Content by Layout Mode

Wire in page.tsx:

```tsx
<SidebarPanel width={sidebarWidth} open={sidebarOpen} layoutMode={layoutMode} onClose={() => setSidebarCollapsed(true)}>
  {layoutMode === 'scan' && (
    <>
      {uxFlags.coachDockV1 && (
        <CoachDock surface="desktop" isOpen={showDesktopCoachPanel} onToggle={handleDesktopCoachDockToggle} />
      )}
      {showDesktopCoachPanel && <AICoachFeed />}
      <SetupFeed />
      <FlowTicker />
      <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.1em] text-white/50 hover:text-white/70">
          Advanced Analytics
        </summary>
        <div className="mt-2.5 space-y-2.5">
          <LevelMatrix />
          <DecisionContext />
          <GEXLandscape profile={gexProfile?.combined || null} />
          <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
        </div>
      </details>
    </>
  )}

  {layoutMode === 'evaluate' && (
    <>
      <AICoachFeed />
      <SetupFeed />
      <ContractSelector />
      <DecisionContext />
    </>
  )}

  {layoutMode === 'in_trade' && (
    <>
      <AICoachFeed />
      <ContractSelector />
      <SetupFeed />
      <FlowTicker />
    </>
  )}
</SidebarPanel>
```

### 3.5 Task: Redesign ActionStrip as Bottom HUD

**File:** `components/spx-command-center/action-strip.tsx`

The action strip moves from a card below the header to a transparent overlay at the bottom of the viewport. It absorbs the timeframe controls from SPXChart.

```typescript
'use client'

import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { ChartTimeframe } from '@/lib/api/ai-coach'
import { cn } from '@/lib/utils'

interface ActionStripProps {
  showLevels: boolean
  onToggleLevels: () => void
  showCone: boolean
  onToggleCone: () => void
  showSpatialCoach: boolean
  onToggleSpatialCoach: () => void
  showGEXGlow: boolean
  onToggleGEXGlow: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  immersiveMode: boolean
  onToggleImmersive: () => void
  showAllLevels: boolean
  onToggleAllLevels: () => void
}

const TIMEFRAMES: ChartTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D']

export function ActionStrip(props: ActionStripProps) {
  const { selectedTimeframe, setChartTimeframe } = useSPXPriceContext()

  const overlayToggles = [
    { label: 'Levels', key: 'L', active: props.showLevels, toggle: props.onToggleLevels },
    { label: 'Cone', key: 'C', active: props.showCone, toggle: props.onToggleCone },
    { label: 'Coach', key: 'A', active: props.showSpatialCoach, toggle: props.onToggleSpatialCoach },
    { label: 'GEX', key: 'G', active: props.showGEXGlow, toggle: props.onToggleGEXGlow },
  ]

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 py-2.5"
      style={{
        background: 'linear-gradient(0deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Left: Timeframes */}
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => {
              setChartTimeframe(tf)
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                surface: 'action_strip_timeframe',
                timeframe: tf,
              })
            }}
            className={cn(
              'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              selectedTimeframe === tf
                ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200'
                : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80'
            )}
          >
            {tf}
          </button>
        ))}

        <div className="mx-2 h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={props.onToggleAllLevels}
          className={cn(
            'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.showAllLevels
              ? 'border-champagne/40 bg-champagne/12 text-champagne'
              : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80'
          )}
        >
          {props.showAllLevels ? 'All Levels' : 'Focus'}
        </button>
      </div>

      {/* Center: Overlay toggles */}
      <div className="flex items-center gap-1.5">
        {overlayToggles.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => {
              btn.toggle()
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                surface: 'action_strip_overlay',
                overlay: btn.label.toLowerCase(),
                nextState: !btn.active,
              })
            }}
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              btn.active
                ? 'border-champagne/30 bg-champagne/10 text-champagne'
                : 'border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70'
            )}
          >
            {btn.label}
            <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">
              {btn.key}
            </span>
          </button>
        ))}
      </div>

      {/* Right: Sidebar + Immersive */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={props.onToggleSidebar}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.sidebarOpen
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-white/10 bg-white/[0.02] text-white/50'
          )}
        >
          Panel
          <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">S</span>
        </button>
        <button
          type="button"
          onClick={props.onToggleImmersive}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.immersiveMode
              ? 'border-champagne/40 bg-champagne/12 text-champagne'
              : 'border-white/10 bg-white/[0.02] text-white/50'
          )}
        >
          Immersive
          <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">I</span>
        </button>
      </div>
    </div>
  )
}
```

### 3.6 Task: Create GEXAmbientGlow Component

**File (NEW):** `components/spx-command-center/gex-ambient-glow.tsx`

```typescript
'use client'

import { useMemo } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'

export function GEXAmbientGlow() {
  const { gexProfile } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()

  const gradients = useMemo(() => {
    if (!gexProfile?.combined?.gexByStrike || spxPrice <= 0) return 'none'

    const strikes = gexProfile.combined.gexByStrike
    const maxAbsGex = Math.max(...strikes.map(s => Math.abs(s.gex)), 1)

    // Only show top strikes by magnitude
    const significant = strikes
      .filter(s => Math.abs(s.gex) > maxAbsGex * 0.3)
      .slice(0, 6)

    if (significant.length === 0) return 'none'

    // Map price to approximate vertical position (0% = top of chart, 100% = bottom)
    // This is a rough heuristic; the chart's visible range determines actual position.
    // We estimate based on price distance from current price.
    const range = 60 // approximate visible range in points

    return significant.map(s => {
      const distanceFromPrice = s.strike - spxPrice
      const yPercent = 50 - (distanceFromPrice / range) * 50
      const clampedY = Math.max(5, Math.min(95, yPercent))
      const color = s.gex > 0 ? '16, 185, 129' : '251, 113, 133' // emerald or rose RGB
      const opacity = Math.min(0.08, (Math.abs(s.gex) / maxAbsGex) * 0.08)

      return `radial-gradient(ellipse 100% 80px at 50% ${clampedY}%, rgba(${color}, ${opacity}) 0%, transparent 70%)`
    }).join(', ')
  }, [gexProfile, spxPrice])

  if (gradients === 'none') return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] transition-[background] duration-500"
      style={{ background: gradients }}
    />
  )
}
```

### 3.7 Task: Add New Keyboard Shortcuts

**File:** `app/members/spx-command-center/page.tsx` (inside `handleKeyDown`)

Add these cases AFTER the existing shortcut handlers, before the closing `}` of the handler:

```typescript
if (key === 'i') {
  event.preventDefault()
  setImmersiveMode((prev) => !prev)
  trackShortcut('toggle_immersive', { nextState: !immersiveMode })
  return
}

if (key === 's') {
  event.preventDefault()
  setSidebarCollapsed((prev) => !prev)
  trackShortcut('toggle_sidebar', { nextState: !sidebarCollapsed })
  return
}

if (key === 'a') {
  event.preventDefault()
  setShowSpatialCoach((prev) => !prev)
  trackShortcut('toggle_spatial_coach', { nextState: !showSpatialCoach })
  return
}

if (key === 'c') {
  event.preventDefault()
  setShowCone((prev) => !prev)
  trackShortcut('toggle_cone', { nextState: !showCone })
  return
}

if (key === 'g') {
  event.preventDefault()
  setShowGEXGlow((prev) => !prev)
  trackShortcut('toggle_gex_glow', { nextState: !showGEXGlow })
  return
}
```

Also add these state variables at the top of `SPXCommandCenterContent`:

```typescript
const [showCone, setShowCone] = useState(true)
const [showSpatialCoach, setShowSpatialCoach] = useState(false)
const [showGEXGlow, setShowGEXGlow] = useState(true)
```

And update the shortcut help modal to include the new shortcuts.

---

## 4. PHASE 2: COORDINATE SYNC & SPATIAL OVERLAYS (Days 7-12)

### 4.1 Task: Create useChartCoordinates Hook

**File (NEW):** `hooks/use-chart-coordinates.ts`

This hook bridges the TradingView Lightweight Charts canvas coordinate system with React's DOM. It must NOT trigger React re-renders on pan/zoom.

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

export interface ChartCoordinateAPI {
  /** Convert a price to Y pixel coordinate. Returns null if price is outside visible range. */
  priceToPixel: (price: number) => number | null
  /** Convert a UNIX timestamp to X pixel coordinate. Returns null if time is outside visible range. */
  timeToPixel: (timestamp: number) => number | null
  /** Current visible price range */
  visiblePriceRange: { min: number; max: number } | null
  /** Chart container dimensions */
  chartDimensions: { width: number; height: number }
  /** Whether the coordinate system is ready */
  ready: boolean
}

/**
 * Attaches to a Lightweight Charts instance to provide price→pixel coordinate mapping.
 *
 * PERFORMANCE CONTRACT:
 * - Does NOT trigger React re-renders on pan/zoom
 * - Exposes a mutable ref that overlay components read imperatively
 * - Calls `onUpdate` callback (for requestAnimationFrame batching)
 */
export function useChartCoordinates(
  chartRef: React.RefObject<IChartApi | null>,
  seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
): {
  coordinatesRef: React.RefObject<ChartCoordinateAPI>
  /** Force a recalculation (call after chart.resize()) */
  invalidate: () => void
} {
  const coordinatesRef = useRef<ChartCoordinateAPI>({
    priceToPixel: () => null,
    timeToPixel: () => null,
    visiblePriceRange: null,
    chartDimensions: { width: 0, height: 0 },
    ready: false,
  })

  const recalculate = useCallback(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    const timeScale = chart.timeScale()

    coordinatesRef.current = {
      priceToPixel: (price: number) => {
        try {
          const y = series.priceToCoordinate(price)
          return y !== null && Number.isFinite(y) ? y : null
        } catch {
          return null
        }
      },
      timeToPixel: (timestamp: number) => {
        try {
          const x = timeScale.timeToCoordinate(timestamp as any)
          return x !== null && Number.isFinite(x) ? x : null
        } catch {
          return null
        }
      },
      visiblePriceRange: (() => {
        try {
          const range = series.priceScale().getVisiblePriceRange()
          return range ? { min: range.from, max: range.to } : null
        } catch {
          return null
        }
      })(),
      chartDimensions: (() => {
        try {
          const el = (chart as any).chartElement?.()
          if (el) return { width: el.clientWidth, height: el.clientHeight }
          return { width: 0, height: 0 }
        } catch {
          return { width: 0, height: 0 }
        }
      })(),
      ready: true,
    }
  }, [chartRef, seriesRef])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const timeScale = chart.timeScale()

    // Recalculate on visible range changes (fires on pan/zoom)
    const unsubTime = timeScale.subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(recalculate)
    })

    // Initial calculation
    recalculate()

    return () => {
      // subscribeVisibleLogicalRangeChange returns void; chart removal handles cleanup
    }
  }, [chartRef, recalculate])

  return { coordinatesRef, invalidate: recalculate }
}
```

**Integration with SPXChart:** The `TradingChart` component (`components/ai-coach/trading-chart.tsx`) must expose its `chartRef` and `candlestickSeriesRef` to the parent. Add forwarded refs or a callback prop:

```typescript
// In TradingChart, add an onChartReady callback:
interface TradingChartProps {
  // ... existing props ...
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Candlestick'>) => void
}

// Call in initChart after chart and series are created:
onChartReady?.(chart, candlestickSeries)
```

### 4.2 Task: Create ProbabilityConeSVG Component

**File (NEW):** `components/spx-command-center/probability-cone-svg.tsx`

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'

interface ProbabilityConeSVGProps {
  coordinatesRef: React.RefObject<ChartCoordinateAPI>
}

export function ProbabilityConeSVG({ coordinatesRef }: ProbabilityConeSVGProps) {
  const { prediction } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const svgRef = useRef<SVGSVGElement>(null)
  const [pathData, setPathData] = useState<string>('')
  const [centerLine, setCenterLine] = useState<string>('')
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!prediction?.probabilityCone?.length || spxPrice <= 0) {
      setPathData('')
      return
    }

    const coords = coordinatesRef.current
    if (!coords.ready) return

    const updatePath = () => {
      const c = coordinatesRef.current
      if (!c.ready) return

      const startY = c.priceToPixel(spxPrice)
      if (startY === null) return

      const { width, height } = c.chartDimensions
      setDims({ width, height })

      // The cone starts at the right edge of visible data and extends right
      const startX = width * 0.85 // Start near right side of chart
      const coneWidth = width * 0.12 // Cone extends 12% of chart width

      const points = prediction.probabilityCone
      const topPoints: string[] = []
      const bottomPoints: string[] = []

      points.forEach((pt, i) => {
        const fraction = (i + 1) / points.length
        const x = startX + fraction * coneWidth
        const highY = c.priceToPixel(pt.high)
        const lowY = c.priceToPixel(pt.low)
        if (highY !== null) topPoints.push(`${x},${highY}`)
        if (lowY !== null) bottomPoints.push(`${x},${lowY}`)
      })

      if (topPoints.length === 0 || bottomPoints.length === 0) {
        setPathData('')
        return
      }

      const path = `M${startX},${startY} L${topPoints.join(' L')} L${bottomPoints.reverse().join(' L')} Z`
      setPathData(path)

      // Center bias line
      const lastCone = prediction.probabilityCone[prediction.probabilityCone.length - 1]
      const centerPrice = lastCone ? (lastCone.high + lastCone.low) / 2 + (prediction.direction.bullish - prediction.direction.bearish) * 2 : spxPrice
      const centerY = c.priceToPixel(centerPrice)
      if (centerY !== null) {
        const endX = startX + coneWidth
        setCenterLine(`M${startX},${startY} L${endX},${centerY}`)
      }
    }

    // Debounce updates to 100ms
    const rafId = requestAnimationFrame(updatePath)
    const intervalId = setInterval(() => requestAnimationFrame(updatePath), 100)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(intervalId)
    }
  }, [prediction, spxPrice, coordinatesRef])

  if (!pathData) return null

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-10"
      width={dims.width}
      height={dims.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="cone-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Cone fill */}
      <path d={pathData} fill="url(#cone-gradient)" stroke="#10B981" strokeWidth={0.5} strokeOpacity={0.3} />

      {/* Directional bias center line */}
      {centerLine && (
        <path d={centerLine} fill="none" stroke="#F5EDCC" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" />
      )}
    </svg>
  )
}
```

### 4.3 Task: Create SpatialCoachNode Component

**File (NEW):** `components/spx-command-center/spatial-coach-node.tsx`

```typescript
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { cn } from '@/lib/utils'

interface SpatialCoachNodeProps {
  message: CoachMessage
  /** Extracted price reference from message content */
  anchorPrice: number
  coordinatesRef: React.RefObject<ChartCoordinateAPI>
  onDismiss: (id: string) => void
  onAction: (actionId: string, messageId: string) => void
}

export function SpatialCoachNode({
  message,
  anchorPrice,
  coordinatesRef,
  onDismiss,
  onAction,
}: SpatialCoachNodeProps) {
  const [expanded, setExpanded] = useState(false)

  const coords = coordinatesRef.current
  if (!coords.ready) return null

  const y = coords.priceToPixel(anchorPrice)
  if (y === null || y < 48 || y > coords.chartDimensions.height - 48) return null

  // Position at 70% from left (near right side of chart, before cone area)
  const x = coords.chartDimensions.width * 0.65

  const isBearish = message.type === 'pre_trade' && message.content.toLowerCase().includes('fade')
  const color = isBearish ? '#FB7185' : '#10B981'

  return (
    <div
      className="pointer-events-auto absolute z-20"
      style={{ left: x, top: y, transform: 'translate(-7px, -7px)' }}
    >
      {/* Horizontal connector line to price axis */}
      <svg
        className="pointer-events-none absolute"
        style={{ left: 7, top: 7, overflow: 'visible' }}
        width={1}
        height={1}
      >
        <line
          x1={0} y1={0}
          x2={coords.chartDimensions.width - x - 80}
          y2={0}
          stroke={color}
          strokeWidth={0.5}
          strokeOpacity={0.2}
          strokeDasharray="2 4"
        />
      </svg>

      {/* Pulsing dot */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="relative h-3.5 w-3.5 rounded-full"
        style={{
          background: color,
          border: `2px solid #0A0A0B`,
          boxShadow: `0 0 12px ${color}66, 0 0 4px ${color}`,
          animation: 'spatial-pulse 2s ease-in-out infinite',
        }}
      />

      {/* Expanded popover */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 20 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className="glass-card-heavy absolute left-5 top-[-60px] z-50 w-[260px] rounded-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[9px] font-mono uppercase tracking-[0.1em]"
                style={{ color: `${color}cc` }}
              >
                AI Coach
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-white/35">@ {anchorPrice.toFixed(0)}</span>
                <button type="button" onClick={() => onDismiss(message.id)} className="text-white/30 hover:text-white/60">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-white/80">
              {message.content.slice(0, 200)}{message.content.length > 200 ? '...' : ''}
            </p>
            <div className="mt-2.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => onAction('stage_trade', message.id)}
                className="rounded-md border px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.06em] transition-colors"
                style={{
                  background: `${color}15`,
                  borderColor: `${color}33`,
                  color: color,
                }}
              >
                Stage Trade
              </button>
              <button
                type="button"
                onClick={() => onAction('details', message.id)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.06em] text-white/50 hover:text-white/70 transition-colors"
              >
                Details
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

Add to `app/globals.css`:

```css
@keyframes spatial-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}
```

### 4.4 Task: Create SpatialCoachLayer

**File (NEW):** `components/spx-command-center/spatial-coach-layer.tsx`

This is the container that manages which coach messages get spatial anchors.

```typescript
'use client'

import { useMemo, useState, useCallback } from 'react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { SpatialCoachNode } from '@/components/spx-command-center/spatial-coach-node'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { trackSPXTelemetryEvent, SPX_TELEMETRY_EVENT } from '@/lib/spx/telemetry'

const MAX_SPATIAL_NODES = 5
const PRICE_PATTERN = /\b(5[5-9]\d{2}|6[0-2]\d{2})\b/ // Match SPX-range prices (5500-6299)

interface SpatialCoachLayerProps {
  coordinatesRef: React.RefObject<ChartCoordinateAPI>
}

export function SpatialCoachLayer({ coordinatesRef }: SpatialCoachLayerProps) {
  const { coachMessages } = useSPXCoachContext()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  // Extract messages that reference specific price levels
  const spatialMessages = useMemo(() => {
    return coachMessages
      .filter(msg => !dismissedIds.has(msg.id))
      .map(msg => {
        const match = msg.content.match(PRICE_PATTERN)
        if (!match) return null
        return { message: msg, anchorPrice: parseFloat(match[0]) }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, MAX_SPATIAL_NODES)
  }, [coachMessages, dismissedIds])

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'spatial_coach_node',
      action: 'dismiss',
      messageId: id,
    })
  }, [])

  const handleAction = useCallback((actionId: string, messageId: string) => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_ACTION_CLICKED, {
      surface: 'spatial_node',
      actionId,
      messageId,
    })
  }, [])

  return (
    <>
      {spatialMessages.map(({ message, anchorPrice }) => (
        <SpatialCoachNode
          key={message.id}
          message={message}
          anchorPrice={anchorPrice}
          coordinatesRef={coordinatesRef}
          onDismiss={handleDismiss}
          onAction={handleAction}
        />
      ))}
    </>
  )
}
```

---

## 5. PHASE 3: POLISH, MOBILE & TELEMETRY (Days 13-18)

### 5.1 Mobile Chart Expansion

**File:** `components/spx-command-center/spx-chart.tsx`

In the mobile smart stack path, change chart height:

```tsx
// Old:
<div className="h-[400px] md:h-[500px]">

// New (only for mobile — desktop is h-full):
<div className={cn(isMobile ? 'h-[55vh] min-h-[320px] max-h-[500px]' : 'h-full')}>
```

Enable GEX glow behind mobile chart by wrapping the mobile SPXChart in a relative container with `<GEXAmbientGlow />`.

### 5.2 New Telemetry Events

Add to `SPX_TELEMETRY_EVENT` in `lib/spx/telemetry.ts`:

```typescript
SPATIAL_OVERLAY_TOGGLED: 'spx_spatial_overlay_toggled',
SPATIAL_NODE_EXPANDED: 'spx_spatial_node_expanded',
SPATIAL_NODE_DISMISSED: 'spx_spatial_node_dismissed',
SPATIAL_NODE_ACTION: 'spx_spatial_node_action',
IMMERSIVE_MODE_TOGGLED: 'spx_immersive_mode_toggled',
SIDEBAR_TOGGLED: 'spx_sidebar_toggled',
CONE_INTERACTION: 'spx_cone_interaction',
GEX_GLOW_TOGGLED: 'spx_gex_glow_toggled',
```

### 5.3 Performance Safeguard

Add to `SPXChart` or the chart container in `page.tsx`:

```typescript
// Auto-hide spatial overlays when frame budget is exceeded
const [spatialThrottled, setSpatialThrottled] = useState(false)
const frameTimesRef = useRef<number[]>([])

useEffect(() => {
  let rafId: number
  let lastFrame = performance.now()

  const measureFrame = () => {
    const now = performance.now()
    const frameTime = now - lastFrame
    lastFrame = now

    frameTimesRef.current.push(frameTime)
    if (frameTimesRef.current.length > 10) frameTimesRef.current.shift()

    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length

    if (avgFrameTime > 20 && !spatialThrottled) {
      setSpatialThrottled(true)
      // Re-enable after 200ms of idle
      setTimeout(() => setSpatialThrottled(false), 200)
    }

    rafId = requestAnimationFrame(measureFrame)
  }

  rafId = requestAnimationFrame(measureFrame)
  return () => cancelAnimationFrame(rafId)
}, [spatialThrottled])

// Use spatialThrottled to conditionally hide SpatialCoachLayer and ProbabilityConeSVG
```

### 5.4 Update Shortcut Help Modal

In page.tsx, update the shortcut help content to include:

```tsx
<p><span className="font-mono text-emerald-200">I</span> toggle immersive mode</p>
<p><span className="font-mono text-emerald-200">S</span> toggle sidebar</p>
<p><span className="font-mono text-emerald-200">A</span> toggle spatial AI coach</p>
<p><span className="font-mono text-emerald-200">C</span> toggle probability cone</p>
<p><span className="font-mono text-emerald-200">G</span> toggle GEX ambient glow</p>
```

### 5.5 Update Command Palette

Add new commands to `commandPaletteCommands` in page.tsx:

```typescript
commands.push({
  id: 'toggle-immersive',
  label: immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode',
  keywords: ['immersive', 'fullscreen', 'hud', 'spatial'],
  shortcut: 'I',
  group: 'View',
  run: () => {
    setImmersiveMode(prev => !prev)
    trackCommand('toggle_immersive', { nextState: !immersiveMode })
  },
})

commands.push({
  id: 'toggle-sidebar',
  label: sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar',
  keywords: ['sidebar', 'panel', 'hide', 'show'],
  shortcut: 'S',
  group: 'View',
  run: () => {
    setSidebarCollapsed(prev => !prev)
    trackCommand('toggle_sidebar', { nextState: !sidebarCollapsed })
  },
})

commands.push({
  id: 'toggle-spatial-coach',
  label: showSpatialCoach ? 'Disable spatial coach' : 'Enable spatial coach',
  keywords: ['spatial', 'coach', 'anchor', 'nodes'],
  shortcut: 'A',
  group: 'Overlays',
  run: () => {
    setShowSpatialCoach(prev => !prev)
    trackCommand('toggle_spatial_coach', { nextState: !showSpatialCoach })
  },
})

commands.push({
  id: 'toggle-probability-cone',
  label: showCone ? 'Hide probability cone' : 'Show probability cone',
  keywords: ['cone', 'probability', 'expected', 'move'],
  shortcut: 'C',
  group: 'Overlays',
  run: () => {
    setShowCone(prev => !prev)
    trackCommand('toggle_cone', { nextState: !showCone })
  },
})
```

---

## 6. COMPONENT SPECIFICATIONS

### Summary of All Components

| Component | File | Status | Lines (est.) |
|-----------|------|--------|-------------|
| `SPXChart` | `components/spx-command-center/spx-chart.tsx` | MODIFY | 546 → ~480 |
| `SPXHeader` | `components/spx-command-center/spx-header.tsx` | REWRITE | 271 → ~180 |
| `ActionStrip` | `components/spx-command-center/action-strip.tsx` | REWRITE | 72 → ~140 |
| `SidebarPanel` | `components/spx-command-center/sidebar-panel.tsx` | NEW | ~80 |
| `GEXAmbientGlow` | `components/spx-command-center/gex-ambient-glow.tsx` | NEW | ~60 |
| `ProbabilityConeSVG` | `components/spx-command-center/probability-cone-svg.tsx` | NEW | ~120 |
| `SpatialCoachNode` | `components/spx-command-center/spatial-coach-node.tsx` | NEW | ~130 |
| `SpatialCoachLayer` | `components/spx-command-center/spatial-coach-layer.tsx` | NEW | ~70 |
| `useChartCoordinates` | `hooks/use-chart-coordinates.ts` | NEW | ~90 |
| `page.tsx` | `app/members/spx-command-center/page.tsx` | MAJOR MODIFY | 757 → ~800 |

### Components NOT Modified (preserve as-is)

- `ai-coach-feed.tsx` (905 lines) — Unchanged. Renders in sidebar.
- `setup-feed.tsx` (270 lines) — Unchanged. Renders in sidebar.
- `setup-card.tsx` (270 lines) — Unchanged.
- `contract-selector.tsx` (289 lines) — Unchanged. Renders in sidebar.
- `contract-card.tsx` (321 lines) — Unchanged.
- `decision-context.tsx` (363 lines) — Unchanged. Moves to sidebar.
- `level-matrix.tsx` (143 lines) — Unchanged. Moves to sidebar.
- `gex-landscape.tsx` (173 lines) — Unchanged. Stays in sidebar analytics.
- `gex-heatmap.tsx` (115 lines) — Unchanged. Stays in sidebar analytics.
- `flow-ticker.tsx` (224 lines) — Unchanged. Moves to sidebar.
- `command-palette.tsx` (187 lines) — Minor: add new commands.
- `coach-message.tsx` (118 lines) — Unchanged.
- `coach-dock.tsx` (82 lines) — Unchanged.
- `coach-bottom-sheet.tsx` (58 lines) — Unchanged.
- `mobile-brief-panel.tsx` (121 lines) — Unchanged.
- `mobile-panel-tabs.tsx` (41 lines) — Unchanged.
- `probability-cone.tsx` (47 lines) — Kept as sidebar fallback.
- `fib-overlay.tsx` (44 lines) — Unchanged.
- `cluster-zone-bar.tsx` (42 lines) — Unchanged.
- `basis-indicator.tsx` (52 lines) — Absorbed into SPXHeader.
- `regime-bar.tsx` (47 lines) — Absorbed into SPXHeader.
- `spx-skeleton.tsx` (49 lines) — Unchanged.

---

## 7. KEYBOARD SHORTCUTS

### Complete Shortcut Map

| Key | Action | Context | Handler Location |
|-----|--------|---------|-----------------|
| `J` | Next setup | Not typing | page.tsx `handleKeyDown` |
| `K` | Previous setup | Not typing | page.tsx `handleKeyDown` |
| `Enter` | Enter trade focus | Setup selected | page.tsx `handleKeyDown` |
| `Escape` | Exit focus / deselect | Any | page.tsx `handleKeyDown` |
| `1`-`4` | Coach quick actions | Not typing | page.tsx → CustomEvent |
| `L` | Toggle level overlay | Not typing | page.tsx `handleKeyDown` |
| `F` | Toggle flow expansion | Not typing | page.tsx → CustomEvent |
| `?` | Show shortcuts help | Not typing | page.tsx `handleKeyDown` |
| `⌘K` / `Ctrl+K` | Command palette | Any | page.tsx `handleKeyDown` |
| `I` | Toggle immersive mode | Not typing | page.tsx `handleKeyDown` **NEW** |
| `S` | Toggle sidebar | Not typing | page.tsx `handleKeyDown` **NEW** |
| `A` | Toggle spatial coach | Not typing | page.tsx `handleKeyDown` **NEW** |
| `C` | Toggle probability cone | Not typing | page.tsx `handleKeyDown` **NEW** |
| `G` | Toggle GEX glow | Not typing | page.tsx `handleKeyDown` **NEW** |

**Conflict check:** None of the new keys (I, S, A, C, G) conflict with existing shortcuts (J, K, L, F, 1-4, Enter, Esc, ?).

---

## 8. PERFORMANCE REQUIREMENTS

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Chart pan/zoom FPS | ≥45 fps (60 goal) | Chrome DevTools Performance panel |
| Spatial overlay sync lag | ≤2 frames (33ms) | Visual inspection |
| Sidebar open/close | <300ms | Framer Motion spring completion |
| First contentful paint | <2s on 4G | Lighthouse throttled |
| Bundle size (route) | <180kb gzipped | next build analyzer |
| Memory (30min session) | <120MB heap | Chrome DevTools Memory |
| Level stabilization churn | <4 mutations/min | Existing CHART_LEVEL_SET_CHANGED telemetry |

### Performance Rules

1. `useChartCoordinates` MUST use refs/MotionValues, NEVER `useState` for coordinate data
2. SVG cone updates MUST be debounced ≥100ms
3. GEX glow gradient updates MUST be debounced ≥200ms
4. `chart.resize()` calls during sidebar animation MUST be debounced ≥50ms
5. Spatial nodes auto-hide when average frame time >20ms
6. Maximum 5 concurrent spatial nodes, FIFO dismissal

---

## 9. BRAND COMPLIANCE

### Required Styles

```css
/* All floating containers */
.glass-card-heavy {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(60px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

/* Backgrounds: ALWAYS #0A0A0B, never #000000 */
/* Bullish: emerald-500 (#10B981) */
/* Bearish: rose-500 (#FB7185) */
/* AI/Fib: champagne (#F5EDCC) */
/* Data text: font-mono (Geist Mono) */
/* Headings: font-serif (Playfair Display) */
/* FORBIDDEN: gold #D4AF37 */
```

---

## 10. TYPE REFERENCE

### Key Interfaces for New Components

```typescript
// From lib/types/spx-command-center.ts
type Regime = 'trending' | 'ranging' | 'compression' | 'breakout'
type LevelCategory = 'structural' | 'tactical' | 'intraday' | 'options' | 'spy_derived' | 'fibonacci'
type LevelStrength = 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
type TradeMode = 'scan' | 'in_trade'
type SPXLayoutMode = 'legacy' | 'scan' | 'evaluate' | 'in_trade'
type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D'

interface PredictionState {
  regime: Regime
  direction: { bullish: number; bearish: number; neutral: number }
  probabilityCone: Array<{
    minutesForward: number
    high: number
    low: number
    center: number
    confidence: number
  }>
  confidence: number
  // ... additional fields
}

interface GEXProfile {
  netGex: number
  flipPoint: number
  callWall: number
  putWall: number
  gexByStrike: Array<{ strike: number; gex: number }>
  keyLevels: Array<{ strike: number; gex: number; type: string }>
  // ... additional fields
}

interface CoachMessage {
  id: string
  type: 'pre_trade' | 'in_trade' | 'behavioral' | 'post_trade' | 'alert'
  priority: 'alert' | 'setup' | 'guidance' | 'behavioral'
  setupId: string | null
  content: string
  structuredData: Record<string, unknown>
  timestamp: string
}

interface BasisState {
  current: number
  trend: 'expanding' | 'contracting' | 'stable'
  leading: 'SPX' | 'SPY' | 'neutral'
}

// From components/ai-coach/trading-chart.tsx
interface LevelAnnotation {
  price: number
  label: string
  color: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  axisLabelVisible?: boolean
  type?: string
  strength?: string
  description?: string
  testsToday?: number
  lastTest?: string | null
  holdRate?: number | null
  displayContext?: string
}
```

### Context Consumption Pattern

```typescript
// Use these hooks in components — DO NOT destructure unused values
const { levels, gexProfile, prediction, regime } = useSPXAnalyticsContext()
const { spxPrice, spxPriceSource, selectedTimeframe, setChartTimeframe } = useSPXPriceContext()
const { selectedSetup, tradeMode, chartAnnotations, visibleLevelCategories } = useSPXSetupContext()
const { coachMessages, coachDecision } = useSPXCoachContext()
const { dataHealth, dataHealthMessage, uxFlags } = useSPXCommandCenter()
```

---

## 11. FILE MANIFEST

### Files to Create

| Path | Purpose |
|------|---------|
| `components/spx-command-center/sidebar-panel.tsx` | Collapsible sidebar container |
| `components/spx-command-center/gex-ambient-glow.tsx` | CSS gradient GEX overlay |
| `components/spx-command-center/probability-cone-svg.tsx` | SVG probability cone |
| `components/spx-command-center/spatial-coach-node.tsx` | Individual spatial AI anchor |
| `components/spx-command-center/spatial-coach-layer.tsx` | Spatial node manager |
| `hooks/use-chart-coordinates.ts` | Chart coordinate sync engine |

### Files to Modify

| Path | Scope |
|------|-------|
| `app/members/spx-command-center/page.tsx` | Layout restructure, sidebar, new state, new shortcuts |
| `components/spx-command-center/spx-chart.tsx` | Remove card wrapper, expand, expose chart refs |
| `components/spx-command-center/spx-header.tsx` | Transparent overlay bar redesign |
| `components/spx-command-center/action-strip.tsx` | Bottom HUD with timeframes + overlay toggles |
| `components/spx-command-center/command-palette.tsx` | Add new spatial commands |
| `components/ai-coach/trading-chart.tsx` | Add `onChartReady` callback prop |
| `lib/spx/telemetry.ts` | New telemetry event constants |
| `app/globals.css` | Add `spatial-pulse` keyframe animation |

### Files to Remove

| Path | Reason |
|------|--------|
| None | All components preserved. `react-resizable-panels` import removed from page.tsx but package stays in package.json (may be used elsewhere). |

### Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| `react-resizable-panels` | REMOVE from page.tsx imports | Keep in package.json if used elsewhere |
| `framer-motion` | EXISTING | Already in bundle. Used for sidebar animation |
| `lightweight-charts` | EXISTING | Already in bundle. Extended with coordinate API |
| `lucide-react` | EXISTING | No new icons needed beyond `PanelRightClose`, `X` |

---

## 12. ACCEPTANCE CRITERIA

### Phase 1 (Days 1-6)

- [ ] `react-resizable-panels` removed from page.tsx desktop layout
- [ ] Chart fills 75%+ of viewport in scan mode, 80% in evaluate/in_trade
- [ ] Sidebar collapses/expands with spring animation (<300ms)
- [ ] SPXHeader renders as transparent overlay at top, not a card
- [ ] ActionStrip renders at bottom with timeframe controls + overlay toggles
- [ ] GEX ambient glow visible behind chart (subtle emerald/rose gradients)
- [ ] Keyboard shortcuts I (immersive), S (sidebar) work correctly
- [ ] Immersive mode hides sidebar, chart fills 100% viewport
- [ ] All existing features work: J/K cycling, Enter trade, coach feed, level matrix
- [ ] Mobile layout completely unchanged (no regressions)
- [ ] Data health indicator visible in header overlay

### Phase 2 (Days 7-12)

- [ ] `useChartCoordinates` hook provides priceToPixel mapping
- [ ] TradingChart exposes chart/series refs via `onChartReady` callback
- [ ] Probability cone SVG renders forward in time from current price
- [ ] Cone updates are debounced (no jank during pan/zoom)
- [ ] Spatial AI coach nodes appear at referenced price levels
- [ ] Node click expands glass-card popover with message + actions
- [ ] Maximum 5 concurrent nodes, FIFO dismissal
- [ ] Keyboard shortcuts A (spatial coach), C (cone) work correctly
- [ ] Pan/zoom maintains ≥45fps with all overlays active
- [ ] Spatial overlays auto-hide when frame budget exceeded

### Phase 3 (Days 13-18)

- [ ] Mobile chart expanded to 55vh with GEX glow
- [ ] New telemetry events firing for all overlay interactions
- [ ] Command palette includes spatial commands
- [ ] Shortcut help modal includes all new shortcuts
- [ ] 30-minute real trading session: all performance targets met
- [ ] Empty states handled (no levels, no setups, no coach messages)
- [ ] Data health degraded/stale state visible in overlay mode
- [ ] No accessibility regressions (tab navigation, screen reader)

---

*End of specification. All file paths are relative to the project root. All imports use the `@/` alias convention. This spec is designed for autonomous implementation — no human clarification should be needed.*
