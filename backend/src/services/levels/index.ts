import { logger } from '../../lib/logger';
import type { MassiveAggregate } from '../../config/massive';
import {
  fetchDailyData,
  fetchPreMarketData,
  fetchIntradayData,
} from './fetcher';
import { calculatePreviousDayLevels, calculateDistances } from './calculators/previousDay';
import { calculatePreMarketLevels } from './calculators/premarket';
import { calculateAllPivots } from './calculators/pivots';
import { calculateVWAP } from './calculators/vwap';
import { calculateATR } from './calculators/atr';
import {
  getCachedLevels,
  cacheLevels,
  addCacheMetadata,
  CACHE_TTL
} from './cache';
import { getMarketStatus as getMarketStatusService } from '../marketHours';
import { analyzeLevelTests } from './levelTestTracker';

export interface LevelItem {
  type: string;
  price: number;
  distance: number;
  distancePct: number;
  distanceATR: number;
  strength: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical';
  description: string;
  displayLabel?: string;
  displayContext?: string;
  side?: 'resistance' | 'support';
  testsToday?: number;
  lastTest?: string | null;
  holdRate?: number | null;
}

export interface LevelsResponse {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  levels: {
    resistance: LevelItem[];
    support: LevelItem[];
    pivots: {
      standard: any;
      camarilla: any;
      fibonacci: any;
    };
    indicators: {
      vwap: number | null;
      atr14: number | null;
      atr7?: number | null;
    };
  };
  marketContext: {
    marketStatus: string;
    sessionType: string;
    timeSinceOpen?: string;
  };
  cached: boolean;
  cacheExpiresAt: string | null;
}

/**
 * Determine level strength based on distance
 */
function determineLevelStrength(distanceATR: number): 'strong' | 'moderate' | 'weak' | 'critical' {
  const absDistance = Math.abs(distanceATR);

  if (absDistance < 0.5) return 'critical';
  if (absDistance < 1.0) return 'strong';
  if (absDistance < 2.0) return 'moderate';
  return 'weak';
}

function calculateDistanceMetrics(currentPrice: number, levelPrice: number, atr14: number | null): {
  distance: number;
  distancePct: number;
  distanceATR: number;
} {
  const distance = levelPrice - currentPrice;
  const distancePct = currentPrice > 0 ? (distance / currentPrice) * 100 : 0;
  const distanceATR = atr14 && atr14 > 0 ? distance / atr14 : 0;

  return {
    distance: Number(distance.toFixed(2)),
    distancePct: Number(distancePct.toFixed(2)),
    distanceATR: Number(distanceATR.toFixed(2)),
  };
}

/**
 * Build a human-readable label/context pair for chart-side level rendering.
 */
function generateDisplayLabel(
  type: string,
  price: number,
  distancePct: number,
  distanceATR: number,
  side: 'resistance' | 'support',
): { label: string; context: string } {
  const directionSymbol = side === 'resistance' ? '↑' : '↓';
  const signedDistancePct = `${distancePct >= 0 ? '+' : ''}${distancePct.toFixed(2)}%`;
  const signedDistanceAtr = `${distanceATR >= 0 ? '+' : ''}${distanceATR.toFixed(2)} ATR`;

  const label = `${type} $${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return {
    label,
    context: `${directionSymbol} ${signedDistancePct} / ${signedDistanceAtr}`,
  };
}

function splitBySide(
  level: Omit<LevelItem, 'displayLabel' | 'displayContext' | 'side'>,
  currentPrice: number,
  resistance: LevelItem[],
  support: LevelItem[],
): void {
  const side: 'resistance' | 'support' = level.price >= currentPrice ? 'resistance' : 'support';
  const display = generateDisplayLabel(
    level.type,
    level.price,
    level.distancePct,
    level.distanceATR,
    side,
  );
  const enrichedLevel: LevelItem = {
    ...level,
    side,
    displayLabel: display.label,
    displayContext: display.context,
  };

  if (level.price >= currentPrice) {
    resistance.push(enrichedLevel);
    return;
  }
  support.push(enrichedLevel);
}

function resolveCurrentPrice(
  symbol: string,
  dailyData: MassiveAggregate[],
  preMarketData: MassiveAggregate[],
  intradayData: MassiveAggregate[],
): number {
  if (intradayData.length > 0) {
    return intradayData[intradayData.length - 1].c;
  }

  // Use pre-market quote when regular session bars are not yet available.
  if (preMarketData.length > 0) {
    return preMarketData[preMarketData.length - 1].c;
  }

  if (dailyData.length > 0) {
    return dailyData[dailyData.length - 1].c;
  }

  throw new Error(`No price data available for ${symbol}`);
}

/**
 * Get market context using the centralized DST-aware market hours service
 */
function getMarketContext(): {
  marketStatus: string;
  sessionType: string;
  timeSinceOpen?: string;
} {
  const status = getMarketStatusService();
  return {
    marketStatus: status.status,
    sessionType: status.session,
    timeSinceOpen: status.timeSinceOpen,
  };
}

/**
 * Main function to calculate all levels for a symbol
 */
export async function calculateLevels(
  symbol: string,
  timeframe: string = 'intraday'
): Promise<LevelsResponse> {
  // Check cache first
  const cachedData = await getCachedLevels(symbol, timeframe);
  if (cachedData) {
    logger.info(`Returning cached levels for ${symbol}:${timeframe}`);
    return addCacheMetadata(cachedData, true, CACHE_TTL.LEVELS);
  }

  logger.info(`Calculating fresh levels for ${symbol}:${timeframe}`);

  try {
    // Fetch all required data in parallel
    const [dailyData, preMarketData, intradayData] = await Promise.all([
      fetchDailyData(symbol, 30), // 30 days for ATR calculation
      fetchPreMarketData(symbol).catch(() => []), // Optional - may fail if market closed
      fetchIntradayData(symbol).catch(() => []), // Optional - may fail if market closed
    ]);

    const currentPrice = resolveCurrentPrice(symbol, dailyData, preMarketData, intradayData);

    // Calculate previous day levels
    const prevDayLevels = calculatePreviousDayLevels(dailyData);

    // Calculate pivots
    const pivots = calculateAllPivots(dailyData);

    // Calculate ATR
    const atr14 = calculateATR(dailyData, 14);
    const atr7 = calculateATR(dailyData, 7);

    // Calculate VWAP
    const vwap = calculateVWAP(intradayData);

    // Calculate pre-market levels
    const preMarketLevels = calculatePreMarketLevels(preMarketData);

    // Calculate distances from current price
    const distances = calculateDistances(currentPrice, prevDayLevels, atr14 || 50);

    // Build side-aware arrays so levels are always emitted even when price is above/below them.
    const resistance: LevelItem[] = [];
    const support: LevelItem[] = [];

    const historicalLevels: Array<{
      type: string;
      description: string;
      distanceData: { price: number; distance: number; distancePct: number; distanceATR: number };
    }> = [
      { type: 'PDH', description: 'Previous Day High', distanceData: distances.PDH },
      { type: 'PDC', description: 'Previous Day Close', distanceData: distances.PDC },
      { type: 'PDL', description: 'Previous Day Low', distanceData: distances.PDL },
    ];

    if (distances.PWH) {
      historicalLevels.push({ type: 'PWH', description: 'Previous Week High', distanceData: distances.PWH });
    }
    if (distances.PWL) {
      historicalLevels.push({ type: 'PWL', description: 'Previous Week Low', distanceData: distances.PWL });
    }

    for (const level of historicalLevels) {
      splitBySide({
        type: level.type,
        price: level.distanceData.price,
        distance: level.distanceData.distance,
        distancePct: level.distanceData.distancePct,
        distanceATR: level.distanceData.distanceATR,
        strength: determineLevelStrength(level.distanceData.distanceATR),
        description: level.description,
        testsToday: 0,
        lastTest: null,
      }, currentPrice, resistance, support);
    }

    if (vwap) {
      const vwapMetrics = calculateDistanceMetrics(currentPrice, vwap, atr14);
      splitBySide({
        type: 'VWAP',
        price: vwap,
        ...vwapMetrics,
        strength: 'dynamic',
        description: 'Volume Weighted Average Price',
        testsToday: 0,
        lastTest: null,
      }, currentPrice, resistance, support);
    }

    if (preMarketLevels) {
      const pmhMetrics = calculateDistanceMetrics(currentPrice, preMarketLevels.PMH, atr14);
      splitBySide({
        type: 'PMH',
        price: preMarketLevels.PMH,
        ...pmhMetrics,
        strength: determineLevelStrength(pmhMetrics.distanceATR),
        description: 'Pre-Market High',
        testsToday: 0,
        lastTest: null,
      }, currentPrice, resistance, support);

      const pmlMetrics = calculateDistanceMetrics(currentPrice, preMarketLevels.PML, atr14);
      splitBySide({
        type: 'PML',
        price: preMarketLevels.PML,
        ...pmlMetrics,
        strength: determineLevelStrength(pmlMetrics.distanceATR),
        description: 'Pre-Market Low',
        testsToday: 0,
        lastTest: null,
      }, currentPrice, resistance, support);
    }

    const marketDate = new Date().toISOString().slice(0, 10);
    const levelTestMap = await analyzeLevelTests(
      symbol,
      [...resistance, ...support],
      intradayData,
      currentPrice,
      `${symbol}:${timeframe}:${marketDate}`,
    );

    const resistanceWithTests = resistance.map((level) => {
      const key = `${level.type}_${level.price.toFixed(2)}`;
      const history = levelTestMap.get(key);
      return {
        ...level,
        testsToday: history?.testsToday || 0,
        lastTest: history?.lastTest || null,
        holdRate: history?.holdRate ?? null,
      };
    });

    const supportWithTests = support.map((level) => {
      const key = `${level.type}_${level.price.toFixed(2)}`;
      const history = levelTestMap.get(key);
      return {
        ...level,
        testsToday: history?.testsToday || 0,
        lastTest: history?.lastTest || null,
        holdRate: history?.holdRate ?? null,
      };
    });

    // Sort resistance by distance (closest first)
    resistanceWithTests.sort((a, b) => a.distance - b.distance);

    // Sort support by distance (closest first, but in reverse since they're negative)
    supportWithTests.sort((a, b) => b.distance - a.distance);

    const result: LevelsResponse = {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: Number(currentPrice.toFixed(2)),
      levels: {
        resistance: resistanceWithTests,
        support: supportWithTests,
        pivots,
        indicators: {
          vwap,
          atr14,
          atr7
        }
      },
      marketContext: getMarketContext(),
      cached: false,
      cacheExpiresAt: null
    };

    // Cache the result
    await cacheLevels(symbol, timeframe, result, CACHE_TTL.LEVELS);

    return addCacheMetadata(result, false, CACHE_TTL.LEVELS);
  } catch (error: any) {
    logger.error(`Failed to calculate levels for ${symbol}`, { error: error?.message || String(error) });
    throw new Error(`Failed to calculate levels: ${error.message}`);
  }
}
