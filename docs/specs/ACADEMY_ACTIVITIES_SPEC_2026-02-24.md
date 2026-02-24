# ACADEMY_ACTIVITIES_SPEC_2026-02-24.md

## Overview: 12 New Interactive Activity Types for TradeITM Academy

**Version:** 1.0
**Date:** 2026-02-24
**Status:** Design Specification (Research & Writing, No Implementation)
**Scope:** Design 12 new block types and associated assessment/interactive patterns for the Academy platform.
**Target Release:** Future phase (post-core academy stabilization)

---

## Executive Summary

This specification designs 12 new interactive activity block types to complement the existing 6 block types (hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection). These new types are optimized for options trading education, technical visualization, decision-making under uncertainty, and self-assessment.

**Key Principles:**
- Leverage Emerald Standard design system (dark mode, glass-card-heavy, Emerald #10B981 + Champagne #F3E5AB)
- Mobile-first responsive design with touch gesture support
- Accessibility-first (keyboard navigation, ARIA, screen reader support)
- Deterministic scoring with partial credit
- Integration with existing competency system (market_context, entry_validation, position_sizing, trade_management, exit_discipline, review_reflection)
- AI-generatable content (structured JSON enables LLM-driven instance creation)

---

## Part 1: Activity Type 1 — Options Chain Simulator

### 1.1 Purpose & Learning Outcomes

Students read a **live-like options chain** (simulated or historical) and answer comprehension questions about:
- Strike selection for a given thesis
- Bid/ask spread interpretation
- Options Greeks (delta, gamma, theta, vega)
- Volume and Open Interest signals
- IV Rank/percentile context

**Competencies Addressed:**
- `entry_validation` (strike selection, risk/reward assessment)
- `market_context` (understanding volatility and OI)

### 1.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'options_chain_simulator'
```

#### New Table (Optional: For Reusable Chain Templates)
```sql
CREATE TABLE academy_options_chain_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  expiration_date date NOT NULL,
  chain_json jsonb NOT NULL,  -- Full chain snapshot
  created_at timestamp DEFAULT now()
);
```

#### Content JSON Structure
```json
{
  "title": "SPX Options Chain Deep Dive",
  "lessonTitle": "Entry Validation via Chain Analysis",
  "lessonObjective": "Identify optimal strikes using chain analytics",
  "instruction": "Examine the SPX 3/21 options chain below. Answer questions about strike selection, Greeks, and volume.",
  "chainSnapshot": {
    "symbol": "SPX",
    "expirationDate": "2026-03-21",
    "spotPrice": 5850.00,
    "impliedVolatility": 0.142,
    "ivRank": 65,
    "chain": [
      {
        "strikePrice": 5800,
        "side": "call",
        "bid": 72.50,
        "ask": 73.80,
        "volume": 8234,
        "openInterest": 45000,
        "delta": 0.75,
        "gamma": 0.0018,
        "theta": -0.08,
        "vega": 0.035
      },
      {
        "strikePrice": 5800,
        "side": "put",
        "bid": 18.20,
        "ask": 19.50,
        "volume": 3421,
        "openInterest": 12000,
        "delta": -0.24,
        "gamma": 0.0019,
        "theta": -0.02,
        "vega": 0.038
      }
    ]
  },
  "questions": [
    {
      "id": "q1",
      "prompt": "Which strike would you select for a bullish call spread entry? Why?",
      "type": "scenario_branch",
      "options": [
        { "id": "atm_call", "label": "At-the-money call (5850)" },
        { "id": "itm_call", "label": "ITM call (5800)" },
        { "id": "otm_call", "label": "OTM call (5900)" }
      ],
      "expectedAnswer": "otm_call",
      "rationale": "OTM calls have higher theta decay benefit for a spread and lower capital requirement."
    }
  ]
}
```

### 1.3 React Component Design

#### Props
```typescript
interface OptionsChainSimulatorProps {
  blockId: string
  contentJson: {
    title: string
    lessonTitle: string
    lessonObjective: string
    instruction: string
    chainSnapshot: {
      symbol: string
      expirationDate: string
      spotPrice: number
      impliedVolatility: number
      ivRank: number
      chain: Array<{
        strikePrice: number
        side: 'call' | 'put'
        bid: number
        ask: number
        volume: number
        openInterest: number
        delta: number
        gamma: number
        theta: number
        vega: number
      }>
    }
    questions: Array<{
      id: string
      prompt: string
      type: string
      options?: Array<{ id: string; label: string }>
      expectedAnswer: string
      rationale: string
    }>
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
// Local state in component
const [selectedStrike, setSelectedStrike] = useState<number | null>(null)
const [selectedSide, setSelectedSide] = useState<'call' | 'put' | null>(null)
const [showGreeks, setShowGreeks] = useState(false)
const [answers, setAnswers] = useState<Record<string, string>>({})
const [feedbackShown, setFeedbackShown] = useState(false)
```

#### Key Interactions
1. **Chain Display:** Render full call/put chain in a table with horizontal scrolling on mobile (or card layout).
2. **Hover/Tap Tooltips:** Show Greeks breakdown on hover (desktop) or tap (mobile).
3. **Strike Selection:** Click/tap to highlight a row; show detailed breakdown in a side panel.
4. **Toggle Greeks View:** Button to expand/collapse Greeks columns (default: hidden on mobile).
5. **Answer Questions:** Multiple-choice or short-answer questions below the chain.
6. **Submit & Feedback:** Show correct rationales and links to related concepts.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap to expand row details (Greeks, volume profile).
  - Swipe left to reveal Greeks columns (if included).
  - Double-tap to zoom into chart region (if applicable).
- **Responsive Layout:**
  - Mobile (< 768px): Card layout with call/put stacked vertically by strike.
  - Tablet (768–1024px): Two-column layout (calls left, puts right).
  - Desktop (> 1024px): Full table with horizontal scrolling for Greeks.

### 1.4 Scoring & Grading Algorithm

**Scoring Strategy: Scenario-based with Partial Credit**

```
For each question:
  IF answer matches expectedAnswer:
    score = 1.0
  ELSE:
    score = 0.0

  // Optionally: Check for common-sense partial credit
  IF answer is "atm_call" when "otm_call" is correct:
    score = 0.5 (student recognizes ATM but misses OTM benefits)

overallScore = sum(itemScores) / totalQuestions
competencyScore[entry_validation] += overallScore * 0.7
competencyScore[market_context] += overallScore * 0.3
```

**Rubric Example:**
- ✓ **Full (1.0):** Selects OTM strike, explains theta/gamma trade-off
- ◐ **Partial (0.5):** Selects ATM or recognizes OTM but reasoning is incomplete
- ✗ **Incomplete (0.0):** Selects strike without supporting logic

### 1.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `entry_validation` | 70% | Strike selection, risk/reward |
| `market_context` | 30% | IV interpretation, OI signals |

**Review Queue Integration:**
If student scores < 70%, add remediation items:
- Prompt: "Explain the relationship between strike selection and theta decay."
- Source: `options_chain_simulator`

### 1.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through rows and question options.
  - Enter/Space to expand Greeks or select answer.
  - Arrow keys to scroll through strikes.

- **Screen Reader Support:**
  - `<table role="grid">` with `aria-label="SPX Options Chain"`
  - `<td role="gridcell">` with data attributes: `data-strike`, `data-side`, `data-greeks`
  - Announce Greeks values as: "5800 Call: Delta 0.75, Gamma 0.0018"

- **ARIA Labels:**
  ```html
  <button aria-label="Show Greeks breakdown for 5800 call">
    Show Greeks
  </button>
  <div aria-describedby="chain-help">
    Click a row to see detailed Greeks
  </div>
  ```

### 1.7 AI Generation Potential

**High:** LLM can generate options chains given:
- Symbol (SPX, QQQ, etc.)
- Expiration date
- Spot price
- IV environment (low, medium, high)
- Market bias (bullish, bearish, neutral)

**Example Prompt:**
```
Generate a realistic SPX options chain for 2026-03-21 expiration
with spot at 5850, IV 14.2%, IV Rank 65. Include 5 call and 5 put
strikes around ATM with bid/ask, volume, OI, and Greeks. Format as JSON.
```

**Content Instance Example:**
```json
{
  "blockType": "options_chain_simulator",
  "contentJson": {
    "title": "Volatility Crush: IV Rank & Chain Compression",
    "instruction": "Compare this pre-earnings vs. post-earnings chain...",
    "chainSnapshot": { ... }
  }
}
```

---

## Part 2: Activity Type 2 — Payoff Diagram Builder

### 2.1 Purpose & Learning Outcomes

Students **interactively build an options position** by dragging "legs" (calls, puts, different strikes/expirations) onto a canvas. In real-time, a **P&L payoff diagram** updates, showing:
- Breakeven points
- Risk/Reward zone shading
- Max loss and max gain
- Greeks across the position

**Competencies Addressed:**
- `position_sizing` (selecting legs, position structure)
- `entry_validation` (strike/expiration combo)
- `trade_management` (understanding position Greeks)

### 2.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'payoff_diagram_builder'
```

#### Content JSON Structure
```json
{
  "title": "Build a Call Spread Payoff",
  "lessonTitle": "Position Sizing & P&L Structure",
  "lessonObjective": "Design a profitable call spread and analyze its payoff curve",
  "instruction": "Drag calls and puts onto the canvas to build a position. Watch the payoff curve update in real-time.",
  "initialPosition": {
    "legs": [],
    "expirationDate": "2026-03-21"
  },
  "availableLegs": [
    {
      "id": "call_5800",
      "type": "call",
      "strikePrice": 5800,
      "expirationDate": "2026-03-21",
      "premium": 73.15,
      "label": "5800 Call @ $73.15"
    },
    {
      "id": "call_5900",
      "type": "call",
      "strikePrice": 5900,
      "expirationDate": "2026-03-21",
      "premium": 24.50,
      "label": "5900 Call @ $24.50"
    },
    {
      "id": "put_5700",
      "type": "put",
      "strikePrice": 5700,
      "expirationDate": "2026-03-21",
      "premium": 12.80,
      "label": "5700 Put @ $12.80"
    }
  ],
  "targetPosition": {
    "description": "Build a bull call spread (long 5800 call, short 5900 call)",
    "legs": [
      { "side": "long", "type": "call", "strike": 5800 },
      { "side": "short", "type": "call", "strike": 5900 }
    ],
    "expectedMaxProfit": 100,
    "expectedMaxLoss": 76.65,
    "expectedBreakeven": 5876.65
  },
  "constraints": {
    "maxLegs": 2,
    "allowedTypes": ["call", "put"],
    "expirationLock": true
  },
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "What is the max profit of this position?",
      "answerKey": { "expectedAnswer": "100" },
      "type": "short_answer_rubric"
    },
    {
      "id": "q2",
      "prompt": "At what price does this spread break even?",
      "answerKey": { "expectedAnswer": "5876.65" },
      "type": "short_answer_rubric"
    }
  ]
}
```

### 2.3 React Component Design

#### Props
```typescript
interface PayoffDiagramBuilderProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    initialPosition: { legs: unknown[]; expirationDate: string }
    availableLegs: Array<{
      id: string
      type: 'call' | 'put'
      strikePrice: number
      expirationDate: string
      premium: number
      label: string
    }>
    targetPosition?: {
      description: string
      legs: Array<{ side: 'long' | 'short'; type: 'call' | 'put'; strike: number }>
      expectedMaxProfit: number
      expectedMaxLoss: number
      expectedBreakeven: number
    }
    constraints: {
      maxLegs: number
      allowedTypes: string[]
      expirationLock: boolean
    }
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [position, setPosition] = useState<Array<{
  legId: string
  side: 'long' | 'short'
  type: 'call' | 'put'
  strikePrice: number
  premium: number
}>>([])

const [priceRange, setPriceRange] = useState<[number, number]>([5600, 6100])
const [payoffData, setPayoffData] = useState<Array<{ price: number; pnl: number }>>(
  calculatePayoff(position, priceRange)
)
const [answers, setAnswers] = useState<Record<string, string>>({})
```

#### Key Interactions
1. **Drag-and-Drop Legs:** Drag available legs onto a canvas/target zone.
2. **Position Builder Panel:** Shows current position (legs, net debit/credit).
3. **Real-Time Payoff Update:** Recalculate P&L curve as legs are added/removed.
4. **Payoff Diagram Display:**
   - SVG or Canvas line chart showing P&L across price range.
   - Shaded zones: profit (green), loss (red).
   - Markers: breakeven points, max profit/loss.
5. **Greeks Summary:** Display position delta, gamma, theta, vega totals.
6. **Assessment Questions:** After building, ask about max profit, breakeven, etc.
7. **Validation:** Highlight when position matches target (if provided).

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap available leg (opens modal to confirm).
  - Swipe leg left to remove from position.
  - Two-finger pinch to zoom payoff diagram.
- **Responsive Layout:**
  - Mobile: Available legs as card stack, payoff chart below.
  - Tablet: 50/50 split (legs left, chart right).
  - Desktop: 30% legs panel, 70% chart with Greeks overlay.

### 2.4 Payoff Calculation Algorithm

```typescript
function calculatePayoff(
  position: LegPosition[],
  priceRange: [number, number],
  resolution = 50
): Array<{ price: number; pnl: number }> {
  const step = (priceRange[1] - priceRange[0]) / resolution
  const result = []

  for (let price = priceRange[0]; price <= priceRange[1]; price += step) {
    let totalPnl = 0

    for (const leg of position) {
      const intrinsic = calculateIntrinsic(leg, price)
      const legPnl = leg.side === 'long'
        ? intrinsic - leg.premium
        : leg.premium - intrinsic

      totalPnl += legPnl
    }

    result.push({ price, pnl: totalPnl })
  }

  return result
}

function calculateIntrinsic(leg: LegPosition, priceAtExpiry: number): number {
  if (leg.type === 'call') {
    return Math.max(priceAtExpiry - leg.strikePrice, 0)
  } else {
    return Math.max(leg.strikePrice - priceAtExpiry, 0)
  }
}
```

### 2.5 Scoring & Grading Algorithm

**Scoring Strategy: Position Matching + Assessment Accuracy**

```
// Positional Accuracy
IF position matches targetPosition:
  positionScore = 1.0
ELSE IF position has correct structure but wrong strikes:
  positionScore = 0.5
ELSE:
  positionScore = 0.0

// Assessment Questions
assessmentScore = average(assessmentItemScores)

// Combined Score
overallScore = (positionScore * 0.6) + (assessmentScore * 0.4)

competencyScore[position_sizing] += overallScore * 0.5
competencyScore[entry_validation] += overallScore * 0.3
competencyScore[trade_management] += overallScore * 0.2
```

### 2.6 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `position_sizing` | 50% | Leg selection, risk/reward structure |
| `entry_validation` | 30% | Strike/expiration combo correctness |
| `trade_management` | 20% | Position Greeks awareness |

### 2.7 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through available legs and select with Enter.
  - Arrow keys to adjust price range slider.
  - Delete/Backspace to remove legs.

- **Screen Reader Support:**
  - List available legs: "5800 Call, long, premium $73.15"
  - Announce payoff chart: "Long call payoff chart from $5600 to $6100. Maximum profit $227, maximum loss $73.15"
  - Announce breakeven: "Breakeven at $5873.15"

- **ARIA:**
  ```html
  <button aria-label="Add 5800 call to position" role="button">Add</button>
  <div role="region" aria-label="Position summary" aria-live="polite">
    2 legs added: Long 5800 call, Short 5900 call
  </div>
  <svg role="img" aria-label="Payoff diagram">...</svg>
  ```

### 2.8 AI Generation Potential

**High:** LLM can generate payoff scenarios given:
- Market condition (bullish, bearish, neutral)
- Position type (spread, straddle, strangle, etc.)
- Risk tolerance (tight stops vs. wide)

**Example Prompt:**
```
Create a payoff diagram builder activity for a bull call spread on SPX.
The target position should be: long 5800 call, short 5900 call,
for 3/21 expiration. Include assessment questions about max profit,
max loss, and breakeven. Format as JSON content_json.
```

---

## Part 3: Activity Type 3 — Greeks Dashboard Simulator

### 3.1 Purpose & Learning Outcomes

Interactive **sliders and controls** let students adjust:
- Underlying price (spot)
- Days to expiration
- Implied volatility
- Strike selection

And watch **Greeks update in real-time:**
- Delta (directional exposure)
- Gamma (delta acceleration)
- Theta (time decay)
- Vega (volatility sensitivity)

**Competencies Addressed:**
- `market_context` (understanding Greeks and volatility)
- `trade_management` (hedging via Greeks)

### 3.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'greeks_dashboard_simulator'
```

#### Content JSON Structure
```json
{
  "title": "Greeks Dashboard: Watch Delta, Gamma, Theta, Vega",
  "lessonTitle": "Trade Management: Greeks in Motion",
  "lessonObjective": "Understand how Greeks change with price, time, and volatility",
  "instruction": "Use the sliders below to adjust market conditions and watch the Greeks update in real-time.",
  "scenario": {
    "symbol": "SPX",
    "position": {
      "type": "long_call",
      "strikePrice": 5850,
      "expirationDate": "2026-03-21",
      "premium": 50.00
    }
  },
  "initialState": {
    "spotPrice": 5850,
    "daysToExpiry": 26,
    "impliedVolatility": 0.142
  },
  "controls": [
    {
      "id": "spot_price",
      "label": "Spot Price",
      "min": 5600,
      "max": 6100,
      "step": 10,
      "unit": "points"
    },
    {
      "id": "days_to_expiry",
      "label": "Days to Expiry",
      "min": 1,
      "max": 60,
      "step": 1,
      "unit": "days"
    },
    {
      "id": "implied_volatility",
      "label": "Implied Volatility",
      "min": 0.05,
      "max": 0.50,
      "step": 0.01,
      "unit": "%"
    }
  ],
  "displayMetrics": [
    {
      "label": "Delta (Δ)",
      "key": "delta",
      "description": "Price sensitivity: 0 to 1 for calls, -1 to 0 for puts"
    },
    {
      "label": "Gamma (Γ)",
      "key": "gamma",
      "description": "Rate of change of delta"
    },
    {
      "label": "Theta (Θ)",
      "key": "theta",
      "description": "Daily time decay (negative = losing value)"
    },
    {
      "label": "Vega (ν)",
      "key": "vega",
      "description": "Sensitivity to 1% change in IV"
    }
  ],
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "When you increased the spot price to 5950, delta increased. Why?",
      "type": "single_select",
      "options": [
        { "id": "opt1", "label": "Call value increased, so delta increases" },
        { "id": "opt2", "label": "Call becomes more ITM, so probability of profit increases" },
        { "id": "opt3", "label": "Gamma compressed near expiry" }
      ],
      "answerKey": { "correctOptionId": "opt2" }
    }
  ]
}
```

### 3.3 React Component Design

#### Props
```typescript
interface GreeksDashboardSimulatorProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    scenario: {
      symbol: string
      position: {
        type: string
        strikePrice: number
        expirationDate: string
        premium: number
      }
    }
    initialState: {
      spotPrice: number
      daysToExpiry: number
      impliedVolatility: number
    }
    controls: Array<{
      id: string
      label: string
      min: number
      max: number
      step: number
      unit: string
    }>
    displayMetrics: Array<{
      label: string
      key: string
      description: string
    }>
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [simulationState, setSimulationState] = useState({
  spotPrice: contentJson.initialState.spotPrice,
  daysToExpiry: contentJson.initialState.daysToExpiry,
  impliedVolatility: contentJson.initialState.impliedVolatility,
})

const [greeks, setGreeks] = useState({
  delta: 0,
  gamma: 0,
  theta: 0,
  vega: 0,
})

const [historicalData, setHistoricalData] = useState<
  Array<{ timestamp: number; spotPrice: number; greeks: unknown }>
>([])
```

#### Key Interactions
1. **Slider Controls:** Adjust spot, DTE, IV with smooth slider transitions.
2. **Real-Time Calculation:** Recompute Greeks (using Black-Scholes or approximation) on every change.
3. **Greeks Display:** Show values numerically and as gauge charts (0–1 for delta/gamma, negative for theta).
4. **Historical Trace:** Optional: plot a line chart of Greeks over time as user adjusts.
5. **Annotations:** Add tooltips explaining why each Greek changed.
6. **Assessment:** Questions about Greeks behavior patterns (e.g., "What happens to theta as you approach expiry?").

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap slider to focus, swipe to adjust.
  - Two-finger pinch on Greeks display to zoom in.
- **Responsive Layout:**
  - Mobile: Stacked sliders (full width), Greeks in 2-column grid below.
  - Tablet: 50/50 (sliders left, Greeks/chart right).
  - Desktop: Left sidebar with sliders, main area with Greeks gauges and historical chart.

### 3.4 Greeks Calculation Algorithm

**Using Black-Scholes Option Pricing Model (or simplified approximation):**

```typescript
function calculateBlackScholesGreeks(
  spotPrice: number,
  strikePrice: number,
  timeToExpiryYears: number,
  impliedVolatility: number,
  riskFreeRate = 0.045,
  optionType: 'call' | 'put' = 'call'
): {
  delta: number
  gamma: number
  theta: number
  vega: number
} {
  const d1 =
    (Math.log(spotPrice / strikePrice) +
      (riskFreeRate + 0.5 * impliedVolatility ** 2) * timeToExpiryYears) /
    (impliedVolatility * Math.sqrt(timeToExpiryYears))

  const d2 = d1 - impliedVolatility * Math.sqrt(timeToExpiryYears)

  const normalPdf = (x: number) => Math.exp(-(x ** 2) / 2) / Math.sqrt(2 * Math.PI)
  const normalCdf = (x: number) => 0.5 * (1 + erf(x / Math.sqrt(2)))

  let delta: number
  if (optionType === 'call') {
    delta = normalCdf(d1)
  } else {
    delta = normalCdf(d1) - 1
  }

  const gamma =
    normalPdf(d1) /
    (spotPrice * impliedVolatility * Math.sqrt(timeToExpiryYears))

  const theta =
    optionType === 'call'
      ? -(spotPrice * normalPdf(d1) * impliedVolatility) /
          (2 * Math.sqrt(timeToExpiryYears)) -
        riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiryYears) * normalCdf(d2)
      : -(spotPrice * normalPdf(d1) * impliedVolatility) /
          (2 * Math.sqrt(timeToExpiryYears)) +
        riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiryYears) * normalCdf(-d2)

  const vega = spotPrice * normalPdf(d1) * Math.sqrt(timeToExpiryYears)

  return {
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(6)),
    theta: Number(theta.toFixed(4)),
    vega: Number(vega.toFixed(4)),
  }
}
```

### 3.5 Scoring & Grading Algorithm

**Scoring Strategy: Assessment-Based Only (Simulator = Exploration)**

```
// This is an exploration tool; grading is via assessment questions only
assessmentScore = average(assessmentItemScores)

competencyScore[market_context] += assessmentScore * 1.0
```

### 3.6 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `market_context` | 100% | Greeks behavior, IV interpretation |

### 3.7 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through sliders, press arrow keys to adjust.
  - Announce Greeks changes as user adjusts: "Delta now 0.65"

- **Screen Reader Support:**
  - Label each slider: "Spot Price slider, current 5850, range 5600 to 6100"
  - Announce Greeks: "Delta: 0.65 (65% probability ITM), Gamma: 0.0018 (delta will increase by 0.0018 per point move)"
  - Live region for updates: `aria-live="polite" aria-label="Greeks Display"`

- **ARIA:**
  ```html
  <input
    type="range"
    aria-label="Adjust spot price"
    aria-valuemin="5600"
    aria-valuemax="6100"
    aria-valuenow="5850"
    aria-valuetext="5850 points"
  />
  ```

### 3.8 AI Generation Potential

**High:** LLM can create scenarios given:
- Option type (call/put)
- Strike price and expiration
- Market condition (IV high/low, near expiry vs. far dated)

**Example Prompt:**
```
Create a Greeks Dashboard Simulator activity for a long call position
on SPX 5850 strike, 3/21 expiration. Initial state: spot 5850, IV 14.2%.
Include assessment questions about gamma behavior near expiry and theta decay acceleration.
```

---

## Part 4: Activity Type 4 — Trade Scenario Decision Tree

### 4.1 Purpose & Learning Outcomes

Students navigate a **branching decision tree** of realistic trade scenarios:
- Each node presents a market condition or decision point.
- Student chooses an action (enter, adjust, close, hold).
- Tree branches show consequences (win, loss, missed opportunity, catastrophic loss).
- Each path teaches a lesson about risk management and discipline.

**Competencies Addressed:**
- `trade_management` (decisions under uncertainty)
- `exit_discipline` (when to close trades)
- `review_reflection` (analyzing consequences)

### 4.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'scenario_decision_tree'
```

#### Content JSON Structure
```json
{
  "title": "The S&P 500 Butterfly: 4 Possible Futures",
  "lessonTitle": "Trade Management & Decision Discipline",
  "lessonObjective": "Navigate trade decisions and understand consequences",
  "instruction": "You have entered a short 5850 butterfly spread on SPX. Follow the scenario branches and make decisions.",
  "tree": {
    "rootNode": "scenario_day1",
    "nodes": {
      "scenario_day1": {
        "id": "scenario_day1",
        "title": "Day 1: Trade Entered",
        "description": "You've just sold a 5800/5850/5900 butterfly spread for $48 net credit. SPX is at 5850 (ATM your short strike).",
        "marketContext": {
          "spotPrice": 5850,
          "daysSinceEntry": 0,
          "impliedVolatility": 0.142,
          "daysToExpiry": 26
        },
        "decisions": [
          {
            "id": "hold_tight",
            "action": "HOLD (no hedge)",
            "consequence": "scenario_day5_move_5900"
          },
          {
            "id": "buy_otm_put",
            "action": "BUY protection: Buy 5800 put",
            "consequence": "scenario_day5_protected"
          },
          {
            "id": "take_profit",
            "action": "CLOSE for 50% profit ($24 debit)",
            "consequence": "scenario_endgame_profit"
          }
        ]
      },
      "scenario_day5_move_5900": {
        "id": "scenario_day5_move_5900",
        "title": "Day 5: SPX Rallies Hard to 5900",
        "description": "SPX has rallied 50 points to 5900. Your butterfly is now at risk: you're at the upper strike.",
        "marketContext": {
          "spotPrice": 5900,
          "daysSinceEntry": 5,
          "impliedVolatility": 0.120,
          "daysToExpiry": 21
        },
        "decisions": [
          {
            "id": "panic_close",
            "action": "PANIC CLOSE for max loss ($52 debit = $4 loss)",
            "consequence": "scenario_endgame_loss"
          },
          {
            "id": "roll_up",
            "action": "ROLL UP to 5850/5900/5950 butterfly",
            "consequence": "scenario_day15_roll_success"
          },
          {
            "id": "hold_pray",
            "action": "HOLD and pray for reversal",
            "consequence": "scenario_endgame_wipeout"
          }
        ]
      },
      "scenario_day5_protected": {
        "id": "scenario_day5_protected",
        "title": "Day 5: Protected Butterfly (Spot 5900)",
        "description": "SPX at 5900. You bought a 5800 put hedge yesterday for $5.50. Your position is protected, but cost you profit.",
        "marketContext": {
          "spotPrice": 5900,
          "daysSinceEntry": 5,
          "impliedVolatility": 0.120,
          "daysToExpiry": 21
        },
        "decisions": [
          {
            "id": "close_protected",
            "action": "CLOSE both legs, take $19 net profit",
            "consequence": "scenario_endgame_profit"
          },
          {
            "id": "hold_hedge",
            "action": "HOLD hedge, let butterfly decay",
            "consequence": "scenario_day15_hedge_success"
          }
        ]
      },
      "scenario_day15_roll_success": {
        "id": "scenario_day15_roll_success",
        "title": "Day 15: Roll Paid Off (Spot 5880)",
        "description": "Your roll to 5850/5900/5950 worked. SPX dropped to 5880 and your new butterfly is sweet. Theta is working.",
        "marketContext": { "spotPrice": 5880, "daysSinceEntry": 15, "daysToExpiry": 11 },
        "decisions": [
          {
            "id": "take_roll_profit",
            "action": "CLOSE roll for 75% max profit",
            "consequence": "scenario_endgame_profit"
          },
          {
            "id": "hold_to_expiry",
            "action": "HOLD to expiry and collect full max profit",
            "consequence": "scenario_endgame_homerun"
          }
        ]
      },
      "scenario_day15_hedge_success": {
        "id": "scenario_day15_hedge_success",
        "title": "Day 15: Hedge Paid Off (Spot 5820)",
        "description": "SPX dropped to 5820. Your butterfly is back near ATM. The 5800 put hedge expires worthless tomorrow but you kept the butterfly alive.",
        "marketContext": { "spotPrice": 5820, "daysSinceEntry": 15, "daysToExpiry": 11 },
        "decisions": [
          {
            "id": "close_for_near_max",
            "action": "CLOSE for near-max profit ($42 collect)",
            "consequence": "scenario_endgame_profit"
          }
        ]
      },
      "scenario_endgame_profit": {
        "id": "scenario_endgame_profit",
        "title": "Exit: Profit Locked In",
        "description": "You closed the position and locked in a profit. Decision discipline paid off. Your loss avoidance and proactive management kept you out of a wipeout.",
        "marketContext": {},
        "outcome": {
          "result": "WIN",
          "pnl": "+$24 to +$42 (50–88% of max)",
          "lesson": "Proactive management, risk hedging, or early profit-taking prevented total loss."
        },
        "decisions": []
      },
      "scenario_endgame_loss": {
        "id": "scenario_endgame_loss",
        "title": "Exit: Loss Realized",
        "description": "You panic-closed at max loss. Emotional decision-making cost you the entire potential profit.",
        "outcome": {
          "result": "LOSS",
          "pnl": "-$4 to -$52 (max loss)",
          "lesson": "Panic selling without a plan locks in losses. Discipline > emotion."
        },
        "decisions": []
      },
      "scenario_endgame_wipeout": {
        "id": "scenario_endgame_wipeout",
        "title": "Expiry: Catastrophic Wipeout",
        "description": "SPX stayed above 5900 through expiry. Your unhedged butterfly expired worthless.",
        "outcome": {
          "result": "WIPEOUT",
          "pnl": "-$52 (max loss, 100%)",
          "lesson": "No hedging + no rolling + holding unprotected = total loss. Plan for tail risk."
        },
        "decisions": []
      },
      "scenario_endgame_homerun": {
        "id": "scenario_endgame_homerun",
        "title": "Expiry: Home Run",
        "description": "SPX expired at 5870, perfectly centered in your butterfly. You collected the full max profit.",
        "outcome": {
          "result": "HOME RUN",
          "pnl": "+$48 (max profit, 100%)",
          "lesson": "Perfect execution, ideal market conditions, and the discipline to hold through expiry."
        },
        "decisions": []
      }
    }
  },
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "In the scenario, which decision branch had the best risk-adjusted outcome?",
      "type": "single_select",
      "options": [
        { "id": "hold_tight", "label": "Hold tight, no hedge" },
        { "id": "buy_protection", "label": "Buy OTM put hedge" },
        { "id": "take_early", "label": "Take 50% profit early" }
      ],
      "answerKey": { "correctOptionId": "buy_protection" },
      "rationale": "Buying protection prevented max loss while keeping upside, exemplifying prudent risk management."
    }
  ]
}
```

### 4.3 React Component Design

#### Props
```typescript
interface ScenarioDecisionTreeProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    tree: {
      rootNode: string
      nodes: Record<
        string,
        {
          id: string
          title: string
          description: string
          marketContext?: Record<string, unknown>
          outcome?: {
            result: string
            pnl: string
            lesson: string
          }
          decisions: Array<{
            id: string
            action: string
            consequence: string
          }>
        }
      >
    }
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [currentNodeId, setCurrentNodeId] = useState(contentJson.tree.rootNode)
const [visitedNodes, setVisitedNodes] = useState(new Set([contentJson.tree.rootNode]))
const [selectedPath, setSelectedPath] = useState<string[]>([contentJson.tree.rootNode])
const [endgameReached, setEndgameReached] = useState(false)
const [answers, setAnswers] = useState<Record<string, string>>({})
```

#### Key Interactions
1. **Display Current Node:** Title, description, market context, decision buttons.
2. **Decision Selection:** Click/tap action button to navigate to consequence node.
3. **Breadcrumb Trail:** Show path taken so far (e.g., "Hold Tight → SPX +50 → Panic Close").
4. **Outcome Display:** When endgame reached, show result (WIN/LOSS/WIPEOUT), P&L, and lesson.
5. **Replay Option:** "Start Over" to explore alternate paths.
6. **Assessment Questions:** After exploring, answer scenario-based questions.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap decision button to navigate.
  - Swipe right to go back (undo last decision).
  - Long-press to see market context details.
- **Responsive Layout:**
  - Mobile: Full-width content, decision buttons stacked vertically.
  - Tablet: Sidebar with breadcrumb, main content area.
  - Desktop: Split view (left: tree visualization, right: current node + decisions).

### 4.4 Scoring & Grading Algorithm

**Scoring Strategy: Outcome-Based + Assessment**

```
// Outcome score based on path quality
IF endgame outcome is HOME_RUN:
  outcomeScore = 1.0
ELSE IF outcome is WIN or PROFIT:
  outcomeScore = 0.8
ELSE IF outcome is LOSS or acceptable loss:
  outcomeScore = 0.5
ELSE IF outcome is WIPEOUT:
  outcomeScore = 0.1

// Assessment score
assessmentScore = average(assessmentItemScores)

// Combined
overallScore = (outcomeScore * 0.4) + (assessmentScore * 0.6)

competencyScore[trade_management] += overallScore * 0.5
competencyScore[exit_discipline] += overallScore * 0.3
competencyScore[review_reflection] += overallScore * 0.2
```

### 4.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `trade_management` | 50% | Decision quality, discipline |
| `exit_discipline` | 30% | Exit logic, stop/profit management |
| `review_reflection` | 20% | Outcome analysis and lesson integration |

### 4.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through decision buttons.
  - Enter/Space to select.
  - Arrow keys to review breadcrumb.

- **Screen Reader Support:**
  - Announce current node: "Day 5: SPX Rallies Hard to 5900. You are at the upper strike of your butterfly."
  - List decisions: "Three options available: Panic close, Roll up, Hold and pray."
  - Outcome: "Home run: Collected full max profit of $48."

- **ARIA:**
  ```html
  <div role="region" aria-label="Current Scenario Node">
    <h2>Day 5: SPX Rallies Hard to 5900</h2>
    <p aria-label="Current situation">SPX moved 50 points to 5900...</p>
  </div>
  <fieldset aria-label="Decision Options">
    <legend>Your Options</legend>
    <label>
      <input type="radio" name="decision" value="panic_close" />
      Panic close
    </label>
  </fieldset>
  ```

### 4.7 AI Generation Potential

**Medium-High:** LLM can generate scenario trees given:
- Trade setup (spread type, strikes, expiration)
- Market scenarios (rally, drop, sideways, IV crush)
- Decision consequences (outcomes, P&L ranges)

**Example Prompt:**
```
Generate a decision tree scenario for a short iron condor on QQQ.
The setup is: short 400 call spread and short 380 put spread,
30 DTE. Include 5 decision nodes with realistic market moves
and consequences. Final outcomes should teach about rolling, hedging, and early exit discipline.
```

---

## Part 5: Activity Type 5 — Position Builder Challenge

### 5.1 Purpose & Learning Outcomes

**Objective-based challenge:** Student is given a market thesis and must design the optimal position:
- Choose strategy (spread type, combo, etc.)
- Select strikes and expiration
- Justify risk/reward
- Answer validation questions

**Competencies Addressed:**
- `entry_validation` (thesis → position mapping)
- `position_sizing` (strategic structure)
- `market_context` (condition → strategy matching)

### 5.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'position_builder_challenge'
```

#### Content JSON Structure
```json
{
  "title": "Challenge: Build the Optimal Bull Call Spread",
  "lessonTitle": "Entry Validation: Thesis to Position",
  "lessonObjective": "Map a market thesis to an appropriate options position",
  "instruction": "You believe SPX will test 5900 within the next 3 weeks but want to cap risk. Design a bull call spread.",
  "challenge": {
    "marketThesis": {
      "symbol": "SPX",
      "outlook": "BULLISH",
      "targetPrice": 5900,
      "timeframe": "3 weeks",
      "confidence": "MEDIUM",
      "keyRisks": ["Rate hike surprise", "Earnings disappointment"]
    },
    "currentMarket": {
      "spotPrice": 5850,
      "impliedVolatility": 0.142,
      "daysToExpiry": 21,
      "skew": "normal"
    },
    "constraintFields": [
      {
        "id": "long_strike",
        "label": "Long Call Strike",
        "type": "select",
        "description": "Which call would you buy to express bullish view?",
        "hint": "Consider your target price and risk tolerance.",
        "options": [
          { "value": "5800", "label": "5800 (ITM, Delta 0.75)" },
          { "value": "5850", "label": "5850 (ATM, Delta 0.52)" },
          { "value": "5900", "label": "5900 (OTM, Delta 0.30)" }
        ]
      },
      {
        "id": "short_strike",
        "label": "Short Call Strike",
        "type": "select",
        "description": "Which call would you sell to cap risk?",
        "hint": "Your short strike should be above your target.",
        "options": [
          { "value": "5900", "label": "5900" },
          { "value": "5950", "label": "5950" },
          { "value": "6000", "label": "6000" }
        ]
      },
      {
        "id": "expiration",
        "label": "Expiration Choice",
        "type": "select",
        "description": "Match your timeframe to a strike.",
        "options": [
          { "value": "3/21", "label": "3/21 (26 DTE)" },
          { "value": "4/18", "label": "4/18 (54 DTE)" }
        ]
      }
    ],
    "rubric": {
      "long_strike": {
        "correct": "5850",
        "reasoning": "ATM long call balances capital efficiency with upside exposure."
      },
      "short_strike": {
        "correct": "5900",
        "reasoning": "Selling 5900 call caps risk above your target; if SPX hits 5900, you're still profitable."
      },
      "expiration": {
        "correct": "3/21",
        "reasoning": "3-week expiration matches your timeframe; avoids theta decay of longer-dated position."
      }
    }
  },
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "Why did you select the 5850 long strike rather than 5800?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["capital efficiency", "balanced", "risk/reward", "premium"]
      }
    },
    {
      "id": "q2",
      "prompt": "What is the max profit and max loss of your position?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["max profit 50", "max loss 50"]
      }
    }
  ]
}
```

### 5.3 React Component Design

#### Props
```typescript
interface PositionBuilderChallengeProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    challenge: {
      marketThesis: {
        symbol: string
        outlook: string
        targetPrice: number
        timeframe: string
        confidence: string
        keyRisks: string[]
      }
      currentMarket: {
        spotPrice: number
        impliedVolatility: number
        daysToExpiry: number
        skew: string
      }
      constraintFields: Array<{
        id: string
        label: string
        type: string
        description: string
        hint: string
        options: Array<{ value: string; label: string }>
      }>
      rubric: Record<string, { correct: string; reasoning: string }>
    }
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [selections, setSelections] = useState<Record<string, string>>({})
const [feedback, setFeedback] = useState<Record<string, { correct: boolean; reasoning: string }>>({})
const [submitted, setSubmitted] = useState(false)
const [answers, setAnswers] = useState<Record<string, string>>({})
```

#### Key Interactions
1. **Display Market Thesis:** Show outlook, target, timeframe, key risks.
2. **Build Position:** Dropdown/select fields for strikes, expiration, etc.
3. **Real-Time Validation:** Show max profit/loss as selections update.
4. **Submit & Grade:** Compare selections to rubric. Show correct/incorrect for each.
5. **Feedback & Learning:** Explain why each selection was optimal or suboptimal.
6. **Assessment:** Follow-up questions about the position.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap select field to open dropdown.
  - Swipe to cycle through options.
- **Responsive Layout:**
  - Mobile: Stacked form fields, full-width dropdowns.
  - Tablet: 2-column layout.
  - Desktop: 3-column with real-time position summary.

### 5.4 Scoring & Grading Algorithm

```
// Field-by-field grading
fieldScores = []
FOR EACH constraintField:
  IF selection == rubric[field].correct:
    fieldScore = 1.0
  ELSE:
    fieldScore = 0.0  // Could allow partial credit for "close" strikes
  fieldScores.push(fieldScore)

overallScore = average(fieldScores)

// Add assessment question score
assessmentScore = average(assessmentItemScores)

combinedScore = (overallScore * 0.5) + (assessmentScore * 0.5)

competencyScore[entry_validation] += combinedScore * 0.6
competencyScore[position_sizing] += combinedScore * 0.2
competencyScore[market_context] += combinedScore * 0.2
```

### 5.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `entry_validation` | 60% | Strike/expiration selection |
| `position_sizing` | 20% | Risk/reward structure |
| `market_context` | 20% | Thesis → position mapping |

### 5.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through form fields.
  - Arrow keys to navigate dropdown options.
  - Enter to select.

- **Screen Reader Support:**
  - Label each field: "Long Call Strike: Which call would you buy to express bullish view?"
  - Announce feedback: "Correct! ATM long call balances capital efficiency with upside exposure."

### 5.7 AI Generation Potential

**Very High:** LLM excels at generating challenge scenarios given:
- Market condition (bullish, bearish, neutral, uncertain)
- Strategy type (spread, straddle, etc.)
- Risk parameters

**Example Prompt:**
```
Generate a position builder challenge for a bearish put spread on QQQ.
Current spot: 480, target: 450, timeframe: 4 weeks. Create 3 constraint
fields (short put strike, long put strike, expiration) with 3 options each.
Include a rubric explaining the correct answer and 2 assessment questions.
```

---

## Part 6: Activity Type 6 — Market Context Tagger

### 6.1 Purpose & Learning Outcomes

Student views an **SPX candlestick chart** and must identify:
- Session mode (trend, range, chop)
- Key support/resistance levels
- Volume signature (trending, accumulation, distribution)
- IV environment (low, medium, high)

**Competencies Addressed:**
- `market_context` (price action reading)
- `entry_validation` (context-aware entry timing)

### 6.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'market_context_tagger'
```

#### Content JSON Structure
```json
{
  "title": "Market Context Tagger: Read Price Action",
  "lessonTitle": "Session Setup & Context Assessment",
  "lessonObjective": "Quickly identify market mode, levels, and volume signature",
  "instruction": "Study the SPX chart below (1-hour bars, last 5 days). Tag the session with mode, key levels, and volume.",
  "chart": {
    "symbol": "SPX",
    "timeframe": "1H",
    "period": "5 days",
    "chartImageUrl": "/charts/spx-5day-1h.png",
    "chartData": {
      "bars": [
        {
          "timestamp": "2026-02-23T09:30:00Z",
          "open": 5840,
          "high": 5860,
          "low": 5835,
          "close": 5850,
          "volume": 2840000
        }
      ],
      "levels": [
        {
          "type": "support",
          "price": 5820,
          "reason": "Prior session low, tested twice"
        },
        {
          "type": "resistance",
          "price": 5880,
          "reason": "Prior week high"
        }
      ]
    }
  },
  "taggingQuestions": [
    {
      "id": "session_mode",
      "label": "Session Mode",
      "type": "single_select",
      "description": "What is the primary mode of this chart?",
      "options": [
        { "value": "trending", "label": "Trending (strong one direction)" },
        { "value": "range", "label": "Range-bound (oscillating between levels)" },
        { "value": "chop", "label": "Chop (choppy, unclear bias)" }
      ],
      "hint": "Look at how many times price tested resistance vs. bounced from support.",
      "correctAnswer": "range",
      "rationale": "Price oscillated between 5820 support and 5880 resistance without strong directional bias."
    },
    {
      "id": "key_support",
      "label": "Primary Support",
      "type": "single_select",
      "description": "Which is the most important support level?",
      "options": [
        { "value": "5820", "label": "5820" },
        { "value": "5835", "label": "5835" },
        { "value": "5800", "label": "5800" }
      ],
      "correctAnswer": "5820",
      "rationale": "5820 was the lowest point tested and held twice; multiple tests = strength."
    },
    {
      "id": "volume_signature",
      "label": "Volume Signature",
      "type": "single_select",
      "description": "What does the volume pattern suggest?",
      "options": [
        { "value": "accumulation", "label": "Accumulation (smart money buying)" },
        { "value": "distribution", "label": "Distribution (smart money selling)" },
        { "value": "neutral", "label": "Neutral (balanced)" }
      ],
      "correctAnswer": "neutral",
      "rationale": "Volume is relatively flat; no concentration of volume at key reversals."
    }
  ]
}
```

### 6.3 React Component Design

#### Props
```typescript
interface MarketContextTaggerProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    chart: {
      symbol: string
      timeframe: string
      period: string
      chartImageUrl: string
      chartData: {
        bars: Array<{
          timestamp: string
          open: number
          high: number
          low: number
          close: number
          volume: number
        }>
        levels: Array<{
          type: string
          price: number
          reason: string
        }>
      }
    }
    taggingQuestions: Array<{
      id: string
      label: string
      type: string
      description: string
      options: Array<{ value: string; label: string }>
      hint: string
      correctAnswer: string
      rationale: string
    }>
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [chartLoaded, setChartLoaded] = useState(false)
const [tagSelections, setTagSelections] = useState<Record<string, string>>({})
const [feedback, setFeedback] = useState<Record<string, boolean>>({})
const [showRationales, setShowRationales] = useState(false)
```

#### Key Interactions
1. **Display Chart:** Show candlestick chart with volume bars below.
2. **Highlight Levels:** Mark support/resistance with horizontal lines and labels.
3. **Tagging Questions:** Multiple-choice questions about mode, levels, volume.
4. **Interactive Annotation:** Optionally allow student to draw levels on chart.
5. **Submit & Feedback:** Grade and show correct answers + rationales.

#### Mobile Compatibility
- **Touch Gestures:**
  - Pinch to zoom into chart.
  - Tap to select answer.
  - Swipe to scroll chart timeline.
- **Responsive Layout:**
  - Mobile: Full-width chart (may need to scroll horizontally).
  - Tablet: Chart on top, questions below.
  - Desktop: Side-by-side (chart left, questions right).

### 6.4 Scoring & Grading Algorithm

```
FOR EACH taggingQuestion:
  IF selection == correctAnswer:
    questionScore = 1.0
  ELSE:
    questionScore = 0.0

overallScore = average(questionScores)

competencyScore[market_context] += overallScore * 1.0
```

### 6.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `market_context` | 100% | Chart reading, level identification |

### 6.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through question options.
  - Arrow keys to navigate.
  - Enter to select.

- **Screen Reader Support:**
  - Describe chart: "SPX 1-hour chart, 5 days. Support at 5820, Resistance at 5880."
  - Announce questions and options.

### 6.7 AI Generation Potential

**Medium:** LLM can generate tagging scenarios given:
- Real historical chart data or synthetic candlestick data
- Market mode (trend, range, chop)
- Labeled support/resistance levels

**Example Prompt:**
```
Create a market context tagger activity using SPX data from
2026-02-17 to 2026-02-24, 1-hour timeframe. Generate 3 tagging
questions about session mode, key support, and volume signature.
```

---

## Part 7: Activity Type 7 — Order Entry Simulator

### 7.1 Purpose & Learning Outcomes

Students complete a **realistic order ticket** with all required fields:
- Symbol, side (buy/sell), quantity
- Option: call/put
- Strike, expiration
- Order type (market, limit, stop)
- GTC, IOC, or day-order
- Validate all fields match position thesis

**Competencies Addressed:**
- `entry_validation` (correct order construction)
- `position_sizing` (contract quantity)

### 7.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'order_entry_simulator'
```

#### Content JSON Structure
```json
{
  "title": "Order Entry: Sell a 5900 Call Spread",
  "lessonTitle": "Entry Validation: Order Construction",
  "lessonObjective": "Correctly fill and submit an options order",
  "instruction": "You want to sell a 5800/5900 call spread on SPX, 3/21 expiration. Complete the order ticket.",
  "orderTicket": {
    "orderType": "spread",
    "template": {
      "leg1": {
        "id": "leg1_symbol",
        "label": "Symbol",
        "type": "text",
        "placeholder": "SPX",
        "required": true,
        "correctValue": "SPX"
      },
      "leg1_side": {
        "id": "leg1_side",
        "label": "Side",
        "type": "select",
        "options": [
          { "value": "buy", "label": "Buy" },
          { "value": "sell", "label": "Sell" }
        ],
        "correctValue": "sell",
        "hint": "Are you opening or closing this position? Selling = opening short."
      },
      "leg1_option_type": {
        "id": "leg1_option_type",
        "label": "Option Type",
        "type": "select",
        "options": [
          { "value": "call", "label": "Call" },
          { "value": "put", "label": "Put" }
        ],
        "correctValue": "call"
      },
      "leg1_strike": {
        "id": "leg1_strike",
        "label": "Strike",
        "type": "number",
        "correctValue": 5800,
        "hint": "Short the 5800 call"
      },
      "leg1_expiration": {
        "id": "leg1_expiration",
        "label": "Expiration",
        "type": "date",
        "correctValue": "2026-03-21"
      },
      "leg1_quantity": {
        "id": "leg1_quantity",
        "label": "Quantity (Contracts)",
        "type": "number",
        "correctValue": 1,
        "min": 1,
        "max": 100,
        "hint": "Start with 1 contract"
      },
      "leg2_side": {
        "id": "leg2_side",
        "label": "Leg 2 Side",
        "type": "select",
        "options": [
          { "value": "buy", "label": "Buy" },
          { "value": "sell", "label": "Sell" }
        ],
        "correctValue": "buy",
        "hint": "Buy to close the spread"
      },
      "leg2_strike": {
        "id": "leg2_strike",
        "label": "Leg 2 Strike",
        "type": "number",
        "correctValue": 5900
      },
      "order_type": {
        "id": "order_type",
        "label": "Order Type",
        "type": "select",
        "options": [
          { "value": "market", "label": "Market" },
          { "value": "limit", "label": "Limit" }
        ],
        "correctValue": "market",
        "hint": "For learning, assume market fills instantly."
      },
      "time_in_force": {
        "id": "time_in_force",
        "label": "Time in Force",
        "type": "select",
        "options": [
          { "value": "day", "label": "Day" },
          { "value": "gtc", "label": "GTC" },
          { "value": "ioc", "label": "IOC" }
        ],
        "correctValue": "day"
      }
    }
  },
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "Why did you choose a market order instead of limit?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["guaranteed fill", "liquid", "spread"]
      }
    }
  ]
}
```

### 7.3 React Component Design

#### Props
```typescript
interface OrderEntrySimulatorProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    orderTicket: {
      orderType: string
      template: Record<string, unknown>
    }
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [orderData, setOrderData] = useState<Record<string, unknown>>({})
const [validation, setValidation] = useState<Record<string, boolean>>({})
const [submitted, setSubmitted] = useState(false)
const [feedback, setFeedback] = useState<Record<string, unknown>>({})
```

#### Key Interactions
1. **Form Rendering:** Render all order ticket fields based on template.
2. **Field Validation:** Real-time validation (symbol exists, strike is number, etc.).
3. **Submit Order:** Button to submit completed order.
4. **Grading:** Check each field against correctValue.
5. **Feedback:** Show which fields were correct/incorrect.

### 7.4 Scoring & Grading Algorithm

```
FOR EACH field:
  IF fieldValue == correctValue:
    fieldScore = 1.0
  ELSE:
    fieldScore = 0.0

overallScore = (numCorrectFields / totalFields)

competencyScore[entry_validation] += overallScore * 1.0
```

### 7.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `entry_validation` | 100% | Order field correctness |

### 7.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through form fields.
  - Enter to submit.

- **Screen Reader Support:**
  - Label each field with hint text.
  - Announce validation errors immediately.

### 7.7 AI Generation Potential

**Very High:** LLM can generate order scenarios for any position type.

---

## Part 8: Activity Type 8 — Flashcard Decks

### 8.1 Purpose & Learning Outcomes

**Spaced repetition flashcards** for key trading terminology and concepts:
- Front: term or question (e.g., "Delta")
- Back: definition or answer (e.g., "Rate of change of option price with respect to underlying")
- Integration with review queue for long-term retention

**Competencies Addressed:**
- `market_context` (terminology mastery)
- `review_reflection` (self-assessment)

### 8.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'flashcard_deck'
```

#### New Table (For Spaced Repetition Tracking)
```sql
CREATE TABLE academy_flashcard_decks (
  id uuid PRIMARY KEY,
  lesson_id uuid REFERENCES academy_lessons(id),
  title text NOT NULL,
  cards_json jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE academy_flashcard_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  deck_id uuid NOT NULL REFERENCES academy_flashcard_decks(id),
  card_id text NOT NULL,
  difficulty_rating integer, -- 1-5 (1=again, 5=easy)
  next_review_date timestamp,
  attempt_count integer DEFAULT 1,
  created_at timestamp DEFAULT now()
);
```

#### Content JSON Structure
```json
{
  "title": "Greeks Terminology Flashcards",
  "lessonTitle": "Market Context Vocabulary",
  "lessonObjective": "Master options Greek definitions and interpretations",
  "instruction": "Study these flashcards. Click to flip. Rate your confidence (1=need more study, 5=mastered).",
  "cards": [
    {
      "id": "delta_1",
      "frontText": "Delta (Δ)",
      "backText": "The rate of change of an option's price with respect to a $1 move in the underlying. For calls, Delta ranges 0–1; for puts, -1–0. Delta ≈ probability of finishing in-the-money.",
      "keyword": "delta"
    },
    {
      "id": "gamma_1",
      "frontText": "Gamma (Γ)",
      "backText": "The rate of change of Delta with respect to a $1 move in the underlying. High gamma = Delta changes rapidly. At-the-money options have highest gamma.",
      "keyword": "gamma"
    },
    {
      "id": "theta_1",
      "frontText": "Theta (Θ)",
      "backText": "Time decay: the daily loss in option value due to passing time, all else equal. Theta accelerates as expiration approaches. Negative for long options, positive for short.",
      "keyword": "theta"
    },
    {
      "id": "vega_1",
      "frontText": "Vega (ν)",
      "backText": "Sensitivity to a 1% change in implied volatility. Higher vega = option price moves more with IV changes. At-the-money options have highest vega.",
      "keyword": "vega"
    }
  ],
  "reviewMode": "spaced_repetition",
  "reviewSchedule": {
    "again": 1,
    "hard": 3,
    "good": 7,
    "easy": 30
  }
}
```

### 8.3 React Component Design

#### Props
```typescript
interface FlashcardDeckProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    cards: Array<{
      id: string
      frontText: string
      backText: string
      keyword: string
    }>
    reviewMode: string
    reviewSchedule: Record<string, number>
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [currentCardIndex, setCurrentCardIndex] = useState(0)
const [isFlipped, setIsFlipped] = useState(false)
const [responses, setResponses] = useState<Record<string, number>>({}) // card_id -> rating
const [deckProgress, setDeckProgress] = useState(0)
```

#### Key Interactions
1. **Card Display:** Show front of card with back hidden initially.
2. **Flip Animation:** Click/tap to flip and reveal back.
3. **Confidence Rating:** 1-5 buttons (Again, Hard, Good, Easy).
4. **Progress Tracking:** Show "Card 3 of 12" counter.
5. **Navigation:** Next/Prev buttons.
6. **Completion:** When deck finished, integrate into review queue.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap card to flip.
  - Swipe left/right to navigate.
  - Tap rating button to record response.
- **Responsive Layout:**
  - Mobile: Card fills screen, rating buttons below.
  - Tablet/Desktop: Same layout, card may be larger.

### 8.4 Spaced Repetition Algorithm

**SM-2 Simplified Algorithm:**
```typescript
function calculateNextReviewDate(
  currentDate: Date,
  difficulty: 1 | 2 | 3 | 4 | 5,
  intervalMap: Record<string, number>
): Date {
  let daysUntilReview = 0

  if (difficulty === 1) {
    // Again: review in 1 day
    daysUntilReview = intervalMap['again'] || 1
  } else if (difficulty === 2) {
    // Hard: review in 3 days
    daysUntilReview = intervalMap['hard'] || 3
  } else if (difficulty === 3) {
    // Good: review in 7 days
    daysUntilReview = intervalMap['good'] || 7
  } else if (difficulty === 4 || difficulty === 5) {
    // Easy: review in 30 days
    daysUntilReview = intervalMap['easy'] || 30
  }

  const nextDate = new Date(currentDate)
  nextDate.setDate(nextDate.getDate() + daysUntilReview)
  return nextDate
}
```

### 8.5 Scoring & Grading Algorithm

```
FOR EACH card:
  IF difficulty rating >= 3:
    cardScore = 1.0
  ELSE:
    cardScore = 0.5

deckScore = average(cardScores)

competencyScore[market_context] += deckScore * 1.0

// Insert review queue items for cards rated < 3
FOR EACH card WHERE difficulty < 3:
  INSERT into review_queue with:
    prompt = card.frontText
    answerKey = { answer: card.backText }
    dueAt = now (immediate re-review)
    intervalDays = 1
```

### 8.6 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `market_context` | 100% | Terminology mastery |

### 8.7 Accessibility Requirements

- **Keyboard Navigation:**
  - Arrow keys to navigate cards.
  - Space to flip.
  - 1-5 keys to rate difficulty.

- **Screen Reader Support:**
  - Announce front: "Card 1 of 12: Delta"
  - Announce back on flip: "Definition: Rate of change..."
  - Announce rating: "Difficulty 3 of 5: Good"

### 8.8 AI Generation Potential

**Very High:** LLM excels at generating card decks for any trading concept.

---

## Part 9: Activity Type 9 — Timed Challenge Rounds

### 9.1 Purpose & Learning Outcomes

**Speed quiz:** 10 rapid-fire questions, 60 seconds per question, with XP multiplier for fast correct answers.
- Build muscle memory on concepts
- Reward decisiveness
- Gamified engagement

**Competencies Addressed:**
- All competencies (as determined by question selection)
- `review_reflection` (fast pattern recognition)

### 9.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'timed_challenge_round'
```

#### Content JSON Structure
```json
{
  "title": "Greeks Speed Round: 10 Questions, 60 Seconds Each",
  "lessonTitle": "Market Context Speed Drill",
  "lessonObjective": "Rapidly identify Greeks and their meanings",
  "instruction": "Answer 10 questions as quickly as possible. Correct answers faster than 30 seconds earn 2x XP.",
  "roundConfig": {
    "totalQuestions": 10,
    "timePerQuestion": 60,
    "xpMultiplierThreshold": 30,
    "xpMultiplier": 2.0
  },
  "questions": [
    {
      "id": "q1",
      "prompt": "Which Greek measures time decay?",
      "type": "single_select",
      "options": [
        { "id": "delta", "label": "Delta" },
        { "id": "gamma", "label": "Gamma" },
        { "id": "theta", "label": "Theta" },
        { "id": "vega", "label": "Vega" }
      ],
      "answerKey": { "correctOptionId": "theta" },
      "competency": "market_context"
    },
    {
      "id": "q2",
      "prompt": "A call with Delta 0.75 has approximately what probability of finishing ITM?",
      "type": "single_select",
      "options": [
        { "id": "25%", "label": "25%" },
        { "id": "50%", "label": "50%" },
        { "id": "75%", "label": "75%" },
        { "id": "90%", "label": "90%" }
      ],
      "answerKey": { "correctOptionId": "75%" },
      "competency": "market_context"
    }
  ]
}
```

### 9.3 React Component Design

#### Props
```typescript
interface TimedChallengeRoundProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    roundConfig: {
      totalQuestions: number
      timePerQuestion: number
      xpMultiplierThreshold: number
      xpMultiplier: number
    }
    questions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
const [timeRemaining, setTimeRemaining] = useState(60)
const [responses, setResponses] = useState<Array<{
  questionId: string
  answer: unknown
  responseTimeSeconds: number
  correct: boolean
}>>([])
const [roundComplete, setRoundComplete] = useState(false)
const [totalXp, setTotalXp] = useState(0)
```

#### Key Interactions
1. **Timer Display:** Prominent countdown timer (changes color as time runs out).
2. **Question Display:** Show question and options.
3. **Rapid Selection:** Click/tap to answer immediately.
4. **Auto-Advance:** Move to next question after selection or timeout.
5. **Results Splash:** Show answer is correct/incorrect with response time.
6. **Final Score:** Total correct, total XP earned, XP multiplier bonuses.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap to answer (large touch targets).
  - Swipe to navigate (optional fallback).
- **Responsive Layout:**
  - Full-width question, large buttons for options.
  - Timer always visible at top.

### 9.4 Scoring & Grading Algorithm

```
totalScore = 0
totalXp = 0

FOR EACH response:
  IF correct:
    baseXp = 10
    IF responseTimeSeconds < xpMultiplierThreshold:
      earnedXp = baseXp * xpMultiplier
    ELSE:
      earnedXp = baseXp

    totalXp += earnedXp
    score += 1.0 / totalQuestions
  ELSE:
    totalXp += 0

overallScore = totalScore

competencyScore[market_context] += overallScore * 1.0 (if market_context questions)
```

### 9.5 Competency Integration

Depends on question mix, but typically:

| Competency | Weight | Assessment |
|------------|--------|------------|
| `market_context` | Variable | Speed drill content |
| `review_reflection` | 10% | Pattern recognition under pressure |

### 9.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through options, Enter to select.
  - Number keys (1-4) to select option A-D.

- **Screen Reader Support:**
  - Announce timer: "Time remaining: 45 seconds"
  - Announce question progress: "Question 3 of 10"
  - Announce result: "Correct! Response time 12 seconds, earned 20 XP"

### 9.7 AI Generation Potential

**Very High:** LLM can generate speed-drill questions for any topic and competency.

---

## Part 10: Activity Type 10 — "What Went Wrong" Analysis

### 10.1 Purpose & Learning Outcomes

Students examine a **losing trade** from a student's journal or case study and identify:
- Entry mistakes
- Sizing errors
- Management failures
- Exit discipline breaches
- Emotional biases

**Competencies Addressed:**
- `review_reflection` (mistake analysis)
- `trade_management` (ex-post analysis)
- `exit_discipline` (loss evaluation)

### 10.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'what_went_wrong_analysis'
```

#### Content JSON Structure
```json
{
  "title": "Case Study: The SPX Iron Condor Blow-Up",
  "lessonTitle": "Learning from Losses: Trade Analysis",
  "lessonObjective": "Identify root causes of trading losses and plan improvements",
  "instruction": "Review this losing trade and analyze what went wrong. Identify at least 3 mistakes.",
  "tradeReview": {
    "tradeId": "demo_loss_001",
    "tradeType": "iron_condor",
    "symbol": "SPX",
    "setupDate": "2026-02-15",
    "closedDate": "2026-02-19",
    "daysHeld": 4,
    "entryDetails": {
      "shortCallStrike": 5900,
      "longCallStrike": 5950,
      "shortPutStrike": 5800,
      "longPutStrike": 5750,
      "expirationDate": "2026-03-21",
      "initialCredit": 48,
      "initialRisk": 52
    },
    "exitDetails": {
      "exitPrice": 95,
      "lossAmount": 47,
      "lossPercent": 98,
      "closedReason": "stop_hit"
    },
    "tradeJournal": {
      "entryRationale": "IV Rank was 85. I expected IV crush and wanted to sell premium.",
      "exitRationale": "SPX gapped up on open, blew through my stop loss immediately.",
      "emotionalState": "Frustrated, panic-sold without checking Greeks or alternative management.",
      "lessonLearned": "I did not hedge. I did not plan for gap risk. I panicked."
    },
    "mistakeCategories": [
      {
        "id": "entry_timing",
        "category": "Entry Timing",
        "description": "Entered when IV was extremely high; high IV is typically a contrarian signal, not a setup.",
        "significance": "HIGH"
      },
      {
        "id": "no_hedge",
        "category": "Risk Management",
        "description": "Iron condor with no protective collar or hedge for gap moves.",
        "significance": "CRITICAL"
      },
      {
        "id": "stop_placement",
        "category": "Stop Placement",
        "description": "Stop at 95 was too tight relative to position width (52 points). Natural pullback would hit stop.",
        "significance": "HIGH"
      },
      {
        "id": "position_size",
        "category": "Position Sizing",
        "description": "1 condor with $5200 risk in a $25k account = 20% max loss. Too large.",
        "significance": "MEDIUM"
      },
      {
        "id": "panic_exit",
        "category": "Discipline",
        "description": "Exited emotionally without considering rolling or adjustment.",
        "significance": "HIGH"
      }
    ]
  },
  "analysisQuestions": [
    {
      "id": "q1",
      "prompt": "What was the primary entry mistake?",
      "type": "single_select",
      "options": [
        { "id": "opt1", "label": "High IV is a sell signal, not a setup signal" },
        { "id": "opt2", "label": "SPX was not in a range" },
        { "id": "opt3", "label": "Expiration was too long (26 days)" }
      ],
      "answerKey": { "correctOptionId": "opt1" },
      "competency": "entry_validation"
    },
    {
      "id": "q2",
      "prompt": "How should the trader have managed gap risk?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["hedge", "protective collar", "tighter stop", "smaller size"]
      },
      "competency": "trade_management"
    }
  ]
}
```

### 10.3 React Component Design

#### Props
```typescript
interface WhatWentWrongAnalysisProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    tradeReview: {
      tradeType: string
      symbol: string
      entryDetails: unknown
      exitDetails: unknown
      tradeJournal: unknown
      mistakeCategories: Array<{
        id: string
        category: string
        description: string
        significance: string
      }>
    }
    analysisQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [selectedMistakes, setSelectedMistakes] = useState<Set<string>>(new Set())
const [answers, setAnswers] = useState<Record<string, string>>({})
const [feedback, setFeedback] = useState<Record<string, unknown>>({})
```

#### Key Interactions
1. **Trade Summary:** Display entry/exit details in a timeline or card layout.
2. **Journal Excerpt:** Show trader's own reflection on the loss.
3. **Mistake Checklist:** Checkboxes for each mistake category. Student selects which mistakes they identified.
4. **Significance Badges:** Color-code by severity (CRITICAL = red, HIGH = orange, MEDIUM = yellow).
5. **Analysis Questions:** Free-form and multiple-choice questions about the loss.
6. **Feedback:** Compare student's identified mistakes to actual list; show lesson.

#### Mobile Compatibility
- **Responsive Layout:**
  - Mobile: Stacked cards (entry, exit, journal, mistakes, questions).
  - Tablet: 2-column (trade details left, analysis right).
  - Desktop: Full timeline view with sidebar analysis.

### 10.4 Scoring & Grading Algorithm

```
// Mistake identification score
correctMistakesIdentified = selectedMistakes ∩ actualMistakes
mistakeScore = |correctMistakesIdentified| / |actualMistakes|

// Analysis question score
analysisScore = average(analysisItemScores)

// Combined
overallScore = (mistakeScore * 0.5) + (analysisScore * 0.5)

competencyScore[review_reflection] += overallScore * 0.6
competencyScore[trade_management] += overallScore * 0.2
competencyScore[exit_discipline] += overallScore * 0.2
```

### 10.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `review_reflection` | 60% | Mistake analysis, pattern recognition |
| `trade_management` | 20% | Management failure identification |
| `exit_discipline` | 20% | Exit decision analysis |

### 10.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through mistakes, Space to select.
  - Tab through questions.

- **Screen Reader Support:**
  - Announce trade summary: "Iron condor short call 5900, loss 47 dollars in 4 days"
  - Announce mistakes: "Entry timing, high significance. No hedge, critical significance."

### 10.7 AI Generation Potential

**Medium:** LLM can generate losing trade case studies given:
- Trade type, entry/exit prices, P&L
- Mistake categories to highlight

---

## Part 11: Activity Type 11 — Strategy Matcher

### 11.1 Purpose & Learning Outcomes

**Drag-to-match game:** Student matches market conditions/opportunities to optimal strategies:
- Left column: market conditions (IV high, bullish, elevated skew, etc.)
- Right column: strategies (iron condor, call spread, strangle, etc.)
- Drag and drop to pair

**Competencies Addressed:**
- `market_context` (condition recognition)
- `entry_validation` (strategy selection)

### 11.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'strategy_matcher'
```

#### Content JSON Structure
```json
{
  "title": "Match Market Conditions to Strategies",
  "lessonTitle": "Market Context → Strategy Selection",
  "lessonObjective": "Map market conditions to optimal option strategies",
  "instruction": "Drag each market condition to its matching strategy. Correct matches earn points.",
  "matchingPairs": [
    {
      "id": "pair1",
      "condition": "IV Rank 80+, expect IV crush, neutral outlook",
      "strategy": "Short Straddle / Short Iron Condor",
      "explanation": "High IV allows premium selling; IV crush benefits short positions."
    },
    {
      "id": "pair2",
      "condition": "Bullish outlook, want limited risk, moderate IV",
      "strategy": "Bull Call Spread",
      "explanation": "Call spread caps risk at spread width, reduces capital requirement."
    },
    {
      "id": "pair3",
      "condition": "Very low IV, expect IV expansion, volatility crush risk low",
      "strategy": "Long Straddle / Strangle",
      "explanation": "Low IV allows buying cheap options; IV expansion or large move benefits long options."
    },
    {
      "id": "pair4",
      "condition": "Earnings event, expect large move, direction uncertain",
      "strategy": "Long Strangle (OTM call + put)",
      "explanation": "Strangles profit from large moves in either direction; cheaper than straddles."
    },
    {
      "id": "pair5",
      "condition": "Bullish call skew, expect upside, fear downside",
      "strategy": "Call Ratio Spread",
      "explanation": "Sell more OTM calls to finance ATM long call; limited downside risk."
    }
  ],
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "Why is a bull call spread preferred when IV is moderate?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["reduced risk", "defined max loss", "capital efficiency"]
      }
    }
  ]
}
```

### 11.3 React Component Design

#### Props
```typescript
interface StrategyMatcherProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    matchingPairs: Array<{
      id: string
      condition: string
      strategy: string
      explanation: string
    }>
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [matches, setMatches] = useState<Record<string, string>>({}) // condition_id -> strategy_id
const [feedback, setFeedback] = useState<Record<string, boolean>>({})
const [submitted, setSubmitted] = useState(false)
```

#### Key Interactions
1. **Left Column:** Shuffled market conditions.
2. **Right Column:** Shuffled strategies.
3. **Drag Lines:** Visual connectors show matches as student drags.
4. **Validation Feedback:** As user matches, highlight correct/incorrect immediately.
5. **Submit & Results:** Show score and explanations for each match.

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap condition, tap strategy to match (no drag required on mobile).
  - Swipe to undo match.
- **Responsive Layout:**
  - Mobile: Stacked cards (conditions top, strategies bottom).
  - Tablet/Desktop: Side-by-side columns with drag lines.

### 11.4 Scoring & Grading Algorithm

```
FOR EACH matchingPair:
  IF userMatched[pair.condition] == pair.strategy:
    pairScore = 1.0
  ELSE:
    pairScore = 0.0

overallScore = average(pairScores)

competencyScore[market_context] += overallScore * 0.6
competencyScore[entry_validation] += overallScore * 0.4
```

### 11.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `market_context` | 60% | Condition recognition |
| `entry_validation` | 40% | Strategy selection appropriateness |

### 11.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through conditions.
  - Tab through strategies.
  - Enter to select and match.

- **Screen Reader Support:**
  - Announce pair: "Condition: IV Rank 80+, Strategy: Short Straddle"
  - Announce match result: "Correct! High IV allows premium selling."

### 11.7 AI Generation Potential

**Very High:** LLM can generate condition-strategy pairs for any market regime.

---

## Part 12: Activity Type 12 — Journal Prompt Exercises

### 12.1 Purpose & Learning Outcomes

**Structured reflection prompts** linked to the Trade Journal feature:
- Students answer reflective questions about a past trade or hypothetical scenario
- Questions guide deeper analysis (process review, emotional state, lessons)
- Responses are optionally saved to journal entry as notes

**Competencies Addressed:**
- `review_reflection` (deliberate practice in self-assessment)
- All competencies (through metacognition)

### 12.2 Schema Changes

#### New Block Type Enum
```typescript
// Add to academy_block_type enum
'journal_prompt_exercise'
```

#### Content JSON Structure
```json
{
  "title": "Trade Journal Reflection: After a Loss",
  "lessonTitle": "Review & Reflection: Deliberate Learning",
  "lessonObjective": "Build discipline in trade analysis and emotional awareness",
  "instruction": "Answer the following journal prompts about a losing trade you've made (real or hypothetical). Be honest and specific.",
  "prompts": [
    {
      "id": "prompt1",
      "order": 1,
      "category": "Entry Process",
      "question": "Did you have a written thesis before entering this trade? What was it?",
      "responseType": "text_long",
      "hint": "Traders without theses trade on emotion. Specific theses prevent random entries.",
      "rubricGuidance": "Look for clear condition-strategy mapping (e.g., 'IV Rank 75, expecting range, selling short strangle')"
    },
    {
      "id": "prompt2",
      "order": 2,
      "category": "Risk Management",
      "question": "How did you calculate your stop loss? Was it based on technicals, Greeks, or emotion?",
      "responseType": "text_long",
      "rubricGuidance": "Correct answers reference support levels, risk tolerance, or pre-defined Greeks thresholds. Avoid 'I just felt it.'"
    },
    {
      "id": "prompt3",
      "order": 3,
      "category": "Emotional Awareness",
      "question": "When the trade moved against you, what emotion dominated: fear, frustration, greed, or something else? How did it affect your decisions?",
      "responseType": "text_long",
      "rubricGuidance": "Honesty and self-awareness are key. Traders who recognize patterns improve fastest."
    },
    {
      "id": "prompt4",
      "order": 4,
      "category": "Decision Discipline",
      "question": "Did you follow your original plan (exit at stop/target)? If not, why?",
      "responseType": "text_long",
      "rubricGuidance": "Evaluate adherence to pre-planned rules vs. ad-hoc changes."
    },
    {
      "id": "prompt5",
      "order": 5,
      "category": "Learning",
      "question": "What is one concrete rule or process change you will implement to avoid this mistake in the future?",
      "responseType": "text_long",
      "rubricGuidance": "Actionable, specific improvements (e.g., 'Always set stops before entering' or 'Max 3% risk per trade')."
    }
  ],
  "assessmentQuestions": [
    {
      "id": "q1",
      "prompt": "What was the primary lesson from this exercise?",
      "type": "short_answer_rubric",
      "answerKey": {
        "keywords": ["discipline", "rules", "emotional control", "process"]
      }
    }
  ]
}
```

### 12.3 React Component Design

#### Props
```typescript
interface JournalPromptExerciseProps {
  blockId: string
  contentJson: {
    title: string
    instruction: string
    prompts: Array<{
      id: string
      order: number
      category: string
      question: string
      responseType: string
      hint: string
      rubricGuidance: string
    }>
    assessmentQuestions: unknown[]
  }
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}
```

#### State Management
```typescript
const [responses, setResponses] = useState<Record<string, string>>({})
const [submitted, setSubmitted] = useState(false)
const [feedback, setFeedback] = useState<Record<string, unknown>>({})
const [saveToJournal, setSaveToJournal] = useState(false)
```

#### Key Interactions
1. **Prompt Display:** Show one prompt at a time or all at once (configurable).
2. **Text Input:** Large textarea for each response.
3. **Hint Tooltip:** "What to consider" guidance.
4. **Progress Indicator:** Show "Prompt 2 of 5" counter.
5. **Submit & Grade:** Use rubric guidance to provide feedback on each response.
6. **Export Option:** "Save responses to Trade Journal" button (if applicable).

#### Mobile Compatibility
- **Touch Gestures:**
  - Tap next/prev to navigate prompts.
  - Pinch textarea to expand.
- **Responsive Layout:**
  - Mobile: Full-width textarea, next/prev buttons stacked.
  - Tablet/Desktop: Multi-column if showing multiple prompts.

### 12.4 Scoring & Grading Algorithm

**Scoring Strategy: Rubric-Based with AI Guidance (Optional)**

```
FOR EACH prompt:
  // Manual rubric check or LLM-assisted grading
  IF responseLength >= 50 words AND responseContainsKeyword:
    promptScore = 1.0
  ELSE IF responseLength >= 20 words:
    promptScore = 0.5
  ELSE:
    promptScore = 0.0

overallScore = average(promptScores)

competencyScore[review_reflection] += overallScore * 1.0
```

**Alternative: LLM-Assisted Grading (Future Enhancement)**
```
Use OpenAI to evaluate response against rubricGuidance:
- Prompt: "Grade this response against the rubric guidance: [guidance]"
- LLM returns: { score: 0-1, feedback: string }
```

### 12.5 Competency Integration

| Competency | Weight | Assessment |
|------------|--------|------------|
| `review_reflection` | 100% | Deliberate practice in self-assessment |

### 12.6 Accessibility Requirements

- **Keyboard Navigation:**
  - Tab through prompts (if sequential).
  - Ctrl+Enter to submit.

- **Screen Reader Support:**
  - Announce prompt category and question: "Category: Entry Process. Question: Did you have a written thesis?"
  - Announce hint: "Hint: Traders without theses trade on emotion."

### 12.7 AI Generation Potential

**Very High:** LLM can generate journal prompts for any trading context or competency focus.

**Example Prompt:**
```
Generate 5 journal reflection prompts for a trader who just experienced
a profitable trade closing early. Prompts should cover: entry thesis,
profit-taking discipline, opportunity cost awareness, emotional state,
and decision automation. Format as academy_journal_prompt_exercise JSON.
```

---

## Part 13: Summary & Implementation Roadmap

### 13.1 Schema Summary

**New Block Type Enums to Add:**
```typescript
type AcademyBlockType =
  | 'hook'
  | 'concept_explanation'
  | 'worked_example'
  | 'guided_practice'
  | 'independent_practice'
  | 'reflection'
  // NEW:
  | 'options_chain_simulator'
  | 'payoff_diagram_builder'
  | 'greeks_dashboard_simulator'
  | 'scenario_decision_tree'
  | 'position_builder_challenge'
  | 'market_context_tagger'
  | 'order_entry_simulator'
  | 'flashcard_deck'
  | 'timed_challenge_round'
  | 'what_went_wrong_analysis'
  | 'strategy_matcher'
  | 'journal_prompt_exercise'
```

**New Tables Required (Optional but Recommended):**
```sql
-- Academy Options Chain Templates (optional, for reusability)
CREATE TABLE academy_options_chain_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  expiration_date date NOT NULL,
  chain_json jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Spaced Repetition Flashcard Tracking
CREATE TABLE academy_flashcard_decks (
  id uuid PRIMARY KEY,
  lesson_id uuid REFERENCES academy_lessons(id),
  title text NOT NULL,
  cards_json jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE academy_flashcard_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  deck_id uuid NOT NULL REFERENCES academy_flashcard_decks(id),
  card_id text NOT NULL,
  difficulty_rating integer,
  next_review_date timestamp,
  attempt_count integer DEFAULT 1,
  created_at timestamp DEFAULT now()
);
```

### 13.2 Component Architecture

**Component Organization:**
```
components/
  academy/
    activities/
      OptionsChainSimulator.tsx
      PayoffDiagramBuilder.tsx
      GreeksDashboardSimulator.tsx
      ScenarioDecisionTree.tsx
      PositionBuilderChallenge.tsx
      MarketContextTagger.tsx
      OrderEntrySimulator.tsx
      FlashcardDeck.tsx
      TimedChallengeRound.tsx
      WhatWentWrongAnalysis.tsx
      StrategyMatcher.tsx
      JournalPromptExercise.tsx

    shared/
      PayoffChart.tsx          (used by Payoff Diagram Builder)
      GreeksGauge.tsx          (used by Greeks Dashboard)
      DecisionTreeVisualization.tsx
      DragDropMatcher.tsx      (used by Strategy Matcher)
```

**Shared Utilities:**
```
lib/
  academy-v3/
    services/
      payoff-calculator.ts    (Payoff Diagram Builder)
      greeks-calculator.ts    (Greeks Dashboard)
      scoring-engine.ts       (Extensions for new activity types)

    activities/
      activity-registry.ts    (Maps blockType to component)
      activity-content-schema.ts (Zod schemas for each contentJson)
```

### 13.3 Design System Compliance

All 12 activity types follow **Emerald Standard** design:

| Aspect | Application |
|--------|------------|
| **Color Palette** | Emerald (#10B981) for CTAs, Champagne (#F3E5AB) for accents, dark backgrounds (#0A0A0B) |
| **Typography** | Playfair Display for titles, Inter for body, Geist Mono for data/prices |
| **Glassmorphism** | All cards use `glass-card-heavy` utility |
| **Icons** | Lucide React, stroke width 1.5 |
| **Loading States** | Pulsing logo skeleton (no spinners) |
| **Mode** | Dark mode only |
| **Borders** | `border-white/5` standard, `border-emerald-500/50` active/highlighted |
| **Mobile First** | Responsive breakpoints: mobile < 768px, tablet 768–1024px, desktop > 1024px |

### 13.4 Competency Mapping Summary

| Activity Type | Market Context | Entry Validation | Position Sizing | Trade Management | Exit Discipline | Review Reflection |
|---|---|---|---|---|---|---|
| Options Chain Simulator | 30% | 70% | — | — | — | — |
| Payoff Diagram Builder | — | 30% | 50% | 20% | — | — |
| Greeks Dashboard Simulator | 100% | — | — | — | — | — |
| Scenario Decision Tree | — | — | — | 50% | 30% | 20% |
| Position Builder Challenge | 20% | 60% | 20% | — | — | — |
| Market Context Tagger | 100% | — | — | — | — | — |
| Order Entry Simulator | — | 100% | — | — | — | — |
| Flashcard Deck | 100% | — | — | — | — | — |
| Timed Challenge Round | Variable | — | — | — | — | 10% |
| What Went Wrong Analysis | — | — | — | 20% | 20% | 60% |
| Strategy Matcher | 60% | 40% | — | — | — | — |
| Journal Prompt Exercise | — | — | — | — | — | 100% |

### 13.5 Implementation Priority & Phasing

**Phase 1: Foundation (Highest ROI)**
1. Flashcard Deck (highest LLM generativity, low complexity)
2. Options Chain Simulator (core to entry validation)
3. Market Context Tagger (core to market_context competency)

**Phase 2: Simulation & Visualization**
4. Payoff Diagram Builder (highest engagement, visual)
5. Greeks Dashboard Simulator (core mechanics learning)
6. Order Entry Simulator (practical entry discipline)

**Phase 3: Decision-Making & Reflection**
7. Scenario Decision Tree (most complex, highest learning value)
8. Position Builder Challenge (synthesis of entry validation)
9. What Went Wrong Analysis (loss analysis discipline)

**Phase 4: Gamification & Polish**
10. Timed Challenge Round (engagement lever)
11. Strategy Matcher (quick engagement, review)
12. Journal Prompt Exercise (integration with Trade Journal)

### 13.6 Testing & Validation Strategy

**For Each Activity Type:**

1. **Unit Tests:**
   - Scoring algorithm correctness
   - Payoff/Greeks calculations (numerical accuracy)
   - Validation rules

2. **Component Tests (Vitest):**
   - State management
   - Event handlers (answer selection, form submission)
   - Accessibility tree (ARIA, keyboard nav)

3. **E2E Tests (Playwright):**
   - Complete user workflows (entry → answer → grading)
   - Mobile/tablet/desktop responsive behavior
   - Screen reader behavior

4. **A11y Tests (@axe-core):**
   - No ARIA violations
   - Proper contrast ratios
   - Keyboard accessibility

**Example E2E Test Structure:**
```typescript
// e2e/academy-activities.spec.ts
test('Options Chain Simulator: User answers questions correctly', async ({ page }) => {
  await page.goto('/members/academy/lessons/[lessonId]')
  // Navigate to options_chain_simulator block
  // Select answers
  // Submit
  // Assert correct feedback shown
  // Assert competency score updated
})

test('Payoff Diagram Builder: Mobile drag-and-drop on touch', async ({ page }) => {
  // Set mobile viewport
  // Tap available leg
  // Drag to canvas
  // Assert payoff curve updates
})
```

### 13.7 AI Content Generation Prompts (Examples)

**For Instructional Designers:**

```
Generate an Options Chain Simulator activity for an SPX lesson.
- Symbol: SPX
- Theme: "Identifying optimal strikes using IV and Greeks"
- Questions: 3 scenario-based questions about strike selection
- Format: JSON content_json for academy_lesson_blocks
```

```
Create a Payoff Diagram Builder activity showing a bull call spread.
- Market outlook: Bullish (target SPX 5900 within 3 weeks)
- Max profit: ~$100
- Max loss: ~$50
- Target position: Long 5850 call, Short 5900 call
- Include 2 assessment questions about max profit/breakeven
- Format: JSON
```

```
Generate a Scenario Decision Tree for an iron condor trade.
- Setup: Short 5800/5900 call spread, short 5700/5800 put spread, 3/21 expiration
- Include 4 decision nodes with realistic market moves and consequences
- Teach: rolling, hedging, position management, discipline
- Final outcomes: Win, Loss, Wipeout, Home Run
- Format: JSON
```

### 13.8 Known Limitations & Future Enhancements

**Current Limitations:**

1. **Greeks Calculation:** Using simplified Black-Scholes. Real-world would integrate Massive.com API for actual market Greeks.

2. **Chart Data:** Market Context Tagger currently uses static images. Could integrate real candlestick data from Massive.com.

3. **AI Grading:** Journal Prompt Exercise uses keyword matching. Could be enhanced with LLM-assisted evaluation.

4. **Scoring Granularity:** All activities use binary or simple partial credit. Could implement nuanced rubrics.

**Future Enhancements:**

1. **Live Market Integration:**
   - Options Chain Simulator → fetch live chains from Massive.com
   - Greeks Dashboard → real-time Greeks from market data

2. **Adaptive Difficulty:**
   - Timed Challenge Round → adjust question difficulty based on accuracy
   - Position Builder Challenge → suggest hints if student struggles

3. **Multiplayer Features:**
   - Leaderboards for Timed Challenge Round
   - Strategy Matcher tournaments

4. **Video Integration:**
   - Embed instructor walkthroughs alongside activities
   - Student-submitted video explanations for Journal Prompts

5. **Advanced Visualization:**
   - 3D Greeks surface (Delta, Gamma, Theta across price/time)
   - Real-time P&L heatmaps for Scenario Decision Tree

---

## Appendix A: JSON Schema Templates

### A.1 Activity Content JSON Validation (Zod Examples)

```typescript
// lib/academy-v3/contracts/activity-content.ts
import { z } from 'zod'

export const optionsChainSimulatorContentSchema = z.object({
  title: z.string(),
  lessonTitle: z.string(),
  lessonObjective: z.string(),
  instruction: z.string(),
  chainSnapshot: z.object({
    symbol: z.string(),
    expirationDate: z.string().date(),
    spotPrice: z.number(),
    impliedVolatility: z.number(),
    ivRank: z.number(),
    chain: z.array(z.object({
      strikePrice: z.number(),
      side: z.enum(['call', 'put']),
      bid: z.number(),
      ask: z.number(),
      volume: z.number(),
      openInterest: z.number(),
      delta: z.number(),
      gamma: z.number(),
      theta: z.number(),
      vega: z.number(),
    })),
  }),
  questions: z.array(z.object({
    id: z.string(),
    prompt: z.string(),
    type: z.string(),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
    })).optional(),
    expectedAnswer: z.string(),
    rationale: z.string(),
  })),
})

export type OptionsChainSimulatorContent = z.infer<typeof optionsChainSimulatorContentSchema>
```

### A.2 Activity Registry (Component Mapping)

```typescript
// lib/academy-v3/activities/activity-registry.ts
import { ReactComponentType } from 'react'
import { OptionsChainSimulator } from '@/components/academy/activities/OptionsChainSimulator'
import { PayoffDiagramBuilder } from '@/components/academy/activities/PayoffDiagramBuilder'
// ... etc

export const ACTIVITY_COMPONENT_MAP: Record<AcademyBlockType, ReactComponentType<any>> = {
  hook: StaticBlockRenderer,
  concept_explanation: StaticBlockRenderer,
  worked_example: StaticBlockRenderer,
  guided_practice: StaticBlockRenderer,
  independent_practice: StaticBlockRenderer,
  reflection: StaticBlockRenderer,
  options_chain_simulator: OptionsChainSimulator,
  payoff_diagram_builder: PayoffDiagramBuilder,
  greeks_dashboard_simulator: GreeksDashboardSimulator,
  scenario_decision_tree: ScenarioDecisionTree,
  position_builder_challenge: PositionBuilderChallenge,
  market_context_tagger: MarketContextTagger,
  order_entry_simulator: OrderEntrySimulator,
  flashcard_deck: FlashcardDeck,
  timed_challenge_round: TimedChallengeRound,
  what_went_wrong_analysis: WhatWentWrongAnalysis,
  strategy_matcher: StrategyMatcher,
  journal_prompt_exercise: JournalPromptExercise,
}
```

---

## Appendix B: Mobile Gesture & Touch API Reference

**Supported Touch Gestures Across Activities:**

| Activity | Tap | Swipe | Pinch | Long-Press | Double-Tap |
|---|---|---|---|---|---|
| Options Chain Simulator | Select row | Scroll chain | Zoom chart | Show tooltip | — |
| Payoff Diagram Builder | Select leg | Remove leg | Zoom diagram | — | — |
| Greeks Dashboard Simulator | Select slider | Adjust value | Zoom display | — | — |
| Scenario Decision Tree | Select decision | Undo move | — | Show context | — |
| Position Builder Challenge | Add leg | Remove leg | Zoom diagram | — | — |
| Market Context Tagger | Select answer | Scroll chart | Zoom chart | — | — |
| Order Entry Simulator | Focus field | — | — | — | — |
| Flashcard Deck | Flip card | Navigate | Zoom card | — | — |
| Timed Challenge Round | Answer | Navigate | — | — | — |
| What Went Wrong Analysis | Select mistake | — | — | Show detail | — |
| Strategy Matcher | Match pair | Undo match | — | Show explanation | — |
| Journal Prompt Exercise | Focus textarea | — | Expand textarea | — | — |

---

## Appendix C: Accessibility Checklist per Activity

**WCAG 2.1 AA Compliance Requirements for All Activities:**

- [ ] Keyboard navigation (Tab, Arrow, Enter, Escape) implemented
- [ ] ARIA labels on all interactive elements (`aria-label`, `aria-describedby`)
- [ ] Form labels properly associated (`<label htmlFor>`)
- [ ] Focus visible (outline or custom indicator)
- [ ] Color not sole means of conveyance (e.g., use icons + text)
- [ ] Contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] Touch targets ≥ 44x44 CSS pixels
- [ ] Screen reader tested (NVDA, JAWS, VoiceOver)
- [ ] No flashing content (> 3 times per second)
- [ ] Error messages identified and recovery suggestions provided

---

## Appendix D: Scoring Algorithm Pseudocode Summary

**Universal Competency Score Update Pattern:**

```
FOR EACH activity completion:
  1. Score assessment items (scoring-service.ts logic)
  2. Calculate activity-level scores per competency
  3. Update user mastery record via AcademyAssessmentService:
     currentScore = existing.score * 0.7 + activityScore * 0.3
     confidence = min(existing.confidence * 0.8 + 0.2, 1.0)
  4. If score < threshold, add remediation items to review queue
  5. Insert learning event (assessment_submitted, assessment_passed/failed)
```

---

## Conclusion

This specification provides a comprehensive design for 12 new interactive activity types that significantly expand the TradeITM Academy's capacity to teach options trading concepts, entry discipline, trade management, and self-reflection.

**Key Design Principles Applied Across All Activities:**
- **Emerald Standard Compliance:** Dark mode, emerald + champagne palette, glassmorphism, sans-serif typography
- **Mobile-First Responsiveness:** Touch gestures, adaptive layouts, readable text
- **Accessibility-First:** WCAG 2.1 AA, keyboard navigation, screen reader support
- **Competency Integration:** Clear mapping to 6 existing competencies, weighted scoring
- **Scoring Clarity:** Deterministic, partial-credit-aware, review queue integration
- **AI Generativity:** Structured JSON enables LLM-driven content creation
- **Testing Strategy:** Unit, component, E2E, and a11y test patterns defined

These activities transform the Academy from a **content consumption platform** into an **interactive, gamified, hands-on learning system** that mirrors real trading decisions and builds muscle memory through deliberate practice.

**Recommended Next Steps:**
1. Implement Phase 1 activities (Flashcard, Options Chain, Market Context Tagger)
2. Gather learner feedback and iterate on UX patterns
3. Integrate with real Massive.com market data
4. Expand assessment question library via LLM generation
5. Build instructor tools for activity creation and customization
