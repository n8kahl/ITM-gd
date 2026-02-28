# Trade Day Replay V2 — Chart Upgrade Execution Spec

> **Status:** Slices 1–7 implemented; Session C hardening + release closeout complete.
> **Date:** 2026-02-27
> **Release Closeout:** 2026-02-28
> **Governing Spec:** `docs/specs/TRADE_DAY_REPLAY_EXECUTION_SPEC_2026-02-27.md`

---

## Context

The Trade Day Replay feature is functional but visually underwhelming compared to the SPX Command Center. The chart shows raw candles with no indicators, trade markers are HTML overlays that don't move with the chart, there's no volume, no key levels, and the session analysis is stats-only. The infrastructure to fix all of this already exists — `TradingChart` supports EMA 8/21, VWAP, volume, Opening Range, RSI, MACD, and level annotations. The indicators are just disabled (`REPLAY_INDICATORS` all `false`), and the marker system chose HTML overlays over native chart markers.

## Scope

7 upgrades across 3 layers (chart, markers, analysis), ordered by impact.

---

## Slice 1: Enable Indicators + Toolbar ✅

**Effort:** Small | **Impact:** High — transforms raw candles into analytical chart
**Status:** Implemented

**What changed:**
- Replaced hardcoded `REPLAY_INDICATORS` (all false) with `useState<IndicatorConfig>` in `ReplayChartPanel`
- Defaults: `ema8: true, ema21: true, vwap: true, openingRange: true, rsi: false, macd: false`
- Created `indicator-toolbar.tsx` — compact toggle bar below replay controls

**Files:**

| File | Action |
|------|--------|
| `components/trade-day-replay/replay-chart.tsx` | Replaced const with `useState<IndicatorConfig>`, passes state to `TradingChart`, renders toolbar |
| `components/trade-day-replay/indicator-toolbar.tsx` | **NEW** — toggle buttons for EMA8, EMA21, VWAP, Opening Range, RSI, MACD |

**Indicator toolbar design:**
- Row of pill-shaped toggle buttons inside `glass-card-heavy` container
- Active: emerald background + white text + colored left border per indicator
- Inactive: transparent + white/40 + hover state
- Icons from lucide-react: `TrendingUp` (EMA), `Activity` (VWAP), `Square` (OR), `BarChart3` (RSI), `Waves` (MACD)
- Compact: single horizontal row, wraps on mobile

**Reuse:** `IndicatorConfig` type from `components/ai-coach/chart-indicators.ts` (already exported). `TradingChart` already accepts `indicators` prop — zero interface changes needed.

---

## Slice 2: Volume Histogram ✅

**Effort:** Trivial | **Impact:** Medium — adds conviction context to every candle
**Status:** Verified — no code changes needed

**What changed:**
- `TradingChart` already renders a volume `HistogramSeries` when bars have `volume` data
- The volume series is always created (line 569-572 of `trading-chart.tsx`) and populated (line 979-985)
- Works because bars include volume from Massive.com
- Volume was suppressed only because `REPLAY_INDICATORS` was all false and the chart was under-configured — enabling indicators fixed this

---

## Slice 3: Native Chart Markers (Replace HTML Overlay) ✅

**Effort:** Medium | **Impact:** High — fixes "overlay doesn't move" bug permanently
**Status:** Implemented

**What changed:**
- Created `trade-chart-markers.ts` utility that converts `EnrichedTrade[]` to lightweight-charts v5 native markers
- Uses `createSeriesMarkers(series)` plugin API (v5) — markers move with chart pan/zoom/replay automatically
- Uses `series.createPriceLine()` for stop levels — horizontal lines that track with price scale

**New file:** `components/trade-day-replay/trade-chart-markers.ts`

```typescript
export type TradeSeriesMarker = SeriesMarker<number>

export function buildTradeMarkers(
  trades: EnrichedTrade[],
  visibleBars: ChartBar[],
  selectedTradeIndex?: number
): TradeSeriesMarker[]

export function buildStopPriceLines(
  trades: EnrichedTrade[],
  visibleBars: ChartBar[],
): TradePriceLineOptions[]
```

**Marker mapping:**

| Trade Event | Shape | Position | Color | Text |
|-------------|-------|----------|-------|------|
| Entry | `arrowUp` | Below candle | `#10B981` (emerald) | Contract shorthand: "6770P" |
| Full Exit | `arrowDown` | Above candle | `#ef4444` (red) | P&L: "+46%" |
| Trim | `circle` | Above candle | `#F3E5AB` (champagne) | "T 21%" |

**Stop levels:** `createPriceLine({ price, color: '#ef4444', lineWidth: 1, lineStyle: 2 (Dashed), title: 'Stop 6859' })`

**Integration in `replay-chart.tsx`:**
- Uses `onChartReady` callback from `TradingChart` to get `chart` and `series` refs
- Creates `ISeriesMarkersPluginApi<number>` via `createSeriesMarkers(series)` on chart ready
- On each frame advance (visibleBars change), calls `buildTradeMarkers()` and `markersPlugin.setMarkers()`
- Manages price line refs in a `useRef` — clears old lines, creates new ones per frame

**Deprecated:** `trade-marker-overlay.tsx` — no longer rendered. File kept for reference during transition.

---

## Slice 4: Key Levels (PDH/PDL + Opening Range Box) ✅

**Effort:** Medium | **Impact:** High — essential trading reference points
**Status:** Implemented

### 4a: Prior Day High/Low (Backend)

**Files:**

| File | Action |
|------|--------|
| `backend/src/routes/trade-day-replay.ts` | Added `getPriorTradingDay()` (skips weekends), `fetchPriorDayBar()` using `getDailyAggregates('I:SPX', priorDate, priorDate)` |
| `backend/src/services/trade-day-replay/types.ts` | Added `PriorDayBar` interface, optional `priorDayBar` on `ReplayPayload` |
| `lib/trade-day-replay/types.ts` | Mirrored `PriorDayBar` and `priorDayBar` addition |

**Backend logic:**
```typescript
function getPriorTradingDay(dateStr: string): string // skips weekends
async function fetchPriorDayBar(replayDate: string): Promise<PriorDayBar | undefined>
// Uses getDailyAggregates('I:SPX', priorDate, priorDate)
// Fail-safe: logs warning and returns undefined on error
```

### 4b: Render Levels on Chart (Frontend)

**File:** `components/trade-day-replay/replay-chart.tsx`

- `priorDayBar` flows from shell → `ReplayChart` → `ReplayChartPanel` via props
- If `priorDayBar` exists, creates two `createPriceLine()` calls in the marker effect:
  - PDH: `#10B981` (emerald) dashed, `title: "PDH"`
  - PDL: `#ef4444` (red) dashed, `title: "PDL"`
- Opening Range: already computed by `calculateOpeningRangeBox()` when `indicators.openingRange` is true — TradingChart handles rendering

**File:** `app/members/trade-day-replay/trade-day-replay-shell.tsx`
- Updated to pass `payload.priorDayBar` to `<ReplayChart>`

---

## Slice 5: Upgraded Session Analysis ✅

**Effort:** Medium | **Impact:** Medium — adds insight beyond raw stats
**Status:** Implemented

### 5a: Equity Curve

**New file:** `components/trade-day-replay/equity-curve.tsx`

- Canvas-based cumulative P&L line chart (140px height) in glass-card container
- X-axis: trade number (1, 2, 3...) | Y-axis: cumulative P&L %
- Data: running sum of each trade's `pnlPercent`
- Line color: emerald when cumulative positive, red when negative
- Area fill gradient below line matching line color
- Zero line as dashed reference
- Data point dots at each trade
- Header shows "Equity Curve" label + final cumulative P&L value
- Returns null if fewer than 2 data points

### 5b: Session Grade

**New file:** `lib/trade-day-replay/session-grader.ts`

```typescript
export type SessionGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface SessionGradeResult {
  grade: SessionGrade
  score: number
  factors: string[]
}

export function computeSessionGrade(
  stats: SessionStats,
  trades: EnrichedTrade[]
): SessionGradeResult
```

**Scoring (100-point scale → letter):**
- Win rate contribution (0–30): `winRate >= 80% → 30, >= 60% → 22, >= 40% → 14, else 6`
- R:R ratio contribution (0–25): average `expectedValueR` across trades
- Discipline contribution (0–25): average `alignmentScore` from evaluations
- Risk management contribution (0–20): stop usage ratio, trim behavior, adaptive sizing

**Grade thresholds:** A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F < 40

### 5c: Aggregate Drivers & Risks

**In `session-analysis.tsx`:**
- Collects all `trade.evaluation.drivers` and `.risks` arrays
- Counts frequency of each string
- Displays top 5 drivers and top 5 risks as colored pills
- Drivers: emerald-tinted pills | Risks: red-tinted pills
- Shows count badge (×2, ×3) for repeated items

### Integration in `session-analysis.tsx`:
```
[Equity Curve]                          ← NEW
[Grade] [Win Rate] [W/L] [Trades] [Duration] [Best] [Worst]  ← Grade tile added
[Top Drivers]  [Key Risks]              ← NEW
[Grade Factors]                         ← NEW
[Trade Card 1] [Trade Card 2] ...       ← existing
```

**Grade tile:** Uses Playfair Display font, letter grade A–F with score/100, color-coded border and background per grade level.

---

## Slice 6: Chart Toolbar Refinement ✅

**Effort:** Small | **Impact:** Medium — gives user control
**Status:** Implemented

**What changed:**
- Added dedicated `Levels` toggle group with independent controls for:
  - `PDH/PDL` (native price lines),
  - `Opening Range` (chart overlay).
- Kept indicator toggles focused on EMA/VWAP/RSI/MACD.
- Added compact active-only legend row showing colored dots + labels for currently enabled overlays/levels.
- Added deterministic E2E coverage for level toggles and a non-happy path where prior-day levels are unavailable.
- Added mobile viewport E2E guard asserting no horizontal overflow regression.

---

## Slice 7: Trade Card Visual Polish ✅

**Effort:** Small | **Impact:** Low — improves trade-level detail
**Status:** Implemented

- Added a compact SPX sparkline in expanded trade cards using replay bars filtered to each trade hold window.
- Added entry and exit markers plus a highlighted entry→exit segment.
- Added a fail-safe fallback copy (`Sparkline unavailable`) when bars or timestamps are invalid/missing.
- Added deterministic E2E assertions for both sparkline happy path and fallback rendering.

---

## File Inventory

### New Files Created (4)

| File | Purpose |
|------|---------|
| `components/trade-day-replay/indicator-toolbar.tsx` | Toggle bar for chart indicators |
| `components/trade-day-replay/trade-chart-markers.ts` | Convert trades → native chart markers + price lines |
| `components/trade-day-replay/equity-curve.tsx` | Canvas-based cumulative P&L line chart |
| `lib/trade-day-replay/session-grader.ts` | Session grade computation (A–F, 100-point scale) |

### New Test Files Created (2)

| File | Purpose |
|------|---------|
| `lib/trade-day-replay/__tests__/session-grader.test.ts` | Unit tests for grading logic |
| `components/trade-day-replay/__tests__/trade-chart-markers.test.ts` | Unit tests for marker builder |

### New E2E Files Created (2)

| File | Purpose |
|------|---------|
| `e2e/specs/members/trade-day-replay.spec.ts` | Replay happy path, levels toggles, sparkline fallback, mobile layout, and preflight 403 coverage |
| `e2e/specs/members/trade-day-replay-test-helpers.ts` | Deterministic shell and API mocks for replay E2E |

### Modified Files (5)

| File | Changes |
|------|---------|
| `components/trade-day-replay/replay-chart.tsx` | State-driven indicators, native markers via createSeriesMarkers, PDH/PDL price lines, removed HTML overlay |
| `components/trade-day-replay/session-analysis.tsx` | Added equity curve, session grade tile, drivers/risks summary, grade factors |
| `lib/trade-day-replay/types.ts` | Added `PriorDayBar` interface, `priorDayBar` on `ReplayPayload` |
| `backend/src/services/trade-day-replay/types.ts` | Mirrored `PriorDayBar` addition |
| `backend/src/routes/trade-day-replay.ts` | Added `getPriorTradingDay()`, `fetchPriorDayBar()` using `getDailyAggregates`, included in response payload |

### Pass-Through Modified (1)

| File | Changes |
|------|---------|
| `app/members/trade-day-replay/trade-day-replay-shell.tsx` | Passes `payload.priorDayBar` to `<ReplayChart>` |

### Deprecated (1)

| File | Status |
|------|--------|
| `components/trade-day-replay/trade-marker-overlay.tsx` | No longer rendered; file kept for reference |

---

## Implementation Order

| Phase | Slices | Status |
|-------|--------|--------|
| **1** | Slice 1 (Indicators + Toolbar) + Slice 2 (Volume) | ✅ Complete |
| **2** | Slice 3 (Native Markers) | ✅ Complete |
| **3** | Slice 4 (Key Levels) | ✅ Complete |
| **4** | Slice 5 (Session Analysis) | ✅ Complete |
| **5** | Slice 6 (Toolbar polish) | ✅ Complete |
| **6** | Slice 7 (Trade-card polish) | ✅ Complete |

---

## Validation (Session C Release Gate)

All commands were executed from `/Users/natekahl/ITM-gd` with Node 22.

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
node -v
which node
pnpm -v
pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts
pnpm exec tsc --noEmit
pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts lib/trade-day-replay/__tests__/session-grader.test.ts
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1
cd /Users/natekahl/ITM-gd/backend && npx tsc --noEmit
```

### Command Evidence (Exact Output) + Result

1. `node -v && which node && pnpm -v`
   ```text
   v22.22.0
   /Users/natekahl/.nvm/versions/node/v22.22.0/bin/node
   10.29.1
   ```
   Result: PASS (exit 0)
2. `pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts`
   ```text
   (no stdout/stderr)
   ```
   Result: PASS (exit 0)
3. `pnpm exec tsc --noEmit`
   ```text
   (no stdout/stderr)
   ```
   Result: PASS (exit 0)
4. `pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts lib/trade-day-replay/__tests__/session-grader.test.ts`
   ```text
    RUN  v4.0.18 /Users/natekahl/ITM-gd

    ✓ lib/trade-day-replay/__tests__/session-grader.test.ts (3 tests) 2ms
    ✓ components/trade-day-replay/__tests__/trade-chart-markers.test.ts (3 tests) 3ms

    Test Files  2 passed (2)
         Tests  6 passed (6)
    Start at  19:19:55
    Duration  194ms (transform 100ms, setup 148ms, import 53ms, tests 6ms, environment 0ms)
   ```
   Result: PASS (exit 0)
5. `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1`
   ```text
   Running 5 tests using 1 worker
   ✓  1 [chromium] › ... builds replay payload and renders replay analysis surfaces (8.5s)
   ✓  2 [chromium] › ... toggles level legend and disables PDH/PDL when prior day data is missing (1.5s)
   ✓  3 [chromium] › ... shows sparkline fallback when trade timestamps are invalid (1.5s)
   ✓  4 [chromium] › ... keeps replay layout stable on mobile viewport (1.3s)
   ✓  5 [chromium] › ... shows explicit backend-admin preflight message on health 403 (1.2s)

   5 passed (21.7s)
   ```
   Result: PASS (exit 0)
6. `cd /Users/natekahl/ITM-gd/backend && npx tsc --noEmit`
   ```text
   (no stdout/stderr)
   ```
   Result: PASS (exit 0)

---

## Technical Notes

### lightweight-charts v5 Migration
The project uses `lightweight-charts@5.1.0`. In v5, series markers moved from `series.setMarkers()` to a plugin API:
```typescript
import { createSeriesMarkers } from 'lightweight-charts'
const markersPlugin = createSeriesMarkers(series)
markersPlugin.setMarkers(markers)
```
The `TradeSeriesMarker` type aliases `SeriesMarker<number>` (epoch seconds) and uses `SeriesMarkerBar` position types (`'aboveBar'` | `'belowBar'`).

### Prior Day Bar Fail-Safety
`fetchPriorDayBar()` is fail-safe: catches all errors, logs a warning, and returns `undefined`. The frontend renders PDH/PDL lines only if `priorDayBar` exists in the payload. This ensures the replay still works on market holidays or if Massive.com daily data is unavailable.

### Equity Curve Canvas Implementation
The equity curve uses raw `<canvas>` instead of lightweight-charts to avoid the weight of spinning up a full chart instance for a simple sparkline. It handles DPR scaling, dynamic color switching (emerald/red), and zero-line reference.

---

## Session C Residual Risks + Rollback Points

1. Marker plugin behavior can drift with future lightweight-charts upgrades.
   - Rollback: revert native marker path in `replay-chart.tsx` + `trade-chart-markers.ts`.
2. PDH/PDL availability remains dependent on daily aggregate provider health.
   - Rollback: disable/remove `priorDayBar` enrichment while keeping replay functional.
3. Options context remains day-granularity and may be interpreted as intraday-precise.
   - Rollback: hide options context block while preserving replay chart/analysis core.
