# SPX Command Center — Remaining Work Spec

**Date:** 2026-02-17
**Source:** Screenshot audit (3.pdf) vs current codebase vs approved mockup

---

## Executive Summary

The screenshot reveals **12 major gaps** between what's rendering live and what our redesigned code specifies. Several of our rewrites appear to not be rendering — either due to build cache, lingering old component imports in other files, or code that was reverted/overwritten by linter passes. The biggest offenders are the **Flow Ticker** (still rendering as massive cards), the **Probability Cone** (still standalone full-size), and the **Setup Cards** (still flat data dump, no thermometer).

---

## GAP 1: Header Metric Grid — Only 2 Cells Rendering (Should Be 4)

**Screenshot shows:** `BASIS +18.67` and `ACTIONABLE 6` as two wide cells.
**Code specifies:** 4 compact cells — `SPX/SPY Basis`, `Basis Z-Score`, `GEX Net`, `GEX Flip Point`.
**Direction probabilities:** Screenshot shows `↑ 33%` / `↓ 33%` / `↔ 34%` with NO labels. Code now has `Direction Probability` header + `Bull`/`Bear`/`Flat` sub-labels.

**Root cause:** The header appears to be rendering an older version that had `BASIS` and `ACTIONABLE` as the two metric cells. Our rewrite changed this to a 4-cell grid with Z-Score, GEX Net, and Flip Point.

**Fix:**
- Verify `spx-header.tsx` is the version with 4 metric cells (SPX/SPY Basis, Basis Z-Score, GEX Net, GEX Flip Point)
- Remove any `ACTIONABLE` cell from the header — actionable count is already in the subtitle line
- Confirm the `Direction Probability` header label and `Bull`/`Bear`/`Flat` sub-labels are present
- Confirm sub-text renders: "SPX leads" under Basis, "Normal/Notable/Extreme" under Z-Score, GEX numeric value under posture, "Above/Below (+N)" under Flip Point

**Files:** `components/spx-command-center/spx-header.tsx`

---

## GAP 2: Action Strip — Missing Prefixes and GEX Chip

**Screenshot shows:** `✦ 6 setups actionable` / `◉ COMPRESSION BULLISH 34%` / `• Bullish pressure 67%` — no category prefixes, no GEX chip visible.
**Code specifies:** `Setups: 6 actionable` / `Posture: COMPRESSION BULLISH 34%` / `Flow: Bullish pressure 67%` / `GEX Unstable -6.2B` chip.

**Fix:**
- Verify action-strip.tsx has the `Setups:`, `Posture:`, `Flow:` prefixes
- Verify GEX chip renders when `gexProfile?.combined?.netGex` is available
- Check that gexLabel conditional isn't hiding the chip (may be null when data is loading)

**Files:** `components/spx-command-center/action-strip.tsx`

---

## GAP 3: Flow Ticker — STILL Rendering as Massive Event Cards

**This is the worst offender.**

**Screenshot shows:** "FLOW PULSE" header with full-width tug-of-war bar, then **6 giant event cards** (#1 through #6), each 3-4 lines tall showing: `SPX BLOCK 6000 (836.2 pts)` / `Score 73.3k` / `$337.6M` / `4608m`. These cards consume ~40% of total left-panel vertical space.

**Code specifies:** Compact `Flow` header with inline tug-of-war bar + bull/bear premium on ONE line, then horizontal chip row showing top 4 events as small inline chips.

**Root cause candidates:**
1. There may be a **separate `FlowPulse` component** or the original FlowTicker had a different render path that's still being used
2. The flow event data shape may include fields (`score`, `points`) that our redesigned component doesn't reference, meaning the OLD component might still be imported somewhere
3. Check for a `flow-pulse.tsx` or similar file that may be rendering instead

**Fix:**
- Search for any component named `FlowPulse` or any file containing "FLOW PULSE" text
- Verify `page.tsx` imports `FlowTicker` from the correct path
- Ensure `flow-ticker.tsx` is our compact version (tug-of-war bar + chip row, NOT tall cards)
- If old component exists, delete it and ensure all imports point to our compact FlowTicker
- The flow events should render as horizontal chips: `SPX BLK 6000 $337.6M 2m` — not multi-line cards

**Files:** `components/spx-command-center/flow-ticker.tsx`, possibly `flow-pulse.tsx` or similar

---

## GAP 4: Probability Cone — Still Standalone Full-Size Component

**Screenshot shows:** `PROBABILITY CONE` as a large standalone section below the chart with 5 full-width rows (5m, 10m, 15m, 20m, 30m), each with wide progress bars and range text. Takes ~15% of left-panel space.

**Code specifies:** Probability Cone should be INSIDE `DecisionContext` as a compact `ConePanel` — a 1/3-width column in a 3-column grid, expandable on click.

**Root cause:** The old standalone `ProbabilityCone` component (`probability-cone.tsx`) still exists AND is likely still being rendered. It was supposed to be replaced by `ConePanel` inside `decision-context.tsx`.

**Fix:**
- Verify `spx-chart.tsx` does NOT import `ProbabilityCone` or `ClusterZoneBar` (these were removed in our rewrite)
- Verify `page.tsx` does NOT import or render `ProbabilityCone` anywhere
- Check that `DecisionContext` is rendering in the left panel (it should contain ClusterPanel + ConePanel + FibPanel)
- The old standalone components (`probability-cone.tsx`, `cluster-zone-bar.tsx`, `fib-overlay.tsx`) can remain as files but should NOT be imported by page.tsx or spx-chart.tsx

**Files:** `app/members/spx-command-center/page.tsx`, `components/spx-command-center/spx-chart.tsx`

---

## GAP 5: "SHOW ADVANCED OVERLAYS" Still Present Below Chart

**Screenshot shows:** A `SHOW ADVANCED OVERLAYS` details toggle below the Probability Cone section.

**Code specifies:** This was removed from `spx-chart.tsx`. Fib overlays are now inline chips in `DecisionContext`'s `FibPanel`.

**Fix:**
- Verify `spx-chart.tsx` does NOT contain a `<details>` with "Show Advanced Overlays"
- Verify no `FibOverlay` import in spx-chart.tsx

**Files:** `components/spx-command-center/spx-chart.tsx`

---

## GAP 6: Setup Feed — Old Layout with Stat Boxes

**Screenshot shows:** `SETUP FEED` header with `ACTIONABLE | WATCHLIST | AVG WIN` stat grid (showing `6 | 2 | 58%`), then `ACTIONABLE NOW (6)` sub-header, then old flat setup cards.

**Code specifies:** Clean header showing only `Setup Feed` + `3 actionable` inline. No stat grid. No "ACTIONABLE NOW" sub-header.

**Fix:**
- Verify `setup-feed.tsx` is our compact version — just header + cards, no stat grid
- Remove the `ACTIONABLE | WATCHLIST | AVG WIN` grid if still present
- Remove the `ACTIONABLE NOW (X)` sub-header

**Files:** `components/spx-command-center/setup-feed.tsx`

---

## GAP 7: Setup Cards — Old Flat Data Dump (No Thermometer)

**Screenshot shows:** Setup card with: `MEAN REVERSION | TRIGGERED` / `Bullish Compression` / `LIVE SETUP: MANAGE WITH STOP DISCIPLINE.` text / `● ● ● ○ ○ 3/5` dots / flat Entry/Stop/Target1/Target2/Dist/Risk grid.

**Code specifies:** Bold `BULLISH COMPRESSION` headline, confluence source pills, entry proximity **thermometer** bar (stop→entry→T1→T2 with live price marker), 4 compact metric boxes (R:R, Win%, Dist, Risk).

**Root cause:** Setup card appears to be rendering the old version. Our rewrite includes `computeThermometer()` and the visual bar.

**Fix:**
- Verify `setup-card.tsx` is our rewritten version with the thermometer
- Check that the component exports match what `setup-feed.tsx` imports
- The card should show: (1) direction + regime headline, (2) setup type + confluence dots, (3) confluence source pills, (4) thermometer bar, (5) 4-metric grid

**Files:** `components/spx-command-center/setup-card.tsx`

---

## GAP 8: Basis Indicator — Still Large Standalone Panel

**Screenshot shows:** `SPX/SPY BASIS` as a large panel in the right column with `18.67` in big text, then `EMA5 | EMA20 | Z` grid. Takes significant vertical space.

**Code specifies:** Basis data is now surfaced in the HEADER metric cells (SPX/SPY Basis cell + Basis Z-Score cell). The standalone `BasisIndicator` should only appear inside the collapsed "Advanced GEX · Basis · Analytics" details section.

**Fix:**
- Verify `BasisIndicator` is ONLY inside the collapsed `<details>` in the right panel, not as a top-level component
- The header already shows Basis + Z-Score, so the standalone is redundant when collapsed

**Files:** `app/members/spx-command-center/page.tsx`

---

## GAP 9: GEX Landscape — Old Full-Size Card

**Screenshot shows:** `GEX LANDSCAPE` as a large standalone card with `Flip 6685.00`, empty bar chart area, then `Call wall | Put wall | Net` row.

**Code specifies:** Compact expandable — shows single line (Flip, Call wall, Put wall, Net) collapsed. Expands on click to show bar chart. Returns `null` when data is empty.

**Fix:**
- Verify `gex-landscape.tsx` is our compact expandable version
- Verify it returns `null` when `gexByStrike` data is all zeros (the screenshot shows an empty chart — this should not render at all)

**Files:** `components/spx-command-center/gex-landscape.tsx`

---

## GAP 10: GEX Heatmap — Old Full-Size Cards

**Screenshot shows:** `SPX + SPY HEATMAP` with `Net posture: Unstable (-4.14B)`, then separate `SUPPORT LEVELS` / `PRESSURE LEVELS` sections, each with full-height cards showing strike + source + bar + GEX value. Takes massive vertical space.

**Code specifies:** Compact expandable — shows `Supportive/Unstable + value` on one line, top support/pressure strike inline. Expands to show 2-column compact bars. Returns `null` when no key levels.

**Fix:**
- Verify `gex-heatmap.tsx` is our compact expandable version
- The old version was a `<section className="glass-card-heavy ...">` — ours is a `<div className="rounded-xl border border-white/8 ...">`

**Files:** `components/spx-command-center/gex-heatmap.tsx`

---

## GAP 11: AI Coach — No Quick Actions, No Setup Filter

**Screenshot shows:** Standard coach with GUIDANCE, BEHAVIORAL, ALERT messages. No quick-action buttons. No "Focused: setup" indicator.

**Code specifies:** Quick-action buttons when setup is selected (`Confirm entry?`, `Risk check`, `Exit strategy`, `Size guidance`), setup-filtered messages, `Focused: fade_at_wall` indicator.

**Fix:**
- Verify `ai-coach-feed.tsx` is our version with `QUICK_ACTIONS` array and the button row
- Verify `filteredMessages` logic is present (filters by `selectedSetup.id`)

**Files:** `components/spx-command-center/ai-coach-feed.tsx`

---

## GAP 12: Contract Card — No Visual R:R Bar

**Screenshot shows:** `CONTRACT SELECTOR` with "Computing recommendation..." — no contract rendered yet. When it does render, it would show the OLD flat card.

**Code specifies:** Visual R:R bar (rose loss zone → emerald profit zone with T1/T2 markers), spread health traffic light, expandable Greeks.

**Fix:**
- Verify `contract-card.tsx` is our version with `spreadHealth()`, visual R:R bar, and expandable analytics
- This may just be a timing issue (recommendation was loading), but verify the new card renders when data arrives

**Files:** `components/spx-command-center/contract-card.tsx`

---

## Verification Checklist

After implementing all fixes, verify:

1. [ ] `npx tsc --noEmit` — zero errors
2. [ ] `npm run build` — builds successfully
3. [ ] Header shows 4 metric cells with labels + sub-text + tooltips
4. [ ] Direction probabilities show "Direction Probability" header + Bull/Bear/Flat labels
5. [ ] Action strip chips have category prefixes + GEX chip visible
6. [ ] Flow renders as ONE compact line (tug-of-war + chips), NOT tall cards
7. [ ] No standalone Probability Cone — it's inside DecisionContext
8. [ ] No "Show Advanced Overlays" below chart
9. [ ] Setup cards show thermometer + confluence pills + 4-metric grid
10. [ ] Setup feed has no stat grid (ACTIONABLE/WATCHLIST/AVG WIN removed)
11. [ ] GEX components are compact expandable, hidden when empty
12. [ ] AI Coach shows quick-action buttons when setup is selected
13. [ ] Contract card shows visual R:R bar when recommendation loads
14. [ ] Basis is only in collapsed Advanced section (header shows the data)

---

## Priority Order

1. **GAP 3 (Flow)** — Worst visual offender, wastes most space
2. **GAP 4 (Prob Cone standalone)** — Second-worst space waste
3. **GAP 7 (Setup Cards)** — Core UX, thermometer is the key differentiator
4. **GAP 1 (Header metrics)** — Important for first-impression clarity
5. **GAP 6 (Setup Feed stat grid)** — Easy win, just remove old code
6. **GAP 5 (Advanced Overlays)** — Easy win, already removed in code
7. **GAP 9/10 (GEX components)** — Space savings
8. **GAP 11 (Coach quick actions)** — UX improvement
9. **GAP 12 (Contract R:R bar)** — UX improvement
10. **GAP 2 (Action strip prefixes)** — Polish
11. **GAP 8 (Basis standalone)** — Layout cleanup
