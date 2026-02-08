import { logger } from '../../lib/logger';
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

export interface LevelItem {
  type: string;
  price: number;
  distance: number;
  distancePct: number;
  distanceATR: number;
  strength: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical';
  description: string;
  testsToday?: number;
  lastTest?: string | null;
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
 * Get current price (using most recent intraday data)
 */
async function getCurrentPrice(symbol: string): Promise<number> {
  try {
    const intradayData = await fetchIntradayData(symbol);
    if (intradayData.length > 0) {
      return intradayData[intradayData.length - 1].c;
    }

    // Fallback to daily data if no intraday available (7 days covers weekends + holidays)
    const dailyData = await fetchDailyData(symbol, 7);
    if (dailyData.length > 0) {
      return dailyData[dailyData.length - 1].c;
    }

    throw new Error('No price data available');
  } catch (error) {
    logger.error('Failed to get current price', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
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
    const [dailyData, preMarketData, intradayData, currentPrice] = await Promise.all([
      fetchDailyData(symbol, 30), // 30 days for ATR calculation
      fetchPreMarketData(symbol).catch(() => []), // Optional - may fail if market closed
      fetchIntradayData(symbol).catch(() => []), // Optional - may fail if market closed
      getCurrentPrice(symbol)
    ]);

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

    // Build resistance array
    const resistance: LevelItem[] = [];

    // Add PWH if available
    if (distances.PWH) {
      resistance.push({
        type: 'PWH',
        price: distances.PWH.price,
        distance: distances.PWH.distance,
        distancePct: distances.PWH.distancePct,
        distanceATR: distances.PWH.distanceATR,
        strength: determineLevelStrength(distances.PWH.distanceATR),
        description: 'Previous Week High',
        testsToday: 0,
        lastTest: null
      });
    }

    // Add PDH
    resistance.push({
      type: 'PDH',
      price: distances.PDH.price,
      distance: distances.PDH.distance,
      distancePct: distances.PDH.distancePct,
      distanceATR: distances.PDH.distanceATR,
      strength: determineLevelStrength(distances.PDH.distanceATR),
      description: 'Previous Day High',
      testsToday: 0, // TODO: Track actual tests
      lastTest: null
    });

    // Build support array
    const support: LevelItem[] = [];

    // Add VWAP if available
    if (vwap && vwap < currentPrice) {
      const vwapDistance = vwap - currentPrice;
      const vwapDistancePct = (vwapDistance / currentPrice) * 100;
      const vwapDistanceATR = atr14 ? vwapDistance / atr14 : 0;

      support.push({
        type: 'VWAP',
        price: vwap,
        distance: Number(vwapDistance.toFixed(2)),
        distancePct: Number(vwapDistancePct.toFixed(2)),
        distanceATR: Number(vwapDistanceATR.toFixed(2)),
        strength: 'dynamic',
        description: 'Volume Weighted Average Price',
        testsToday: 0,
        lastTest: null
      });
    }

    // Add PMH if available and below current price
    if (preMarketLevels && preMarketLevels.PMH < currentPrice) {
      const pmhDistance = preMarketLevels.PMH - currentPrice;
      const pmhDistancePct = (pmhDistance / currentPrice) * 100;
      const pmhDistanceATR = atr14 ? pmhDistance / atr14 : 0;

      support.push({
        type: 'PMH',
        price: preMarketLevels.PMH,
        distance: Number(pmhDistance.toFixed(2)),
        distancePct: Number(pmhDistancePct.toFixed(2)),
        distanceATR: Number(pmhDistanceATR.toFixed(2)),
        strength: 'strong',
        description: 'Pre-Market High',
        testsToday: 0,
        lastTest: null
      });
    }

    // Add PDC
    support.push({
      type: 'PDC',
      price: distances.PDC.price,
      distance: distances.PDC.distance,
      distancePct: distances.PDC.distancePct,
      distanceATR: distances.PDC.distanceATR,
      strength: determineLevelStrength(distances.PDC.distanceATR),
      description: 'Previous Day Close',
      testsToday: 0,
      lastTest: null
    });

    // Add PDL
    support.push({
      type: 'PDL',
      price: distances.PDL.price,
      distance: distances.PDL.distance,
      distancePct: distances.PDL.distancePct,
      distanceATR: distances.PDL.distanceATR,
      strength: determineLevelStrength(distances.PDL.distanceATR),
      description: 'Previous Day Low',
      testsToday: 0,
      lastTest: null
    });

    // Sort resistance by distance (closest first)
    resistance.sort((a, b) => a.distance - b.distance);

    // Sort support by distance (closest first, but in reverse since they're negative)
    support.sort((a, b) => b.distance - a.distance);

    const result: LevelsResponse = {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: Number(currentPrice.toFixed(2)),
      levels: {
        resistance,
        support,
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
