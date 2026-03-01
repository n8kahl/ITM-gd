# Trade Review Detail — Sr. UX Audit

> **Surface:** `/admin/trade-review/[id]`
> **Auditor:** Sr. UX Designer (Claude)
> **Date:** 2026-03-01
> **Scope:** Layout, information architecture, interaction design, visual hierarchy, workflow efficiency
> **Design System Reference:** Emerald Standard (Brand Guidelines v2.0)

---

## Executive Summary

The Trade Review Detail screen is functionally complete — it surfaces the right data, enables AI generation, supports structured coaching feedback, and handles the publish lifecycle. However, the current layout treats all three columns as equal peers, which doesn't reflect how a coach actually works. The result is a screen that **shows everything but prioritizes nothing**, forcing the reviewer to mentally assemble context before they can start coaching.

The recommendations below are organized by impact tier (P0 → P2) and grouped into five themes: Information Hierarchy, Workflow Friction, Visual Design, Interaction Polish, and Missing Capabilities.

---

## 1. Information Hierarchy Problems

### 1.1 No reviewer status or context bar (P0)

**Current:** The page header shows only the entry UUID. There is a conditional sky-colored banner when a review is "claimed," but no persistent summary of the review state.

**Problem:** The coach lands on this page and has to visually scan across all three columns to understand: Who is this trader? What did they trade? Is this already in review? Has feedback been drafted?

**Recommendation:** Add a persistent **context bar** directly below the header that consolidates:

- Member name + avatar + tier badge (pulled from left column)
- Trade summary: `TSLA Long Stock · +$20 (+900.9%) · Feb 28, 2026`
- Review status badge (pending / in_review / completed / dismissed)
- Assigned reviewer name (if claimed)
- Draft status indicator (no draft / AI draft / manual draft / published)
- Time in queue (e.g., "Waiting 2d 4h")

This gives the coach full situational awareness in the first 200ms without scrolling.

### 1.2 Three equal columns fail the coaching workflow (P0)

**Current:** `grid-cols-1 xl:grid-cols-3` — all three panels get identical width.

**Problem:** The Coach Workspace is the primary action surface. It's where the coach spends 80%+ of their time. Giving it the same width as the read-only trade detail panel means every textarea is cramped, especially "Areas to Improve" which has two fields per item, and "Overall Assessment" which should invite longer-form writing.

**Recommendation:** Switch to a **2/5 + 3/5 split** or use a **tabbed left panel**:

- **Option A (Recommended):** Left panel becomes a tabbed container holding "Trade Detail" and "Market Context" as two tabs. Right panel (Coach Workspace) gets ~60% of the width. The trade detail is reference material — it doesn't need to be visible simultaneously with the market chart.
- **Option B:** Use `xl:grid-cols-5` with `col-span-2` for trade detail, `col-span-1` for market context (narrower), and `col-span-2` for coach workspace.

### 1.3 Member stats are fetched but never displayed (P1)

**Current:** The API returns `member_stats` (total trades, win rate, avg P&L, symbol-specific stats, recent streak, avg discipline score) but the detail page types it as `Record<string, unknown>` and never renders it.

**Problem:** This is some of the most valuable coaching context. A coach reviewing a trade needs to know: Is this trader consistently profitable? Is this an anomaly? What's their discipline trend?

**Recommendation:** Add a **"Trader Profile" card** either in the context bar or as a collapsible section in the Trade Detail panel showing:

- Win rate (with visual indicator: green if >55%, amber if 45-55%, red if <45%)
- Total trades reviewed
- Symbol-specific win rate for the current symbol
- Recent streak (winning/losing/mixed)
- Avg discipline score (if available)

### 1.4 P&L formatting inconsistency (P2)

**Current:** P&L shows `+$20` and P&L% shows `+900.90%`. Both use the same `text-sm` sizing inside the same-sized metric cards.

**Problem:** A 900% return is extraordinary — it should be visually prominent. The P&L figure and the P&L percentage are arguably the single most important data points for coaching context.

**Recommendation:** Make P&L and P&L% use `font-mono text-lg` (Geist Mono, per brand guidelines) and position them in the context bar or as a hero metric at the top of the Trade Detail panel. Extraordinary returns (>100% or >$1000) could get a champagne accent border.

---

## 2. Workflow Friction

### 2.1 "Generate AI Analysis" is disconnected from its input (P0)

**Current:** The "Generate AI Analysis" button lives in the Coach Workspace header. The "Coach Preliminary Notes" textarea that shapes the AI output sits below it, inside the workspace body. The button and its input field are visually separated by the section border.

**Problem:** The flow should be: write notes → generate. But the button appears *before* the notes field, creating a top-down reading order that implies "click generate, then optionally add notes." This is backwards.

**Recommendation:** Group the preliminary notes and the generate button into a single **"AI Generation" card** with the notes above and the button below the notes. Add a subtle helper text: "Notes below will guide the AI analysis." Consider making the button change label to "Regenerate" after the first generation.

### 2.2 No preview of what the member will see (P1)

**Current:** The coach writes structured feedback and clicks "Publish to Member." They have no way to preview how it will render on the member's journal detail sheet.

**Problem:** The member-facing `CoachFeedbackSection` component renders differently from the coach workspace (e.g., areas_to_improve shows point + instruction as a card, drills use `<details>` disclosure). The coach may be surprised by how their feedback appears.

**Recommendation:** Add a **"Preview Member View"** toggle or modal that renders the current draft through the same `CoachFeedbackSection` component (or a read-only variant). This closes the feedback loop and builds coach confidence before publishing.

### 2.3 `window.confirm()` for publish/dismiss is not premium (P1)

**Current:** Both Publish and Dismiss use native `window.confirm()` dialogs.

**Problem:** A native browser confirm dialog breaks the dark theme immersion entirely. For an action as consequential as publishing coaching feedback to a paying member, this should be a designed experience.

**Recommendation:** Replace with a custom modal component using `glass-card-heavy` styling:

- **Publish modal:** Shows a summary of what will be sent (grade, number of points, assessment preview), the member's name, and an emerald "Confirm Publish" button.
- **Dismiss modal:** Shows a warning that this will close the review without feedback, with a red "Confirm Dismiss" button and optional dismiss reason textarea.

### 2.4 No keyboard shortcuts for power users (P2)

**Current:** All actions require mouse clicks.

**Recommendation:** Add keyboard shortcuts for the coach's most frequent actions:

- `Cmd+S` → Save Draft
- `Cmd+G` → Generate AI Analysis
- `Cmd+Enter` → Open Publish confirmation
- `Escape` → Navigate back to queue

### 2.5 No auto-save / draft loss risk (P1)

**Current:** The coach's work is only persisted on explicit "Save Draft" click. If they accidentally navigate away, close the tab, or the browser crashes, all work is lost.

**Recommendation:** Implement auto-save with a debounced 10-second timer. Show a subtle "Draft saved" / "Unsaved changes" indicator in the workspace header. Add a `beforeunload` handler to warn about unsaved changes.

---

## 3. Visual Design Issues

### 3.1 Metric cards create visual noise (P1)

**Current:** Every single data point (Symbol, Direction, Contract, Review Status, P&L, etc.) is wrapped in its own `rounded-lg border border-white/10 bg-white/5 p-3` card inside a `grid-cols-2` grid. The Trade Detail panel alone has 10+ individual metric cards, each with its own border.

**Problem:** This creates a "sea of boxes" effect where everything looks the same and nothing stands out. The eye has no clear path through the information. Per the Brand Guidelines, the aesthetic should be "Quiet Luxury" — but the current pattern reads more like a dense data dashboard.

**Recommendation:**

- **Group related metrics** into logical clusters without individual card borders. Use a single card for "Trade Parameters" (symbol, direction, contract, position size, hold time) and a separate card for "P&L" (entry, exit, P&L, P&L%).
- **Use horizontal key-value pairs** for simple text metrics (e.g., `Symbol: TSLA | Direction: Long | Contract: Stock`) rather than giving each its own card.
- **Reserve bordered cards** for high-signal metrics: P&L, Psychology scores, and Options Greeks.

### 3.2 Typography doesn't follow brand guidelines (P1)

**Current:** All text uses Inter (via default Tailwind classes). No use of `Playfair Display` for headings or `Geist Mono` for financial data.

**Recommendation:**

- Section headers ("Market Context", "Coach Workspace", "Psychology") should use `font-serif` (Playfair Display) per brand guidelines.
- All price values ($2.22, $22.22), P&L figures, percentages, and the Entry ID should use `font-mono` (Geist Mono).
- The member name could use `font-serif` at a slightly larger size for a premium feel.

### 3.3 Grade select is a plain `<select>` dropdown (P1)

**Current:** The grade (A-F) is a standard HTML `<select>` element with default styling.

**Problem:** The grade is the most consequential single-field decision the coach makes. It deserves visual weight and intentional design.

**Recommendation:** Replace with a **button group / segmented control** where each grade is a clickable pill:

- A: Emerald background
- B: Sky/blue background
- C: Amber background
- D: Orange background
- F: Red background

This gives the coach immediate visual feedback on the severity of the grade and makes the selection feel intentional rather than incidental.

### 3.4 Confidence select lacks semantic meaning (P2)

**Current:** `<select>` with options "high", "medium", "low" — all lowercase, no visual differentiation.

**Recommendation:** Similar button group treatment. Or at minimum, capitalize the labels and add a subtle icon or color indicator.

### 3.5 Border inconsistency: `border-white/10` vs `border-white/5` (P2)

**Current:** The Brand Guidelines specify `border-white/5` as the standard border, but the trade review components consistently use `border-white/10` (double the opacity).

**Recommendation:** Align with the brand standard. Use `border-white/5` for default borders and reserve `border-white/10` for hover/focus states or to indicate interactive surfaces.

### 3.6 Entry/Exit bar cards break the neutral palette (P2)

**Current:** Entry Bar uses `border-emerald-400/30 bg-emerald-500/10` and Exit Bar uses `border-red-400/30 bg-red-500/10`.

**Problem:** Using P&L colors (green/red) for entry/exit bars conflates "entry" with "positive" and "exit" with "negative." An entry could be into a losing trade; an exit could be a profit-take.

**Recommendation:** Use neutral styling for both bars with only the labels differentiating them, or use directional indicators (in/out arrows) rather than color semantics.

---

## 4. Interaction Polish

### 4.1 Screenshots section is underdeveloped (P1)

**Current:** Coach screenshots display as tiny `h-24` (96px) thumbnails in a 2-column grid. Each shows the raw file path below it. Remove buttons use the same small `luxury-outline` treatment.

**Problem:** Screenshots are valuable coaching tools — the coach is annotating charts, marking entries, drawing on price action. Showing them at 96px makes them useless for review. The raw file path (`coach-review-screenshots/...`) is implementation detail that shouldn't be exposed.

**Recommendation:**

- Increase thumbnail size to `h-40` minimum.
- Add click-to-zoom (like the member screenshot already has).
- Remove the raw path display.
- Add drag-and-drop upload in addition to the file picker.
- Consider a lightbox gallery view when multiple screenshots are attached.

### 4.2 Activity log is buried and minimal (P2)

**Current:** The activity log is inside a `<details>` element at the very bottom of the Coach Workspace. Each entry shows only the action name and timestamp.

**Problem:** For audit purposes and coach handoff, the activity log should include who performed the action and be more accessible.

**Recommendation:**

- Move the activity log to a dedicated tab or collapsible section outside the main workspace scroll.
- Include the actor name alongside each action.
- Use relative timestamps ("2 hours ago") with full timestamps on hover.
- Add visual indicators for key milestones (review requested, AI generated, draft saved, published).

### 4.3 No loading skeleton for initial load (P1)

**Current:** While loading, the page shows a single glass card with "Loading trade review detail..." text.

**Problem:** Per the Brand Guidelines, loading states should use the "Pulsing Logo" skeleton, never plain text.

**Recommendation:** Implement a shimmer/pulse skeleton that mirrors the three-column layout shape, giving the coach a sense of what's coming while data loads.

### 4.4 Textarea rows are too small for coaching content (P1)

**Current:** Most textareas use `rows={2}` (What Went Well, Areas to Improve observations, drill descriptions). Internal Notes uses `rows={4}`. Overall Assessment uses `rows={4}`.

**Problem:** `rows={2}` is ~40px of writing space. Coaches writing thoughtful feedback will immediately be scrolling inside tiny textareas. This makes the authoring experience feel cramped and discourages thorough feedback.

**Recommendation:**

- What Went Well: `rows={3}` minimum
- Areas to Improve (observation): `rows={3}`
- Areas to Improve (instruction): `rows={3}`
- Overall Assessment: `rows={6}`
- Grade Reasoning: `rows={3}`
- Consider auto-expanding textareas that grow with content.

---

## 5. Missing Capabilities

### 5.1 No way to navigate between reviews without returning to queue (P1)

**Current:** The coach must click "Back" to the queue, then click into the next review. There's no "Next Review" or "Previous Review" navigation.

**Recommendation:** Add prev/next navigation arrows in the header or context bar, ideally showing the next trade's symbol and member name as a preview.

### 5.2 No rich text in coach feedback (P2)

**Current:** All coach feedback fields are plain text.

**Recommendation:** Consider lightweight markdown support (bold, italic, links) in the "Areas to Improve" instruction field and "Overall Assessment." This would allow coaches to link to academy lessons or emphasize key points.

### 5.3 No feedback templates (P2)

**Current:** Every review starts from scratch (or from AI generation).

**Recommendation:** Allow coaches to save and reuse common feedback snippets or templates (e.g., "Position sizing too large for account size," "Good entry timing but no defined exit plan"). This could be a simple dropdown that inserts text.

### 5.4 No side-by-side view of member's notes vs coach notes (P1)

**Current:** The member's trade notes (strategy, setup notes, execution notes, lessons learned) are in the left column inside a `<details>` accordion. The coach workspace is in the right column. The coach must scroll the left column and read notes, then scroll back to the right to write feedback.

**Recommendation:** In the coach workspace, add a collapsible "Member's Notes" reference section that shows the member's strategy, execution notes, and lessons learned inline — so the coach can reference them without cross-column scrolling.

### 5.5 No comparison to member's past reviews (P2)

**Current:** The coach sees this trade in isolation (except for the unused member_stats).

**Recommendation:** Add a "Previous Reviews" section showing the member's last 3-5 coach-reviewed trades with grades, so the coach can track improvement and reference prior feedback.

---

## 6. Accessibility Concerns

### 6.1 Select elements lack visible labels (P1)

**Current:** The Grade and Confidence `<select>` elements have no associated `<label>`. Screen readers will announce them as unlabeled dropdowns.

**Recommendation:** Add `aria-label` or visible labels above each select. E.g., "Grade" and "Confidence Level."

### 6.2 Trash buttons lack accessible names (P1)

**Current:** The delete buttons on What Went Well, Areas to Improve, and Specific Drills items only contain a Trash2 icon with no text or aria-label.

**Recommendation:** Add `aria-label={`Remove item ${index + 1}`}` to each trash button.

### 6.3 Color-only status indicators (P2)

**Current:** The data quality badge (FULL/PARTIAL/STALE) and review status badges rely on color alone to convey meaning.

**Recommendation:** The text labels help, but ensure sufficient contrast ratios. The red-on-dark-red combination for STALE may not meet WCAG AA requirements.

---

## 7. Recommended Implementation Priority

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **P0** | Context bar with trade summary + review status | High | Medium |
| **P0** | Column rebalancing (tabbed left panel or wider workspace) | High | Medium |
| **P0** | Group AI generation notes + button together | High | Low |
| **P1** | Render member_stats in trader profile card | High | Low |
| **P1** | Custom publish/dismiss modals (replace window.confirm) | Medium | Medium |
| **P1** | Member view preview toggle | Medium | Medium |
| **P1** | Auto-save with unsaved changes indicator | Medium | Medium |
| **P1** | Reduce metric card visual noise | Medium | Medium |
| **P1** | Apply brand typography (Playfair + Geist Mono) | Medium | Low |
| **P1** | Grade as button group / segmented control | Medium | Low |
| **P1** | Larger textareas + auto-expand | Medium | Low |
| **P1** | Screenshot zoom + larger thumbnails | Medium | Low |
| **P1** | Skeleton loading state | Low | Low |
| **P1** | Prev/Next review navigation | Medium | Medium |
| **P1** | Inline member notes reference in workspace | Medium | Low |
| **P1** | Accessible labels for selects and icon buttons | Medium | Low |
| **P2** | Keyboard shortcuts | Low | Low |
| **P2** | Feedback templates/snippets | Low | Medium |
| **P2** | Rich text (markdown) in feedback | Low | High |
| **P2** | Previous reviews history | Low | Medium |
| **P2** | Border opacity alignment with brand standard | Low | Low |
| **P2** | Activity log improvements | Low | Low |

---

## 8. Summary

The trade review screen has strong bones — the data model is comprehensive, the API surface is well-designed, and the coach workspace captures the right structured feedback. The primary opportunities are:

1. **Elevate the coach's workflow** by restructuring the layout to prioritize the workspace and consolidating context into a summary bar.
2. **Reduce cognitive load** by grouping metrics, surfacing member stats, and enabling inline reference to member notes.
3. **Raise the visual bar** by applying the Emerald Standard typography, replacing native browser dialogs, and treating high-signal elements (grade, P&L) with the visual weight they deserve.
4. **Protect the coach's work** with auto-save, unsaved change warnings, and preview capabilities.

These changes would transform the experience from "functional admin tool" to "premium coaching workstation" — which is the right bar for a platform built on the Private Equity / Quiet Luxury aesthetic.
