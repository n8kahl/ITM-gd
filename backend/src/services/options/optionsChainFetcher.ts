import { logger } from '../../lib/logger';
import {
  getOptionsContracts,
  getOptionsSnapshot,
  getOptionsExpirations,
  getNearestOptionsExpiration,
  OptionsContract as MassiveOptionsContract,
  OptionsSnapshot
} from '../../config/massive';
import { getDailyAggregates, getMinuteAggregates } from '../../config/massive';
import { getRiskFreeRate, getDividendYield } from '../../services/marketConstants';
import { cacheGet, cacheSet } from '../../config/redis';
import { toEasternTime } from '../marketHours';
import { getRealTimePrice } from '../realTimePrice';
import {
  OptionContract,
  OptionsMatrixCell,
  OptionsMatrixResponse,
  OptionsChainResponse,
  BlackScholesInputs
} from './types';
import {
  calculateBlackScholes,
  daysToExpiry,
  daysToYears
} from './blackScholes';

/**
 * Options Chain Fetcher
 *
 * Fetches options chain data from Massive.com
 * Calculates Greeks using Black-Scholes model
 * Caches results for performance
 */

// Market-data caching (Phase 3.7): keep options data very fresh.

// Market-data caching (Phase 3.7): keep options data very fresh.
const OPTIONS_CHAIN_CACHE_TTL = 60; // 60 seconds
const OPTIONS_MATRIX_CACHE_TTL = 60; // 60 seconds
const DEFAULT_MATRIX_EXPIRATIONS = 5;
const DEFAULT_MATRIX_STRIKE_RANGE = 50;
const MATRIX_FETCH_CONCURRENCY = 2;
const SNAPSHOT_BULK_CACHE_TTL_MS = 15_000;
const SNAPSHOT_BATCH_SIZE = 12;
const SNAPSHOT_BATCH_DELAY_MS = 60;
const BULK_SNAPSHOT_MIN_CONTRACTS = 20;

interface BulkSnapshotCacheEntry {
  capturedAt: number;
  byTicker: Map<string, OptionsSnapshot>;
}

const bulkSnapshotCache = new Map<string, BulkSnapshotCacheEntry>();
const bulkSnapshotInFlight = new Map<string, Promise<Map<string, OptionsSnapshot>>>();

/**
 * Get current price for underlying symbol
 */
// Known index symbols that need the I: prefix for Massive.com aggregates
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'VIX', 'RUT', 'COMP', 'DJIA']);

function getCurrentEasternDate(now: Date = new Date()): string {
  return toEasternTime(now).dateStr;
}

async function getCurrentPrice(symbol: string): Promise<number> {
  const ticker = INDEX_SYMBOLS.has(symbol) ? `I:${symbol}` : symbol;

  try {
    const rtPrice = await getRealTimePrice(ticker);
    return rtPrice.price;
  } catch (error) {
    logger.warn(`Real-time price failed for ${symbol}, falling back to intraday aggregates`, { error: error instanceof Error ? error.message : String(error) });

    const today = getCurrentEasternDate();
    const minuteData = await getMinuteAggregates(ticker, today);
    if (minuteData.length > 0) {
      return minuteData[minuteData.length - 1].c;
    }

    logger.warn(`No intraday aggregate bars for ${symbol}, falling back to daily aggregates`);

    // 7-day lookback covers weekends + holidays
    const weekAgo = getCurrentEasternDate(new Date(Date.now() - 7 * 86400000));
    const data = await getDailyAggregates(ticker, weekAgo, today);

    if (data.length === 0) {
      throw new Error(`No price data available for ${symbol}`);
    }

    // Return most recent close price
    return data[data.length - 1].c;
  }
}

/**
 * Find nearest expiration date
 */
async function getNearestExpiration(symbol: string): Promise<string> {
  const nearest = await getNearestOptionsExpiration(symbol);
  if (nearest) return nearest;

  // Fallback for providers that do not support expiration_date.gte sorting params.
  const expirations = await getOptionsExpirations(symbol);
  if (expirations.length === 0) {
    throw new Error(`No options expirations found for ${symbol}`);
  }

  const today = getCurrentEasternDate();
  const futureExpirations = expirations.filter(exp => exp >= today);
  if (futureExpirations.length === 0) {
    throw new Error(`No future expirations available for ${symbol}`);
  }

  return futureExpirations[0];
}

/**
 * Filter strikes within range of current price
 * @param strikes - All available strikes
 * @param currentPrice - Current underlying price
 * @param range - Number of strikes above/below (default 10)
 */
function filterStrikesByRange(
  strikes: number[],
  currentPrice: number,
  range: number = 10
): number[] {
  // Sort strikes
  const sortedStrikes = [...strikes].sort((a, b) => a - b);

  // Find closest strike to current price
  const closestStrikeIndex = sortedStrikes.reduce((prevIdx, strike, idx) => {
    const prevDiff = Math.abs(sortedStrikes[prevIdx] - currentPrice);
    const currDiff = Math.abs(strike - currentPrice);
    return currDiff < prevDiff ? idx : prevIdx;
  }, 0);

  // Get strikes within range
  const startIdx = Math.max(0, closestStrikeIndex - range);
  const endIdx = Math.min(sortedStrikes.length, closestStrikeIndex + range + 1);

  return sortedStrikes.slice(startIdx, endIdx);
}

function toSnapshotTicker(snapshot: OptionsSnapshot): string | null {
  const raw = snapshot.ticker || snapshot.details?.ticker;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return normalized || null;
}

async function getBulkSnapshotIndex(symbol: string): Promise<Map<string, OptionsSnapshot>> {
  const cacheKey = symbol.toUpperCase();
  const cached = bulkSnapshotCache.get(cacheKey);

  if (cached && (Date.now() - cached.capturedAt) <= SNAPSHOT_BULK_CACHE_TTL_MS) {
    return cached.byTicker;
  }

  const inFlight = bulkSnapshotInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const run = (async () => {
    const snapshots = await getOptionsSnapshot(symbol);
    const rows = Array.isArray(snapshots) ? snapshots : (snapshots ? [snapshots] : []);
    const byTicker = new Map<string, OptionsSnapshot>();

    for (const row of rows) {
      const ticker = toSnapshotTicker(row);
      if (!ticker) continue;
      byTicker.set(ticker, row);
    }

    bulkSnapshotCache.set(cacheKey, {
      capturedAt: Date.now(),
      byTicker,
    });

    logger.info('Options snapshot bulk index refreshed', {
      symbol: cacheKey,
      count: byTicker.size,
    });

    return byTicker;
  })();

  bulkSnapshotInFlight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    bulkSnapshotInFlight.delete(cacheKey);
  }
}

async function resolveSnapshotsForContracts(
  symbol: string,
  contracts: MassiveOptionsContract[],
): Promise<{ snapshots: Map<string, OptionsSnapshot>; bulkUsed: boolean; bulkHits: number }> {
  const snapshots = new Map<string, OptionsSnapshot>();
  let bulkUsed = false;
  let bulkHits = 0;

  if (contracts.length >= BULK_SNAPSHOT_MIN_CONTRACTS) {
    try {
      const bulkIndex = await getBulkSnapshotIndex(symbol);
      bulkUsed = true;

      for (const contract of contracts) {
        const ticker = contract.ticker.trim().toUpperCase();
        const snapshot = bulkIndex.get(ticker);
        if (!snapshot) continue;
        snapshots.set(contract.ticker, snapshot);
        bulkHits += 1;
      }
    } catch (error) {
      logger.warn('Bulk options snapshot lookup failed, falling back to per-contract fetch', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const missingContracts = contracts.filter((contract) => !snapshots.has(contract.ticker));
  for (let i = 0; i < missingContracts.length; i += SNAPSHOT_BATCH_SIZE) {
    const batch = missingContracts.slice(i, i + SNAPSHOT_BATCH_SIZE);

    await Promise.all(batch.map(async (contract) => {
      try {
        const snapshotData = await getOptionsSnapshot(symbol, contract.ticker);
        const snapshotRows = Array.isArray(snapshotData)
          ? snapshotData
          : (snapshotData ? [snapshotData as unknown as OptionsSnapshot] : []);

        if (snapshotRows.length > 0) {
          snapshots.set(contract.ticker, snapshotRows[0]);
        }
      } catch (error) {
        logger.error(`Failed to fetch snapshot for ${contract.ticker}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }));

    if (i + SNAPSHOT_BATCH_SIZE < missingContracts.length) {
      await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_BATCH_DELAY_MS));
    }
  }

  return { snapshots, bulkUsed, bulkHits };
}

function calculateContractGex(
  gamma: number | undefined,
  openInterest: number,
  spotPrice: number,
): number {
  if (!gamma || gamma <= 0 || !Number.isFinite(openInterest) || openInterest <= 0 || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return 0;
  }

  return gamma * openInterest * 100 * spotPrice * spotPrice * 0.01;
}

function calculateCellMetrics(
  call: OptionContract | null,
  put: OptionContract | null,
  spotPrice: number,
): OptionsMatrixCell['metrics'] {
  const callVolume = call?.volume ?? 0;
  const putVolume = put?.volume ?? 0;
  const callOi = call?.openInterest ?? 0;
  const putOi = put?.openInterest ?? 0;

  const ivCandidates = [call?.impliedVolatility ?? 0, put?.impliedVolatility ?? 0]
    .filter((value) => Number.isFinite(value) && value > 0);

  const impliedVolatility = ivCandidates.length > 0
    ? ivCandidates.reduce((sum, value) => sum + value, 0) / ivCandidates.length
    : null;

  const callGex = calculateContractGex(call?.gamma, callOi, spotPrice);
  const putGex = calculateContractGex(put?.gamma, putOi, spotPrice);

  return {
    volume: Math.round(callVolume + putVolume),
    openInterest: Math.round(callOi + putOi),
    impliedVolatility,
    gex: callGex - putGex,
  };
}

/**
 * Calculate Greeks using Black-Scholes model
 */
function calculateContractGreeks(
  spotPrice: number,
  strikePrice: number,
  expiryDate: string,
  optionType: 'call' | 'put',
  impliedVolatility: number,
  riskFreeRate: number,
  dividendYield: number
): { delta: number; gamma: number; theta: number; vega: number; rho: number } {
  const timeToExpiry = daysToYears(daysToExpiry(expiryDate));

  const inputs: BlackScholesInputs = {
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    volatility: impliedVolatility,
    dividendYield,
    optionType
  };

  const result = calculateBlackScholes(inputs);
  return result.greeks;
}

/**
 * Convert Massive.com snapshot to our OptionContract format
 */
function convertToOptionContract(
  massiveContract: MassiveOptionsContract,
  snapshot: OptionsSnapshot,
  currentPrice: number,
  symbol: string,
  riskFreeRate: number,
  dividendYield: number
): OptionContract {
  const { strike_price, expiration_date, contract_type } = massiveContract;
  const day = snapshot.day || { open: 0, high: 0, low: 0, close: 0, volume: 0 };
  const lastQuote = snapshot.last_quote || { bid: 0, ask: 0, bid_size: 0, ask_size: 0, last_updated: 0 };
  const greeks = snapshot.greeks;
  const impliedVolatility = snapshot.implied_volatility;
  const openInterest = snapshot.open_interest;

  // Calculate intrinsic and extrinsic value
  const intrinsicValue = contract_type === 'call'
    ? Math.max(0, currentPrice - strike_price)
    : Math.max(0, strike_price - currentPrice);

  const last = day.close ?? 0;
  const extrinsicValue = Math.max(0, last - intrinsicValue);

  // Use Massive.com Greeks if available, otherwise calculate with Black-Scholes
  let contractGreeks: { delta: number; gamma: number; theta: number; vega: number; rho: number };
  const hasProviderGreeks = (
    typeof greeks?.delta === 'number'
    && typeof greeks?.gamma === 'number'
    && typeof greeks?.theta === 'number'
    && typeof greeks?.vega === 'number'
  );
  const hasImpliedVolatility = typeof impliedVolatility === 'number' && impliedVolatility > 0;

  if (hasProviderGreeks) {
    contractGreeks = {
      delta: greeks.delta ?? 0,
      gamma: greeks.gamma ?? 0,
      theta: greeks.theta ?? 0,
      vega: greeks.vega ?? 0,
      rho: 0 // Massive.com doesn't provide rho
    };
  } else if (hasImpliedVolatility) {
    // Calculate Greeks using Black-Scholes
    contractGreeks = calculateContractGreeks(
      currentPrice,
      strike_price,
      expiration_date,
      contract_type,
      impliedVolatility as number,
      riskFreeRate,
      dividendYield
    );
  } else {
    // No IV available, can't calculate Greeks
    contractGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  return {
    symbol,
    strike: strike_price,
    expiry: expiration_date,
    type: contract_type,
    last,
    bid: lastQuote.bid ?? 0,
    ask: lastQuote.ask ?? 0,
    volume: day.volume ?? 0,
    openInterest: openInterest ?? 0,
    impliedVolatility: impliedVolatility ?? 0,
    delta: contractGreeks.delta,
    gamma: contractGreeks.gamma,
    theta: contractGreeks.theta,
    vega: contractGreeks.vega,
    rho: contractGreeks.rho,
    inTheMoney: contract_type === 'call' ? currentPrice > strike_price : currentPrice < strike_price,
    intrinsicValue,
    extrinsicValue
  };
}

/**
 * Fetch complete options chain for a symbol
 *
 * @param symbol - Underlying symbol (SPX, NDX)
 * @param expiryDate - Specific expiry date or undefined for nearest
 * @param strikeRange - Number of strikes above/below current price (default 10)
 */
export async function fetchOptionsChain(
  symbol: string,
  expiryDate?: string,
  strikeRange: number = 10
): Promise<OptionsChainResponse> {
  // Check cache first
  const cacheKey = `options_chain:${symbol}:${expiryDate || 'nearest'}:${strikeRange}`;
  const cached = await cacheGet<OptionsChainResponse>(cacheKey);

  if (cached) {
    logger.info(`Options chain cache hit: ${cacheKey}`);
    return cached;
  }

  logger.info(`Fetching options chain for ${symbol}, expiry: ${expiryDate || 'nearest'}`);

  try {
    // Get current price
    const currentPrice = await getCurrentPrice(symbol);
    const riskFreeRate = await getRiskFreeRate();
    const dividendYield = await getDividendYield(symbol);

    const requestedExpiry = expiryDate?.trim() || undefined;

    // Get expiry date (use nearest if not specified)
    let expiry = requestedExpiry || await getNearestExpiration(symbol);

    // Fetch all contracts for this expiration
    let contracts = await getOptionsContracts(symbol, expiry);

    if (contracts.length === 0 && requestedExpiry) {
      const fallbackExpiry = await getNearestExpiration(symbol);

      if (fallbackExpiry && fallbackExpiry !== expiry) {
        const fallbackContracts = await getOptionsContracts(symbol, fallbackExpiry);
        if (fallbackContracts.length > 0) {
          logger.warn('Requested expiry unavailable; falling back to nearest expiration', {
            symbol,
            requestedExpiry: expiry,
            fallbackExpiry,
          });
          expiry = fallbackExpiry;
          contracts = fallbackContracts;
        }
      }
    }

    if (contracts.length === 0) {
      throw new Error(`No options contracts found for ${symbol} ${expiry}`);
    }

    const daysToExp = daysToExpiry(expiry);

    // Extract unique strikes and filter by range
    const allStrikes = [...new Set(contracts.map(c => c.strike_price))];
    const filteredStrikes = filterStrikesByRange(allStrikes, currentPrice, strikeRange);

    // Filter contracts to only include filtered strikes
    const filteredContracts = contracts.filter(c =>
      filteredStrikes.includes(c.strike_price)
    );

    const {
      snapshots,
      bulkUsed,
      bulkHits,
    } = await resolveSnapshotsForContracts(symbol, filteredContracts);

    // Convert to our OptionContract format
    const calls: OptionContract[] = [];
    const puts: OptionContract[] = [];

    for (const contract of filteredContracts) {
      const snapshot = snapshots.get(contract.ticker);

      if (!snapshot) {
        logger.warn(`No snapshot data for ${contract.ticker}, skipping`);
        continue;
      }

      const optionContract = convertToOptionContract(
        contract,
        snapshot,
        currentPrice,
        symbol,
        riskFreeRate,
        dividendYield
      );

      if (contract.contract_type === 'call') {
        calls.push(optionContract);
      } else {
        puts.push(optionContract);
      }
    }

    // Sort by strike
    calls.sort((a, b) => a.strike - b.strike);
    puts.sort((a, b) => a.strike - b.strike);

    if (calls.length === 0 && puts.length === 0) {
      logger.warn(`Options chain resolved with zero contracts for ${symbol}`, {
        expiry,
        contractsFetched: contracts.length,
        contractsFiltered: filteredContracts.length,
        snapshotsFetched: snapshots.size,
        bulkUsed,
        bulkHits,
      });
    } else {
      logger.info('Options chain snapshot coverage', {
        symbol,
        expiry,
        filteredContracts: filteredContracts.length,
        snapshotsFetched: snapshots.size,
        bulkUsed,
        bulkHits,
      });
    }

    // Calculate IV Rank (simplified - would need historical IV data for accurate calculation)
    // For now, just use current average IV as placeholder
    const allIVs = [...calls, ...puts].map(c => c.impliedVolatility).filter(iv => iv > 0);
    const avgIV = allIVs.length > 0
      ? allIVs.reduce((sum, iv) => sum + iv, 0) / allIVs.length
      : undefined;

    const response: OptionsChainResponse = {
      symbol,
      currentPrice,
      expiry,
      daysToExpiry: daysToExp,
      ivRank: avgIV ? Math.round(avgIV * 100) : undefined,
      options: {
        calls,
        puts
      }
    };

    // Cache the result
    await cacheSet(cacheKey, response, OPTIONS_CHAIN_CACHE_TTL);
    logger.info(`Options chain cached: ${cacheKey}`);

    return response;
  } catch (error: any) {
    logger.error(`Failed to fetch options chain for ${symbol}`, { error: error.message });
    throw new Error(`Failed to fetch options chain: ${error.message}`);
  }
}

/**
 * Get available expiration dates for a symbol
 */
export async function fetchExpirationDates(symbol: string): Promise<string[]> {
  const cacheKey = `options_expirations:${symbol}`;
  const today = getCurrentEasternDate();
  const cached = await cacheGet<string[]>(cacheKey);

  if (cached) {
    logger.info(`Expirations cache hit: ${cacheKey}`);
    const filteredCached = cached.filter(exp => exp >= today);
    if (filteredCached.length !== cached.length) {
      await cacheSet(cacheKey, filteredCached, 3600);
    }
    return filteredCached;
  }

  try {
    const expirations = await getOptionsExpirations(symbol);

    // Filter to only future expirations
    const futureExpirations = expirations.filter(exp => exp >= today);

    // Cache for 1 hour
    await cacheSet(cacheKey, futureExpirations, 3600);

    return futureExpirations;
  } catch (error: any) {
    logger.error(`Failed to fetch expirations for ${symbol}`, { error: error.message });
    throw new Error(`Failed to fetch expirations: ${error.message}`);
  }
}

async function fetchMatrixChains(
  symbol: string,
  expirations: string[],
  strikeRange: number,
): Promise<OptionsChainResponse[]> {
  const chains: OptionsChainResponse[] = [];

  for (let i = 0; i < expirations.length; i += MATRIX_FETCH_CONCURRENCY) {
    const batch = expirations.slice(i, i + MATRIX_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((expiry) => fetchOptionsChain(symbol, expiry, strikeRange)),
    );
    chains.push(...batchResults);
  }

  return chains;
}

export async function fetchOptionsMatrix(
  symbolInput: string,
  options?: {
    expirations?: number;
    strikes?: number;
  },
): Promise<OptionsMatrixResponse> {
  const symbol = symbolInput.toUpperCase();
  const expirationsCount = Math.max(1, Math.min(10, options?.expirations ?? DEFAULT_MATRIX_EXPIRATIONS));
  const strikeRange = Math.max(10, Math.min(80, options?.strikes ?? DEFAULT_MATRIX_STRIKE_RANGE));
  const cacheKey = `options_matrix:${symbol}:exp:${expirationsCount}:strikes:${strikeRange}`;

  const cached = await cacheGet<OptionsMatrixResponse>(cacheKey);
  if (cached) {
    logger.info(`Options matrix cache hit: ${cacheKey}`);
    return cached;
  }

  const availableExpirations = await fetchExpirationDates(symbol);
  const selectedExpirations = availableExpirations.slice(0, expirationsCount);

  if (selectedExpirations.length === 0) {
    throw new Error(`No options expirations found for ${symbol}`);
  }

  const chains = await fetchMatrixChains(symbol, selectedExpirations, strikeRange);
  if (chains.length === 0) {
    throw new Error(`No options chain data found for ${symbol}`);
  }

  const currentPrice = chains[0].currentPrice;
  const cellMap = new Map<string, { expiry: string; strike: number; call: OptionContract | null; put: OptionContract | null }>();
  const strikesSet = new Set<number>();

  for (const chain of chains) {
    for (const call of chain.options.calls) {
      const key = `${chain.expiry}:${call.strike}`;
      const existing = cellMap.get(key) || { expiry: chain.expiry, strike: call.strike, call: null, put: null };
      existing.call = call;
      cellMap.set(key, existing);
      strikesSet.add(call.strike);
    }

    for (const put of chain.options.puts) {
      const key = `${chain.expiry}:${put.strike}`;
      const existing = cellMap.get(key) || { expiry: chain.expiry, strike: put.strike, call: null, put: null };
      existing.put = put;
      cellMap.set(key, existing);
      strikesSet.add(put.strike);
    }
  }

  const strikes = Array.from(strikesSet.values()).sort((a, b) => a - b);
  const cells: OptionsMatrixCell[] = Array.from(cellMap.values())
    .map((cell) => ({
      expiry: cell.expiry,
      strike: cell.strike,
      call: cell.call,
      put: cell.put,
      metrics: calculateCellMetrics(cell.call, cell.put, currentPrice),
    }))
    .sort((a, b) => {
      if (a.strike !== b.strike) return a.strike - b.strike;
      return selectedExpirations.indexOf(a.expiry) - selectedExpirations.indexOf(b.expiry);
    });

  const response: OptionsMatrixResponse = {
    symbol,
    currentPrice,
    expirations: selectedExpirations,
    strikes,
    cells,
    generatedAt: new Date().toISOString(),
    cacheKey,
  };

  await cacheSet(cacheKey, response, OPTIONS_MATRIX_CACHE_TTL);
  logger.info('Options matrix generated', {
    symbol,
    expirations: selectedExpirations.length,
    strikes: strikes.length,
    cells: cells.length,
  });

  return response;
}

/**
 * Get single option contract details
 */
export async function fetchOptionContract(
  symbol: string,
  strike: number,
  expiry: string,
  type: 'call' | 'put'
): Promise<OptionContract | null> {
  try {
    const currentPrice = await getCurrentPrice(symbol);

    // Fetch all contracts for this expiry and find matching one
    const contracts = await getOptionsContracts(symbol, expiry);
    const contract = contracts.find(
      c => c.strike_price === strike && c.contract_type === type
    );

    if (!contract) {
      return null;
    }

    // Fetch snapshot
    const snapshotData = await getOptionsSnapshot(symbol, contract.ticker);

    const snapshotRows = Array.isArray(snapshotData)
      ? snapshotData
      : (snapshotData ? [snapshotData as unknown as OptionsSnapshot] : []);

    if (snapshotRows.length === 0) {
      return null;
    }

    const riskFreeRate = await getRiskFreeRate();
    const dividendYield = await getDividendYield(symbol);
    return convertToOptionContract(contract, snapshotRows[0], currentPrice, symbol, riskFreeRate, dividendYield);
  } catch (error: any) {
    logger.error('Failed to fetch option contract', { error: error.message });
    return null;
  }
}
