import { getDailyAggregates, getMinuteAggregates, MassiveAggregate } from '../../config/massive';

// Convert Massive.com ticker format (I:SPX -> SPX)
function normalizeSymbol(symbol: string): string {
  // Remove index prefix if present
  if (symbol.startsWith('I:')) {
    return symbol;
  }
  // Add index prefix for SPX and NDX
  if (symbol === 'SPX' || symbol === 'NDX') {
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

  console.log(`Fetching daily data for ${ticker} from ${from} to ${to}`);

  try {
    const data = await getDailyAggregates(ticker, from, to);
    console.log(`Fetched ${data.length} daily bars for ${ticker}`);
    return data;
  } catch (error: any) {
    console.error(`Failed to fetch daily data for ${ticker}:`, error.message);
    throw new Error(`Failed to fetch daily data: ${error.message}`);
  }
}

// Fetch minute data for a specific date (for PMH/PML)
export async function fetchPreMarketData(symbol: string, date?: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeSymbol(symbol);
  const targetDate = date || new Date().toISOString().split('T')[0];

  console.log(`Fetching pre-market data for ${ticker} on ${targetDate}`);

  try {
    const data = await getMinuteAggregates(ticker, targetDate);

    // Filter for pre-market hours (4:00 AM - 9:30 AM ET)
    // Convert timestamps to ET and filter
    const preMarketData = data.filter(candle => {
      const date = new Date(candle.t);
      const hours = date.getUTCHours() - 5; // Convert to ET (simplified, doesn't handle DST)
      const minutes = date.getUTCMinutes();
      const timeInMinutes = hours * 60 + minutes;

      // Pre-market: 4:00 AM (240 min) to 9:30 AM (570 min)
      return timeInMinutes >= 240 && timeInMinutes < 570;
    });

    console.log(`Fetched ${preMarketData.length} pre-market bars for ${ticker}`);
    return preMarketData;
  } catch (error: any) {
    console.error(`Failed to fetch pre-market data for ${ticker}:`, error.message);
    throw new Error(`Failed to fetch pre-market data: ${error.message}`);
  }
}

// Fetch intraday minute data (for VWAP)
export async function fetchIntradayData(symbol: string, date?: string): Promise<MassiveAggregate[]> {
  const ticker = normalizeSymbol(symbol);
  const targetDate = date || new Date().toISOString().split('T')[0];

  console.log(`Fetching intraday data for ${ticker} on ${targetDate}`);

  try {
    const data = await getMinuteAggregates(ticker, targetDate);

    // Filter for regular market hours (9:30 AM - 4:00 PM ET)
    const intradayData = data.filter(candle => {
      const date = new Date(candle.t);
      const hours = date.getUTCHours() - 5; // Convert to ET (simplified)
      const minutes = date.getUTCMinutes();
      const timeInMinutes = hours * 60 + minutes;

      // Regular hours: 9:30 AM (570 min) to 4:00 PM (960 min)
      return timeInMinutes >= 570 && timeInMinutes <= 960;
    });

    console.log(`Fetched ${intradayData.length} intraday bars for ${ticker}`);
    return intradayData;
  } catch (error: any) {
    console.error(`Failed to fetch intraday data for ${ticker}:`, error.message);
    throw new Error(`Failed to fetch intraday data: ${error.message}`);
  }
}

// Get the most recent complete trading day
export function getPreviousTradingDay(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // If today is Monday (1), go back to Friday (3 days)
  // If today is Sunday (0), go back to Friday (2 days)
  // Otherwise, go back 1 day
  let daysBack = 1;
  if (dayOfWeek === 1) daysBack = 3; // Monday -> Friday
  if (dayOfWeek === 0) daysBack = 2; // Sunday -> Friday

  const previousDay = new Date(today);
  previousDay.setDate(previousDay.getDate() - daysBack);
  return previousDay;
}
