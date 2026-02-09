# Interactive Widget Cards Specification

## Problem

Currently, widget cards rendered inline in the AI Coach chat (from function call results like `get_key_levels`, `get_options_chain`, `analyze_position`, etc.) are **static display blocks**. They show data but offer zero interactivity. Users see a key level and then have to manually switch tabs, re-enter the symbol, and navigate to that level. This completely breaks the "seamless companion" experience.

## Principle

**Every piece of data shown in a widget card should be an entry point into a deeper action.** If you show a price level, it should be clickable. If you show a Greek, it should be explainable. If you show a position, it should be manageable. The widget cards are not just displays — they are the primary navigation mechanism within the AI Coach.

---

## Widget Card Interactions by Type

### 1. Key Levels Widget (`get_key_levels` result)

**Current State:** Shows resistance/support levels as colored text with prices and ATR distances. No interactivity.

**Target State:**

Each level row is clickable and shows a hover tooltip with available actions:

| Element | Click Action | Right-Click / Long-Press Actions |
|---------|-------------|----------------------------------|
| Level price (e.g., "PDH: $5,919.90") | Centers chart on this level, switches to Chart tab | "Set Alert at this level", "View Options near this strike", "Send to Chat" |
| VWAP indicator | Shows VWAP bands on chart (toggles them on) | "Show VWAP deviation bands", "VWAP analysis" |
| ATR value | No action (informational) | "What does ATR mean?" (sends education prompt to chat) |
| "Show on Chart" button (NEW) | Switches to Chart tab with ALL levels annotated | — |
| Distance badge (e.g., "0.4 ATR") | Highlights the level on chart with distance visualization | — |

**Implementation:**
```typescript
// In widget-cards.tsx, each level row should be:
<button
  onClick={() => workflow.viewChartAtLevel(level.price, level.type)}
  onContextMenu={(e) => showLevelContextMenu(e, level)}
  className="group flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
>
  <span className="flex items-center gap-2">
    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: levelColor }} />
    <span className="font-medium">{level.label}</span>
  </span>
  <span className="flex items-center gap-3">
    <span className="font-mono">${level.price.toFixed(2)}</span>
    <span className="text-xs opacity-60">{level.distanceATR.toFixed(1)} ATR</span>
    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  </span>
</button>
```

**Context Menu Actions (right-click or long-press):**
```typescript
const levelContextMenu = [
  { label: "Show on Chart", icon: CandlestickChart, action: () => workflow.viewChartAtLevel(level.price) },
  { label: "Set Alert Here", icon: Bell, action: () => workflow.createAlertAtLevel(level) },
  { label: "View Options Near Strike", icon: TableProperties, action: () => workflow.viewOptionsNearStrike(symbol, level.price) },
  { label: "Copy Price", icon: Copy, action: () => navigator.clipboard.writeText(level.price.toString()) },
];
```

---

### 2. Options Chain Widget (inline from `get_options_chain`)

**Current State:** Shows a mini table of calls/puts with Greeks. Static text.

**Target State:**

| Element | Click Action | Additional Actions |
|---------|-------------|-------------------|
| Contract row (e.g., "5935C $4.20") | Opens Position Analyzer pre-filled with this contract | "Add to Position", "Show on Chart" |
| Strike price | Highlights this strike on the chart as horizontal line | — |
| IV value | Shows IV rank context ("IV of 18.5% is in the 35th percentile for this symbol") | — |
| Delta value | Tooltip: "This contract moves ~$0.48 for every $1 move in {symbol}" | — |
| Theta value | Tooltip: "This contract loses ~${Math.abs(theta).toFixed(2)} per day from time decay" | — |
| "Full Chain" button (NEW) | Switches to Options tab with this symbol/expiry pre-loaded | — |
| "0DTE" badge (if applicable, NEW) | Switches to 0DTE Dashboard with this contract highlighted | — |

**Each contract row should show action icons on hover:**
- Chart icon: Show breakeven on chart
- Calculator icon: Open position analyzer
- Plus icon: Add to tracked positions

---

### 3. Position Summary Widget (`analyze_position` result)

**Current State:** Shows P&L, Greeks, breakeven as static numbers.

**Target State:**

| Element | Click Action | Additional Actions |
|---------|-------------|-------------------|
| P&L value | Tooltip: "Entry: $X -> Current: $Y, Change: $Z" with sparkline | — |
| "Show on Chart" button (NEW) | Chart loads with entry, breakeven, stop, target overlaid | — |
| "Get Advice" button (NEW) | Sends "What should I do with my {symbol} {strike}{type}?" to AI chat | — |
| Greeks section | Expandable to show Greeks explanation for each value | — |
| Delta value | Tooltip: "Your position moves ~${delta * 100} for every $1 move in {symbol}" | — |
| Theta value | Visual indicator: small timer icon + "Losing $X/day" in red | — |
| "Close" button (NEW) | Confirms and marks position as closed, prompts for exit price | — |
| "Roll" button (NEW) | Opens roll calculator pre-filled with current position data | — |
| Max Loss indicator | If approaching max loss (>80%), pulses red with warning | — |

**P&L should be color-coded and animated:**
- Green for profit, red for loss
- Number should count up/down when value changes (real-time via WebSocket)
- Small arrow indicator showing direction of change

---

### 4. Alert Status Widget (`set_alert` / `get_alerts` result)

**Current State:** Shows alert type, target, status as text.

**Target State:**

| Element | Click Action | Additional Actions |
|---------|-------------|-------------------|
| Alert row | Expands to show full alert details + distance from current price | — |
| "Show on Chart" button | Centers chart on alert target price with highlighted line | — |
| "Cancel" button | Cancels the alert with confirmation | — |
| "Edit" button (NEW) | Inline edit of target value | — |
| Distance indicator (NEW) | Shows how far current price is from target: "$12.30 away (0.3%)" | Updates in real-time |
| Progress bar (NEW) | Visual bar showing how close price is to target | Fills as price approaches |

---

### 5. Market Overview Widget (`get_market_status` result)

**Current State:** Shows market status, session type, time since open.

**Target State:**

| Element | Click Action |
|---------|-------------|
| Status badge ("OPEN", "PRE-MARKET", etc.) | No action (informational) |
| Time display | Shows full market hours schedule for today |
| "View Morning Brief" button (NEW, pre-market only) | Opens Morning Brief panel |
| Session countdown timer (NEW) | Shows time remaining in current session, updates in real-time |
| Next event indicator (NEW) | "FOMC in 2 days" or "CPI tomorrow 8:30 AM" — clickable to macro context |

---

### 6. Scan Results Widget (NEW - from `scan_opportunities`)

When the AI calls `scan_opportunities`, results should render as interactive cards in the chat:

| Element | Click Action |
|---------|-------------|
| Setup card | Expands to show full setup details (entry, stop, target, option suggestion) |
| "View Chart" button | Chart loads with setup annotations (entry line, stop line, target line, ORB box if applicable) |
| "View Options" button | Options chain loads filtered to strikes near the suggested entry |
| "Track This Setup" button (NEW) | Adds to a "watched setups" list, alerts user when setup triggers or invalidates |
| Confidence badge | Tooltip explaining what contributes to the confidence score |
| Suggested option contract | Clickable -> opens position analyzer with this contract |

---

### 7. Earnings Widget (NEW - from `get_earnings_analysis`)

| Element | Click Action |
|---------|-------------|
| Expected move bar | Visual bar chart comparing expected vs historical moves |
| Strategy card | Expands to show full strategy details with risk/reward |
| "Simulate" button | Opens position analyzer pre-filled with the suggested strategy |
| Historical move bars | Click on a quarter -> shows what happened (gap direction, IV crush, fill) |
| IV Rank gauge | Click -> opens IV Dashboard for this symbol |
| "Set Earnings Alert" button | Creates alert for the day before earnings |

---

### 8. GEX Widget (NEW - from `get_gamma_exposure`)

| Element | Click Action |
|---------|-------------|
| GEX flip point | Click -> centers chart on flip point with annotation |
| Max GEX strike | Click -> centers chart + shows options chain at this strike |
| Regime indicator ("Positive Gamma") | Tooltip explaining implications for price action |
| "Show GEX Chart" button | Opens full GEX visualization |
| "Show on Chart" button | Adds GEX levels as overlays on the trading chart |
| Key level rows | Same interaction as Key Levels widget (click to chart, right-click for context menu) |

---

## Technical Implementation

### Shared Action System

Create `components/ai-coach/widget-actions.ts`:

```typescript
export interface WidgetAction {
  label: string;
  icon: React.ComponentType;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  tooltip?: string;
}

// Standard action factories
export function chartAction(symbol: string, level?: number): WidgetAction;
export function optionsAction(symbol: string, strike?: number, expiry?: string): WidgetAction;
export function alertAction(symbol: string, price: number, type: string): WidgetAction;
export function analyzeAction(position: PositionInput): WidgetAction;
export function chatAction(prompt: string): WidgetAction;
export function copyAction(text: string): WidgetAction;
```

### Widget Action Bar Component

Create `components/ai-coach/widget-action-bar.tsx`:

```typescript
// Renders a row of action buttons at the bottom of any widget card
interface WidgetActionBarProps {
  actions: WidgetAction[];
  compact?: boolean;  // For inline use (smaller buttons, icons only)
}
```

### Context Menu Component

Create `components/ai-coach/widget-context-menu.tsx`:

```typescript
// Right-click / long-press context menu for widget elements
interface WidgetContextMenuProps {
  trigger: React.ReactNode;
  actions: WidgetAction[];
}
```

### Integration with Workflow Context

All widget actions should flow through the `AICoachWorkflowContext`:

```typescript
// In widget-cards.tsx, consume the workflow context:
const { viewChartAtLevel, viewOptionsNearStrike, createAlertAtLevel, sendToChat } = useAICoachWorkflow();

// Wire up to widget elements
<KeyLevelRow
  level={level}
  onClick={() => viewChartAtLevel(symbol, level.price)}
  onSetAlert={() => createAlertAtLevel(symbol, level.price, `${level.label} alert`)}
  onViewOptions={() => viewOptionsNearStrike(symbol, level.price)}
/>
```

---

## Visual Design Principles

1. **Hover reveals actions**: Widget cards look clean by default. Action buttons fade in on hover (or show on tap for mobile).

2. **Clickable elements have cursor:pointer and subtle hover state**: A slight background change (bg-white/5 -> bg-white/10) and a tiny chevron icon appearing on the right.

3. **Real-time values animate**: P&L, prices, distances should use a count-up/down animation when they change. Use `framer-motion` AnimatePresence for smooth number transitions.

4. **Context menus are native-feeling**: Use Radix UI ContextMenu or DropdownMenu for right-click menus. They should feel like part of the OS, not a custom modal.

5. **Action confirmation for destructive actions**: "Cancel Alert" and "Close Position" require a confirmation step (either inline confirmation or a small dialog).

6. **Loading states for async actions**: When clicking "View Options" or "Show on Chart", show a brief loading spinner on the button before the tab switches. This gives feedback that the action was registered.

7. **Mobile-friendly**: On touch devices, long-press replaces right-click for context menus. Action buttons should be large enough to tap (min 44px touch target).

---

## Priority Order

1. Key Levels widget interactivity (most commonly shown, highest impact)
2. Position Summary widget interactivity (P&L tracking is core)
3. Scan Results widget (drives trade workflow)
4. Options Chain widget (drives analysis workflow)
5. Alert Status widget (monitoring workflow)
6. New widgets: GEX, Earnings, 0DTE (Phase 3+)
7. Market Overview (lower priority, mostly informational)
