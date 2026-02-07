import { calculateLevels } from '../services/levels';
import { fetchIntradayData } from '../services/levels/fetcher';
import { fetchOptionsChain } from '../services/options/optionsChainFetcher';
import { analyzePosition, analyzePortfolio } from '../services/options/positionAnalyzer';
import { Position } from '../services/options/types';

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

    case 'get_options_chain':
      return await handleGetOptionsChain(args);

    case 'analyze_position':
      return await handleAnalyzePosition(args);

    case 'show_chart':
      return await handleShowChart(args);

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
async function handleGetMarketStatus(_args: any) {
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

/**
 * Handler: get_options_chain
 * Fetches options chain with Greeks and IV
 */
async function handleGetOptionsChain(args: {
  symbol: string;
  expiry?: string;
  strikeRange?: number;
}) {
  const { symbol, expiry, strikeRange = 10 } = args;

  try {
    const chain = await fetchOptionsChain(symbol, expiry, strikeRange);

    // Simplify for AI - return only most relevant data
    return {
      symbol: chain.symbol,
      currentPrice: chain.currentPrice,
      expiry: chain.expiry,
      daysToExpiry: chain.daysToExpiry,
      ivRank: chain.ivRank,
      calls: chain.options.calls.map(c => ({
        strike: c.strike,
        last: c.last,
        bid: c.bid,
        ask: c.ask,
        volume: c.volume,
        openInterest: c.openInterest,
        iv: (c.impliedVolatility * 100).toFixed(1) + '%',
        delta: c.delta?.toFixed(2),
        gamma: c.gamma?.toFixed(4),
        theta: c.theta?.toFixed(2),
        vega: c.vega?.toFixed(2),
        inTheMoney: c.inTheMoney
      })),
      puts: chain.options.puts.map(p => ({
        strike: p.strike,
        last: p.last,
        bid: p.bid,
        ask: p.ask,
        volume: p.volume,
        openInterest: p.openInterest,
        iv: (p.impliedVolatility * 100).toFixed(1) + '%',
        delta: p.delta?.toFixed(2),
        gamma: p.gamma?.toFixed(4),
        theta: p.theta?.toFixed(2),
        vega: p.vega?.toFixed(2),
        inTheMoney: p.inTheMoney
      }))
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch options chain',
      message: error.message
    };
  }
}

/**
 * Handler: analyze_position
 * Analyzes position(s) for P&L, Greeks, and risk
 */
async function handleAnalyzePosition(args: {
  position?: Position;
  positions?: Position[];
}) {
  const { position, positions } = args;

  try {
    // Single position analysis
    if (position) {
      const analysis = await analyzePosition(position);

      return {
        position: {
          symbol: analysis.position.symbol,
          type: analysis.position.type,
          strike: analysis.position.strike,
          expiry: analysis.position.expiry,
          quantity: analysis.position.quantity,
          entryPrice: analysis.position.entryPrice,
          entryDate: analysis.position.entryDate
        },
        currentValue: `$${analysis.currentValue.toFixed(2)}`,
        costBasis: `$${analysis.costBasis.toFixed(2)}`,
        pnl: `$${analysis.pnl.toFixed(2)}`,
        pnlPct: `${analysis.pnlPct.toFixed(2)}%`,
        daysHeld: analysis.daysHeld,
        daysToExpiry: analysis.daysToExpiry,
        breakeven: analysis.breakeven,
        maxGain: typeof analysis.maxGain === 'number'
          ? `$${analysis.maxGain.toFixed(2)}`
          : analysis.maxGain,
        maxLoss: typeof analysis.maxLoss === 'number'
          ? `$${analysis.maxLoss.toFixed(2)}`
          : analysis.maxLoss,
        riskRewardRatio: analysis.riskRewardRatio?.toFixed(2),
        greeks: analysis.greeks
      };
    }

    // Portfolio analysis
    if (positions && positions.length > 0) {
      const analysis = await analyzePortfolio(positions);

      return {
        positionCount: analysis.positions.length,
        portfolio: {
          totalValue: `$${analysis.portfolio.totalValue.toFixed(2)}`,
          totalCostBasis: `$${analysis.portfolio.totalCostBasis.toFixed(2)}`,
          totalPnl: `$${analysis.portfolio.totalPnl.toFixed(2)}`,
          totalPnlPct: `${analysis.portfolio.totalPnlPct.toFixed(2)}%`,
          portfolioGreeks: {
            delta: analysis.portfolio.portfolioGreeks.delta,
            gamma: analysis.portfolio.portfolioGreeks.gamma,
            theta: analysis.portfolio.portfolioGreeks.theta,
            vega: analysis.portfolio.portfolioGreeks.vega
          },
          risk: {
            maxLoss: typeof analysis.portfolio.risk.maxLoss === 'number'
              ? `$${analysis.portfolio.risk.maxLoss.toFixed(2)}`
              : analysis.portfolio.risk.maxLoss,
            maxGain: typeof analysis.portfolio.risk.maxGain === 'number'
              ? `$${analysis.portfolio.risk.maxGain.toFixed(2)}`
              : analysis.portfolio.risk.maxGain
          },
          riskAssessment: {
            level: analysis.portfolio.riskAssessment.overall,
            warnings: analysis.portfolio.riskAssessment.warnings
          }
        },
        positions: analysis.positions.map(p => ({
          symbol: p.position.symbol,
          type: p.position.type,
          pnl: `$${p.pnl.toFixed(2)}`,
          pnlPct: `${p.pnlPct.toFixed(2)}%`
        }))
      };
    }

    return {
      error: 'No position or positions provided'
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze position',
      message: error.message
    };
  }
}

/**
 * Handler: show_chart
 * Returns chart configuration for the frontend to render.
 * Also fetches current levels so they can be annotated on the chart.
 */
async function handleShowChart(args: { symbol: string; timeframe?: string }) {
  const { symbol, timeframe = '1D' } = args;

  try {
    // Fetch levels to include as annotations
    const levels = await calculateLevels(symbol, 'intraday');

    return {
      action: 'show_chart',
      symbol,
      timeframe,
      currentPrice: levels.currentPrice,
      levels: {
        resistance: levels.levels.resistance.slice(0, 5),
        support: levels.levels.support.slice(0, 5),
        indicators: levels.levels.indicators
      },
      message: `Displaying ${symbol} chart (${timeframe}) with key levels in the center panel.`
    };
  } catch (error: any) {
    return {
      action: 'show_chart',
      symbol,
      timeframe,
      error: 'Could not fetch levels for chart annotations',
      message: `Displaying ${symbol} chart (${timeframe}) in the center panel.`
    };
  }
}
