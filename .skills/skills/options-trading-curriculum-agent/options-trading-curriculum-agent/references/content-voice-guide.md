# TITM Content Voice & Style Guide

## Table of Contents
1. [Voice Principles](#voice-principles)
2. [Content Patterns by Block Type](#content-patterns-by-block-type)
3. [Example Content Blocks](#example-content-blocks)
4. [Terminology Standards](#terminology-standards)
5. [SPX & NDX Specific Content](#spx--ndx-specific-content)

---

## Voice Principles

The TITM Academy voice is that of a **senior prop desk mentor** — direct, precise, no fluff. Think of someone who has traded for 15 years and is teaching their own money to a sharp junior trader.

**Do:**
- Lead with the actionable concept in bold
- Use specific numbers (not "small position" — say "1-2% of account")
- Reference real market mechanics (VWAP, GEX, IV percentile, SPX multiplier)
- Use mathematical notation when it clarifies (delta × move × 100 = P&L)
- Structure as rule → reasoning → example → edge case
- Address common mistakes directly ("Common mistake: sizing up on hot alerts")

**Don't:**
- Use vague motivational language ("believe in your process")
- Over-explain basic concepts — the audience knows what options are
- Use hedging language ("you might want to consider perhaps...")
- Write in passive voice
- Include disclaimers or "not financial advice" in lesson content

**Formatting:**
- Bold key terms on first use: **Delta**, **GEX**, **VWAP**
- Use markdown for structure: headers, bold, code blocks for formulas
- Numbers in examples should be realistic SPX/NDX levels
- Bullet lists for rules and checklists
- Arrow notation for worked examples: → Result

---

## Content Patterns by Block Type

### Hook (Concept Brief)
- **Length:** 150-300 words
- **Duration:** 5-6 minutes
- **Pattern:** Definition → Three functions/uses → Concrete example with math → Connection to 0DTE/scalping → Warning about common misconception
- **content_type:** `rich_text`

### Concept Explanation (Quick Check)
- **Length:** 10-30 words
- **Duration:** 2 minutes
- **Pattern:** Single sentence prompt that verifies the hook concept was absorbed
- **content_type:** `quick_check`

### Worked Example (Scenario Walkthrough)
- **Length:** Varies (structured JSON with 3-5 steps)
- **Duration:** 5 minutes
- **Pattern:** Real trading scenario → Multi-step decision tree → 3 choices per step (1 correct, 1 wrong, 1 suboptimal) → Detailed feedback per choice
- **content_type:** `scenario_walkthrough` or `applied_drill`
- **For drills:** Markdown with specific numbers and calculations

### Guided Practice (Reflection)
- **Length:** 30-60 words
- **Duration:** 2 minutes
- **Pattern:** Personal question connecting concept to trader's own experience → Follow-up "how would X change Y" framing
- **content_type:** `reflection`

### Independent Practice
- **Length:** 100-200 words
- **Duration:** 5 minutes
- **Pattern:** Multiple mini-scenarios requiring calculation or classification → Specific numbers → Expected answers inline
- **content_type:** `applied_drill`

---

## Example Content Blocks

### Hook Example (Delta lesson)
```
**Delta** measures how much your option price changes per $1 move in the underlying.
Call delta ranges from 0 to 1.0; put delta from 0 to -1.0. Delta serves three
functions for scalpers: (1) **Directional sensitivity** — a 0.50 delta call gains
~$0.50 per $1 up move, (2) **Probability proxy** — delta roughly equals the chance
of expiring ITM (0.50 delta ≈ 50% probability), (3) **Position sizing** — use delta
to calculate how many contracts give you the exposure you want. Example: You want $500
profit from a $10 SPX move. With a 0.50 delta option: 0.50 × $10 × 100 = $500 per
contract, so you need 1 contract. Delta is not static — it increases as options move
ITM, decreases as they move OTM, and these changes are dramatically amplified on 0DTE
due to gamma.
```

### Worked Example (Applied Drill)
```
Size these alert trades for a $20K account at 1.5% risk:

**Alert 1:** Entry $4.00, Stop $2.00. Risk/contract = $200. Max risk = $300.
→ Contracts: 1 ($200 ≤ $300 ✓, 2 would be $400 > $300 ✗)

**Alert 2:** Entry $6.50, Stop $3.25. Risk/contract = $325. Max risk = $300.
→ Contracts: 0 (risk exceeds budget — skip or tighten stop)

**Alert 3:** Entry $2.00, Stop $1.00. Risk/contract = $100. Max risk = $300.
→ Contracts: 3 ($300 = exactly at limit — consider 2 for buffer)
```

### Reflection Example
```
Have you ever felt pressure to trade bigger because others were excited about a setup?
How would sticking to your sizing rules regardless of social context protect your
account long-term?
```

---

## Terminology Standards

Always use these exact terms (not alternatives):

| Correct | Never Use |
|---------|-----------|
| 0DTE | zero-day, same-day expiry |
| SPX | S&P 500 index options (when referring to the option product) |
| NDX | Nasdaq-100 index options |
| GEX | gamma exposure (spell out on first use per module) |
| IV percentile | implied vol, IV rank (different metric) |
| VWAP | volume weighted average price (spell out on first use) |
| Put Wall / Call Wall | support/resistance (when specifically GEX-derived) |
| Conviction level | confidence level (TITM-specific term for alerts) |
| Entry validation | entry confirmation |
| Risk per contract | risk per lot |
| Premium stop | dollar stop (when based on % of premium paid) |
| Thesis | trade idea (thesis implies structured reasoning) |

---

## SPX & NDX Specific Content

### SPX Key Facts for Content
- Cash-settled (no delivery risk)
- European-style (no early assignment)
- 60/40 tax treatment (Section 1256)
- $100 multiplier
- PM-settled (standard) vs AM-settled (monthly/quarterly)
- 0DTE available Mon-Fri
- Deepest index options liquidity
- Typical 0DTE ATM premium: $3-8 depending on VIX
- Typical bid-ask spread: $0.10-0.30 for liquid strikes

### NDX Key Facts for Content
- Cash-settled, European-style (same as SPX)
- $100 multiplier
- 60/40 tax treatment (Section 1256)
- Lower liquidity than SPX — wider spreads
- Higher notional per point ($100 × NDX level ~$20K+)
- More volatile intraday (tech-weighted)
- 0DTE available but less liquid than SPX
- Better for directional plays when tech is leading
- Typical 0DTE ATM premium: $15-40 (higher due to higher index level)
- Watch NVDA, AAPL, MSFT, AMZN, META for NDX direction

### SPX vs NDX Content Comparison Points
- SPX for pure index/macro plays; NDX for tech-tilted thesis
- SPX has tighter spreads; NDX has wider but larger moves
- SPX 0DTE is the primary TITM vehicle; NDX 0DTE is supplementary
- Position sizing: NDX requires smaller contracts due to higher premium
- GEX/flow data more reliable for SPX (deeper market)
- VIX tracks SPX; VXN tracks NDX (less commonly referenced)

### Content Templates for Index-Specific Lessons

**SPX Lesson Template:**
- Open with SPX-specific contract mechanics
- Use realistic SPX levels (5000-5500 range)
- Reference SPX-specific flow: GEX, Put Wall, Call Wall, 0DTE gamma
- Include SPX spread strategies (verticals, butterflies)
- Tax implications for SPX Section 1256

**NDX Lesson Template:**
- Open with NDX differences from SPX
- Use realistic NDX levels (18000-20000 range)
- Reference tech earnings catalysts and sector rotation
- Include NDX-specific risks (single-stock concentration)
- Compare NDX trade setups to equivalent SPX plays

### Image URLs for Content
Use these paths for imageUrl in content_json:
- `/academy/illustrations/market-context.svg` — Market analysis topics
- `/academy/illustrations/entry-validation.svg` — Entry/setup topics
- `/academy/illustrations/trade-management.svg` — Management/execution topics
- `/academy/illustrations/training-default.svg` — General/default
