import { calculateLevels } from '../services/levels';
import { fetchIntradayData, fetchDailyData } from '../services/levels/fetcher';
import { fetchOptionsChain } from '../services/options/optionsChainFetcher';
import { analyzePosition, analyzePortfolio } from '../services/options/positionAnalyzer';
import { Position } from '../services/options/types';
import { supabase } from '../config/database';
import { getMarketStatus as getMarketStatusService } from '../services/marketHours';
import { scanOpportunities } from '../services/scanner';
import { analyzeLongTermTrend } from '../services/charts/chartDataService';
import { generateGreeksProjection, assessGreeksTrend } from '../services/leaps/greeksProjection';
import { calculateRoll } from '../services/leaps/rollCalculator';
import { getMacroContext, assessMacroImpact } from '../services/macro/macroContext';
import { daysToExpiry as calcDaysToExpiry } from '../services/options/blackScholes';

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

    case 'get_long_term_trend':
      return await handleGetLongTermTrend(args);

    case 'analyze_leaps_position':
      return await handleAnalyzeLeapsPosition(args);

    case 'analyze_swing_trade':
      return await handleAnalyzeSwingTrade(args);

    case 'calculate_roll_decision':
      return await handleCalculateRollDecision(args);

    case 'get_macro_context':
      return await handleGetMacroContext(args);

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

    if (intradayData.length > 0) {
      // Market is open or has today's data
      const latestCandle = intradayData[intradayData.length - 1];
      return {
        symbol,
        price: latestCandle.c,
        timestamp: new Date(latestCandle.t).toISOString(),
        high: latestCandle.h,
        low: latestCandle.l,
        volume: latestCandle.v,
        isDelayed: false
      };
    }

    // Fallback to daily data (covers weekends + holidays with 7-day lookback)
    const dailyData = await fetchDailyData(symbol, 7);
    if (dailyData.length > 0) {
      const latestBar = dailyData[dailyData.length - 1];
      const marketStatus = getMarketStatusService();
      return {
        symbol,
        price: latestBar.c,
        timestamp: new Date(latestBar.t).toISOString(),
        high: latestBar.h,
        low: latestBar.l,
        volume: latestBar.v,
        isDelayed: true,
        priceAsOf: 'Last trading day close',
        marketStatusMessage: marketStatus.message || 'Market is currently closed'
      };
    }

    return {
      error: 'No price data available',
      message: 'No market data found for the past 7 days'
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

/**
 * Handler: get_long_term_trend
 * Analyzes weekly/monthly trend with EMAs and support/resistance
 */
async function handleGetLongTermTrend(args: {
  symbol: string;
  timeframe?: 'weekly' | 'monthly';
}) {
  const { symbol, timeframe = 'weekly' } = args;

  try {
    const trend = await analyzeLongTermTrend(symbol, timeframe);
    return trend;
  } catch (error: any) {
    return {
      error: 'Failed to analyze long-term trend',
      message: error.message,
    };
  }
}

/**
 * Handler: analyze_leaps_position
 * Comprehensive LEAPS analysis with Greeks projection + macro context
 */
async function handleAnalyzeLeapsPosition(args: {
  symbol: string;
  option_type: 'call' | 'put';
  strike: number;
  entry_price: number;
  entry_date: string;
  expiry_date: string;
  quantity?: number;
  current_iv?: number;
}) {
  const {
    symbol, option_type, strike, entry_price,
    entry_date, expiry_date, quantity = 1, current_iv = 0.25,
  } = args;

  try {
    const dte = calcDaysToExpiry(expiry_date);
    const daysHeld = Math.ceil(
      (Date.now() - new Date(entry_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get current price via intraday data, falling back to daily
    let currentPrice = strike; // last resort fallback
    try {
      const intradayData = await fetchIntradayData(symbol);
      if (intradayData.length > 0) {
        currentPrice = intradayData[intradayData.length - 1].c;
      } else {
        // Fallback to daily data (covers weekends + holidays)
        const dailyData = await fetchDailyData(symbol, 7);
        if (dailyData.length > 0) {
          currentPrice = dailyData[dailyData.length - 1].c;
        }
      }
    } catch {
      // Use strike as last resort fallback
    }

    // Greeks projection
    const projection = generateGreeksProjection(
      symbol, option_type, strike, currentPrice, dte, current_iv
    );

    // Current vs entry comparison
    const currentSnapshot = projection.projections[0];
    const greeksTrend = assessGreeksTrend(
      currentSnapshot?.delta || 0,
      0.5, // approximate entry delta
      currentSnapshot?.theta || 0,
      dte
    );

    // P&L estimate
    const currentValue = currentSnapshot?.projectedValue || 0;
    const pnl = (currentValue - entry_price) * quantity * 100;
    const pnlPct = entry_price > 0 ? ((currentValue - entry_price) / entry_price * 100) : 0;

    // Macro context
    const macroImpact = assessMacroImpact(symbol);

    // Roll recommendation
    let rollRecommendation: 'yes' | 'no' | 'optional' = 'no';
    if (dte < 60) rollRecommendation = 'yes';
    else if (dte < 120 && pnlPct > 30) rollRecommendation = 'optional';

    // Suggestions
    const suggestions: string[] = [];
    if (dte < 90) suggestions.push('Consider rolling to extend duration - theta acceleration is approaching');
    if (pnlPct > 50) suggestions.push('Position has significant gains - consider taking partial profits');
    if (pnlPct < -30) suggestions.push('Position is significantly underwater - reassess thesis');
    if (greeksTrend === 'improving') suggestions.push('Greeks trend is favorable - position becoming more efficient');
    if (rollRecommendation === 'optional') suggestions.push('Rolling to lock in gains is an option worth evaluating');
    if (suggestions.length === 0) suggestions.push('Position is healthy - no immediate action needed');

    return {
      symbol,
      optionType: option_type,
      strike,
      entryPrice: entry_price,
      currentValue: Number(currentValue.toFixed(2)),
      pnl: `$${pnl.toFixed(2)}`,
      pnlPct: `${pnlPct.toFixed(1)}%`,
      daysHeld,
      daysToExpiry: dte,
      currentUnderlying: currentPrice,
      greeks: currentSnapshot ? {
        delta: currentSnapshot.delta,
        gamma: currentSnapshot.gamma,
        theta: currentSnapshot.theta,
        vega: currentSnapshot.vega,
      } : null,
      greeksTrend,
      greeksProjection: projection.projections.slice(0, 6), // First 6 timepoints
      rollRecommendation,
      macroOutlook: macroImpact.overallOutlook,
      macroHighlights: {
        bullish: macroImpact.bullishFactors.slice(0, 3),
        bearish: macroImpact.bearishFactors.slice(0, 3),
        catalysts: macroImpact.upcomingCatalysts.slice(0, 3),
      },
      suggestions,
      timelineRisk: dte > 180 ? 'low' : dte > 90 ? 'medium' : 'high',
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze LEAPS position',
      message: error.message,
    };
  }
}

/**
 * Handler: analyze_swing_trade
 * Multi-day swing trade analysis with targets and management
 */
async function handleAnalyzeSwingTrade(args: {
  symbol: string;
  position_type?: string;
  entry_price: number;
  current_price: number;
  entry_date: string;
  direction: 'long' | 'short';
}) {
  const { symbol, entry_price, current_price, entry_date, direction } = args;

  try {
    const daysHeld = Math.ceil(
      (Date.now() - new Date(entry_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const pnlPct = direction === 'long'
      ? ((current_price - entry_price) / entry_price) * 100
      : ((entry_price - current_price) / entry_price) * 100;

    // Get levels for targets
    let technicalSetup = 'Unable to fetch technical data';
    let nextTargets: number[] = [];
    let stopLevel = 0;

    try {
      const levels = await calculateLevels(symbol, 'intraday');
      const resistance = levels.levels.resistance.map(r => r.price);
      const support = levels.levels.support.map(s => s.price);

      if (direction === 'long') {
        nextTargets = resistance.filter(r => r > current_price).slice(0, 3);
        stopLevel = support.find(s => s < current_price) || entry_price * 0.98;
      } else {
        nextTargets = support.filter(s => s < current_price).slice(0, 3);
        stopLevel = resistance.find(r => r > current_price) || entry_price * 1.02;
      }

      const vwap = levels.levels.indicators?.vwap;
      const priceVsVwap = vwap ? (current_price > vwap ? 'above VWAP' : 'below VWAP') : '';
      technicalSetup = `Price at $${current_price.toFixed(2)}, ${priceVsVwap}. ${direction === 'long' ? 'Next resistance' : 'Next support'}: ${nextTargets.map(t => `$${t.toFixed(0)}`).join(', ') || 'none identified'}`;
    } catch {
      // Continue without levels
    }

    // Risk/reward
    const riskPerShare = Math.abs(current_price - stopLevel);
    const rewardPerShare = nextTargets.length > 0 ? Math.abs(nextTargets[0] - current_price) : riskPerShare;
    const riskRewardRatio = riskPerShare > 0 ? Number((rewardPerShare / riskPerShare).toFixed(2)) : 0;

    // Time horizon
    let timeHorizon: string;
    if (daysHeld <= 3) timeHorizon = '1-3 days';
    else if (daysHeld <= 7) timeHorizon = '3-7 days';
    else timeHorizon = '1-2 weeks';

    // Management suggestions
    const suggestions: string[] = [];
    if (pnlPct > 8) {
      suggestions.push(`Position is up ${pnlPct.toFixed(1)}% - consider taking partial profits`);
    }
    if (pnlPct > 15) {
      suggestions.push('Strong gains achieved - trail stop to lock in profits');
    }
    if (pnlPct < -5) {
      suggestions.push('Position moving against you - review thesis and stop level');
    }
    if (daysHeld > 10) {
      suggestions.push('Extended hold period - evaluate if the setup is still valid');
    }
    if (riskRewardRatio < 1) {
      suggestions.push('Risk/reward ratio is unfavorable - consider tightening stop or taking profits');
    }
    if (suggestions.length === 0) {
      suggestions.push('Position is within normal parameters - continue monitoring');
    }

    return {
      symbol,
      direction,
      entryPrice: entry_price,
      currentPrice: current_price,
      pnlPct: `${pnlPct.toFixed(1)}%`,
      daysHeld,
      technicalSetup,
      nextTargets,
      stopLevelRecommendation: Number(stopLevel.toFixed(2)),
      riskRewardRatio,
      timeHorizon,
      suggestions,
    };
  } catch (error: any) {
    return {
      error: 'Failed to analyze swing trade',
      message: error.message,
    };
  }
}

/**
 * Handler: calculate_roll_decision
 * Calculates roll cost/benefit for LEAPS
 */
async function handleCalculateRollDecision(args: {
  symbol: string;
  option_type: 'call' | 'put';
  current_strike: number;
  current_expiry: string;
  new_strike: number;
  new_expiry?: string;
  current_price: number;
  implied_volatility?: number;
  quantity?: number;
}) {
  const {
    current_strike, current_expiry, new_strike,
    new_expiry, option_type, current_price,
    implied_volatility = 0.25, quantity = 1,
  } = args;

  try {
    const result = calculateRoll({
      currentStrike: current_strike,
      currentExpiry: current_expiry,
      newStrike: new_strike,
      newExpiry: new_expiry,
      optionType: option_type,
      currentPrice: current_price,
      impliedVolatility: implied_volatility,
      quantity,
    });

    return {
      current: {
        strike: result.current.strike,
        expiry: result.current.expiry,
        daysToExpiry: result.current.daysToExpiry,
        value: `$${result.current.value.toFixed(2)}`,
        greeks: result.current.greeks,
      },
      new: {
        strike: result.new.strike,
        expiry: result.new.expiry,
        daysToExpiry: result.new.daysToExpiry,
        value: `$${result.new.value.toFixed(2)}`,
        greeks: result.new.greeks,
      },
      analysis: {
        netCreditDebit: result.rollAnalysis.netCreditDebit > 0
          ? `+$${result.rollAnalysis.netCreditDebit.toFixed(2)} credit`
          : `-$${Math.abs(result.rollAnalysis.netCreditDebit).toFixed(2)} debit`,
        newBreakEven: `$${result.rollAnalysis.newBreakEven.toFixed(2)}`,
        recommendation: result.rollAnalysis.recommendation,
        pros: result.rollAnalysis.pros,
        cons: result.rollAnalysis.cons,
      },
    };
  } catch (error: any) {
    return {
      error: 'Failed to calculate roll',
      message: error.message,
    };
  }
}

/**
 * Handler: get_macro_context
 * Returns macro-economic context with optional symbol-specific impact
 */
async function handleGetMacroContext(args: { symbol?: string }) {
  const { symbol } = args;

  try {
    const macro = getMacroContext();

    const result: any = {
      economicCalendar: macro.economicCalendar.slice(0, 5),
      fedPolicy: {
        currentRate: macro.fedPolicy.currentRate,
        nextMeeting: macro.fedPolicy.nextMeetingDate,
        rateOutlook: macro.fedPolicy.expectedOutcome,
        tone: macro.fedPolicy.currentTone,
        probabilities: macro.fedPolicy.marketImpliedProbabilities,
      },
      earningsSeason: {
        phase: macro.earningsSeason.currentPhase,
        beatRate: `${(macro.earningsSeason.beatRate * 100).toFixed(0)}%`,
        implication: macro.earningsSeason.implication,
      },
      sectorRotation: {
        moneyFlow: macro.sectorRotation.moneyFlowDirection,
        sectors: macro.sectorRotation.sectors
          .filter(s => s.relativeStrength !== 'neutral')
          .map(s => ({
            name: s.name,
            strength: s.relativeStrength,
            trend: s.trend,
          })),
      },
    };

    // Add symbol-specific impact if requested
    if (symbol) {
      const impact = assessMacroImpact(symbol);
      result.symbolImpact = {
        symbol,
        outlook: impact.overallOutlook,
        bullishFactors: impact.bullishFactors,
        bearishFactors: impact.bearishFactors,
        riskFactors: impact.riskFactors,
        advice: impact.adviceForLEAPS,
        catalysts: impact.upcomingCatalysts.slice(0, 3),
      };
    }

    return result;
  } catch (error: any) {
    return {
      error: 'Failed to fetch macro context',
      message: error.message,
    };
  }
}
