import { calculateLevels } from '../services/levels';
import { fetchIntradayData } from '../services/levels/fetcher';
import { fetchOptionsChain } from '../services/options/optionsChainFetcher';
import { analyzePosition, analyzePortfolio } from '../services/options/positionAnalyzer';
import { Position } from '../services/options/types';
import { supabase } from '../config/database';
import { getMarketStatus as getMarketStatusService } from '../services/marketHours';
import { scanOpportunities } from '../services/scanner';

/**
 * Function handlers - these execute when the AI calls a function
 * They return results that get fed back to the AI
 */

interface FunctionCall {
  name: string;
  arguments: string; // JSON string
}

interface FunctionCallContext {
  userId?: string;
}

export async function executeFunctionCall(functionCall: FunctionCall, context?: FunctionCallContext): Promise<any> {
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

    case 'get_trade_history':
      return await handleGetTradeHistory(args, context?.userId);

    case 'set_alert':
      return await handleSetAlert(args, context?.userId);

    case 'get_alerts':
      return await handleGetAlerts(args, context?.userId);

    case 'scan_opportunities':
      return await handleScanOpportunities(args);

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
 * Uses DST-aware market hours and holiday calendar
 */
async function handleGetMarketStatus(_args: any) {
  return getMarketStatusService();
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
 * Handler: get_trade_history
 * Queries the user's trade journal for recent trades and performance stats
 */
async function handleGetTradeHistory(
  args: { symbol?: string; limit?: number },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const { symbol, limit = 10 } = args;

  try {
    let query = supabase
      .from('ai_coach_trades')
      .select('*')
      .eq('user_id', userId);

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: trades, error } = await query
      .order('entry_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const allTrades = trades || [];
    const closedTrades = allTrades.filter(t => t.trade_outcome != null);
    const wins = closedTrades.filter(t => t.trade_outcome === 'win');

    return {
      trades: allTrades.map(t => ({
        symbol: t.symbol,
        type: t.position_type,
        strategy: t.strategy,
        entryDate: t.entry_date,
        entryPrice: t.entry_price,
        exitDate: t.exit_date,
        exitPrice: t.exit_price,
        quantity: t.quantity,
        pnl: t.pnl != null ? `$${t.pnl.toFixed(2)}` : 'Open',
        pnlPct: t.pnl_pct != null ? `${t.pnl_pct.toFixed(1)}%` : null,
        outcome: t.trade_outcome || 'open',
      })),
      summary: {
        totalTrades: allTrades.length,
        closedTrades: closedTrades.length,
        openTrades: allTrades.length - closedTrades.length,
        wins: wins.length,
        losses: closedTrades.filter(t => t.trade_outcome === 'loss').length,
        winRate: closedTrades.length > 0
          ? `${((wins.length / closedTrades.length) * 100).toFixed(1)}%`
          : 'N/A',
        totalPnl: `$${closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)}`,
      },
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch trade history',
      message: error.message,
    };
  }
}

/**
 * Handler: set_alert
 * Creates a price alert for a symbol
 */
async function handleSetAlert(
  args: { symbol: string; alert_type: string; target_value: number; notes?: string },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const { symbol, alert_type, target_value, notes } = args;

  try {
    const { data, error } = await supabase
      .from('ai_coach_alerts')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        alert_type,
        target_value,
        notification_channels: ['in-app'],
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const typeLabels: Record<string, string> = {
      price_above: 'Price Above',
      price_below: 'Price Below',
      level_approach: 'Level Approach',
      level_break: 'Level Break',
      volume_spike: 'Volume Spike',
    };

    return {
      success: true,
      alert: {
        id: data.id,
        symbol: data.symbol,
        type: typeLabels[data.alert_type] || data.alert_type,
        targetValue: data.target_value,
        status: data.status,
        createdAt: data.created_at,
      },
      message: `Alert set: ${typeLabels[alert_type] || alert_type} ${target_value} for ${symbol}`,
    };
  } catch (error: any) {
    return {
      error: 'Failed to create alert',
      message: error.message,
    };
  }
}

/**
 * Handler: get_alerts
 * Gets the user's alerts with optional filtering
 */
async function handleGetAlerts(
  args: { status?: string; symbol?: string },
  userId?: string
) {
  if (!userId) {
    return { error: 'User not authenticated' };
  }

  const { status = 'active', symbol } = args;

  try {
    let query = supabase
      .from('ai_coach_alerts')
      .select('*')
      .eq('user_id', userId);

    if (status) query = query.eq('status', status);
    if (symbol) query = query.eq('symbol', symbol.toUpperCase());

    const { data: alerts, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const typeLabels: Record<string, string> = {
      price_above: 'Price Above',
      price_below: 'Price Below',
      level_approach: 'Level Approach',
      level_break: 'Level Break',
      volume_spike: 'Volume Spike',
    };

    return {
      alerts: (alerts || []).map(a => ({
        id: a.id,
        symbol: a.symbol,
        type: typeLabels[a.alert_type] || a.alert_type,
        targetValue: a.target_value,
        status: a.status,
        conditionMet: a.condition_met,
        triggeredAt: a.triggered_at,
        notes: a.notes,
        createdAt: a.created_at,
      })),
      count: (alerts || []).length,
    };
  } catch (error: any) {
    return {
      error: 'Failed to fetch alerts',
      message: error.message,
    };
  }
}

/**
 * Handler: scan_opportunities
 * Scans for trading opportunities across symbols
 */
async function handleScanOpportunities(args: {
  symbols?: string[];
  include_options?: boolean;
}) {
  const { symbols = ['SPX', 'NDX'], include_options = true } = args;

  try {
    const result = await scanOpportunities(symbols, include_options);

    return {
      opportunities: result.opportunities.map(opp => ({
        type: opp.type,
        setupType: opp.setupType.replace(/_/g, ' '),
        symbol: opp.symbol,
        direction: opp.direction,
        score: opp.score,
        currentPrice: opp.currentPrice,
        description: opp.description,
        suggestedTrade: opp.suggestedTrade,
        metadata: opp.metadata,
      })),
      count: result.opportunities.length,
      symbols: result.symbols,
      scanDurationMs: result.scanDurationMs,
      message: result.opportunities.length > 0
        ? `Found ${result.opportunities.length} opportunity${result.opportunities.length > 1 ? 'ies' : 'y'} across ${symbols.join(', ')}`
        : `No opportunities found across ${symbols.join(', ')} at this time`,
    };
  } catch (error: any) {
    return {
      error: 'Failed to scan opportunities',
      message: error.message,
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
