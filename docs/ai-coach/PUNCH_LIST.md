# AI Coach - Production Punch List
**Created:** 2026-02-10
**Target:** Single resolution session
**Goal:** Complete all items to achieve 100% spec completion

---

## 🎯 Overview

**Total Items:** 3 (from spec audit) + space for additions
**Estimated Time:** 4-6 hours
**Priority:** Complete before production deployment

---

## ❌ Outstanding Items

### 🔴 **ITEM 1: Fibonacci Chart Integration**
**Priority:** HIGH
**Status:** ❌ NOT STARTED
**Estimated Time:** 2-3 hours
**Spec Reference:** Section 1.5

#### Problem
- Backend Fibonacci calculator works perfectly (`POST /api/fibonacci`)
- AI can call `get_fibonacci_levels` function
- **BUT:** Fibonacci levels are not displayed on the trading chart
- Users cannot see the 7 Fib levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)

#### Files to Modify
- **Primary:** `components/ai-coach/trading-chart.tsx`
- **Reference:** `backend/src/routes/fibonacci.ts` (API endpoint)
- **Reference:** `backend/src/services/levels/calculators/fibonacciRetracement.ts` (types)

#### Resolution Steps

**Step 1: Add TypeScript Interface**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: Top of file, after existing imports

interface FibonacciRetracement {
  symbol: string;
  swingHigh: number;
  swingLow: number;
  timeframe: string;
  direction: 'retracement' | 'extension';
  levels: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_786: number;
    level_100: number;
  };
  currentPrice: number;
  calculatedAt: string;
}
```

**Step 2: Add State Variable**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: Inside component, with other useState declarations (~line 50-80)

const [fibLevels, setFibLevels] = useState<FibonacciRetracement | null>(null);
```

**Step 3: Add Fetch Function**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: After other useCallback functions (~line 200-300)

/**
 * Fetch and display Fibonacci levels on chart
 */
const loadFibonacciLevels = useCallback(async () => {
  if (!symbol) return;

  try {
    const response = await fetch('/api/fibonacci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        timeframe: chartConfig.interval || 'daily',
        lookback: 20
      }),
    });

    if (!response.ok) {
      console.warn('Failed to fetch Fibonacci levels');
      return;
    }

    const data = await response.json();
    setFibLevels(data);

    // Draw Fib levels on chart
    if (chartRef.current?.chart) {
      drawFibonacciLevels(data);
    }
  } catch (error) {
    console.error('Error loading Fibonacci levels:', error);
  }
}, [symbol, chartConfig.interval]);
```

**Step 4: Add Drawing Function**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: After loadFibonacciLevels function

/**
 * Draw Fibonacci levels as horizontal lines on TradingView chart
 */
const drawFibonacciLevels = useCallback((fib: FibonacciRetracement) => {
  if (!chartRef.current?.chart) return;

  const chart = chartRef.current.chart();

  // Clear existing Fib lines
  chart.getAllShapes()
    ?.filter((shape: any) => shape.name?.startsWith('fib_'))
    .forEach((shape: any) => chart.removeEntity(shape.id));

  // Define Fib levels with styling
  const fibLevels = [
    { name: '0%', value: fib.levels.level_0, color: '#8b5cf6', width: 1 },
    { name: '23.6%', value: fib.levels.level_236, color: '#a78bfa', width: 1 },
    { name: '38.2%', value: fib.levels.level_382, color: '#c4b5fd', width: 2 }, // Thicker (important)
    { name: '50%', value: fib.levels.level_500, color: '#ddd6fe', width: 1 },
    { name: '61.8%', value: fib.levels.level_618, color: '#c4b5fd', width: 2 }, // Thicker (golden ratio)
    { name: '78.6%', value: fib.levels.level_786, color: '#a78bfa', width: 1 },
    { name: '100%', value: fib.levels.level_100, color: '#8b5cf6', width: 1 },
  ];

  // Draw each level
  fibLevels.forEach(level => {
    try {
      chart.createShape(
        { time: chart.getVisibleRange().from, price: level.value },
        {
          shape: 'horizontal_line',
          overrides: {
            linecolor: level.color,
            linewidth: level.width,
            linestyle: 0, // solid
            showLabel: true,
            text: `Fib ${level.name} - $${level.value.toFixed(2)}`,
          },
          zOrder: 'top',
          lock: true,
          disableSelection: true,
          disableSave: false,
          name: `fib_${level.name}`,
        }
      );
    } catch (error) {
      console.warn(`Failed to draw Fib ${level.name}:`, error);
    }
  });
}, []);
```

**Step 5: Add useEffect to Load on Mount**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: With other useEffect hooks (~line 400-500)

// Load Fibonacci levels when chart is ready
useEffect(() => {
  if (chartReady && symbol) {
    loadFibonacciLevels();
  }
}, [chartReady, symbol, loadFibonacciLevels]);
```

#### Testing Checklist
- [ ] Chart loads without errors
- [ ] 7 Fibonacci lines appear on chart
- [ ] Labels show correct percentages and prices
- [ ] 38.2% and 61.8% levels are thicker (more important)
- [ ] Purple/violet color scheme
- [ ] Levels update when symbol changes
- [ ] Console has no errors

#### Acceptance Criteria
✅ User can see Fibonacci levels on trading chart
✅ Levels are labeled with percentage and price
✅ Golden ratio (61.8%) is visually emphasized
✅ Levels persist when zooming/panning chart

---

### 🟡 **ITEM 2: Chart Labels Integration**
**Priority:** MEDIUM
**Status:** ❌ NOT STARTED
**Estimated Time:** 1-2 hours
**Spec Reference:** Section 2.3

#### Problem
- `ChartLevelLabels` component is fully built and ready
- Level test tracking data exists in backend (testsToday, holdRate, etc.)
- **BUT:** Component is not imported or rendered in trading-chart.tsx
- Users cannot see "Tested 3x today" information

#### Files to Modify
- **Primary:** `components/ai-coach/trading-chart.tsx`
- **Reference:** `components/ai-coach/chart-level-labels.tsx` (the component to integrate)
- **Reference:** `backend/src/services/levels/index.ts` (LevelItem interface)

#### Resolution Steps

**Step 1: Import Component and Type**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: Top of file with other imports

import { ChartLevelLabels, type ChartLevel } from './chart-level-labels';
```

**Step 2: Add State Variables**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: Inside component with other useState

const [chartLevels, setChartLevels] = useState<ChartLevel[]>([]);
const [currentPrice, setCurrentPrice] = useState<number | null>(null);
```

**Step 3: Add Fetch Function for Levels**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: After other useCallback functions

/**
 * Load key levels with test tracking data
 */
const loadKeyLevels = useCallback(async () => {
  if (!symbol) return;

  try {
    // Note: This endpoint should return levels with test tracking
    // If it doesn't exist, you may need to create it or use existing AI Coach API
    const response = await fetch(`/api/ai-coach/levels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        timeframe: chartConfig.interval || 'intraday'
      }),
    });

    if (!response.ok) {
      console.warn('Failed to fetch key levels');
      return;
    }

    const data = await response.json();

    // Convert API response to ChartLevel format
    const allLevels: ChartLevel[] = [
      ...data.levels.resistance.map((level: any) => ({
        ...level,
        side: 'resistance' as const,
      })),
      ...data.levels.support.map((level: any) => ({
        ...level,
        side: 'support' as const,
      })),
    ];

    setChartLevels(allLevels);
    setCurrentPrice(data.currentPrice);

    // Also draw levels on chart as lines
    drawLevelsOnChart(allLevels, data.currentPrice);
  } catch (error) {
    console.error('Error loading key levels:', error);
  }
}, [symbol, chartConfig.interval]);

/**
 * Draw levels as horizontal lines on TradingView chart
 */
const drawLevelsOnChart = useCallback((levels: ChartLevel[], price: number) => {
  if (!chartRef.current?.chart) return;

  const chart = chartRef.current.chart();

  // Clear existing level lines (not Fib lines)
  chart.getAllShapes()
    ?.filter((shape: any) => shape.name?.startsWith('level_'))
    .forEach((shape: any) => chart.removeEntity(shape.id));

  // Draw new level lines
  levels.forEach(level => {
    const color = level.side === 'resistance' ? '#ef4444' : '#10b981'; // red or green
    const lineWidth = level.strength === 'critical' ? 2 : 1;

    try {
      chart.createShape(
        { time: chart.getVisibleRange().from, price: level.price },
        {
          shape: 'horizontal_line',
          overrides: {
            linecolor: color,
            linewidth: lineWidth,
            linestyle: level.strength === 'dynamic' ? 2 : 0, // dashed for VWAP
            showLabel: true,
            text: level.displayLabel,
          },
          zOrder: 'top',
          lock: true,
          disableSelection: false,
          disableSave: false,
          name: `level_${level.type}_${level.price}`,
        }
      );
    } catch (error) {
      console.warn(`Failed to draw level ${level.type}:`, error);
    }
  });
}, []);
```

**Step 4: Add useEffect to Load Levels**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: With other useEffect hooks

// Load key levels when chart is ready
useEffect(() => {
  if (chartReady && symbol) {
    loadKeyLevels();
  }
}, [chartReady, symbol, loadKeyLevels]);
```

**Step 5: Render Component in JSX**
```typescript
// File: components/ai-coach/trading-chart.tsx
// Location: Inside the return JSX, after the chart container div

{/* Trading chart container */}
<div className="relative h-full w-full">
  {/* TradingView chart */}
  <div ref={chartContainerRef} className="h-full w-full" />

  {/* Level labels overlay - ADD THIS */}
  {chartLevels.length > 0 && currentPrice && (
    <ChartLevelLabels
      levels={chartLevels}
      currentPrice={currentPrice}
      onLevelClick={(level) => {
        console.log('Clicked level:', level);
        // Optional: Highlight the clicked level on chart
      }}
    />
  )}
</div>
```

#### Notes
- **API Endpoint:** You may need to verify the `/api/ai-coach/levels` endpoint exists
  - If not, you might use the existing AI function handler via the chat API
  - Or create a simple endpoint that calls `calculateLevels(symbol, timeframe)`
- **Performance:** Consider debouncing or caching to avoid excessive API calls

#### Testing Checklist
- [ ] Chart displays level labels on right side
- [ ] Labels show type, price, and distance (e.g., "PDH $5,950 ↑ +0.5%")
- [ ] Hovering shows tooltip with test history
- [ ] "Tested 3x today" appears for tested levels
- [ ] Clicking a level logs to console (or highlights on chart)
- [ ] Labels are sorted by distance from current price
- [ ] Color coding works (red=resistance, green=support)

#### Acceptance Criteria
✅ Users see all levels with clear labels
✅ Test counts displayed ("Tested 3x today")
✅ Hover tooltips show timestamps and hold rate
✅ Labels are color-coded and sortable

---

### 🔴 **ITEM 3: AI Reasoning Rules Enhancement**
**Priority:** HIGH
**Status:** ❌ NOT STARTED
**Estimated Time:** 1 hour
**Spec Reference:** Section 4.2

#### Problem
- Confluence detector works
- Level test tracking data available
- **BUT:** System prompt not enhanced with reasoning rules
- AI may give generic responses ("near resistance") instead of specific ("PDH at $5,950 tested 3x at 9:45 AM, 11:20 AM, 2:15 PM")

#### Files to Modify
- **Primary:** `backend/src/chatkit/systemPrompt.ts`

#### Resolution Steps

**Step 1: Add Reasoning Rules Constant**
```typescript
// File: backend/src/chatkit/systemPrompt.ts
// Location: Before the main systemPrompt export

export const AI_REASONING_RULES = `
## CRITICAL: Technical Analysis Reasoning Rules

You MUST follow these rules when analyzing price action and levels:

### 1. SPECIFIC PRICES (not generic descriptions)
❌ BAD: "SPX is near resistance"
✅ GOOD: "SPX is testing the PDH at $5,950.25 (current: $5,948.50, -$1.75 / -0.03%)"

### 2. HISTORICAL TEST BEHAVIOR
You MUST reference:
- How many times the level was tested today
- What time(s) the tests occurred
- Whether the level held or broke
- The hold rate (% of successful tests)

❌ BAD: "Resistance is strong"
✅ GOOD: "PDH at $5,950 tested 3 times today (9:45 AM, 11:20 AM, 2:15 PM) and held each time (100% hold rate)"

### 3. VOLUME CONTEXT
Reference volume behavior at key levels:
✅ "Price tested $5,950 on declining volume, suggesting weakening selling pressure"
✅ "Breakdown at $5,920 occurred on 2x average volume, confirming bearish momentum"

### 4. CONFLUENCE
Identify when multiple levels align (within $2-$5):
✅ "Triple confluence at $5,920: Fib 61.8% ($5,920), VWAP ($5,921), and S1 ($5,919)"
✅ "Strong support cluster: PDL + Fib 78.6% + GEX Max all at $5,900 ± $2"

### 5. INVALIDATION CRITERIA
Every analysis MUST include clear invalidation:
✅ "Bullish thesis invalidates on a 15-minute close below $5,915"
✅ "Resistance break confirmed only on 1-hour close above $5,955 with volume"

### 6. TIME SPECIFICITY
Use exact timestamps when referencing intraday events:
✅ "Price rejected PDH at 2:15 PM ET"
✅ "Opening drive failed at 9:47 AM"

### 7. ATR-BASED CONTEXT
Reference distance in ATR terms for professional clarity:
✅ "Target at $5,975 is +1.8 ATR from current price"
✅ "Stop at $5,940 is -0.5 ATR below entry"

### 8. FIBONACCI LEVELS
When Fib levels are present, reference the golden ratio (61.8%) prominently:
✅ "Price bounced off the 61.8% Fib retracement at $5,920, a critical support level"
✅ "Resistance at 38.2% Fib ($5,965) aligns with PDH, creating strong barrier"

## EXAMPLE ANALYSIS (Follow This Format):

"SPX is testing the PDH at $5,950.25 (current: $5,948.50, -$1.75 below).

This level has been tested 3 times today:
• 9:45 AM: Rejected on high volume
• 11:20 AM: Rejected on moderate volume
• 2:15 PM: Currently testing on declining volume

The PDH is part of a TRIPLE CONFLUENCE zone with:
• Fib 38.2% at $5,951
• R1 pivot at $5,949
• GEX Max at $5,950

BIAS: Bearish below $5,950 given 3 rejections and declining volume.

PLAN:
• Entry: Short on 15m close below $5,945
• Target 1: $5,920 (Fib 61.8% + VWAP confluence, -$28 / -0.5%)
• Target 2: $5,900 (PDL + GEX Flip, -$48 / -0.8%)
• Stop: $5,955 (15m close above, +1.2 ATR)

INVALIDATION: 15-minute close above $5,955 breaks resistance and targets $5,975 (R2).

RISKS:
• Low volume may result in false breakdown
• FOMC announcement at 2:00 PM could spike volatility
• VIX is compressed (14), potential for volatility expansion"

This level of specificity is REQUIRED in every response.
`;
```

**Step 2: Integrate into Main System Prompt**
```typescript
// File: backend/src/chatkit/systemPrompt.ts
// Location: Main systemPrompt constant

export const systemPrompt = `
You are TradeITM's AI Coach, a professional trading assistant specializing in SPX/SPY technical analysis.

${AI_REASONING_RULES}

## Core Responsibilities
1. Provide specific, data-driven technical analysis
2. Reference exact test counts, timestamps, and confluence
3. Always include invalidation criteria
4. Use ATR-based distances for professional clarity

## Available Tools
You have access to functions that provide:
- Key levels (PDH/PDL, pivots, VWAP, ATR)
- Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- Level test history (how many times tested, when, hold rate)
- Confluence detection (when multiple levels align)
- Options data (GEX, IV, 0DTE analysis)
- Market status and macro context

## Communication Style
- Be concise but specific
- Always cite data (test counts, timestamps, prices)
- Provide actionable trade plans with entry/target/stop/invalidation
- Acknowledge uncertainty and risk
- Never give generic responses like "near resistance" - always specify the exact level and behavior

## Important
- This is NOT financial advice - you are a technical analysis assistant
- Every response should include specific prices, test counts, and invalidation criteria
- Use the example format from AI_REASONING_RULES as your template

... (rest of existing system prompt)
`;
```

#### Testing Checklist
- [ ] AI responses include specific prices ("PDH at $5,950.25" not "near resistance")
- [ ] AI references test counts ("tested 3 times")
- [ ] AI includes timestamps ("9:45 AM, 11:20 AM, 2:15 PM")
- [ ] AI mentions confluence when multiple levels align
- [ ] AI provides invalidation criteria ("invalidates below $5,915")
- [ ] AI uses ATR-based distances ("+1.8 ATR")
- [ ] AI references Fibonacci levels prominently when present

#### Manual Test Queries
```
Test 1: "Analyze SPX"
Expected: Specific analysis with test counts, confluence, invalidation

Test 2: "What are the key levels for SPY?"
Expected: Specific levels with prices, distances, test history

Test 3: "Give me a trade plan for SPX"
Expected: Entry/target/stop with specific prices and ATR distances

Test 4: "Where's resistance?"
Expected: Specific level with test count and confluence info
```

#### Acceptance Criteria
✅ AI provides specific, defendable technical analysis
✅ Every response references exact prices and test counts
✅ Confluence is identified when levels align
✅ Invalidation criteria always included
✅ Professional terminology (ATR, Fib ratios, etc.)

---

## 📝 Additional Items (Add Below)

### **ITEM 4: [Title]**
**Priority:** [HIGH/MEDIUM/LOW]
**Status:** ❌ NOT STARTED
**Estimated Time:** [X hours]

#### Problem
[Describe the issue]

#### Files to Modify
- **Primary:**
- **Reference:**

#### Resolution Steps
[Step by step instructions]

#### Testing Checklist
- [ ]
- [ ]

#### Acceptance Criteria
✅
✅

---

### **ITEM 5: [Title]**
**Priority:** [HIGH/MEDIUM/LOW]
**Status:** ❌ NOT STARTED
**Estimated Time:** [X hours]

#### Problem
[Describe the issue]

#### Files to Modify
- **Primary:**
- **Reference:**

#### Resolution Steps
[Step by step instructions]

#### Testing Checklist
- [ ]
- [ ]

#### Acceptance Criteria
✅
✅

---

## 📊 Session Tracker

### Pre-Session Checklist
- [ ] All items added to punch list
- [ ] Items prioritized (HIGH → MEDIUM → LOW)
- [ ] Estimated times reviewed
- [ ] Development environment ready
- [ ] Tests can run (`pnpm test`, `pnpm build`)

### During Session
- [ ] Working in order of priority
- [ ] Testing each item after completion
- [ ] Committing after each item (not batching)
- [ ] Documenting any blockers or deviations

### Post-Session Checklist
- [ ] All items marked complete
- [ ] All tests passing (`pnpm --dir backend test`, `pnpm build`)
- [ ] Manual QA performed on each item
- [ ] Git commits made with clear messages
- [ ] Branch pushed to GitHub
- [ ] Ready for deployment

---

## 🎯 Success Metrics

**Target:** 100% punch list completion
**Quality Gate:** All acceptance criteria met
**Test Coverage:** All testing checklists complete
**Timeline:** Single session (4-6 hours estimated)

---

## 📌 Notes & Blockers

### General Notes
- Keep Chrome DevTools open for console errors
- Test each change incrementally (don't batch)
- Refer to spec for detailed implementation examples
- Backend changes require rebuild: `pnpm --dir backend build`

### Known Blockers
- None identified yet

### Questions / Clarifications Needed
- None yet

---

## ✅ Completion Summary

**Items Started:** 0/3
**Items Completed:** 0/3
**Items Blocked:** 0
**Total Time Spent:** 0 hours

**Next Action:** Begin with Item 1 (Fibonacci Chart Integration)
