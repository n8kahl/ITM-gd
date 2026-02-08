import { logger } from '../../lib/logger';
import { getDailyAggregates, getMinuteAggregates, MassiveAggregate } from '../../config/massive';
import { isTradingDay, getETOffset } from '../marketHours';

// Known index symbols that need the I: prefix for Massive.com aggregates
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'VIX', 'RUT', 'COMP', 'DJIA']);

// Normalize symbol to Massive.com ticker format (SPX -> I:SPX, AAPL stays AAPL)
function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('I:')) {
    return symbol;
  }
  if (INDEX_SYMBOLS.has(symbol)) {
    return `I:${symbol}`;
  }
  return symbol;
}

// Get dates for fetching historical data
function getDateRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
}

// Fetch daily historical data (for PDH/PDL/PDC, pivots, ATR)
export async function fetchDailyData(symbol: string, daysBack: number = 30): Promise<MassiveAggregate[]> {
  const ticker = normalizeSymbol(symbol);
  const { from, to } = getDateRange(daysBack);

  logger.info(`Fetching daily data for ${ticker} from ${from} to ${to}`);

  try {
    const data = await getDailyAggregates(ticker, from, to);
    logger.info(`Fetched ${data.length} daily bars for ${ticker}`);
    return data;
  } catch (error: any) {
    logger.error(`Failed to fetch daily data for ${ticker}`, { error: error.message });
    throw new Error(`Failed to fetch daily data: ${error.message}`);
  }
}

// Fetch minute data for a specific date (for PMH/PML)
export async function fetchPreMarketData(symbol: string, date?: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeSymbol(symbol);
  const targetDate = date || new Date().toISOString().split('T')[0];

  logger.info(`Fetching pre-market data for ${ticker} on ${targetDate}`);

  try {
    const data = await getMinuteAggregates(ticker, targetDate);

    // Filter for pre-market hours (4:00 AM - 9:30 AM ET) with DST awareness
    const preMarketData = data.filter(candle => {
      const date = new Date(candle.t);
      const offset = getETOffset(date);
      const hours = date.getUTCHours() + offset;
      const minutes = date.getUTCMinutes();
      const timeInMinutes = hours * 60 + minutes;

      // Pre-market: 4:00 AM (240 min) to 9:30 AM (570 min)
      return timeInMinutes >= 240 && timeInMinutes < 570;
    });

    logger.info(`Fetched ${preMarketData.length} pre-market bars for ${ticker}`);
    return preMarketData;
  } catch (error: any) {
    logger.error(`Failed to fetch pre-market data for ${ticker}`, { error: error.message });
    throw new Error(`Failed to fetch pre-market data: ${error.message}`);
  }
}

// Fetch intraday minute data (for VWAP)
export async function fetchIntradayData(symbol: string, date?: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeSymbol(symbol);
  const targetDate = date || new Date().toISOString().split('T')[0];

  logger.info(`Fetching intraday data for ${ticker} on ${targetDate}`);

  try {
    const data = await getMinuteAggregates(ticker, targetDate);

    // Filter for regular market hours (9:30 AM - 4:00 PM ET) with DST awareness
    const intradayData = data.filter(candle => {
      const date = new Date(candle.t);
      const offset = getETOffset(date);
      const hours = date.getUTCHours() + offset;
      const minutes = date.getUTCMinutes();
      const timeInMinutes = hours * 60 + minutes;

      // Regular hours: 9:30 AM (570 min) to 4:00 PM (960 min)
      return timeInMinutes >= 570 && timeInMinutes <= 960;
    });

    logger.info(`Fetched ${intradayData.length} intraday bars for ${ticker}`);
    return intradayData;
  } catch (error: any) {
    logger.error(`Failed to fetch intraday data for ${ticker}`, { error: error.message });
    throw new Error(`Failed to fetch intraday data: ${error.message}`);
  }
}

// Get the most recent complete trading day (skips weekends and holidays)
export function getPreviousTradingDay(): Date {
  const today = new Date();
  let candidate = new Date(today);
  candidate.setDate(candidate.getDate() - 1);

  // Walk backwards up to 10 days to find a valid trading day
  for (let i = 0; i < 10; i++) {
    if (isTradingDay(candidate)) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() - 1);
  }

  // Fallback: return yesterday if no trading day found within 10 days
  const fallback = new Date(today);
  fallback.setDate(fallback.getDate() - 1);
  return fallback;
}
