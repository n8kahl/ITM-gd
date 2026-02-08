import { getAggregates, MassiveAggregate } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

/**
 * Chart data service for weekly/monthly timeframes
 * Provides multi-year historical data with calculated indicators (EMAs, pivots)
 */

export interface ChartCandle {
  time: number;     // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartIndicators {
  ema50: number | null;
  ema200: number | null;
  pivots: {
    pp: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } | null;
}

export interface ChartDataResult {
  symbol: string;
  timeframe: 'weekly' | 'monthly';
  currentPrice: number;
  candles: ChartCandle[];
  indicators: ChartIndicators;
  count: number;
  timestamp: string;
  cached: boolean;
}

function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('I:')) return symbol;
  if (symbol === 'SPX' || symbol === 'NDX') return `I:${symbol}`;
  return symbol;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;

  const multiplier = 2 / (period + 1);

  // Start with SMA for the first 'period' values
  let ema = closes.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

  // Apply EMA formula for remaining values
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(2));
}

/**
 * Calculate pivot points from the most recent completed candle
 */
export function calculatePivots(candles: ChartCandle[]): ChartIndicators['pivots'] {
  if (candles.length < 2) return null;

  // Use the previous completed candle (not the current in-progress one)
  const prev = candles[candles.length - 2];
  const h = prev.high;
  const l = prev.low;
  const c = prev.close;

  const pp = (h + l + c) / 3;

  return {
    pp: Number(pp.toFixed(2)),
    r1: Number((2 * pp - l).toFixed(2)),
    r2: Number((pp + (h - l)).toFixed(2)),
    s1: Number((2 * pp - h).toFixed(2)),
    s2: Number((pp - (h - l)).toFixed(2)),
  };
}

/**
 * Fetch weekly or monthly chart data with indicators
 */
export async function getChartData(
  symbol: string,
  timeframe: 'weekly' | 'monthly',
  bars: number = 260
): Promise<ChartDataResult> {
  const cacheKey = `chart:${symbol}:${timeframe}:${bars}`;
  const cacheTTL = timeframe === 'weekly' ? 3600 : 7200; // 1h weekly, 2h monthly

  // Check cache
  const cached = await cacheGet<ChartDataResult>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const ticker = normalizeSymbol(symbol);
  const timespan = timeframe === 'weekly' ? 'week' : 'month';

  // Calculate date range for enough bars
  const yearsBack = timeframe === 'weekly'
    ? Math.ceil(bars / 52) + 1  // ~52 weeks/year
    : Math.ceil(bars / 12) + 1; // ~12 months/year

  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - yearsBack);

  const response = await getAggregates(
    ticker,
    1,
    timespan,
    from.toISOString().split('T')[0],
    to.toISOString().split('T')[0]
  );

  const allResults = response.results || [];
  const results = allResults.slice(-bars); // Take the most recent N bars

  const candles: ChartCandle[] = results.map((bar: MassiveAggregate) => ({
    time: Math.floor(bar.t / 1000),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));

  // Calculate indicators
  const closes = candles.map(c => c.close);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const pivots = calculatePivots(candles);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  const result: ChartDataResult = {
    symbol,
    timeframe,
    currentPrice,
    candles,
    indicators: { ema50, ema200, pivots },
    count: candles.length,
    timestamp: new Date().toISOString(),
    cached: false,
  };

  await cacheSet(cacheKey, result, cacheTTL);

  return result;
}

/**
 * Get long-term trend analysis from weekly/monthly data
 */
export interface TrendAnalysis {
  symbol: string;
  timeframe: 'weekly' | 'monthly';
  currentPrice: number;
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  ema50: number | null;
  ema200: number | null;
  ema50Status: 'above' | 'below' | 'unknown';
  ema200Status: 'above' | 'below' | 'unknown';
  nextResistance: { price: number; description: string; distance: number } | null;
  keySupport: { price: number; description: string; distance: number } | null;
  interpretation: string;
}

export async function analyzeLongTermTrend(
  symbol: string,
  timeframe: 'weekly' | 'monthly' = 'weekly'
): Promise<TrendAnalysis> {
  const chartData = await getChartData(symbol, timeframe);
  const { currentPrice, indicators, candles } = chartData;
  const { ema50, ema200, pivots } = indicators;

  // Determine EMA status
  const ema50Status = ema50 ? (currentPrice > ema50 ? 'above' : 'below') : 'unknown';
  const ema200Status = ema200 ? (currentPrice > ema200 ? 'above' : 'below') : 'unknown';

  // Determine trend
  let trendDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema50Status === 'above' && ema200Status === 'above') {
    trendDirection = 'bullish';
  } else if (ema50Status === 'below' && ema200Status === 'below') {
    trendDirection = 'bearish';
  }

  // Find resistance and support from recent candles
  let nextResistance: TrendAnalysis['nextResistance'] = null;
  let keySupport: TrendAnalysis['keySupport'] = null;

  if (candles.length > 10) {
    // Find recent highs above current price
    const recentHighs = candles
      .slice(-52) // Last year of weekly data
      .filter(c => c.high > currentPrice)
      .sort((a, b) => a.high - b.high);

    if (recentHighs.length > 0) {
      const nearest = recentHighs[0];
      nextResistance = {
        price: nearest.high,
        description: `${timeframe === 'weekly' ? 'Weekly' : 'Monthly'} high`,
        distance: Number((nearest.high - currentPrice).toFixed(2)),
      };
    }

    // Find recent lows below current price
    const recentLows = candles
      .slice(-52)
      .filter(c => c.low < currentPrice)
      .sort((a, b) => b.low - a.low);

    if (recentLows.length > 0) {
      const nearest = recentLows[0];
      keySupport = {
        price: nearest.low,
        description: `${timeframe === 'weekly' ? 'Weekly' : 'Monthly'} support`,
        distance: Number((nearest.low - currentPrice).toFixed(2)),
      };
    }

    // Override with EMA-based support if applicable
    if (ema50 && ema50 < currentPrice && ema50 > (keySupport?.price || 0)) {
      keySupport = {
        price: ema50,
        description: `50-${timeframe === 'weekly' ? 'week' : 'month'} EMA`,
        distance: Number((ema50 - currentPrice).toFixed(2)),
      };
    }
  }

  // Use pivots for resistance/support if available
  if (pivots) {
    if (!nextResistance && pivots.r1 > currentPrice) {
      nextResistance = {
        price: pivots.r1,
        description: `${timeframe === 'weekly' ? 'Weekly' : 'Monthly'} R1 pivot`,
        distance: Number((pivots.r1 - currentPrice).toFixed(2)),
      };
    }
    if (!keySupport && pivots.s1 < currentPrice) {
      keySupport = {
        price: pivots.s1,
        description: `${timeframe === 'weekly' ? 'Weekly' : 'Monthly'} S1 pivot`,
        distance: Number((pivots.s1 - currentPrice).toFixed(2)),
      };
    }
  }

  // Build interpretation
  const parts: string[] = [];
  parts.push(`${symbol} is in a ${trendDirection} trend on the ${timeframe} timeframe.`);

  if (ema50) parts.push(`Price is ${ema50Status} the 50-period EMA ($${ema50}).`);
  if (ema200) parts.push(`Price is ${ema200Status} the 200-period EMA ($${ema200}).`);
  if (nextResistance) parts.push(`Next resistance at $${nextResistance.price} (${nextResistance.description}).`);
  if (keySupport) parts.push(`Key support at $${keySupport.price} (${keySupport.description}).`);

  return {
    symbol,
    timeframe,
    currentPrice,
    trendDirection,
    ema50,
    ema200,
    ema50Status,
    ema200Status,
    nextResistance,
    keySupport,
    interpretation: parts.join(' '),
  };
}
