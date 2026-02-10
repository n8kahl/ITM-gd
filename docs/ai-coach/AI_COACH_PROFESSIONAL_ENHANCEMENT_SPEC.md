# AI Coach Professional Enhancement Spec
**Version:** 1.0
**Date:** 2026-02-10
**Status:** Ready for Implementation
**Target:** Codex Autonomous Execution

---

## Executive Summary

### What We're Building
Enhance the AI Coach to professional-grade technical analysis with:
1. **Fibonacci Retracement Levels** - Calculate and display Fib levels based on recent swing high/low
2. **Enhanced Chart Labels** - All levels clearly labeled with type, price, distance, and context
3. **Level Test Tracking** - Track how many times price tested each level, with success rate
4. **AI Reasoning Enhancement** - AI must reference specific technical criteria (e.g., "tested 3x", "held on high volume")
5. **IV/GEX Educational Context** - Tooltips and explanations for Options/GEX tools

### Why This Matters
Current AI responses are generic ("near resistance"). This upgrade makes every analysis **comprehensive, accurate, and defendable** with specific technical reasons.

### Success Metrics
- AI references specific test counts in 90%+ of analyses
- All chart levels have clear labels (100% coverage)
- Users understand what GEX/IV means (measured via reduced support questions)

---

## Table of Contents
1. [Success Criteria](#success-criteria)
2. [Technical Architecture](#technical-architecture)
3. [Implementation Phases](#implementation-phases)
4. [Phase 1: Fibonacci Retracement](#phase-1-fibonacci-retracement)
5. [Phase 2: Chart Label Enhancement](#phase-2-chart-label-enhancement)
6. [Phase 3: Level Test Tracking](#phase-3-level-test-tracking)
7. [Phase 4: AI Reasoning Enhancement](#phase-4-ai-reasoning-enhancement)
8. [Phase 5: Educational Context](#phase-5-educational-context)
9. [Testing Requirements](#testing-requirements)
10. [Documentation Requirements](#documentation-requirements)
11. [Deployment Plan](#deployment-plan)
12. [Quality Gates](#quality-gates)
13. [Rollback Plan](#rollback-plan)
14. [Acceptance Criteria](#acceptance-criteria)

---

## Success Criteria

### Functional Requirements
- ✅ Fibonacci retracement levels calculate correctly (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- ✅ Chart displays all levels with clear labels (type + price + distance)
- ✅ AI references specific test counts ("tested 3 times") in analysis
- ✅ Level test tracking stores data in Redis with 24h TTL
- ✅ GEX/IV tools have educational tooltips
- ✅ All changes maintain backward compatibility (existing endpoints unchanged)

### Non-Functional Requirements
- ⚡ Performance: Fib calculation adds <100ms to level calculation time
- 📊 Observability: All new functions logged with timing metrics
- 🔒 Security: No new authentication requirements (uses existing)
- 🧪 Test Coverage: 90%+ coverage on new code
- 📚 Documentation: Every new function has JSDoc comments

---

## Technical Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│  • TradingChart.tsx (displays levels + Fib lines)           │
│  • GEXChart.tsx (adds educational tooltips)                 │
│  • IVDashboard.tsx (adds educational context)               │
└────────────────────┬────────────────────────────────────────┘
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                     │
├─────────────────────────────────────────────────────────────┤
│  • POST /api/ai-coach/chat (enhanced with Fib + tests)     │
│  • Function Handler: get_fibonacci_levels                   │
│  • Function Handler: get_key_levels (enhanced)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
├─────────────────────────────────────────────────────────────┤
│  • fibonacciRetracement.ts (NEW)                            │
│  • levelTestTracker.ts (NEW)                                │
│  • confluenceDetector.ts (NEW)                              │
│  • levels/index.ts (enhanced)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Massive.com  │          │    Redis     │
│ (price data) │          │ (test cache) │
└──────────────┘          └──────────────┘
```

### Data Flow
1. User asks: "Analyze SPX"
2. AI calls function: `get_key_levels("SPX")`
3. Backend:
   - Fetches intraday/daily bars from Massive.com
   - Calculates Fib retracement from recent swing
   - Analyzes level tests from intraday bars
   - Caches results in Redis (5min TTL)
   - Returns enriched data to AI
4. AI uses enriched data to write specific analysis
5. Frontend displays levels on chart with labels

---

## Implementation Phases

### Phase Overview
| Phase | Focus | Duration | Dependencies |
|-------|-------|----------|--------------|
| 1 | Fibonacci Retracement | 2 days | None |
| 2 | Chart Label Enhancement | 2 days | Phase 1 |
| 3 | Level Test Tracking | 3 days | Phase 1 |
| 4 | AI Reasoning Enhancement | 2 days | Phase 3 |
| 5 | Educational Context | 1 day | None (parallel) |

**Total Duration:** 10 days (2 weeks with buffer)

---

## Phase 1: Fibonacci Retracement

### Objective
Add Fibonacci retracement calculator that identifies recent swing high/low and calculates standard Fib levels (23.6%, 38.2%, 50%, 61.8%, 78.6%).

### Files to Create

#### 1.1 Backend: Fibonacci Retracement Calculator
**File:** `/backend/src/services/levels/calculators/fibonacciRetracement.ts`

```typescript
import { MassiveAggregate } from '../../../config/massive';

/**
 * Fibonacci Retracement Levels
 * Calculates standard Fibonacci retracement levels based on recent swing high/low
 */
export interface FibonacciRetracement {
  symbol: string;
  swingHigh: number;
  swingHighIndex: number; // bar index where swing high occurred
  swingLow: number;
  swingLowIndex: number; // bar index where swing low occurred
  timeframe: string; // "daily" | "15m" | "1h" | "5m"
  lookbackBars: number; // how many bars were analyzed
  direction: 'retracement' | 'extension'; // retracement = pullback, extension = rally
  levels: {
    level_0: number;      // 0% (swing high for retracement, swing low for extension)
    level_236: number;    // 23.6%
    level_382: number;    // 38.2%
    level_500: number;    // 50%
    level_618: number;    // 61.8% (golden ratio - most important)
    level_786: number;    // 78.6%
    level_100: number;    // 100% (swing low for retracement, swing high for extension)
  };
  calculatedAt: string; // ISO timestamp
}

/**
 * Find swing high and swing low within a lookback period
 *
 * @param bars - Array of price bars (most recent last)
 * @param lookback - Number of bars to scan (default 20)
 * @returns { high, highIndex, low, lowIndex }
 */
function findSwingPoints(
  bars: MassiveAggregate[],
  lookback: number
): { high: number; highIndex: number; low: number; lowIndex: number } {
  const startIndex = Math.max(0, bars.length - lookback);
  const recentBars = bars.slice(startIndex);

  let highestPrice = -Infinity;
  let highestIndex = 0;
  let lowestPrice = Infinity;
  let lowestIndex = 0;

  for (let i = 0; i < recentBars.length; i++) {
    if (recentBars[i].h > highestPrice) {
      highestPrice = recentBars[i].h;
      highestIndex = i;
    }
    if (recentBars[i].l < lowestPrice) {
      lowestPrice = recentBars[i].l;
      lowestIndex = i;
    }
  }

  return {
    high: highestPrice,
    highIndex: startIndex + highestIndex,
    low: lowestPrice,
    lowIndex: startIndex + lowestIndex,
  };
}

/**
 * Calculate Fibonacci retracement levels
 *
 * Direction logic:
 * - If swing high occurred AFTER swing low → "retracement" (pullback from high)
 * - If swing low occurred AFTER swing high → "extension" (rally from low)
 *
 * @param bars - Array of price bars (intraday or daily)
 * @param lookback - Number of bars to scan for swing points (default 20)
 * @returns FibonacciRetracement object
 */
export function calculateFibonacciRetracement(
  symbol: string,
  bars: MassiveAggregate[],
  timeframe: string = 'daily',
  lookback: number = 20
): FibonacciRetracement {
  if (bars.length < 2) {
    throw new Error('Insufficient data for Fibonacci calculation (need at least 2 bars)');
  }

  const swing = findSwingPoints(bars, lookback);
  const range = swing.high - swing.low;

  // Determine direction based on which came first
  const direction: 'retracement' | 'extension' =
    swing.highIndex > swing.lowIndex ? 'retracement' : 'extension';

  // For retracement (pullback from high), levels go downward from swing high
  // For extension (rally from low), levels go upward from swing low
  const levels = direction === 'retracement'
    ? {
        level_0: swing.high,
        level_236: swing.high - (range * 0.236),
        level_382: swing.high - (range * 0.382),
        level_500: swing.high - (range * 0.500),
        level_618: swing.high - (range * 0.618),
        level_786: swing.high - (range * 0.786),
        level_100: swing.low,
      }
    : {
        level_0: swing.low,
        level_236: swing.low + (range * 0.236),
        level_382: swing.low + (range * 0.382),
        level_500: swing.low + (range * 0.500),
        level_618: swing.low + (range * 0.618),
        level_786: swing.low + (range * 0.786),
        level_100: swing.high,
      };

  // Round all levels to 2 decimal places
  const roundedLevels = Object.fromEntries(
    Object.entries(levels).map(([key, value]) => [key, Number(value.toFixed(2))])
  ) as typeof levels;

  return {
    symbol,
    swingHigh: Number(swing.high.toFixed(2)),
    swingHighIndex: swing.highIndex,
    swingLow: Number(swing.low.toFixed(2)),
    swingLowIndex: swing.lowIndex,
    timeframe,
    lookbackBars: lookback,
    direction,
    levels: roundedLevels,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Determine which Fib level is closest to current price
 * Used by AI to prioritize which levels to mention
 */
export function findClosestFibLevel(
  fib: FibonacciRetracement,
  currentPrice: number
): { level: keyof FibonacciRetracement['levels']; price: number; distance: number } {
  let closestLevel: keyof FibonacciRetracement['levels'] = 'level_500';
  let closestDistance = Infinity;

  for (const [levelName, levelPrice] of Object.entries(fib.levels)) {
    const distance = Math.abs(currentPrice - levelPrice);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestLevel = levelName as keyof FibonacciRetracement['levels'];
    }
  }

  return {
    level: closestLevel,
    price: fib.levels[closestLevel],
    distance: Number((currentPrice - fib.levels[closestLevel]).toFixed(2)),
  };
}
```

#### 1.2 Backend: Add Fibonacci Function Handler
**File:** `/backend/src/chatkit/functionHandlers.ts`

**Action:** Add new case to switch statement (around line 150):

```typescript
case 'get_fibonacci_levels':
  return await handleGetFibonacciLevels(typedArgs);
```

**Action:** Add handler function at end of file:

```typescript
/**
 * Handle get_fibonacci_levels function call
 * Returns Fibonacci retracement levels for a symbol
 */
async function handleGetFibonacciLevels(args: {
  symbol: string;
  timeframe?: 'daily' | '15m' | '1h' | '5m';
  lookback?: number;
}): Promise<any> {
  const symbol = toValidSymbol(args.symbol);
  if (!symbol) return invalidSymbolError();

  const timeframe = args.timeframe || 'daily';
  const lookback = typeof args.lookback === 'number' && args.lookback > 0 && args.lookback <= 100
    ? args.lookback
    : 20;

  try {
    // Fetch appropriate bars based on timeframe
    const bars = timeframe === 'daily'
      ? await withTimeout(
          () => fetchDailyData(symbol, lookback + 10),
          FUNCTION_TIMEOUT_MS,
          'fetchDailyData'
        )
      : await withTimeout(
          () => fetchIntradayData(symbol, timeframe),
          FUNCTION_TIMEOUT_MS,
          'fetchIntradayData'
        );

    if (bars.length < 2) {
      return {
        error: 'Insufficient data',
        message: `Not enough price data for ${symbol} to calculate Fibonacci levels`,
      };
    }

    const fib = calculateFibonacciRetracement(symbol, bars, timeframe, lookback);
    const currentPrice = bars[bars.length - 1].c;
    const closest = findClosestFibLevel(fib, currentPrice);

    // Human-readable interpretation
    const interpretation = fib.direction === 'retracement'
      ? `Price pulled back from swing high $${fib.swingHigh.toFixed(2)}. Key support at 61.8% ($${fib.levels.level_618}) and 78.6% ($${fib.levels.level_786}). Current price $${currentPrice.toFixed(2)} is closest to ${closest.level.replace('level_', '')}% level.`
      : `Price rallying from swing low $${fib.swingLow.toFixed(2)}. Key resistance at 38.2% ($${fib.levels.level_382}) and 61.8% ($${fib.levels.level_618}). Current price $${currentPrice.toFixed(2)} is closest to ${closest.level.replace('level_', '')}% level.`;

    return withFreshness(
      {
        ...fib,
        currentPrice: Number(currentPrice.toFixed(2)),
        closestLevel: {
          name: closest.level.replace('level_', '') + '%',
          price: closest.price,
          distance: closest.distance,
          distancePct: Number(((closest.distance / currentPrice) * 100).toFixed(2)),
        },
        interpretation,
      },
      {
        asOf: new Date().toISOString(),
        source: 'Massive.com',
        delayed: false,
        staleAfterSeconds: 300, // 5 min cache
      }
    );
  } catch (error) {
    return {
      error: 'Calculation failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
```

#### 1.3 Backend: Add to AI Function Definitions
**File:** `/backend/src/chatkit/functions.ts`

**Action:** Add to functions array (around line 50):

```typescript
{
  name: 'get_fibonacci_levels',
  description: 'Calculate Fibonacci retracement levels for a symbol based on recent swing high/low. Use this when user asks about Fibonacci levels, retracement levels, or key support/resistance zones.',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock or index symbol (e.g., SPX, SPY, QQQ, AAPL)',
      },
      timeframe: {
        type: 'string',
        enum: ['daily', '1h', '15m', '5m'],
        description: 'Timeframe for calculating swing points (default: daily)',
      },
      lookback: {
        type: 'number',
        description: 'Number of bars to scan for swing high/low (default: 20, max: 100)',
      },
    },
    required: ['symbol'],
  },
},
```

#### 1.4 Backend: Unit Tests
**File:** `/backend/src/services/levels/calculators/__tests__/fibonacciRetracement.test.ts`

```typescript
import { calculateFibonacciRetracement, findClosestFibLevel } from '../fibonacciRetracement';
import { MassiveAggregate } from '../../../../config/massive';

describe('Fibonacci Retracement Calculator', () => {
  const createBar = (h: number, l: number, c: number, t: number = Date.now()): MassiveAggregate => ({
    o: (h + l) / 2,
    h,
    l,
    c,
    v: 1000000,
    t,
    n: 100,
    vw: c,
  });

  describe('calculateFibonacciRetracement', () => {
    it('should calculate retracement levels when price pulls back from high', () => {
      // Create bars: price goes from 100 to 120 (high), then pulls back to 110
      const bars: MassiveAggregate[] = [
        createBar(105, 100, 102),
        createBar(110, 105, 108),
        createBar(115, 110, 113),
        createBar(120, 115, 118), // swing high
        createBar(118, 113, 115), // pullback
        createBar(115, 110, 112), // more pullback
      ];

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);

      expect(fib.direction).toBe('retracement');
      expect(fib.swingHigh).toBe(120);
      expect(fib.swingLow).toBe(100);
      expect(fib.levels.level_0).toBe(120); // 0% = swing high
      expect(fib.levels.level_100).toBe(100); // 100% = swing low

      // Check key Fib levels
      const range = 120 - 100; // 20
      expect(fib.levels.level_236).toBeCloseTo(120 - (range * 0.236), 1); // ~115.28
      expect(fib.levels.level_382).toBeCloseTo(120 - (range * 0.382), 1); // ~112.36
      expect(fib.levels.level_500).toBeCloseTo(120 - (range * 0.500), 1); // 110
      expect(fib.levels.level_618).toBeCloseTo(120 - (range * 0.618), 1); // ~107.64
      expect(fib.levels.level_786).toBeCloseTo(120 - (range * 0.786), 1); // ~104.28
    });

    it('should calculate extension levels when price rallies from low', () => {
      // Create bars: price drops to 100 (low), then rallies to 115
      const bars: MassiveAggregate[] = [
        createBar(120, 115, 118),
        createBar(115, 110, 112),
        createBar(110, 105, 107),
        createBar(105, 100, 102), // swing low
        createBar(107, 102, 105), // rally start
        createBar(112, 107, 110), // rally continues
        createBar(117, 112, 115), // more rally
      ];

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);

      expect(fib.direction).toBe('extension');
      expect(fib.swingHigh).toBe(120);
      expect(fib.swingLow).toBe(100);
      expect(fib.levels.level_0).toBe(100); // 0% = swing low for extension
      expect(fib.levels.level_100).toBe(120); // 100% = swing high

      // Extension levels go upward
      const range = 120 - 100; // 20
      expect(fib.levels.level_236).toBeCloseTo(100 + (range * 0.236), 1);
      expect(fib.levels.level_618).toBeCloseTo(100 + (range * 0.618), 1);
    });

    it('should throw error with insufficient data', () => {
      const bars: MassiveAggregate[] = [createBar(100, 90, 95)];

      expect(() => {
        calculateFibonacciRetracement('TEST', bars, 'daily', 10);
      }).toThrow('Insufficient data');
    });

    it('should respect lookback parameter', () => {
      const bars: MassiveAggregate[] = Array.from({ length: 50 }, (_, i) =>
        createBar(100 + i, 90 + i, 95 + i)
      );

      const fib = calculateFibonacciRetracement('TEST', bars, 'daily', 10);
      expect(fib.lookbackBars).toBe(10);

      // Swing points should be within last 10 bars only
      expect(fib.swingHighIndex).toBeGreaterThanOrEqual(bars.length - 10);
    });
  });

  describe('findClosestFibLevel', () => {
    it('should find closest Fib level to current price', () => {
      const fib = calculateFibonacciRetracement(
        'TEST',
        [
          createBar(120, 100, 118),
          createBar(118, 110, 112),
        ],
        'daily',
        10
      );

      // Current price at 112 should be closest to 50% level (110)
      const closest = findClosestFibLevel(fib, 112);

      expect(closest.level).toBe('level_500');
      expect(closest.distance).toBeCloseTo(2, 1); // 112 - 110
    });
  });
});
```

#### 1.5 Frontend: Display Fib Levels on Chart
**File:** `/components/ai-coach/trading-chart.tsx`

**Action:** Add new state for Fib levels (around line 50):

```typescript
const [fibLevels, setFibLevels] = useState<FibonacciRetracement | null>(null);
```

**Action:** Add interface for FibonacciRetracement (top of file):

```typescript
interface FibonacciRetracement {
  levels: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_786: number;
    level_100: number;
  };
  direction: 'retracement' | 'extension';
  swingHigh: number;
  swingLow: number;
}
```

**Action:** Add function to fetch and display Fib levels (around line 200):

```typescript
/**
 * Fetch Fibonacci levels and add to chart
 */
const loadFibonacciLevels = useCallback(async () => {
  if (!symbol) return;

  try {
    // Call backend to get Fib levels
    const response = await fetch('/api/ai-coach/fibonacci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        timeframe: chartConfig.interval,
        lookback: 20
      }),
    });

    if (!response.ok) {
      console.warn('Failed to fetch Fibonacci levels');
      return;
    }

    const data = await response.json();
    setFibLevels(data);

    // Add Fib levels to TradingView chart
    if (chartRef.current?.chart) {
      const chart = chartRef.current.chart();

      // Clear existing Fib lines
      chart.getAllShapes()
        .filter((shape: any) => shape.name?.startsWith('fib_'))
        .forEach((shape: any) => chart.removeEntity(shape.id));

      // Add new Fib lines
      const fibLevels = [
        { name: '0%', value: data.levels.level_0, color: '#6366f1', width: 1 },
        { name: '23.6%', value: data.levels.level_236, color: '#8b5cf6', width: 1 },
        { name: '38.2%', value: data.levels.level_382, color: '#a78bfa', width: 2 },
        { name: '50%', value: data.levels.level_500, color: '#c4b5fd', width: 1 },
        { name: '61.8%', value: data.levels.level_618, color: '#a78bfa', width: 2 },
        { name: '78.6%', value: data.levels.level_786, color: '#8b5cf6', width: 1 },
        { name: '100%', value: data.levels.level_100, color: '#6366f1', width: 1 },
      ];

      fibLevels.forEach(level => {
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
      });
    }
  } catch (error) {
    console.error('Error loading Fibonacci levels:', error);
  }
}, [symbol, chartConfig.interval]);

// Load Fib levels when symbol/interval changes
useEffect(() => {
  if (chartReady && symbol) {
    loadFibonacciLevels();
  }
}, [chartReady, symbol, chartConfig.interval, loadFibonacciLevels]);
```

#### 1.6 Backend: Add Fibonacci API Endpoint
**File:** `/backend/src/routes/fibonacci.ts` (NEW FILE)

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { calculateFibonacciRetracement } from '../services/levels/calculators/fibonacciRetracement';
import { fetchDailyData, fetchIntradayData } from '../services/levels/fetcher';
import { isValidSymbol, normalizeSymbol } from '../lib/symbols';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/fibonacci
 * Calculate Fibonacci retracement levels for a symbol
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { symbol: rawSymbol, timeframe = 'daily', lookback = 20 } = req.body;

    if (!rawSymbol || typeof rawSymbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const symbol = normalizeSymbol(rawSymbol);
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    const validTimeframes = ['daily', '1h', '15m', '5m'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ error: 'Invalid timeframe' });
    }

    const lookbackNum = Number(lookback);
    if (!Number.isInteger(lookbackNum) || lookbackNum < 2 || lookbackNum > 100) {
      return res.status(400).json({ error: 'Lookback must be between 2 and 100' });
    }

    // Fetch bars
    const bars = timeframe === 'daily'
      ? await fetchDailyData(symbol, lookbackNum + 10)
      : await fetchIntradayData(symbol, timeframe);

    if (bars.length < 2) {
      return res.status(404).json({
        error: 'Insufficient data',
        message: `Not enough price data for ${symbol}`,
      });
    }

    // Calculate Fibonacci levels
    const fib = calculateFibonacciRetracement(symbol, bars, timeframe, lookbackNum);
    const currentPrice = bars[bars.length - 1].c;

    logger.info('Fibonacci levels calculated', {
      symbol,
      timeframe,
      lookback: lookbackNum,
      direction: fib.direction,
      currentPrice,
    });

    return res.json({
      ...fib,
      currentPrice: Number(currentPrice.toFixed(2)),
    });
  } catch (error) {
    logger.error('Fibonacci calculation failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(500).json({
      error: 'Calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
```

**File:** `/backend/src/routes/index.ts`

**Action:** Add Fibonacci route (around line 20):

```typescript
import fibonacciRouter from './fibonacci';

// ... existing routes ...

app.use('/api/fibonacci', fibonacciRouter);
```

### Phase 1 Testing Checklist
- [ ] Unit tests pass: `pnpm --dir backend test fibonacciRetracement.test.ts`
- [ ] Backend builds: `pnpm --dir backend build`
- [ ] API endpoint works: `curl -X POST http://localhost:3001/api/fibonacci -d '{"symbol":"SPX"}' -H "Content-Type: application/json"`
- [ ] Chart displays Fib lines correctly
- [ ] AI function call works: User asks "show me Fib levels for SPX" → levels returned

### Phase 1 Documentation Checklist
- [ ] All functions have JSDoc comments
- [ ] README updated with Fibonacci feature
- [ ] API endpoint documented in `/docs/api/fibonacci.md`

---

## Phase 2: Chart Label Enhancement

### Objective
Every level on the chart must have a clear label showing: type, price, distance from current price.

### Files to Modify

#### 2.1 Backend: Enhance Level Items with Display Metadata
**File:** `/backend/src/services/levels/index.ts`

**Action:** Update `LevelItem` interface (around line 21):

```typescript
export interface LevelItem {
  type: string;
  price: number;
  distance: number;
  distancePct: number;
  distanceATR: number;
  strength: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical';
  description: string;

  // NEW: Display metadata for chart labels
  displayLabel: string;      // e.g., "PDH $5,950.25"
  displayContext: string;     // e.g., "+0.5% / +1.2 ATR"
  side: 'resistance' | 'support'; // which side of current price

  // Level test tracking (added in Phase 3, placeholder for now)
  testsToday?: number;
  lastTest?: string | null;
  holdRate?: number | null;
}
```

**Action:** Add helper function to generate display labels (around line 100):

```typescript
/**
 * Generate human-readable display label for a level
 */
function generateDisplayLabel(
  type: string,
  price: number,
  distance: number,
  distancePct: number,
  distanceATR: number,
  side: 'resistance' | 'support'
): { label: string; context: string } {
  const directionSymbol = side === 'resistance' ? '↑' : '↓';
  const sign = distance > 0 ? '+' : '';

  const label = `${type} $${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const context = `${directionSymbol} ${sign}${distancePct.toFixed(2)}% / ${sign}${distanceATR.toFixed(2)} ATR`;

  return { label, context };
}
```

**Action:** Update level creation to include display metadata (around line 200 in `calculateLevels` function):

```typescript
// When creating resistance levels
resistance.push({
  type: 'PDH',
  price: previousDay.pdh,
  distance,
  distancePct,
  distanceATR,
  strength: determineLevelStrength(distanceATR),
  description: 'Previous Day High - strong resistance',
  displayLabel: `PDH $${previousDay.pdh.toFixed(2)}`,
  displayContext: `↑ +${distancePct.toFixed(2)}% / +${distanceATR.toFixed(2)} ATR`,
  side: 'resistance',
});

// Same for support levels with '↓' and appropriate sign
```

#### 2.2 Frontend: Enhanced Chart Labels Component
**File:** `/components/ai-coach/chart-level-labels.tsx` (NEW FILE)

```typescript
'use client'

import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface ChartLevel {
  type: string;
  price: number;
  displayLabel: string;
  displayContext: string;
  side: 'resistance' | 'support';
  strength: 'strong' | 'moderate' | 'weak' | 'critical' | 'dynamic';
  description: string;
  testsToday?: number;
  lastTest?: string | null;
  holdRate?: number | null;
}

interface ChartLevelLabelsProps {
  levels: ChartLevel[];
  currentPrice: number;
  onLevelClick?: (level: ChartLevel) => void;
}

const STRENGTH_COLORS = {
  critical: 'bg-red-500/20 border-red-500 text-red-300',
  strong: 'bg-orange-500/20 border-orange-500 text-orange-300',
  moderate: 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
  weak: 'bg-white/10 border-white/30 text-white/60',
  dynamic: 'bg-blue-500/20 border-blue-500 text-blue-300',
};

const SIDE_COLORS = {
  resistance: 'text-red-400',
  support: 'text-emerald-400',
};

export function ChartLevelLabels({ levels, currentPrice, onLevelClick }: ChartLevelLabelsProps) {
  // Sort levels by distance from current price (closest first)
  const sortedLevels = [...levels].sort((a, b) =>
    Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice)
  );

  return (
    <div className="absolute right-2 top-16 z-20 max-h-[calc(100vh-200px)] w-64 space-y-1 overflow-y-auto">
      <div className="mb-2 flex items-center gap-2 text-xs text-white/50">
        <span>Key Levels</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">
                Levels sorted by distance from current price.
                Click a level to highlight it on the chart.
                <br /><br />
                <strong>Colors:</strong><br />
                • Red: Resistance above<br />
                • Green: Support below<br />
                • Intensity: Proximity to price
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {sortedLevels.slice(0, 12).map((level, index) => (
        <LevelCard
          key={`${level.type}-${level.price}`}
          level={level}
          currentPrice={currentPrice}
          onClick={() => onLevelClick?.(level)}
        />
      ))}
    </div>
  );
}

function LevelCard({
  level,
  currentPrice,
  onClick
}: {
  level: ChartLevel;
  currentPrice: number;
  onClick: () => void;
}) {
  const distancePct = ((level.price - currentPrice) / currentPrice) * 100;
  const isClose = Math.abs(distancePct) < 1; // Within 1%

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'w-full rounded-md border p-2 text-left transition-all hover:scale-[1.02]',
              STRENGTH_COLORS[level.strength],
              isClose && 'ring-2 ring-white/30'
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-medium">
                {level.displayLabel}
              </span>
              <span className={cn('text-[10px]', SIDE_COLORS[level.side])}>
                {level.displayContext}
              </span>
            </div>

            {level.testsToday !== undefined && level.testsToday > 0 && (
              <div className="mt-1 text-[10px] text-white/50">
                Tested {level.testsToday}x today
                {level.holdRate !== null && ` (${(level.holdRate * 100).toFixed(0)}% hold rate)`}
              </div>
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-medium">{level.type}</p>
            <p className="text-white/70">{level.description}</p>

            {level.testsToday !== undefined && level.testsToday > 0 && (
              <>
                <p className="mt-2 border-t border-white/10 pt-2 text-white/60">
                  <strong>Today:</strong> {level.testsToday} test{level.testsToday > 1 ? 's' : ''}
                </p>
                {level.lastTest && (
                  <p className="text-white/60">
                    <strong>Last test:</strong> {new Date(level.lastTest).toLocaleTimeString()}
                  </p>
                )}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### 2.3 Frontend: Integrate Labels into Trading Chart
**File:** `/components/ai-coach/trading-chart.tsx`

**Action:** Import the new component (top of file):

```typescript
import { ChartLevelLabels, type ChartLevel } from './chart-level-labels';
```

**Action:** Add state for levels (around line 60):

```typescript
const [chartLevels, setChartLevels] = useState<ChartLevel[]>([]);
```

**Action:** Add function to load levels (around line 250):

```typescript
/**
 * Load key levels and update chart labels
 */
const loadKeyLevels = useCallback(async () => {
  if (!symbol) return;

  try {
    const response = await fetch('/api/ai-coach/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe: chartConfig.interval }),
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

    // Draw levels on TradingView chart
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

  // Clear existing level lines
  chart.getAllShapes()
    .filter((shape: any) => shape.name?.startsWith('level_'))
    .forEach((shape: any) => chart.removeEntity(shape.id));

  // Draw new level lines
  levels.forEach(level => {
    const color = level.side === 'resistance' ? '#ef4444' : '#10b981'; // red or green
    const lineWidth = level.strength === 'critical' ? 2 : 1;

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
  });
}, []);

// Load levels when chart is ready
useEffect(() => {
  if (chartReady && symbol) {
    loadKeyLevels();
  }
}, [chartReady, symbol, loadKeyLevels]);
```

**Action:** Add labels component to JSX (around line 600):

```tsx
{/* Level labels overlay */}
{chartLevels.length > 0 && currentPrice && (
  <ChartLevelLabels
    levels={chartLevels}
    currentPrice={currentPrice}
    onLevelClick={(level) => {
      // Highlight the clicked level on chart
      console.log('Clicked level:', level);
      // TODO: Add visual highlight on TradingView chart
    }}
  />
)}
```

### Phase 2 Testing Checklist
- [ ] Chart displays all levels with labels (PDH, PDL, R1, S1, VWAP, etc.)
- [ ] Labels show type + price + distance correctly
- [ ] Hover tooltips display full context
- [ ] Levels are color-coded (red=resistance, green=support)
- [ ] Critical levels (within 0.5 ATR) have thicker lines
- [ ] Dynamic levels (VWAP) are dashed lines

### Phase 2 Documentation Checklist
- [ ] Component documented: `/docs/components/chart-level-labels.md`
- [ ] Screenshots added to docs showing labeled chart
- [ ] User guide updated: "How to read chart levels"

---

## Phase 3: Level Test Tracking

### Objective
Track how many times price tested each level today, with timestamps and success rate.

### Files to Create/Modify

#### 3.1 Backend: Level Test Tracker Service
**File:** `/backend/src/services/levels/levelTestTracker.ts` (NEW FILE)

```typescript
import { MassiveAggregate } from '../../config/massive';
import { LevelItem } from './index';
import { logger } from '../../lib/logger';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface LevelTestEvent {
  timestamp: string;
  price: number;
  result: 'held' | 'broken';
  volume: number;
  barIndex: number;
}

export interface LevelTestHistory {
  level: string; // e.g., "PDH_5950"
  levelType: string;
  levelPrice: number;
  side: 'resistance' | 'support';
  testsToday: number;
  tests: LevelTestEvent[];
  holdRate: number; // 0-1
  lastTest: string | null;
  avgVolumeAtTest: number | null;
}

/**
 * Analyze how price interacted with levels throughout the day
 *
 * @param levels - Array of support/resistance levels
 * @param intradayBars - Intraday bars (5m, 15m, or 1h)
 * @param currentPrice - Current price
 * @returns Map of level key -> test history
 */
export async function analyzeLevelTests(
  symbol: string,
  levels: LevelItem[],
  intradayBars: MassiveAggregate[],
  currentPrice: number,
  cacheKey: string
): Promise<Map<string, LevelTestHistory>> {
  // Check cache first
  const cached = await getLevelTestsFromCache(cacheKey);
  if (cached) {
    logger.debug('Level tests loaded from cache', { symbol, cacheKey });
    return cached;
  }

  const testHistory = new Map<string, LevelTestHistory>();

  for (const level of levels) {
    const levelKey = `${level.type}_${level.price.toFixed(2)}`;
    const side: 'resistance' | 'support' = level.price > currentPrice ? 'resistance' : 'support';

    const tests = findLevelTests(level, intradayBars, side);

    if (tests.length === 0) {
      // No tests, skip
      continue;
    }

    const held = tests.filter(t => t.result === 'held').length;
    const holdRate = tests.length > 0 ? held / tests.length : 0;
    const avgVolume = tests.reduce((sum, t) => sum + t.volume, 0) / tests.length;

    testHistory.set(levelKey, {
      level: levelKey,
      levelType: level.type,
      levelPrice: level.price,
      side,
      testsToday: tests.length,
      tests,
      holdRate,
      lastTest: tests[tests.length - 1]?.timestamp || null,
      avgVolumeAtTest: avgVolume,
    });
  }

  // Cache for 5 minutes
  await cacheLevelTests(cacheKey, testHistory, 300);

  return testHistory;
}

/**
 * Find all instances where price tested a level
 *
 * Test criteria:
 * - For resistance: bar high within 0.15% of level
 * - For support: bar low within 0.15% of level
 *
 * Result determination:
 * - Held: Bar closes on correct side of level
 * - Broken: Bar closes on wrong side of level
 */
function findLevelTests(
  level: LevelItem,
  bars: MassiveAggregate[],
  side: 'resistance' | 'support'
): LevelTestEvent[] {
  const tests: LevelTestEvent[] = [];
  const threshold = level.price * 0.0015; // 0.15% tolerance

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    let touched = false;
    let result: 'held' | 'broken' = 'held';

    if (side === 'resistance') {
      // Check if bar high touched resistance
      touched = Math.abs(bar.h - level.price) <= threshold;

      if (touched) {
        // Did it hold? Close should be below level
        result = bar.c < level.price ? 'held' : 'broken';
      }
    } else {
      // Check if bar low touched support
      touched = Math.abs(bar.l - level.price) <= threshold;

      if (touched) {
        // Did it hold? Close should be above level
        result = bar.c > level.price ? 'held' : 'broken';
      }
    }

    if (touched) {
      tests.push({
        timestamp: new Date(bar.t).toISOString(),
        price: side === 'resistance' ? bar.h : bar.l,
        result,
        volume: bar.v,
        barIndex: i,
      });
    }
  }

  return tests;
}

/**
 * Cache level tests in Redis
 */
async function cacheLevelTests(
  key: string,
  tests: Map<string, LevelTestHistory>,
  ttlSeconds: number
): Promise<void> {
  try {
    const serialized = JSON.stringify(Array.from(tests.entries()));
    await redis.setex(`level_tests:${key}`, ttlSeconds, serialized);
  } catch (error) {
    logger.warn('Failed to cache level tests', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get level tests from Redis cache
 */
async function getLevelTestsFromCache(
  key: string
): Promise<Map<string, LevelTestHistory> | null> {
  try {
    const cached = await redis.get(`level_tests:${key}`);
    if (!cached) return null;

    const entries = JSON.parse(cached) as Array<[string, LevelTestHistory]>;
    return new Map(entries);
  } catch (error) {
    logger.warn('Failed to retrieve cached level tests', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get test summary for a specific level (used by AI)
 */
export function formatLevelTestSummary(history: LevelTestHistory): string {
  if (history.testsToday === 0) {
    return `${history.levelType} at $${history.levelPrice.toFixed(2)} has not been tested today.`;
  }

  const lastTestTime = history.lastTest
    ? new Date(history.lastTest).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : 'unknown';

  const holdPct = (history.holdRate * 100).toFixed(0);
  const resultDesc = history.holdRate >= 0.75
    ? 'strong level'
    : history.holdRate >= 0.5
    ? 'moderate level'
    : 'weak level';

  return `${history.levelType} at $${history.levelPrice.toFixed(2)} tested ${history.testsToday}x today (last: ${lastTestTime}). Held ${holdPct}% of tests (${resultDesc}).`;
}
```

#### 3.2 Backend: Enhance Level Calculation with Test Tracking
**File:** `/backend/src/services/levels/index.ts`

**Action:** Import the level test tracker (top of file):

```typescript
import { analyzeLevelTests, formatLevelTestSummary } from './levelTestTracker';
```

**Action:** Enhance `calculateLevels` function to include test history (around line 200):

```typescript
export async function calculateLevels(
  symbol: string,
  timeframe: string = 'intraday'
): Promise<LevelsResponse> {
  // ... existing cache check ...

  try {
    // Fetch data
    const [dailyData, preMarketData, intradayData] = await Promise.all([
      fetchDailyData(symbol, 10),
      fetchPreMarketData(symbol),
      fetchIntradayData(symbol, timeframe === 'daily' ? '1h' : '15m'),
    ]);

    // ... existing level calculations ...

    // NEW: Analyze level tests using intraday bars
    const allLevels = [...resistance, ...support];
    const cacheKey = `${symbol}:${timeframe}:${marketDate}`;
    const testHistory = await analyzeLevelTests(
      symbol,
      allLevels,
      intradayData,
      currentPrice,
      cacheKey
    );

    // Enrich levels with test data
    const enrichedResistance = resistance.map(level => {
      const levelKey = `${level.type}_${level.price.toFixed(2)}`;
      const history = testHistory.get(levelKey);

      return {
        ...level,
        testsToday: history?.testsToday || 0,
        lastTest: history?.lastTest || null,
        holdRate: history?.holdRate || null,
      };
    });

    const enrichedSupport = support.map(level => {
      const levelKey = `${level.type}_${level.price.toFixed(2)}`;
      const history = testHistory.get(levelKey);

      return {
        ...level,
        testsToday: history?.testsToday || 0,
        lastTest: history?.lastTest || null,
        holdRate: history?.holdRate || null,
      };
    });

    const result = {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice,
      levels: {
        resistance: enrichedResistance,
        support: enrichedSupport,
        pivots,
        indicators: { vwap, atr14, atr7 },
      },
      marketContext: getMarketContext(),
      cached: false,
      cacheExpiresAt: null,
    };

    // Cache the enriched result
    await cacheLevels(symbol, timeframe, result);

    return result;
  } catch (error) {
    logger.error('Level calculation failed', {
      symbol,
      timeframe,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

#### 3.3 Backend: Unit Tests for Level Test Tracker
**File:** `/backend/src/services/levels/__tests__/levelTestTracker.test.ts` (NEW FILE)

```typescript
import { analyzeLevelTests, formatLevelTestSummary } from '../levelTestTracker';
import { MassiveAggregate } from '../../../config/massive';
import { LevelItem } from '../index';

describe('Level Test Tracker', () => {
  const createBar = (h: number, l: number, c: number, v: number = 1000000): MassiveAggregate => ({
    o: (h + l) / 2,
    h,
    l,
    c,
    v,
    t: Date.now(),
    n: 100,
    vw: c,
  });

  const createLevel = (type: string, price: number): LevelItem => ({
    type,
    price,
    distance: 0,
    distancePct: 0,
    distanceATR: 0,
    strength: 'moderate',
    description: `${type} level`,
    displayLabel: `${type} $${price}`,
    displayContext: '',
    side: price > 100 ? 'resistance' : 'support',
  });

  describe('analyzeLevelTests', () => {
    it('should detect resistance test (held)', async () => {
      const resistance = createLevel('R1', 105);
      const bars = [
        createBar(103, 100, 102), // no test
        createBar(105.5, 102, 104), // test: high touched 105, closed below (held)
        createBar(104, 101, 103), // no test
      ];

      const history = await analyzeLevelTests(
        'TEST',
        [resistance],
        bars,
        102,
        'test_key_1'
      );

      const r1History = history.get('R1_105.00');
      expect(r1History).toBeDefined();
      expect(r1History!.testsToday).toBe(1);
      expect(r1History!.tests[0].result).toBe('held');
      expect(r1History!.holdRate).toBe(1.0);
    });

    it('should detect resistance test (broken)', async () => {
      const resistance = createLevel('R1', 105);
      const bars = [
        createBar(103, 100, 102), // no test
        createBar(107, 102, 106), // test: high touched 105, closed above (broken)
      ];

      const history = await analyzeLevelTests(
        'TEST',
        [resistance],
        bars,
        106,
        'test_key_2'
      );

      const r1History = history.get('R1_105.00');
      expect(r1History).toBeDefined();
      expect(r1History!.testsToday).toBe(1);
      expect(r1History!.tests[0].result).toBe('broken');
      expect(r1History!.holdRate).toBe(0.0);
    });

    it('should detect support test (held)', async () => {
      const support = createLevel('S1', 95);
      const bars = [
        createBar(100, 97, 99), // no test
        createBar(98, 94.5, 96), // test: low touched 95, closed above (held)
      ];

      const history = await analyzeLevelTests(
        'TEST',
        [support],
        bars,
        98,
        'test_key_3'
      );

      const s1History = history.get('S1_95.00');
      expect(s1History).toBeDefined();
      expect(s1History!.testsToday).toBe(1);
      expect(s1History!.tests[0].result).toBe('held');
      expect(s1History!.holdRate).toBe(1.0);
    });

    it('should detect multiple tests with mixed results', async () => {
      const resistance = createLevel('PDH', 110);
      const bars = [
        createBar(110.2, 108, 109), // test 1: held
        createBar(109, 107, 108),   // no test
        createBar(110.1, 108, 109), // test 2: held
        createBar(112, 109, 111),   // test 3: broken
      ];

      const history = await analyzeLevelTests(
        'TEST',
        [resistance],
        bars,
        111,
        'test_key_4'
      );

      const pdhHistory = history.get('PDH_110.00');
      expect(pdhHistory).toBeDefined();
      expect(pdhHistory!.testsToday).toBe(3);
      expect(pdhHistory!.holdRate).toBeCloseTo(2 / 3, 2); // 2 held, 1 broken
    });

    it('should handle levels with no tests', async () => {
      const resistance = createLevel('R2', 120);
      const bars = [
        createBar(105, 100, 103),
        createBar(106, 102, 105),
      ];

      const history = await analyzeLevelTests(
        'TEST',
        [resistance],
        bars,
        104,
        'test_key_5'
      );

      // Level not in map (no tests)
      expect(history.has('R2_120.00')).toBe(false);
    });
  });

  describe('formatLevelTestSummary', () => {
    it('should format summary for tested level', () => {
      const history = {
        level: 'PDH_5950',
        levelType: 'PDH',
        levelPrice: 5950,
        side: 'resistance' as const,
        testsToday: 3,
        tests: [],
        holdRate: 1.0,
        lastTest: '2026-02-10T14:30:00Z',
        avgVolumeAtTest: 500000,
      };

      const summary = formatLevelTestSummary(history);
      expect(summary).toContain('PDH at $5950.00');
      expect(summary).toContain('tested 3x today');
      expect(summary).toContain('Held 100% of tests');
      expect(summary).toContain('strong level');
    });

    it('should format summary for untested level', () => {
      const history = {
        level: 'R2_6000',
        levelType: 'R2',
        levelPrice: 6000,
        side: 'resistance' as const,
        testsToday: 0,
        tests: [],
        holdRate: 0,
        lastTest: null,
        avgVolumeAtTest: null,
      };

      const summary = formatLevelTestSummary(history);
      expect(summary).toContain('has not been tested today');
    });
  });
});
```

### Phase 3 Testing Checklist
- [ ] Unit tests pass: `pnpm --dir backend test levelTestTracker.test.ts`
- [ ] Level test data cached in Redis (verify with `redis-cli KEYS "level_tests:*"`)
- [ ] API returns test counts: `testsToday`, `lastTest`, `holdRate`
- [ ] Chart labels display test counts
- [ ] AI references test counts in analysis

### Phase 3 Documentation Checklist
- [ ] Level test tracking algorithm documented
- [ ] Redis cache strategy documented
- [ ] Test result criteria explained (held vs broken)

---

## Phase 4: AI Reasoning Enhancement

### Objective
AI must reference specific technical criteria in every analysis: test counts, volume, confluence, invalidation.

### Files to Modify

#### 4.1 Backend: Confluence Detector
**File:** `/backend/src/services/levels/confluenceDetector.ts` (NEW FILE)

```typescript
import { LevelsResponse } from './index';
import { FibonacciRetracement } from './calculators/fibonacciRetracement';

export interface ConfluenceZone {
  priceCenter: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  levelsInZone: Array<{
    type: string;
    price: number;
    source: 'key_levels' | 'fibonacci' | 'gex';
  }>;
  strength: 'strong' | 'moderate' | 'weak';
  side: 'resistance' | 'support';
  description: string;
}

/**
 * Detect confluence zones where multiple levels cluster together
 *
 * Confluence = when 2+ different level types are within 0.3% of each other
 * Examples:
 * - PDH + Fib 61.8% + GEX Max all within $5,948-$5,952
 * - VWAP + S1 + Fib 50% all near $5,920
 *
 * @param levels - Key support/resistance levels
 * @param fib - Fibonacci retracement levels (optional)
 * @param gexLevels - GEX levels (optional)
 * @param currentPrice - Current price
 * @returns Array of confluence zones
 */
export function detectConfluence(
  levels: LevelsResponse,
  fib?: FibonacciRetracement | null,
  gexLevels?: { flipPoint: number | null; maxGEXStrike: number | null } | null,
  currentPrice?: number
): ConfluenceZone[] {
  const allLevelPoints: Array<{ type: string; price: number; source: string }> = [];

  // Collect all levels
  for (const level of levels.levels.resistance) {
    allLevelPoints.push({ type: level.type, price: level.price, source: 'key_levels' });
  }
  for (const level of levels.levels.support) {
    allLevelPoints.push({ type: level.type, price: level.price, source: 'key_levels' });
  }

  // Add Fib levels
  if (fib) {
    for (const [levelName, levelPrice] of Object.entries(fib.levels)) {
      const fibName = levelName.replace('level_', '') + '%';
      allLevelPoints.push({ type: `Fib ${fibName}`, price: levelPrice, source: 'fibonacci' });
    }
  }

  // Add GEX levels
  if (gexLevels) {
    if (gexLevels.flipPoint) {
      allLevelPoints.push({ type: 'GEX Flip', price: gexLevels.flipPoint, source: 'gex' });
    }
    if (gexLevels.maxGEXStrike) {
      allLevelPoints.push({ type: 'GEX Max', price: gexLevels.maxGEXStrike, source: 'gex' });
    }
  }

  // Sort by price
  allLevelPoints.sort((a, b) => a.price - b.price);

  // Find clusters (levels within 0.3% of each other)
  const confluenceThreshold = 0.003; // 0.3%
  const zones: ConfluenceZone[] = [];
  const used = new Set<number>();

  for (let i = 0; i < allLevelPoints.length; i++) {
    if (used.has(i)) continue;

    const cluster = [allLevelPoints[i]];
    used.add(i);

    // Find all nearby levels
    for (let j = i + 1; j < allLevelPoints.length; j++) {
      if (used.has(j)) continue;

      const priceDiff = Math.abs(allLevelPoints[j].price - allLevelPoints[i].price);
      const priceDiffPct = priceDiff / allLevelPoints[i].price;

      if (priceDiffPct <= confluenceThreshold) {
        cluster.push(allLevelPoints[j]);
        used.add(j);
      }
    }

    // Only create confluence zone if 2+ levels
    if (cluster.length >= 2) {
      const prices = cluster.map(l => l.price);
      const priceCenter = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const priceRangeLow = Math.min(...prices);
      const priceRangeHigh = Math.max(...prices);

      const side: 'resistance' | 'support' = currentPrice
        ? (priceCenter > currentPrice ? 'resistance' : 'support')
        : 'resistance';

      const strength: 'strong' | 'moderate' | 'weak' =
        cluster.length >= 4 ? 'strong' :
        cluster.length >= 3 ? 'moderate' : 'weak';

      const levelTypes = cluster.map(l => l.type).join(' + ');

      zones.push({
        priceCenter: Number(priceCenter.toFixed(2)),
        priceRangeLow: Number(priceRangeLow.toFixed(2)),
        priceRangeHigh: Number(priceRangeHigh.toFixed(2)),
        levelsInZone: cluster.map(l => ({
          type: l.type,
          price: Number(l.price.toFixed(2)),
          source: l.source as 'key_levels' | 'fibonacci' | 'gex',
        })),
        strength,
        side,
        description: `${cluster.length}-way confluence: ${levelTypes} at $${priceCenter.toFixed(2)}`,
      });
    }
  }

  // Sort by strength (strongest first)
  return zones.sort((a, b) => {
    const strengthOrder = { strong: 3, moderate: 2, weak: 1 };
    return strengthOrder[b.strength] - strengthOrder[a.strength];
  });
}

/**
 * Format confluence zones for AI consumption
 */
export function formatConfluenceForAI(zones: ConfluenceZone[]): string {
  if (zones.length === 0) {
    return 'No significant confluence zones detected.';
  }

  const descriptions = zones.map(zone => {
    const levelNames = zone.levelsInZone.map(l => `${l.type} ($${l.price})`).join(', ');
    return `• ${zone.strength.toUpperCase()} ${zone.side} at $${zone.priceCenter} (${zone.levelsInZone.length} levels): ${levelNames}`;
  });

  return 'CONFLUENCE ZONES:\n' + descriptions.join('\n');
}
```

#### 4.2 Backend: Update AI System Prompt
**File:** `/backend/src/chatkit/systemPrompt.ts`

**Action:** Add reasoning rules section (around line 50):

```typescript
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

// Add to main system prompt
export const systemPrompt = `
You are TradeITM's AI Coach, a professional trading assistant specializing in SPX/SPY technical analysis.

${AI_REASONING_RULES}

... (rest of existing system prompt) ...
`;
```

#### 4.3 Backend: Enhance Function Handlers to Return Richer Context
**File:** `/backend/src/chatkit/functionHandlers.ts`

**Action:** Update `handleGetKeyLevels` to include confluence and test summaries (around line 200):

```typescript
async function handleGetKeyLevels(args: { symbol: string; timeframe?: string }): Promise<any> {
  const symbol = toValidSymbol(args.symbol);
  if (!symbol) return invalidSymbolError();

  const timeframe = args.timeframe || 'intraday';

  try {
    // Get levels with test tracking
    const levels = await withTimeout(
      () => calculateLevels(symbol, timeframe),
      FUNCTION_TIMEOUT_MS,
      'calculateLevels'
    );

    // Get Fibonacci levels (optional)
    let fib: FibonacciRetracement | null = null;
    try {
      const bars = timeframe === 'daily'
        ? await fetchDailyData(symbol, 30)
        : await fetchIntradayData(symbol, timeframe);

      if (bars.length >= 20) {
        fib = calculateFibonacciRetracement(symbol, bars, timeframe, 20);
      }
    } catch (fibError) {
      logger.warn('Fibonacci calculation skipped', {
        symbol,
        error: fibError instanceof Error ? fibError.message : String(fibError)
      });
    }

    // Detect confluence zones
    const confluenceZones = detectConfluence(levels, fib, null, levels.currentPrice);

    // Format level test summaries
    const testSummaries: string[] = [];
    for (const level of [...levels.levels.resistance, ...levels.levels.support]) {
      if (level.testsToday && level.testsToday > 0) {
        const summary = formatLevelTestSummary({
          level: `${level.type}_${level.price}`,
          levelType: level.type,
          levelPrice: level.price,
          side: level.price > levels.currentPrice ? 'resistance' : 'support',
          testsToday: level.testsToday,
          tests: [],
          holdRate: level.holdRate || 0,
          lastTest: level.lastTest || null,
          avgVolumeAtTest: null,
        });
        testSummaries.push(summary);
      }
    }

    return withFreshness(
      {
        ...levels,
        fibonacci: fib,
        confluenceZones,
        testSummaries,
        aiGuidance: {
          strongestResistance: levels.levels.resistance[0],
          strongestSupport: levels.levels.support[0],
          nearestConfluence: confluenceZones[0] || null,
          criticalLevels: [...levels.levels.resistance, ...levels.levels.support]
            .filter(l => l.strength === 'critical')
            .slice(0, 3),
        },
      },
      {
        asOf: new Date().toISOString(),
        source: 'Massive.com + derived calculations',
        delayed: false,
        staleAfterSeconds: 300,
      }
    );
  } catch (error) {
    logger.error('Key levels handler failed', {
      symbol,
      timeframe,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      error: 'Level calculation failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Phase 4 Testing Checklist
- [ ] AI responses include specific test counts ("tested 3 times")
- [ ] AI responses include timestamps ("tested at 9:45 AM, 11:20 AM")
- [ ] AI responses reference confluence ("triple confluence at $5,920")
- [ ] AI responses include invalidation criteria ("invalidates below $5,915")
- [ ] AI responses use ATR-based distances ("+1.8 ATR")
- [ ] Manual QA: 10 sample queries verify specific reasoning

### Phase 4 Documentation Checklist
- [ ] AI reasoning rules documented in `/docs/ai-coach/reasoning-framework.md`
- [ ] Example analyses added to docs
- [ ] Quality standards defined

---

## Phase 5: Educational Context (IV/GEX)

### Objective
Add tooltips and explanations to GEX/IV tools so users understand what they mean and how to use them.

### Files to Modify

#### 5.1 Frontend: GEX Chart Educational Enhancement
**File:** `/components/ai-coach/gex-chart.tsx`

**Action:** Add educational header with info tooltip (around line 93):

```tsx
<div className={cn('rounded-lg border border-white/10 bg-black/20 p-3', className)}>
  {/* Educational Header */}
  <div className="mb-3 flex items-start justify-between gap-2">
    <div>
      <h4 className="text-sm font-medium text-white/90">Gamma Exposure (GEX)</h4>
      <p className="mt-0.5 text-[10px] text-white/50">Dealer hedging pressure by strike</p>
    </div>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="rounded-full p-1 hover:bg-white/10">
            <Info className="h-3.5 w-3.5 text-white/50" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-sm">
          <div className="space-y-2 text-xs">
            <p className="font-medium">What is Gamma Exposure (GEX)?</p>
            <p>GEX measures how much dealers must buy or sell to hedge their options positions.</p>

            <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
              <div>
                <span className="font-medium text-emerald-300">Positive GEX (Green):</span>
                <p className="text-white/70">Dealers buy when price rises, sell when it falls → suppresses volatility → range-bound price action</p>
              </div>

              <div>
                <span className="font-medium text-red-300">Negative GEX (Red):</span>
                <p className="text-white/70">Dealers sell when price rises, buy when it falls → amplifies volatility → trending price action</p>
              </div>

              <div>
                <span className="font-medium text-yellow-300">GEX Flip Point:</span>
                <p className="text-white/70">Price where GEX changes from positive to negative. Below flip = high volatility zone.</p>
              </div>

              <div>
                <span className="font-medium text-violet-300">Max GEX Strike:</span>
                <p className="text-white/70">Strike with highest absolute GEX. Price tends to "pin" here intraday as dealers hedge.</p>
              </div>
            </div>

            <div className="mt-2 border-t border-white/10 pt-2">
              <p className="font-medium">How to Use:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-white/70">
                <li>Max GEX acts as intraday magnet</li>
                <li>Avoid shorts above Max GEX (high resistance)</li>
                <li>Below Flip Point = expect volatility</li>
                <li>Use with key levels for confluence</li>
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  {/* Rest of existing GEX chart JSX */}
  ...
</div>
```

#### 5.2 Frontend: IV Dashboard Educational Enhancement
**File:** `/components/ai-coach/iv-dashboard.tsx`

**Action:** Add educational panel at top of component (around line 50):

```tsx
{/* Educational Panel */}
<div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
  <div className="flex items-start gap-2">
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
    <div className="space-y-1 text-xs">
      <p className="font-medium text-blue-200">Implied Volatility (IV) Guide</p>
      <ul className="space-y-1 text-blue-200/80">
        <li>
          <strong>IV Rank:</strong> Where current IV sits vs 52-week range.
          <span className="ml-1 text-blue-200/60">
            0-25% = cheap options (good for buying) | 75-100% = expensive options (good for selling)
          </span>
        </li>
        <li>
          <strong>IV Term Structure:</strong> How IV changes across expiration dates.
          <span className="ml-1 text-blue-200/60">
            Upward slope = market expects future event | Downward slope = near-term event, then calm
          </span>
        </li>
        <li>
          <strong>Put/Call IV Skew:</strong> Difference between put and call IV.
          <span className="ml-1 text-blue-200/60">
            High put IV = fear/downside protection demand | High call IV = upside speculation
          </span>
        </li>
      </ul>
    </div>
  </div>
</div>

{/* Rest of existing IV dashboard JSX */}
```

#### 5.3 Frontend: Options Heatmap Legend
**File:** `/components/ai-coach/options-heatmap.tsx`

**Action:** Add legend explaining colors (around line 100):

```tsx
{/* Legend */}
<div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2">
  <p className="mb-2 text-xs font-medium text-white/70">How to Read This Heatmap:</p>
  <div className="grid grid-cols-2 gap-2 text-[10px]">
    <div>
      <span className="font-medium text-emerald-300">Dark Green:</span>
      <p className="text-white/60">High call open interest → resistance</p>
    </div>
    <div>
      <span className="font-medium text-red-300">Dark Red:</span>
      <p className="text-white/60">High put open interest → support</p>
    </div>
    <div>
      <span className="font-medium text-yellow-300">Yellow Highlight:</span>
      <p className="text-white/60">Max pain / high volume strikes</p>
    </div>
    <div>
      <span className="font-medium text-violet-300">Purple Highlight:</span>
      <p className="text-white/60">Max GEX strike (intraday magnet)</p>
    </div>
  </div>
  <p className="mt-2 text-[10px] text-white/50">
    Use this to identify where traders are positioned and potential pin levels for expiration.
  </p>
</div>
```

### Phase 5 Testing Checklist
- [ ] GEX chart has info tooltip with full explanation
- [ ] IV dashboard has educational panel at top
- [ ] Options heatmap has legend explaining colors
- [ ] Tooltips render correctly on hover
- [ ] Educational content is clear and concise

### Phase 5 Documentation Checklist
- [ ] User guide: "Understanding GEX" added to docs
- [ ] User guide: "How to Use IV Rank" added to docs
- [ ] Screenshots of tooltips added to docs

---

## Testing Requirements

### Unit Tests (Backend)
**Location:** `/backend/src/services/levels/calculators/__tests__/`

**Coverage Target:** 90%+ on new code

**Test Files:**
- `fibonacciRetracement.test.ts` (Phase 1)
- `levelTestTracker.test.ts` (Phase 3)
- `confluenceDetector.test.ts` (Phase 4)

**Run Command:**
```bash
pnpm --dir backend test
```

**Pass Criteria:**
- All tests pass
- Coverage > 90%
- No flaky tests

---

### Integration Tests (Backend)
**Location:** `/backend/src/routes/__tests__/`

**Test Files:**
- `fibonacci.test.ts` (API endpoint)
- `chat.test.ts` (AI function calls)

**Example Test:**
```typescript
describe('POST /api/fibonacci', () => {
  it('should return Fibonacci levels for valid symbol', async () => {
    const response = await request(app)
      .post('/api/fibonacci')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ symbol: 'SPX', timeframe: 'daily', lookback: 20 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('levels');
    expect(response.body.levels).toHaveProperty('level_618');
    expect(response.body.direction).toMatch(/^(retracement|extension)$/);
  });

  it('should return 400 for invalid symbol', async () => {
    const response = await request(app)
      .post('/api/fibonacci')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ symbol: 'INVALID!!!', timeframe: 'daily' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
```

---

### E2E Tests (Frontend + Backend)
**Location:** `/e2e/specs/ai-coach/`

**Test Files:**
- `fibonacci-levels.spec.ts` (Phase 1)
- `chart-labels.spec.ts` (Phase 2)
- `ai-reasoning.spec.ts` (Phase 4)

**Example E2E Test:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Coach - Fibonacci Levels', () => {
  test('should display Fibonacci levels on chart', async ({ page }) => {
    // Login
    await page.goto('/members/ai-coach');
    await page.waitForSelector('[data-testid="trading-chart"]');

    // Wait for chart to load
    await page.waitForTimeout(3000);

    // Check that Fib levels are displayed
    const fibLevels = await page.locator('[name^="fib_"]').count();
    expect(fibLevels).toBeGreaterThan(0);

    // Check that 61.8% level exists (golden ratio)
    const fib618 = await page.locator('[name="fib_61.8%"]');
    await expect(fib618).toBeVisible();
  });

  test('AI should reference Fibonacci levels in analysis', async ({ page }) => {
    await page.goto('/members/ai-coach');

    // Type question
    await page.fill('[data-testid="chat-input"]', 'Analyze SPX levels');
    await page.click('[data-testid="chat-submit"]');

    // Wait for AI response
    await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 });

    // Check that response mentions Fibonacci
    const responseText = await page.locator('[data-testid="ai-message"]').last().textContent();
    expect(responseText).toMatch(/fib(onacci)?/i);
    expect(responseText).toMatch(/61\.8%|golden ratio/i);
  });
});
```

**Run Command:**
```bash
pnpm exec playwright test e2e/specs/ai-coach/
```

---

### Manual QA Test Cases

**Phase 1: Fibonacci Retracement**
- [ ] Open AI Coach, symbol: SPX
- [ ] Verify Fib levels appear on chart (7 lines: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- [ ] Verify 61.8% and 38.2% are thicker than others (more important)
- [ ] Ask AI: "Show me Fibonacci levels for SPX"
- [ ] Verify AI response includes Fib levels with prices

**Phase 2: Chart Labels**
- [ ] Verify ALL levels have labels (PDH, PDL, R1, S1, VWAP, etc.)
- [ ] Hover over level → tooltip shows full context
- [ ] Verify color coding: red=resistance, green=support, yellow=GEX
- [ ] Verify critical levels (within 0.5 ATR) have thicker lines

**Phase 3: Level Test Tracking**
- [ ] Load chart at 11:00 AM (mid-session)
- [ ] Verify levels show test counts ("Tested 3x today")
- [ ] Hover over level → tooltip shows test timestamps
- [ ] Ask AI: "Has PDH been tested?" → AI mentions specific test count

**Phase 4: AI Reasoning**
- [ ] Ask AI: "Analyze SPX"
- [ ] Verify response includes:
  - [ ] Specific prices ("PDH at $5,950.25")
  - [ ] Test counts ("tested 3 times")
  - [ ] Timestamps ("tested at 9:45 AM, 11:20 AM")
  - [ ] Confluence ("triple confluence at $5,920")
  - [ ] Invalidation ("invalidates below $5,915")
  - [ ] ATR distances ("+1.8 ATR")

**Phase 5: Educational Context**
- [ ] Open GEX chart → click info icon → verify tooltip shows explanation
- [ ] Open IV dashboard → verify educational panel at top
- [ ] Open Options Heatmap → verify legend explains colors

---

## Documentation Requirements

### Code Documentation (JSDoc)

**Every new function must have JSDoc:**

```typescript
/**
 * Calculate Fibonacci retracement levels
 *
 * Determines recent swing high/low within lookback period and calculates
 * standard Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%).
 *
 * @param symbol - Stock or index symbol (e.g., "SPX", "SPY")
 * @param bars - Array of price bars (most recent last)
 * @param timeframe - Timeframe of bars ("daily", "1h", "15m", "5m")
 * @param lookback - Number of bars to scan for swing points (default: 20)
 * @returns FibonacciRetracement object with levels and metadata
 * @throws {Error} If bars.length < 2
 *
 * @example
 * const bars = await fetchDailyData("SPX", 30);
 * const fib = calculateFibonacciRetracement("SPX", bars, "daily", 20);
 * console.log(fib.levels.level_618); // 61.8% level (golden ratio)
 */
export function calculateFibonacciRetracement(
  symbol: string,
  bars: MassiveAggregate[],
  timeframe: string = 'daily',
  lookback: number = 20
): FibonacciRetracement {
  // ...
}
```

---

### API Documentation

**File:** `/docs/api/fibonacci.md`

```markdown
# Fibonacci Retracement API

## Endpoint
`POST /api/fibonacci`

## Description
Calculate Fibonacci retracement levels for a symbol based on recent swing high/low.

## Authentication
Requires JWT token in `Authorization: Bearer <token>` header.

## Request Body
```json
{
  "symbol": "SPX",
  "timeframe": "daily",
  "lookback": 20
}
```

## Response (200 OK)
```json
{
  "symbol": "SPX",
  "swingHigh": 5975.25,
  "swingHighIndex": 18,
  "swingLow": 5850.00,
  "swingLowIndex": 5,
  "timeframe": "daily",
  "lookbackBars": 20,
  "direction": "retracement",
  "levels": {
    "level_0": 5975.25,
    "level_236": 5945.63,
    "level_382": 5927.38,
    "level_500": 5912.63,
    "level_618": 5897.88,
    "level_786": 5876.63,
    "level_100": 5850.00
  },
  "currentPrice": 5920.00,
  "calculatedAt": "2026-02-10T15:30:00Z"
}
```

## Error Responses
- `400 Bad Request` - Invalid symbol or parameters
- `404 Not Found` - Insufficient data for symbol
- `500 Internal Server Error` - Calculation failed
```

---

### User Documentation

**File:** `/docs/user-guides/understanding-fibonacci-levels.md`

```markdown
# Understanding Fibonacci Retracement Levels

## What are Fibonacci Levels?

Fibonacci retracement levels are horizontal lines that indicate potential support and resistance levels based on the Fibonacci sequence (0, 1, 1, 2, 3, 5, 8, 13, 21...).

## Key Levels

- **23.6%** - Shallow retracement, strong trend
- **38.2%** - Common retracement in strong trends
- **50%** - Not a Fibonacci ratio, but widely watched
- **61.8%** - The "Golden Ratio" - most important level
- **78.6%** - Deep retracement, trend may be weakening

## How to Use

1. **Identify the Swing:** TradeITM automatically finds recent swing high/low
2. **Watch 61.8%:** The golden ratio is the strongest support/resistance
3. **Look for Confluence:** When Fib levels align with other levels (VWAP, pivots, GEX), they become stronger
4. **Use for Entries:** Enter trades when price bounces off key Fib levels

## Example

If SPX rallied from 5850 to 5975 and is pulling back:
- **61.8% level at 5897** - Watch for bounce here (strongest support)
- **50% level at 5912** - If it breaks 61.8%, next support
- **38.2% level at 5927** - Shallow retracement, trend still strong

## On the Chart

Fibonacci levels appear as purple horizontal lines. The 38.2% and 61.8% levels are thicker because they're most important.
```

---

## Deployment Plan

### Pre-Deployment Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass (at least 90%)
- [ ] Manual QA completed (all test cases)
- [ ] Code reviewed (if applicable)
- [ ] Documentation complete
- [ ] Performance tested (Fib calc < 100ms overhead)
- [ ] Redis cache tested (verify TTL works)
- [ ] Error handling tested (invalid symbols, missing data)

---

### Deployment Steps

#### Step 1: Deploy Backend (Zero-Downtime)
```bash
# 1. Build backend
cd backend
pnpm install
pnpm build

# 2. Run final test suite
pnpm test

# 3. Deploy to production (Railway auto-deploys from main)
git checkout main
git merge codex/production-hardening
git push origin main

# 4. Verify healthcheck
curl https://api.tradeitm.com/health
# Expected: {"status":"ok","timestamp":"..."}

# 5. Verify new endpoint
curl -X POST https://api.tradeitm.com/api/fibonacci \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"symbol":"SPX","timeframe":"daily","lookback":20}'
# Expected: Fibonacci levels JSON
```

#### Step 2: Deploy Frontend (Vercel)
```bash
# 1. Build frontend
cd /Users/natekahl/ITM-gd
pnpm install
pnpm build

# 2. Test locally
pnpm dev
# Navigate to http://localhost:3000/members/ai-coach
# Verify chart labels, Fib levels, tooltips

# 3. Deploy to Vercel (auto-deploys from main)
git push origin main

# 4. Verify production
# Visit https://tradeitm.com/members/ai-coach
# Test Fibonacci levels, chart labels, AI reasoning
```

#### Step 3: Database Migrations (if any)
```bash
# No new tables required for this enhancement
# Redis cache is ephemeral (no schema changes)
```

#### Step 4: Post-Deployment Verification
- [ ] Visit AI Coach in production
- [ ] Verify Fib levels appear on chart
- [ ] Verify chart labels display correctly
- [ ] Ask AI: "Analyze SPX" → verify specific reasoning
- [ ] Check GEX tooltip → verify educational content
- [ ] Monitor logs for errors (10 min)
- [ ] Check Redis cache hit rate: `redis-cli INFO stats | grep keyspace_hits`

---

### Monitoring & Observability

#### Metrics to Watch (First 24 Hours)
```bash
# Backend logs
tail -f /var/log/backend/app.log | grep -E "(fibonacci|level_tests|confluence)"

# Error rate
curl https://api.tradeitm.com/metrics | grep error_rate

# Redis cache hit rate
redis-cli INFO stats | grep keyspace_hits
# Target: >80% hit rate for level_tests cache

# API latency
curl https://api.tradeitm.com/metrics | grep p95_latency
# Target: <500ms for /api/fibonacci
```

#### Alerts to Set Up
- API error rate > 5% → Slack alert
- `/api/fibonacci` latency > 1s → Slack alert
- Redis connection failures → Slack alert
- E2E test failures → Slack alert

---

## Rollback Plan

### If Critical Bug Detected (P0)

**Symptoms:**
- AI Coach crashes
- Chart doesn't load
- Fibonacci calculation throws errors
- Redis cache causes memory issues

**Rollback Steps:**
```bash
# 1. Identify last known good commit
git log --oneline -10

# 2. Revert to previous commit
git revert <commit-hash>
git push origin main

# 3. Verify rollback in production (wait 2 min for deploy)
curl https://api.tradeitm.com/health

# 4. Notify team
# Post in Slack: "Rolled back AI Coach enhancements due to [issue]. Investigating."

# 5. Disable new features via feature flag (if implemented)
# Set environment variable: ENABLE_FIBONACCI_LEVELS=false
```

### If Minor Bug Detected (P1/P2)

**Examples:**
- Fibonacci levels slightly off
- Chart labels misaligned
- Tooltips not rendering

**Hot-Fix Steps:**
```bash
# 1. Create hot-fix branch
git checkout -b hotfix/fibonacci-calculation-fix

# 2. Fix bug, add test
# Edit backend/src/services/levels/calculators/fibonacciRetracement.ts
# Add regression test

# 3. Fast-track review + deploy
git commit -m "fix: correct Fibonacci 61.8% calculation"
git push origin hotfix/fibonacci-calculation-fix

# 4. Merge directly to main (bypass PR if urgent)
git checkout main
git merge hotfix/fibonacci-calculation-fix
git push origin main
```

---

## Quality Gates

### Phase Completion Criteria

**Phase 1 (Fibonacci Retracement) is DONE when:**
- [ ] Unit tests pass: `pnpm --dir backend test fibonacciRetracement.test.ts`
- [ ] API endpoint returns correct Fib levels for SPX, SPY, QQQ
- [ ] Chart displays 7 Fib lines (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- [ ] AI can call `get_fibonacci_levels` function successfully
- [ ] Documentation complete: API docs + user guide

**Phase 2 (Chart Labels) is DONE when:**
- [ ] All levels on chart have labels (100% coverage)
- [ ] Labels show type + price + distance
- [ ] Hover tooltips display full context
- [ ] Color coding works (red/green/yellow)
- [ ] Manual QA passes all test cases

**Phase 3 (Level Test Tracking) is DONE when:**
- [ ] Unit tests pass: `pnpm --dir backend test levelTestTracker.test.ts`
- [ ] Test data cached in Redis (verify with `redis-cli KEYS "level_tests:*"`)
- [ ] Chart labels show test counts ("Tested 3x today")
- [ ] API returns `testsToday`, `lastTest`, `holdRate` for all levels
- [ ] Manual QA: Level tested at 10 AM shows timestamp in tooltip

**Phase 4 (AI Reasoning) is DONE when:**
- [ ] AI responses include specific test counts (90% of queries)
- [ ] AI responses reference confluence when present
- [ ] AI responses include invalidation criteria
- [ ] AI responses use ATR-based distances
- [ ] Manual QA: 10 sample queries all pass quality check

**Phase 5 (Educational Context) is DONE when:**
- [ ] GEX chart has info tooltip with full explanation
- [ ] IV dashboard has educational panel
- [ ] Options heatmap has legend
- [ ] All tooltips render correctly (no layout issues)
- [ ] User can understand GEX/IV without external resources

---

### Production Readiness Checklist

**Before merging to `main`:**
- [ ] All 5 phases complete
- [ ] All unit tests pass (90%+ coverage)
- [ ] All integration tests pass
- [ ] E2E tests pass (90%+)
- [ ] Manual QA complete (all test cases)
- [ ] Performance tested (no regressions)
- [ ] Error handling tested (edge cases covered)
- [ ] Documentation complete (code + API + user guides)
- [ ] Redis cache tested (TTL works, no memory leaks)
- [ ] Observability added (logs, metrics, alerts)
- [ ] Rollback plan tested (can revert cleanly)
- [ ] Security reviewed (no new vulnerabilities)
- [ ] Accessibility tested (tooltips keyboard-accessible)

---

## Acceptance Criteria

### Functional Acceptance

**User Story 1: Fibonacci Retracement**
> As a trader, I want to see Fibonacci retracement levels on the chart so I can identify key support/resistance zones.

**Acceptance Criteria:**
- [ ] Chart displays 7 Fib levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- [ ] 61.8% and 38.2% levels are visually emphasized (thicker lines)
- [ ] Fib levels auto-calculate based on recent 20-bar swing
- [ ] AI references Fib levels in analysis

**User Story 2: Enhanced Chart Labels**
> As a trader, I want all levels clearly labeled so I know what each line represents.

**Acceptance Criteria:**
- [ ] Every level shows type + price (e.g., "PDH $5,950.25")
- [ ] Hover tooltip shows distance from current price
- [ ] Color coding: red=resistance, green=support, yellow=GEX
- [ ] Labels update in real-time as price moves

**User Story 3: Level Test Tracking**
> As a trader, I want to know how many times a level has been tested so I can gauge its strength.

**Acceptance Criteria:**
- [ ] Chart labels show test count (e.g., "Tested 3x today")
- [ ] Tooltip shows test timestamps (e.g., "9:45 AM, 11:20 AM, 2:15 PM")
- [ ] Tooltip shows hold rate (e.g., "100% hold rate")
- [ ] AI references test counts in analysis

**User Story 4: Specific AI Reasoning**
> As a trader, I want AI to give specific technical reasons (not generic descriptions) so I can trust the analysis.

**Acceptance Criteria:**
- [ ] AI mentions specific prices ("PDH at $5,950.25" not "near resistance")
- [ ] AI mentions test counts ("tested 3 times" with timestamps)
- [ ] AI mentions confluence ("triple confluence at $5,920")
- [ ] AI provides invalidation criteria ("invalidates below $5,915")
- [ ] AI uses ATR-based distances ("+1.8 ATR")

**User Story 5: Educational Context**
> As a user, I want tooltips explaining GEX/IV so I understand what these metrics mean.

**Acceptance Criteria:**
- [ ] GEX chart has info icon → tooltip explains positive/negative GEX
- [ ] IV dashboard has educational panel at top
- [ ] Options heatmap has legend explaining colors
- [ ] User can understand tools without Googling

---

### Non-Functional Acceptance

**Performance:**
- [ ] Fibonacci calculation adds <100ms to level calculation
- [ ] Chart renders with all labels in <2 seconds
- [ ] Redis cache hit rate >80%
- [ ] API p95 latency <500ms

**Reliability:**
- [ ] Error rate <1% (measured over 7 days)
- [ ] No crashes or unhandled exceptions
- [ ] Graceful degradation (if Redis down, levels still work without test tracking)

**Security:**
- [ ] All endpoints require authentication
- [ ] No sensitive data logged
- [ ] Input validation on all API endpoints

**Observability:**
- [ ] All new functions log timing metrics
- [ ] Errors logged with context (symbol, timeframe, user ID)
- [ ] Metrics exposed for monitoring (latency, error rate, cache hit rate)

---

## Implementation Notes for Codex

### Autonomous Execution Guidelines

**This spec is designed for Codex to execute autonomously. Follow these steps:**

1. **Read entire spec** before starting
2. **Execute phases sequentially** (1 → 2 → 3 → 4 → 5)
3. **Run tests after each phase** (don't wait until end)
4. **Write tests FIRST** (TDD approach where applicable)
5. **Document as you go** (add JSDoc comments immediately)
6. **Commit after each phase** with descriptive message
7. **Verify phase completion** against quality gates before moving to next phase

### When to Ask for Human Input

**DO NOT ask for input on:**
- Code structure decisions (follow existing patterns)
- Variable naming (use descriptive names)
- Algorithm choices (spec provides implementation details)
- Testing approach (follow test templates provided)

**DO ask for input if:**
- Spec is ambiguous or contradictory
- External dependency is missing (e.g., Redis not running)
- Design decision impacts user experience significantly
- Performance targets cannot be met (<100ms for Fib calc)
- Breaking change required (backward incompatibility)

### Error Handling Strategy

**For all new functions:**
```typescript
try {
  // Main logic
} catch (error) {
  logger.error('Function failed', {
    context: { symbol, timeframe, lookback },
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Return user-friendly error
  return {
    error: 'Calculation failed',
    message: 'Unable to calculate Fibonacci levels. Please try again.',
  };
}
```

**Never throw unhandled exceptions to the frontend.**

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **Fibonacci Retracement** | Horizontal lines indicating support/resistance based on Fibonacci ratios |
| **Confluence** | When multiple levels cluster together (within 0.3%), creating a stronger zone |
| **Level Test** | When price touches a level (within 0.15% tolerance) |
| **Hold Rate** | Percentage of times a level successfully acted as support/resistance |
| **ATR** | Average True Range - measure of volatility (average bar range over 14 periods) |
| **GEX** | Gamma Exposure - measure of dealer hedging pressure |
| **IV Rank** | Where current IV sits relative to 52-week range (0-100%) |

---

### Reference Files

**Key Files Modified:**
- `/backend/src/services/levels/calculators/fibonacciRetracement.ts` (NEW)
- `/backend/src/services/levels/levelTestTracker.ts` (NEW)
- `/backend/src/services/levels/confluenceDetector.ts` (NEW)
- `/backend/src/services/levels/index.ts` (MODIFIED)
- `/backend/src/chatkit/functionHandlers.ts` (MODIFIED)
- `/backend/src/chatkit/functions.ts` (MODIFIED)
- `/backend/src/chatkit/systemPrompt.ts` (MODIFIED)
- `/components/ai-coach/trading-chart.tsx` (MODIFIED)
- `/components/ai-coach/chart-level-labels.tsx` (NEW)
- `/components/ai-coach/gex-chart.tsx` (MODIFIED)
- `/components/ai-coach/iv-dashboard.tsx` (MODIFIED)

**Test Files:**
- `/backend/src/services/levels/calculators/__tests__/fibonacciRetracement.test.ts` (NEW)
- `/backend/src/services/levels/__tests__/levelTestTracker.test.ts` (NEW)
- `/e2e/specs/ai-coach/fibonacci-levels.spec.ts` (NEW)
- `/e2e/specs/ai-coach/chart-labels.spec.ts` (NEW)
- `/e2e/specs/ai-coach/ai-reasoning.spec.ts` (NEW)

---

### Success Indicators (Post-Launch)

**After 7 days in production, measure:**
- [ ] AI reasoning quality: >90% of responses include specific test counts
- [ ] User engagement: Time spent on AI Coach +20%
- [ ] User understanding: Support tickets about GEX/IV -30%
- [ ] Feature adoption: 70%+ of users enable Fib levels on chart
- [ ] Performance: p95 latency <500ms, error rate <1%

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-10 | 1.0 | Initial spec created | Claude (Sonnet 4.5) |

---

**END OF SPECIFICATION**

This document is ready for Codex autonomous execution. All phases, tests, documentation requirements, and quality gates are defined. Execute sequentially and verify each phase before proceeding.
