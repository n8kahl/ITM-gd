import { logger } from '../../lib/logger';
import {
  getOptionsContracts,
  getOptionsSnapshot,
  getOptionsExpirations,
  OptionsContract as MassiveOptionsContract,
  OptionsSnapshot
} from '../../config/massive';
import { getDailyAggregates } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import {
  OptionContract,
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

// Default risk-free rate (US 10-year Treasury, update periodically)
const RISK_FREE_RATE = 0.045; // 4.5%

// Dividend yields for common symbols (used in Black-Scholes fallback)
const DIVIDEND_YIELDS: { [key: string]: number } = {
  'SPX': 0.014,   // ~1.4% for S&P 500
  'NDX': 0.007,   // ~0.7% for NASDAQ-100
  'QQQ': 0.006,   // ~0.6% for Invesco QQQ
  'SPY': 0.013,   // ~1.3% for SPDR S&P 500
  'IWM': 0.012,   // ~1.2% for Russell 2000 ETF
  'DIA': 0.018,   // ~1.8% for Dow ETF
  'AAPL': 0.005,  // ~0.5%
  'MSFT': 0.007,  // ~0.7%
  'AMZN': 0.0,    // No dividend
  'GOOGL': 0.005, // ~0.5%
  'META': 0.004,  // ~0.4%
  'TSLA': 0.0,    // No dividend
  'NVDA': 0.0003, // ~0.03%
};
// Default for unknown symbols — most large-caps pay ~0.5-1%
const DEFAULT_DIVIDEND_YIELD = 0.005;

// Cache TTL for options chain (5 minutes during market hours)
const OPTIONS_CHAIN_CACHE_TTL = 300; // 5 minutes

/**
 * Get current price for underlying symbol
 */
// Known index symbols that need the I: prefix for Massive.com aggregates
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'VIX', 'RUT', 'COMP', 'DJIA']);

async function getCurrentPrice(symbol: string): Promise<number> {
  const ticker = INDEX_SYMBOLS.has(symbol) ? `I:${symbol}` : symbol;
  const today = new Date().toISOString().split('T')[0];
  // 7-day lookback covers weekends + holidays (longest US market closure = 3 consecutive days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const data = await getDailyAggregates(ticker, weekAgo, today);

  if (data.length === 0) {
    throw new Error(`No price data available for ${symbol}`);
  }

  // Return most recent close price
  return data[data.length - 1].c;
}

/**
 * Find nearest expiration date
 */
async function getNearestExpiration(symbol: string): Promise<string> {
  const expirations = await getOptionsExpirations(symbol);

  if (expirations.length === 0) {
    throw new Error(`No options expirations found for ${symbol}`);
  }

  // Return first future expiration
  const today = new Date().toISOString().split('T')[0];
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

/**
 * Calculate Greeks using Black-Scholes model
 */
function calculateContractGreeks(
  spotPrice: number,
  strikePrice: number,
  expiryDate: string,
  optionType: 'call' | 'put',
  impliedVolatility: number,
  symbol: string
): { delta: number; gamma: number; theta: number; vega: number; rho: number } {
  const timeToExpiry = daysToYears(daysToExpiry(expiryDate));
  const dividendYield = DIVIDEND_YIELDS[symbol] || DEFAULT_DIVIDEND_YIELD;

  const inputs: BlackScholesInputs = {
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate: RISK_FREE_RATE,
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
  symbol: string
): OptionContract {
  const { strike_price, expiration_date, contract_type } = massiveContract;
  const { last_quote, day, greeks, implied_volatility, open_interest } = snapshot;

  // Calculate intrinsic and extrinsic value
  const intrinsicValue = contract_type === 'call'
    ? Math.max(0, currentPrice - strike_price)
    : Math.max(0, strike_price - currentPrice);

  const last = day.close || 0;
  const extrinsicValue = Math.max(0, last - intrinsicValue);

  // Use Massive.com Greeks if available, otherwise calculate with Black-Scholes
  let contractGreeks: { delta: number; gamma: number; theta: number; vega: number; rho: number };

  if (greeks && implied_volatility) {
    contractGreeks = {
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      vega: greeks.vega,
      rho: 0 // Massive.com doesn't provide rho
    };
  } else if (implied_volatility) {
    // Calculate Greeks using Black-Scholes
    contractGreeks = calculateContractGreeks(
      currentPrice,
      strike_price,
      expiration_date,
      contract_type,
      implied_volatility,
      symbol
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
    bid: last_quote.bid,
    ask: last_quote.ask,
    volume: day.volume || 0,
    openInterest: open_interest || 0,
    impliedVolatility: implied_volatility || 0,
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

    // Get expiry date (use nearest if not specified)
    const expiry = expiryDate || await getNearestExpiration(symbol);
    const daysToExp = daysToExpiry(expiry);

    // Fetch all contracts for this expiration
    const contracts = await getOptionsContracts(symbol, expiry);

    if (contracts.length === 0) {
      throw new Error(`No options contracts found for ${symbol} ${expiry}`);
    }

    // Extract unique strikes and filter by range
    const allStrikes = [...new Set(contracts.map(c => c.strike_price))];
    const filteredStrikes = filterStrikesByRange(allStrikes, currentPrice, strikeRange);

    // Filter contracts to only include filtered strikes
    const filteredContracts = contracts.filter(c =>
      filteredStrikes.includes(c.strike_price)
    );

    // Fetch snapshots for all contracts (in batches to avoid rate limits)
    const BATCH_SIZE = 50;
    const snapshots: Map<string, OptionsSnapshot> = new Map();

    for (let i = 0; i < filteredContracts.length; i += BATCH_SIZE) {
      const batch = filteredContracts.slice(i, i + BATCH_SIZE);

      // Fetch snapshots in parallel for this batch
      const snapshotPromises = batch.map(async contract => {
        try {
          const snapshotData = await getOptionsSnapshot(symbol, contract.ticker);
          if (snapshotData.length > 0) {
            snapshots.set(contract.ticker, snapshotData[0]);
          }
        } catch (error) {
          logger.error(`Failed to fetch snapshot for ${contract.ticker}`, { error: error instanceof Error ? error.message : String(error) });
        }
      });

      await Promise.all(snapshotPromises);

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < filteredContracts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

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
        symbol
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
  const cached = await cacheGet<string[]>(cacheKey);

  if (cached) {
    logger.info(`Expirations cache hit: ${cacheKey}`);
    return cached;
  }

  try {
    const expirations = await getOptionsExpirations(symbol);

    // Filter to only future expirations
    const today = new Date().toISOString().split('T')[0];
    const futureExpirations = expirations.filter(exp => exp >= today);

    // Cache for 1 hour
    await cacheSet(cacheKey, futureExpirations, 3600);

    return futureExpirations;
  } catch (error: any) {
    logger.error(`Failed to fetch expirations for ${symbol}`, { error: error.message });
    throw new Error(`Failed to fetch expirations: ${error.message}`);
  }
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

    if (snapshotData.length === 0) {
      return null;
    }

    return convertToOptionContract(contract, snapshotData[0], currentPrice, symbol);
  } catch (error: any) {
    logger.error('Failed to fetch option contract', { error: error.message });
    return null;
  }
}
