import { logger } from '../../lib/logger';
import { supabase } from '../../config/database';
import {
  Position,
  PositionAnalysis,
  PortfolioAnalysis,
  Greeks
} from './types';
import { fetchOptionContract } from './optionsChainFetcher';
import { calculatePositionGreeks } from './blackScholes';

/**
 * Position Analyzer
 *
 * Analyzes individual positions and portfolios
 * Calculates P&L, Greeks, risk metrics, breakeven points
 */

// Contract multiplier for SPX/NDX options
const CONTRACT_MULTIPLIER = 100;

/**
 * Calculate days held
 */
function calculateDaysHeld(entryDate: string): number {
  const entry = new Date(entryDate);
  const now = new Date();
  const diffTime = now.getTime() - entry.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate days to expiry
 */
function calculateDaysToExpiry(expiryDate?: string): number | undefined {
  if (!expiryDate) return undefined;

  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate breakeven price for simple long/short options
 */
function calculateBreakeven(position: Position): number | undefined {
  if (!position.strike || !position.expiry) return undefined;

  const { type, strike, entryPrice, quantity } = position;

  // Long positions
  if (quantity > 0) {
    if (type === 'call') {
      return strike + entryPrice;
    } else if (type === 'put') {
      return strike - entryPrice;
    }
  }

  // Short positions
  if (quantity < 0) {
    if (type === 'call') {
      return strike + Math.abs(entryPrice);
    } else if (type === 'put') {
      return strike - Math.abs(entryPrice);
    }
  }

  return undefined;
}

/**
 * Calculate max gain/loss for different position types
 */
function calculateMaxGainLoss(position: Position): {
  maxGain: number | string;
  maxLoss: number | string;
} {
  const { type, strike, strike2, quantity, entryPrice } = position;
  const absQuantity = Math.abs(quantity);
  const premium = entryPrice * CONTRACT_MULTIPLIER * absQuantity;

  // Long call
  if (type === 'call' && quantity > 0) {
    return {
      maxGain: 'unlimited',
      maxLoss: premium
    };
  }

  // Short call
  if (type === 'call' && quantity < 0) {
    return {
      maxGain: premium,
      maxLoss: 'unlimited'
    };
  }

  // Long put
  if (type === 'put' && quantity > 0 && strike) {
    return {
      maxGain: (strike * CONTRACT_MULTIPLIER * absQuantity) - premium,
      maxLoss: premium
    };
  }

  // Short put
  if (type === 'put' && quantity < 0 && strike) {
    return {
      maxGain: premium,
      maxLoss: (strike * CONTRACT_MULTIPLIER * absQuantity) - premium
    };
  }

  // Call spread (bull call spread: long lower strike, short higher strike)
  if (type === 'call_spread' && strike && strike2) {
    const spreadWidth = Math.abs(strike2 - strike) * CONTRACT_MULTIPLIER * absQuantity;

    if (quantity > 0) {
      // Bull call spread (debit)
      return {
        maxGain: spreadWidth - premium,
        maxLoss: premium
      };
    } else {
      // Bear call spread (credit)
      return {
        maxGain: premium,
        maxLoss: spreadWidth - premium
      };
    }
  }

  // Put spread (bear put spread: long higher strike, short lower strike)
  if (type === 'put_spread' && strike && strike2) {
    const spreadWidth = Math.abs(strike2 - strike) * CONTRACT_MULTIPLIER * absQuantity;

    if (quantity > 0) {
      // Bear put spread (debit)
      return {
        maxGain: spreadWidth - premium,
        maxLoss: premium
      };
    } else {
      // Bull put spread (credit)
      return {
        maxGain: premium,
        maxLoss: spreadWidth - premium
      };
    }
  }

  // Iron condor (4-leg spread)
  if (type === 'iron_condor' && strike && strike2) {
    // Simplified calculation assuming balanced iron condor
    // Premium received should exceed max loss on either side
    return {
      maxGain: premium,
      maxLoss: 'varies by strikes'
    };
  }

  // Stock
  if (type === 'stock') {
    return {
      maxGain: 'unlimited',
      maxLoss: strike ? strike * absQuantity : 'unlimited'
    };
  }

  return {
    maxGain: 'unknown',
    maxLoss: 'unknown'
  };
}

/**
 * Fetch current option price and Greeks
 */
async function fetchCurrentOptionData(
  position: Position
): Promise<{ currentPrice: number; greeks: Greeks } | null> {
  if (!position.strike || !position.expiry) return null;

  const optionType = position.type === 'call' || position.type === 'call_spread' ? 'call' : 'put';

  try {
    const contract = await fetchOptionContract(
      position.symbol,
      position.strike,
      position.expiry,
      optionType
    );

    if (!contract) return null;

    // Calculate position Greeks (multiply by quantity and multiplier)
    const contractGreeks = {
      delta: contract.delta || 0,
      gamma: contract.gamma || 0,
      theta: contract.theta || 0,
      vega: contract.vega || 0,
      rho: contract.rho || 0
    };

    const positionGreeks = calculatePositionGreeks(
      contractGreeks,
      position.quantity,
      CONTRACT_MULTIPLIER
    );

    return {
      currentPrice: contract.last,
      greeks: positionGreeks
    };
  } catch (error) {
    logger.error('Failed to fetch current option data', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Analyze a single position
 */
export async function analyzePosition(position: Position): Promise<PositionAnalysis> {
  const daysHeld = calculateDaysHeld(position.entryDate);
  const daysToExp = calculateDaysToExpiry(position.expiry);
  const breakeven = calculateBreakeven(position);
  const { maxGain, maxLoss } = calculateMaxGainLoss(position);

  // Fetch current data for options
  let currentPrice = position.currentPrice;
  let greeks = position.greeks;

  if (position.type !== 'stock' && position.strike && position.expiry) {
    const currentData = await fetchCurrentOptionData(position);

    if (currentData) {
      currentPrice = currentData.currentPrice;
      greeks = currentData.greeks;
    }
  }

  // Use entry price if current price not available
  if (currentPrice === undefined) {
    currentPrice = position.entryPrice;
  }

  // Calculate P&L
  const absQuantity = Math.abs(position.quantity);
  const multiplier = position.type === 'stock' ? 1 : CONTRACT_MULTIPLIER;

  const currentValue = currentPrice * multiplier * absQuantity;
  const costBasis = position.entryPrice * multiplier * absQuantity;

  // For short positions, P&L is inverted
  let pnl: number;
  if (position.quantity > 0) {
    pnl = currentValue - costBasis;
  } else {
    pnl = costBasis - currentValue;
  }

  const pnlPct = costBasis !== 0 ? (pnl / costBasis) * 100 : 0;

  // Calculate risk/reward ratio
  let riskRewardRatio: number | undefined;
  if (typeof maxGain === 'number' && typeof maxLoss === 'number' && maxLoss !== 0) {
    riskRewardRatio = maxGain / maxLoss;
  }

  return {
    position,
    currentValue,
    costBasis,
    pnl,
    pnlPct,
    daysHeld,
    daysToExpiry: daysToExp,
    breakeven,
    maxGain,
    maxLoss,
    riskRewardRatio,
    greeks
  };
}

/**
 * Calculate portfolio-level Greeks
 */
function calculatePortfolioGreeks(positions: PositionAnalysis[]): Greeks {
  const portfolioGreeks: Greeks = {
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    rho: 0
  };

  for (const position of positions) {
    if (position.greeks) {
      portfolioGreeks.delta += position.greeks.delta;
      portfolioGreeks.gamma += position.greeks.gamma;
      portfolioGreeks.theta += position.greeks.theta;
      portfolioGreeks.vega += position.greeks.vega;
      portfolioGreeks.rho = (portfolioGreeks.rho || 0) + (position.greeks.rho || 0);
    }
  }

  return {
    delta: Number(portfolioGreeks.delta.toFixed(2)),
    gamma: Number(portfolioGreeks.gamma.toFixed(4)),
    theta: Number(portfolioGreeks.theta.toFixed(2)),
    vega: Number(portfolioGreeks.vega.toFixed(2)),
    rho: Number((portfolioGreeks.rho || 0).toFixed(2))
  };
}

/**
 * Assess portfolio risk level
 */
function assessRisk(
  positions: PositionAnalysis[],
  portfolioGreeks: Greeks,
  totalCostBasis: number
): { overall: 'low' | 'moderate' | 'high' | 'extreme'; warnings: string[] } {
  const warnings: string[] = [];
  let riskScore = 0;

  // Check for unlimited risk positions
  const unlimitedRiskPositions = positions.filter(
    p => p.maxLoss === 'unlimited'
  );

  if (unlimitedRiskPositions.length > 0) {
    warnings.push(`${unlimitedRiskPositions.length} position(s) with unlimited risk`);
    riskScore += 3;
  }

  // Check for high delta exposure (directional risk)
  const absDelta = Math.abs(portfolioGreeks.delta);
  if (absDelta > 100) {
    warnings.push(`High directional exposure (Delta: ${portfolioGreeks.delta.toFixed(0)})`);
    riskScore += 2;
  }

  // Check for high negative theta (time decay)
  if (portfolioGreeks.theta < -500) {
    warnings.push(`High time decay (Theta: $${portfolioGreeks.theta.toFixed(0)}/day)`);
    riskScore += 1;
  }

  // Check for high vega exposure (IV risk)
  const absVega = Math.abs(portfolioGreeks.vega);
  if (absVega > 1000) {
    warnings.push(`High IV sensitivity (Vega: $${portfolioGreeks.vega.toFixed(0)} per 1% IV)`);
    riskScore += 1;
  }

  // Check for positions close to expiry
  const expiringPositions = positions.filter(
    p => p.daysToExpiry !== undefined && p.daysToExpiry <= 7
  );

  if (expiringPositions.length > 0) {
    warnings.push(`${expiringPositions.length} position(s) expiring within 7 days`);
    riskScore += 1;
  }

  // Check for concentrated positions (>50% of portfolio in one trade)
  const largePositions = positions.filter(
    p => Math.abs(p.costBasis) > totalCostBasis * 0.5
  );

  if (largePositions.length > 0) {
    warnings.push(`${largePositions.length} oversized position(s) (>50% of portfolio)`);
    riskScore += 2;
  }

  // Determine overall risk level
  let overall: 'low' | 'moderate' | 'high' | 'extreme';
  if (riskScore === 0) overall = 'low';
  else if (riskScore <= 2) overall = 'moderate';
  else if (riskScore <= 5) overall = 'high';
  else overall = 'extreme';

  return { overall, warnings };
}

/**
 * Analyze entire portfolio
 */
export async function analyzePortfolio(positions: Position[]): Promise<PortfolioAnalysis> {
  // Analyze each position
  const positionAnalyses = await Promise.all(
    positions.map(position => analyzePosition(position))
  );

  // Calculate portfolio totals
  const totalValue = positionAnalyses.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCostBasis = positionAnalyses.reduce((sum, p) => sum + Math.abs(p.costBasis), 0);
  const totalPnl = positionAnalyses.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnlPct = totalCostBasis !== 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  // Calculate portfolio Greeks
  const portfolioGreeks = calculatePortfolioGreeks(positionAnalyses);

  // Calculate max loss/gain
  let maxLoss: number | string = 0;
  let maxGain: number | string = 0;
  let hasUnlimitedLoss = false;
  let hasUnlimitedGain = false;

  for (const position of positionAnalyses) {
    if (position.maxLoss === 'unlimited') {
      hasUnlimitedLoss = true;
    } else if (typeof position.maxLoss === 'number') {
      maxLoss = (typeof maxLoss === 'number' ? maxLoss : 0) + position.maxLoss;
    }

    if (position.maxGain === 'unlimited') {
      hasUnlimitedGain = true;
    } else if (typeof position.maxGain === 'number') {
      maxGain = (typeof maxGain === 'number' ? maxGain : 0) + position.maxGain;
    }
  }

  if (hasUnlimitedLoss) maxLoss = 'unlimited';
  if (hasUnlimitedGain) maxGain = 'unlimited';

  // Assess risk
  const riskAssessment = assessRisk(positionAnalyses, portfolioGreeks, totalCostBasis);

  return {
    positions: positionAnalyses,
    portfolio: {
      totalValue,
      totalCostBasis,
      totalPnl,
      totalPnlPct,
      portfolioGreeks,
      risk: {
        maxLoss,
        maxGain,
        buyingPowerUsed: totalCostBasis // Simplified - would need account data for accurate BP calculation
      },
      riskAssessment
    }
  };
}

interface PositionRow {
  id: string;
  user_id: string;
  symbol: string;
  position_type: string;
  strike: number | string | null;
  expiry: string | null;
  quantity: number | string;
  entry_price: number | string;
  entry_date: string;
  current_price: number | string | null;
  greeks: Record<string, unknown> | null;
  status: 'open' | 'closed' | 'expired';
}

const VALID_POSITION_TYPES = new Set<Position['type']>([
  'call',
  'put',
  'call_spread',
  'put_spread',
  'iron_condor',
  'stock',
]);

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  }
  return date.toISOString().slice(0, 10);
}

function parseGreeks(value: Record<string, unknown> | null): Greeks | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const delta = parseNumber(value.delta) ?? 0;
  const gamma = parseNumber(value.gamma) ?? 0;
  const theta = parseNumber(value.theta) ?? 0;
  const vega = parseNumber(value.vega) ?? 0;
  const rho = parseNumber(value.rho) ?? 0;

  return { delta, gamma, theta, vega, rho };
}

function mapPositionType(positionType: string): Position['type'] {
  const normalized = positionType.toLowerCase() as Position['type'];
  if (VALID_POSITION_TYPES.has(normalized)) return normalized;
  return 'stock';
}

function mapRowToPosition(row: PositionRow): Position {
  return {
    id: row.id,
    symbol: row.symbol.toUpperCase(),
    type: mapPositionType(row.position_type),
    strike: parseNumber(row.strike),
    expiry: parseDateOnly(row.expiry),
    quantity: parseNumber(row.quantity) ?? 0,
    entryPrice: parseNumber(row.entry_price) ?? 0,
    entryDate: parseDateOnly(row.entry_date) ?? new Date().toISOString().slice(0, 10),
    currentPrice: parseNumber(row.current_price),
    greeks: parseGreeks(row.greeks),
  };
}

/**
 * Get position by ID from database
 */
export async function getPositionById(positionId: string, userId?: string): Promise<Position | null> {
  let query = supabase
    .from('ai_coach_positions')
    .select('id, user_id, symbol, position_type, strike, expiry, quantity, entry_price, entry_date, current_price, greeks, status')
    .eq('id', positionId)
    .eq('status', 'open')
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    logger.error('Failed to fetch position by id', {
      positionId,
      userId,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return null;
  }

  if (!data) return null;
  return mapRowToPosition(data as PositionRow);
}

/**
 * Get all positions for a user
 */
export async function getUserPositions(userId: string): Promise<Position[]> {
  const { data, error } = await supabase
    .from('ai_coach_positions')
    .select('id, user_id, symbol, position_type, strike, expiry, quantity, entry_price, entry_date, current_price, greeks, status')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('Failed to fetch user positions', {
      userId,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return [];
  }

  return (data || [])
    .map((row) => mapRowToPosition(row as PositionRow))
    .filter((position) => position.quantity !== 0 && position.entryPrice > 0);
}
