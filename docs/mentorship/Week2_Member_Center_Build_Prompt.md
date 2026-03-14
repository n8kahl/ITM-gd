# MEMBER CENTER BUILD PROMPT — Week 2: The Setup Filter

**Use this prompt after you've created the Week 2 Gamma.app presentation and have the embed URL. Paste this entire prompt into Claude Code to build the Week 2 member center page.**

---

## PROMPT

Build the Week 2 member center page for the Sniper Mentorship program. This page goes at `app/members/mentorship/week-2/page.tsx` and must match the exact structure, quality, and design patterns of the existing Week 1 page at `app/members/mentorship/week-1/page.tsx`.

**Before you start:** Read these files to understand the exact patterns:
- `app/members/mentorship/week-1/page.tsx` (the React page to replicate structurally)
- `app/members/mentorship/week-1/journal-guide/page.tsx` (reference for interactive guide patterns)
- `app/members/mentorship/page.tsx` (hub page — you'll need to update this to mark Week 2 as active)

---

### PAGE STRUCTURE (match Week 1 exactly):

**1. Hero Section**
- Badge: "Week 2 of 8"
- Title: "The Setup Filter"
- Subtitle quote: "If it doesn't pass the checklist, it doesn't get your capital."
- CTAs: "Open Checklist Guide" (primary, links to `/members/mentorship/week-2/checklist-guide`) + "Go to Trade Journal" (secondary, links to `/members/journal`)

**2. Core Lesson — Gamma Embed**
- Embed the Week 2 Gamma.app presentation
- Replace the iframe `src` with the actual Gamma embed URL: `https://gamma.app/embed/YOUR_WEEK2_EMBED_ID?mode=present`
- Same responsive sizing as Week 1: `h-[56vh] min-h-[360px] max-h-[720px] w-full md:h-[72vh] md:min-h-[620px] md:max-h-[900px] lg:h-[78vh]`
- Title: "Week 2 — The Setup Filter"

**3. "What You'll Learn" Grid (4 cards)**
- The 7 characteristics of an A+ setup
- How to build and use a pre-trade checklist
- Watchlist construction: 3-tier framework
- Time-of-day edge: when to trade and when to sit

**4. A+ Setup Criteria Section**
Display the 7 A+ criteria as a visual card grid:
1. Clear Directional Bias — Market trend supports your direction
2. Key Technical Level — Price at significant S/R, VWAP, or MA
3. Volume Confirmation — Above-average volume validates the move
4. Favorable Time of Day — First 30 min or last hour
5. Defined Risk-to-Reward — Minimum 1:2 R:R with stop and target set
6. Clean Emotional State — Calm, focused, following your plan
7. Passes Your Checklist — All 7 must be true simultaneously

**5. Interactive Pre-Trade Checklist Scorer**
Build an interactive component where users can check/uncheck 7 boxes and get a real-time score:
- State: `useState` for each of the 7 gates (boolean)
- Display gates as toggleable cards (emerald border when checked, white/10 when unchecked)
- Score display at bottom:
  - 7/7 → Green: "A+ SETUP — Execute with confidence"
  - 5-6/7 → Yellow/Champagne: "B SETUP — Skip or paper trade only"
  - <5/7 → Red: "NO TRADE — Walk away"
- Include a "Reset" button to clear all checkboxes

The 7 gates:
1. Market Trend — SPX/QQQ trending in my trade direction?
2. Key Level — Price at significant S/R, VWAP, or MA?
3. Volume — Current volume above 20-day average?
4. Time of Day — In a high-probability window?
5. R:R Defined — At least 1:2 with stop-loss and target?
6. Emotional State — Calm, focused, not revenge/FOMO?
7. Position Size — Risk ≤ 2% and within daily loss limit?

**6. Time-of-Day Edge Section**
Display as a visual timeline with 4 zones:
- 9:30-10:00 AM → Green → "The Opening Drive" — Highest volume, momentum plays
- 10:00-11:30 AM → Yellow → "The Reversal Zone" — Consolidation, fade setups
- 11:30 AM-2:00 PM → Red → "The Chop Zone" — Avoid trading, review instead
- 3:00-4:00 PM → Green → "Power Hour" — Second volume surge, trend confirmation

Use colored left borders or background tints to visually distinguish zones.

**7. Before vs. After Comparison Table**
Two-column layout (same pattern as Week 1's Gambler vs. Sniper table):
- Desktop: `<table>` with red/emerald headers
- Mobile: stacked cards

| Before the Filter | After the Filter |
|---|---|
| 47 trades/month | 12 trades/month |
| 47% emotional/FOMO/revenge | 8% unplanned |
| 38% win rate | 67% win rate |
| 0.8:1 average R:R | 2.1:1 average R:R |
| -$1,240 net P&L | +$2,890 net P&L |
| Stressed, inconsistent | Disciplined, in control |

**8. Interactive Backtest Calculator**
Let users input their own numbers to see the filter's impact:
- Inputs: Total trades (number), Trades that pass filter (number), Filtered P&L ($), Unfiltered P&L ($)
- Outputs:
  - Filter rate: `(filtered / total) * 100`%
  - P&L per filtered trade: `filteredPL / filtered`
  - P&L per unfiltered trade: `unfilteredPL / (total - filtered)`
  - Projected monthly P&L (filtered only): display prominently
- Color-code: emerald for positive, red for negative

**9. Knowledge Check Quiz (5 questions)**
Same interactive pattern as Week 1's quiz component:

Q1: AAPL at key support, above-avg volume, 10:15 AM, SPX trending up, calm emotional state, R:R 1:2.5, defined stop. A+ setup?
- Options: ["No — missing volume confirmation", "Yes — all 7 criteria met", "No — too early in the day", "Yes — but only if you size up"]
- Correct: 1 (index)
- Explanation: All 7 checklist gates pass. Market trend ✓, key level ✓, volume ✓, time ✓, R:R ✓, emotional state ✓, position size ✓.

Q2: 12:45 PM, TSLA setup, 5/7 checklist items green. What do you do?
- Options: ["Take it — 5/7 is good enough", "Skip — B trade in the chop zone", "Size down and take it", "Wait and re-check at 3 PM"]
- Correct: 1
- Explanation: 5/7 is a B trade, and 12:45 PM is the chop zone. Two red flags. Snipers skip B trades.

Q3: How many symbols should your Tier 1 (Core) watchlist contain?
- Options: ["15-20 for max opportunity", "3-5 high-liquidity familiar symbols", "Only 1 to master it", "Whatever is trending on social media"]
- Correct: 1
- Explanation: 3-5 core symbols gives enough opportunity while maintaining deep familiarity for pattern recognition.

Q4: You lost $300, new QQQ setup is 6/7 — only emotional state is red. What do you do?
- Options: ["Take it — 6/7 is close enough", "Skip — emotional state is non-negotiable", "Paper trade it", "Size down to half"]
- Correct: 1
- Explanation: Emotional state is not negotiable. If you're angry or tilted, you are impaired. Walk away.

Q5: Filter backtest: 6 filtered trades = +$1,800, 14 unfiltered = -$2,300. What does this tell you?
- Options: ["Only trade 6 times per month", "The filter identifies your edge", "Find more A+ setups", "The filter is too strict"]
- Correct: 1
- Explanation: 6 filtered trades = +$1,800. 14 unfiltered = -$2,300. Your edge lives in the filtered trades. Trade less, earn more.

**10. Assignment Section (12 tasks)**
Same numbered-circle pattern as Week 1:
1. Copy or customize the 7-point Pre-Trade Checklist
2. Print it or save as phone wallpaper / desk sticky note
3. Choose 3-5 Tier 1 (Core) watchlist symbols
4. Choose 2-3 Tier 2 (Rotation) symbols for this week
5. Add 1-2 Tier 3 (Catalyst) symbols if events are approaching
6. Write key levels (support/resistance) for each watchlist symbol
7. Run your 20 Week 1 trades through the new checklist — score each X/7
8. Calculate: What % of trades would have been filtered out?
9. Calculate: What would your P&L be with only 7/7 trades?
10. Identify 3 A+ setups during live market this week (even if paper trading)
11. Log each setup in Trade Journal with tag "Filtered Setup" and checklist score
12. Bring your watchlist, checklist, and backtest results to the Week 2 group call

CTAs below: "Open Checklist Guide" (primary) + "Open Trade Journal" (secondary)

**11. Week 2 Outcome Section**
Same centered glass-card pattern as Week 1:
- Heading: "Week 2 Outcome"
- Text: You become **selective with your setups**.
- Quote: "You don't need more setups. You need a filter that kills bad ones before they kill your account."

---

### ALSO UPDATE:

**`app/members/mentorship/page.tsx`:**
- Change Week 2 from `active: false` to `active: true`
- Keep Weeks 3-8 as `active: false`

**Analytics tracking:**
- Use `Analytics.trackAcademyAction('mentorship_week2_quiz_qN')` for quiz interactions (same pattern as Week 1)
- Use `Analytics.trackAcademyAction('mentorship_week2_checklist_toggle')` for checklist interactions

---

### DESIGN STANDARDS (enforced):

- **Theme:** Dark mode only. Emerald (#10B981) primary, Champagne (#F3E5AB) accent.
- **Typography:** `font-[family-name:var(--font-playfair)]` for headings, Inter for body, `font-mono` for data/numbers.
- **Cards:** `glass-card-heavy` class on all card surfaces.
- **Borders:** `border-white/10` default, `border-emerald-500/20` for highlighted sections.
- **Icons:** Lucide React, stroke width 1.5. Key icons for Week 2: `Crosshair`, `CheckSquare`, `ListChecks`, `Clock`, `Filter`, `Target`, `TrendingUp`, `BarChart3`.
- **Mobile first:** All tables have mobile card alternatives using `hidden md:block` / `md:hidden` patterns.
- **Inputs:** `min-h-11` on all interactive elements. Dark backgrounds: `bg-[#0A0A0B]/70`.
- **Imports:** Use `@/` alias. Import `Analytics` from `@/lib/analytics`.
- **Client component:** `'use client'` at top.
- **No localStorage:** Keep all state in React `useState`.

---

### VALIDATION AFTER BUILD:

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app/members/mentorship/week-2/page.tsx app/members/mentorship/page.tsx
pnpm run build
```

All must pass before commit.
