# SPX Sniper Command Center — UX & Visualization Audit

**Date:** February 16, 2026
**Scope:** Full component audit of `/members/spx-command-center` — 19 components, 1 context provider, 11 hooks
**Goal:** Transform a data dashboard into an action-oriented Sniper Command Center

---

## Executive Summary

The current SPX Command Center is architecturally sound — real-time WebSocket pricing, a well-typed snapshot engine, AI coaching, and a ranked setup lifecycle are all in place. The problem isn't data availability; it's **visual hierarchy and action density**. The layout reads like a monitoring dashboard rather than a decision cockpit. A sniper doesn't scroll through panels looking for signals — they see one unified kill zone and act.

Here are the **7 highest-impact redesign priorities**, ordered by effort-to-impact ratio:

---

## 1. THE HEADER IS PASSIVE — MAKE IT THE MISSION BRIEFING

**Current state:** The `spx-header.tsx` shows four equal-weight stat boxes (SPX, SPY, Basis, Regime) plus a subtitle "Institutional Setup Intelligence." It reads like a monitoring strip, not a briefing that tells you what to do right now.

**Problem:** All four metrics are given equal visual weight. Regime and Basis are context signals, not primary. The subtitle is marketing copy — it doesn't convey urgency or state.

**Recommended redesign — "Sniper Briefing Bar":**

- **Hero metric:** SPX price displayed at 2-3x the size of everything else, with a real-time tick color flash (green/red on each WebSocket update). This is the single most important number on the screen.
- **Contextual cluster:** Regime + Direction + Confidence should merge into a single **"Market Posture" badge** — e.g., a single pill that reads `TRENDING BULLISH 78%` with regime-colored background. Not three separate inline spans.
- **Action count badge:** Replace the generic subtitle with a dynamic tagline: `"2 setups actionable · Breakout regime · Bullish pressure"` — generated from `activeSetups.filter(s => s.status === 'ready' || s.status === 'triggered').length`, `regime`, and flow net bias. This immediately tells the trader "there's something to do."
- **Kill the SPY price box from the header.** SPY is a derivative signal — it belongs in the Basis Indicator, not top-level. Reclaim that space for the action count.
- **Prediction direction pills** (`↑ 62% ↓ 28% ↔ 10%`) should move into the header from `regime-bar.tsx` — they're the single most decision-relevant prediction and deserve top-of-page visibility.

**Implementation note:** All data is already in `useSPXCommandCenter()`. This is purely a layout/component change in `spx-header.tsx`.

---

## 2. THE THREE-PANEL LAYOUT BURIES THE ACTION — USE A TWO-TIER ARCHITECTURE

**Current state:** The page uses a 25/50/25 resizable panel split. Left = Setup Feed + Level Matrix. Center = Chart + Flow. Right = AI Coach + Contract Selector + Basis + GEX (collapsed).

**Problem:** The right panel is a vertical scroll dump. AI Coach, Contract Selector, Basis Indicator, and GEX analytics are all stacked in a 25% panel — the most important action components (Coach alerts, Contract recommendations) are crammed next to the least urgent (Basis EMA values, GEX heatmap). On most screens, the Contract Selector is below the fold.

**Recommended redesign — "Briefing + Battlefield":**

**Tier 1: Action Strip (full-width, above the panels)**
A horizontal strip below the header containing:
- **Top coach alert** (highest-priority `CoachMessage` with `priority === 'alert'`) — one line, full width, with a dismiss/expand action
- **Active setup count pill** + **Flow net bias pill** + **Regime pill** — inline, scannable
- This replaces `regime-bar.tsx` as a standalone component and absorbs the single most important coach message

**Tier 2: Two-panel split (60/40 or 65/35)**
- **Left (larger):** Chart + Cluster Zones + Probability Cone (the battlefield view)
- **Right:** Setup Feed (top, dominant) → Contract Selector (directly below selected setup) → AI Coach Feed (below, scrollable)

**What gets demoted:**
- **Level Matrix** moves to a collapsible drawer or overlay triggered from the chart header. It's reference data, not action data. Traders consult it; they don't stare at it.
- **Basis Indicator** becomes a small inline widget in the header or Action Strip — just the current value + trend arrow, not the full EMA breakdown.
- **GEX analytics** remain collapsed but move to a dedicated "Advanced" tab/drawer rather than being buried in the right panel scroll.
- **Flow Ticker** moves to the Action Strip as a compact ticker/marquee, or becomes a collapsible section below the chart.

**Implementation note:** This requires restructuring `page.tsx` panel layout but all components exist. The key change is removing `PanelGroup` from its current 3-panel config and restructuring to a stacked Tier 1 + 2-panel Tier 2.

---

## 3. SETUP CARDS DON'T DRIVE ACTION — ADD A VISUAL ENTRY THERMOMETER

**Current state:** `setup-card.tsx` shows type, direction, confluence dots, entry/stop/target grid, distance to entry, risk to stop, probability, and confluence sources. It's information-dense but flat — every piece of data has the same visual weight.

**Problem:** A sniper looking at a setup card needs to instantly know: "How close am I to entry, and what do I do if it triggers?" The current card makes you read 12 data points to answer that question.

**Recommended redesign — "Sniper Setup Card":**

- **Entry Proximity Thermometer:** A single horizontal bar spanning the card width showing `Stop ← [current price marker] → Entry Zone → Target 1 → Target 2`. The current price marker moves in real-time. When price enters the entry zone, the entire card border pulses emerald (you already have `animate-pulse-emerald` on triggered status — extend this).
- **Primary action headline:** Instead of showing `setup.direction + setup.regime` as a secondary line, make it the card's bold headline: **"BULLISH BREAKOUT"** in 16px+ text. The setup type (`fade_at_wall`, `breakout_vacuum`, etc.) becomes a subtle label.
- **Collapse the grid:** Entry/Stop/Target grid currently uses 6 cells (Entry, Stop, T1, T2, Dist to Entry, Risk to Stop). Replace with the thermometer visualization + two key numbers: **R:R ratio** (already available on the recommended contract) and **Probability** — the two numbers that matter for a go/no-go decision.
- **"Why Now" prominence:** `confluenceSources` is currently the last thing on the card in 10px text. Move it up — it's the conviction signal. Display as 2-3 colored pills (e.g., `GEX Support`, `Fib Confluence`, `Flow Confirm`).
- **One-tap contract:** When a setup is selected and has a `recommendedContract`, show a compact contract preview directly on the card — strike, expiry, R:R. Clicking opens the full Contract Selector detail.

**Implementation note:** `distanceToEntry` and all price levels are already computed in `setup-card.tsx`. The thermometer is a pure CSS/layout exercise using the existing data.

---

## 4. THE FLOW TICKER LACKS SIGNAL HIERARCHY — ADD A "FLOW CONVICTION SCORE"

**Current state:** `flow-ticker.tsx` ranks 6 flow events by `premium / age_minutes`, shows a bull/bear tug-of-war bar, and lists individual events.

**Problem:** The flow data is presented as a feed — it doesn't answer the trader's question: "Does flow confirm or deny my setup?" The bull/bear premium bar is useful but disconnected from the active setup context.

**Recommended redesign — "Flow Conviction Meter":**

- **Setup-aware flow scoring:** When a setup is selected, compute a "Flow Alignment Score" — what percentage of recent high-premium flow aligns with the setup's direction? If the setup is bullish and 80% of flow premium is bullish, show a big green `FLOW CONFIRMS 80%` badge. If it contradicts, show amber `FLOW DIVERGES`. This is the single most useful flow signal for a sniper.
- **Compact mode by default:** The individual event rows take up significant vertical space. Default to showing only the tug-of-war bar + conviction badge + the single highest-scored event. Expand to full list on click.
- **Strike proximity filter:** Highlight flow events where the strike is within ±20 points of the selected setup's entry zone. These are the most relevant and should appear with a special "Near Entry" tag.

**Implementation note:** `flowEvents` and `selectedSetup` are both available in context. The alignment score is a simple filter + sum calculation.

---

## 5. AI COACH IS A CHAT BOX — MAKE IT A TACTICAL ADVISOR

**Current state:** `ai-coach-feed.tsx` shows a chronological list of coach messages with a text input to ask questions. Messages have priority colors (alert = rose, setup = emerald, behavioral = champagne).

**Problem:** The coach is positioned as a chat feed, but traders don't have time to read chat during live setups. The most important coach message (the one saying "take this trade" or "hold off") gets buried as soon a new message arrives.

**Recommended redesign — "Tactical Advisor Panel":**

- **Pinned top alert:** The highest-priority unread message should be pinned at the top of the panel with a distinct "ALERT" treatment — full-width, bolder typography, and a dismiss button. This never scrolls away until acknowledged.
- **Contextual prompts:** Instead of a blank text input saying "Ask coach for setup guidance," show pre-built quick-ask buttons: `"Confirm entry?"`, `"Risk check"`, `"Exit strategy?"` — each pre-fills the prompt with the selected setup ID. This reduces the coach from a chat interface to a one-tap tactical advisor.
- **Message grouping:** Group messages by the setup they reference (`setupId`). When a setup is selected, auto-filter to show only messages about that setup. Show an "All messages" toggle for the full history.
- **Inline action chips:** If a coach message says "consider entering" or "tighten stop," parse for actionable keywords and render them as highlighted action phrases within the message text (already partially supported by `structuredData` on `CoachMessage`).

**Implementation note:** `CoachMessage.setupId` already exists for filtering. The quick-ask buttons are new UI but call the existing `sendCoachMessage()` API.

---

## 6. THE LEVEL MATRIX IS A SPREADSHEET — MAKE IT A PROXIMITY MAP

**Current state:** `level-matrix.tsx` shows a sortable table with Source, Category, and Price columns. It filters by category and shows the 14 nearest levels to spot.

**Problem:** A table of prices doesn't convey spatial relationships. The trader needs to see "I'm between these two levels, the one above is a fortress cluster, the one below is weak" — not a sorted list.

**Recommended redesign — "Level Proximity Map":**

- **Vertical price ladder:** Replace the table with a vertical strip showing levels as horizontal bars at their relative price positions. Current price is a bright horizontal line cutting through the middle. Levels above are resistance (rose-tinted), levels below are support (emerald-tinted). Bar width encodes strength (critical = full width, weak = narrow).
- **Zone highlighting:** Cluster zones from `clusterZones` should appear as shaded bands on this ladder, not as a separate `ClusterZoneBar` component.
- **Interactive hover:** Hovering a level on the ladder highlights it on the main chart (via `chartAnnotations`), and vice versa — clicking a level on the chart highlights it on the ladder.
- **Decision zones:** Mark the entry zone, stop, and targets of the selected setup directly on the ladder, creating a unified "where am I relative to my trade plan" view.

**Implementation note:** This is the most significant visual redesign. The data is all available; it requires building a custom SVG or canvas-based visualization.

---

## 7. CONTRACT SELECTOR IS PASSIVE — MAKE IT A ONE-CLICK EXECUTION PREVIEW

**Current state:** `contract-selector.tsx` shows a contract card when a setup is selected, with Greeks behind a `<details>` collapse. The card shows R:R, spread, expiry, bid/ask, max loss, and reasoning.

**Problem:** The contract recommendation appears only after selecting a setup, and it presents as informational rather than actionable. The most critical decision data (R:R, max loss, expected P&L at targets) is scattered across the card.

**Recommended redesign — "Strike Console":**

- **Risk/Reward visual:** Replace the text-based R:R display with a horizontal bar showing loss zone (red, left) vs. profit zone (green, right), with T1 and T2 marked. The visual immediately communicates "I risk $X to make $Y-$Z." The `maxLoss`, `expectedPnlAtTarget1`, and `expectedPnlAtTarget2` fields make this trivial.
- **Spread health indicator:** Show bid-ask spread as a traffic light (green < 10%, amber 10-20%, red > 20%) rather than just a percentage number.
- **Greeks at a glance:** Instead of hiding Greeks behind a details toggle, show the four key Greeks (Delta, Gamma, Theta, Vega) as a compact 4-column bar with visual indicators (theta as a red drip icon, delta as a directional arrow, etc.).
- **Pre-filled sizing:** Add a "Position Size" input that calculates contracts based on a user-defined max risk. If a trader sets max risk to $500 and max loss per contract is $250, show "2 contracts" automatically.

---

## ADDITIONAL QUICK WINS (Lower effort, meaningful impact)

### A. Probability Cone Needs Context
The current `probability-cone.tsx` shows time-forward ranges as horizontal bars. Add the selected setup's entry zone and targets as vertical markers on the cone — this answers "will price likely reach my entry in the next 30/60/90 minutes?"

### B. GEX Landscape is Undersized
The `gex-landscape.tsx` bar chart is only `h-28` (112px) with `grid-cols-10`. This is too small to read. Increase to `h-44` minimum and use dynamic column count based on the data. Show the current price position as a vertical line on the GEX chart.

### C. Mobile Needs a "Sniper Summary" Tab
The current mobile layout has 4 tabs (Chart, Setups, Coach, Levels). Add a 5th tab: **"Brief"** — a single scrollable view showing: top setup card, flow conviction, prediction direction, and the latest coach alert. This gives mobile users the "do I act?" answer without tab-switching.

### D. Sound/Haptic Alerts for Triggered Setups
When a setup transitions from `ready` to `triggered`, there's only a visual pulse. Add an opt-in notification sound and browser notification for traders who have the tab in the background.

### E. Session P&L Tracker
Add a small widget showing the day's realized + unrealized P&L from setups that were acted on. This closes the feedback loop and makes the command center feel like a cockpit, not just a signal screen.

---

## COMPONENT DEPENDENCY MAP FOR IMPLEMENTATION

```
Priority 1 (Header + Action Strip):
  spx-header.tsx ← modify
  regime-bar.tsx ← absorb into new ActionStrip component
  NEW: action-strip.tsx

Priority 2 (Layout restructure):
  page.tsx ← restructure panels
  level-matrix.tsx ← move to drawer/overlay
  basis-indicator.tsx ← inline into header
  flow-ticker.tsx ← compact mode + conviction score

Priority 3 (Setup Cards):
  setup-card.tsx ← add thermometer + restructure
  contract-card.tsx ← add visual R:R bar
  contract-selector.tsx ← inline preview on cards

Priority 4 (Coach redesign):
  ai-coach-feed.tsx ← pinned alert + quick actions
  coach-message.tsx ← action chip parsing

Priority 5 (Level visualization):
  level-matrix.tsx ← rebuild as proximity map
  cluster-zone-bar.tsx ← merge into proximity map

Priority 6 (Polish):
  probability-cone.tsx ← add setup markers
  gex-landscape.tsx ← increase size + price line
  mobile-panel-tabs.tsx ← add Brief tab
```

---

## WHAT'S ALREADY EXCELLENT

Before closing, credit where due — the foundation is strong:

- **Type system** is thorough (`spx-command-center.ts` covers every domain entity)
- **Setup ranking** algorithm in context is smart (status → confluence → probability → recency)
- **Focused level filtering** on the chart (proximity-weighted, strength-boosted) is exactly right
- **Flow scoring** (premium/age) is a good recency-weighted signal
- **Coach message priority system** (alert > setup > guidance > behavioral) is well-structured
- **WebSocket price streaming** with fallback to snapshot data is production-grade
- **Glass card aesthetic** is premium and consistent

The architecture doesn't need to change. The data layer is ready. This is a **presentation layer transformation** — making the same data tell a story that ends with "here's what to do right now."
