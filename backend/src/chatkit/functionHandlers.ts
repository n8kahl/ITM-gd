import { calculateLevels } from '../services/levels';
import { fetchIntradayData } from '../services/levels/fetcher';

/**
 * Function handlers - these execute when the AI calls a function
 * They return results that get fed back to the AI
 */

interface FunctionCall {
  name: string;
  arguments: string; // JSON string
}

export async function executeFunctionCall(functionCall: FunctionCall): Promise<any> {
  const { name, arguments: argsString } = functionCall;
  const args = JSON.parse(argsString);

  switch (name) {
    case 'get_key_levels':
      return await handleGetKeyLevels(args);

    case 'get_current_price':
      return await handleGetCurrentPrice(args);

    case 'get_market_status':
      return await handleGetMarketStatus(args);

    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

/**
 * Handler: get_key_levels
 * Calls the levels calculation engine
 */
async function handleGetKeyLevels(args: { symbol: string; timeframe?: string }) {
  const { symbol, timeframe = 'intraday' } = args;

  try {
    // Call the levels service
    const levels = await calculateLevels(symbol, timeframe);

    // Return simplified response for AI (remove some metadata)
    return {
      symbol: levels.symbol,
      currentPrice: levels.currentPrice,
      levels: {
        resistance: levels.levels.resistance.slice(0, 5), // Top 5 resistance levels
        support: levels.levels.support.slice(0, 5), // Top 5 support levels
        pivots: levels.levels.pivots,
        indicators: levels.levels.indicators
      },
      marketContext: levels.marketContext,
      timestamp: levels.timestamp
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch levels',
      message: error.message
    };
  }
}

/**
 * Handler: get_current_price
 * Gets the most recent price from intraday data
 */
async function handleGetCurrentPrice(args: { symbol: string }) {
  const { symbol } = args;

  try {
    // Fetch intraday data
    const intradayData = await fetchIntradayData(symbol);

    if (intradayData.length === 0) {
      return {
        error: 'No price data available',
        message: 'Market may be closed or data unavailable'
      };
    }

    // Get most recent candle
    const latestCandle = intradayData[intradayData.length - 1];

    return {
      symbol,
      price: latestCandle.c,
      timestamp: new Date(latestCandle.t).toISOString(),
      high: latestCandle.h,
      low: latestCandle.l,
      volume: latestCandle.v
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch current price',
      message: error.message
    };
  }
}

/**
 * Handler: get_market_status
 * Determines if market is open, pre-market, after-hours, or closed
 */
async function handleGetMarketStatus(args: any) {
  const now = new Date();
  const hour = now.getUTCHours() - 5; // Convert to ET (simplified, no DST)
  const minute = now.getUTCMinutes();
  const timeInMinutes = hour * 60 + minute;
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'closed',
      session: 'weekend',
      nextOpen: 'Monday 9:30 AM ET',
      message: 'Markets are closed for the weekend'
    };
  }

  // Pre-market: 4:00 AM - 9:30 AM (240 - 570 minutes)
  if (timeInMinutes >= 240 && timeInMinutes < 570) {
    const minutesUntilOpen = 570 - timeInMinutes;
    const hoursUntilOpen = Math.floor(minutesUntilOpen / 60);
    const minsUntilOpen = minutesUntilOpen % 60;

    return {
      status: 'pre-market',
      session: 'extended',
      timeUntilOpen: `${hoursUntilOpen}h ${minsUntilOpen}m`,
      message: 'Pre-market session is active'
    };
  }

  // Regular hours: 9:30 AM - 4:00 PM (570 - 960 minutes)
  if (timeInMinutes >= 570 && timeInMinutes <= 960) {
    const minutesSinceOpen = timeInMinutes - 570;
    const hours = Math.floor(minutesSinceOpen / 60);
    const mins = minutesSinceOpen % 60;

    return {
      status: 'open',
      session: 'regular',
      timeSinceOpen: `${hours}h ${mins}m`,
      message: 'Market is open for regular trading'
    };
  }

  // After-hours: 4:00 PM - 8:00 PM (960 - 1200 minutes)
  if (timeInMinutes > 960 && timeInMinutes < 1200) {
    return {
      status: 'after-hours',
      session: 'extended',
      message: 'After-hours session is active'
    };
  }

  // Closed: 8:00 PM - 4:00 AM
  return {
    status: 'closed',
    session: 'none',
    nextOpen: 'Tomorrow 4:00 AM ET (pre-market)',
    message: 'Markets are closed'
  };
}
