import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';
import { formatMassiveTicker } from '../lib/symbols';
import { toEasternTime } from '../services/marketHours';

dotenv.config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_BASE_URL = 'https://api.massive.com';

if (!MASSIVE_API_KEY) {
  throw new Error('Missing MASSIVE_API_KEY environment variable');
}

// Create Axios instance for Massive.com API
export const massiveClient: AxiosInstance = axios.create({
  baseURL: MASSIVE_BASE_URL,
  headers: {
    'Authorization': `Bearer ${MASSIVE_API_KEY}`
  },
  timeout: 30000
});

function getCurrentEasternDate(now: Date = new Date()): string {
  return toEasternTime(now).dateStr;
}

function normalizeOptionsUnderlyingTicker(underlyingTicker: string): string {
  const normalized = underlyingTicker.trim().toUpperCase();
  return normalized.startsWith('I:') ? normalized.slice(2) : normalized;
}

function toOptionsSnapshotUnderlyingTicker(underlyingTicker: string): string {
  return formatMassiveTicker(normalizeOptionsUnderlyingTicker(underlyingTicker));
}

// Add request interceptor for logging
massiveClient.interceptors.request.use(
  (config) => {
    logger.info(`Massive.com API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
massiveClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    logger.error('Massive.com API Error', { error: error.response?.data || error.message });
    return Promise.reject(error);
  }
);

// Types for API responses
export interface MassiveAggregate {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // volume weighted average price
  t: number; // timestamp (milliseconds)
  n?: number; // number of transactions
}

export interface MassiveAggregatesResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results: MassiveAggregate[];
  status: string;
  request_id: string;
  count: number;
}

// API Methods
export async function getAggregates(
  ticker: string,
  multiplier: number,
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
  from: string,
  to: string
): Promise<MassiveAggregatesResponse> {
  try {
    const response = await massiveClient.get<MassiveAggregatesResponse>(
      `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`,
      {
        params: {
          adjusted: true,
          sort: 'asc',
          limit: 50000
        }
      }
    );
    return response.data;
  } catch (error: any) {
    logger.error(`Failed to fetch aggregates for ${ticker}`, { error: error.message });
    throw error;
  }
}

// Get daily aggregates for a date range (used for PDH, pivots, ATR)
export async function getDailyAggregates(
  ticker: string,
  from: string,
  to: string
): Promise<MassiveAggregate[]> {
  const response = await getAggregates(ticker, 1, 'day', from, to);
  return response.results || [];
}

// Get minute aggregates for a specific date (used for PMH/PML, VWAP)
export async function getMinuteAggregates(
  ticker: string,
  date: string
): Promise<MassiveAggregate[]> {
  const response = await getAggregates(ticker, 1, 'minute', date, date);
  return response.results || [];
}

export type MassiveIndicatorTimespan = 'minute' | 'hour' | 'day' | 'week' | 'month';
type MassiveIndicatorOrder = 'asc' | 'desc';
type MassiveIndicatorSeriesType = 'open' | 'high' | 'low' | 'close' | 'volume';

export interface MassiveSingleIndicatorValue {
  timestamp: number;
  value: number;
}

export interface MassiveMACDIndicatorValue {
  timestamp: number;
  value: number;
  signal: number;
  histogram: number;
}

interface MassiveSingleIndicatorResponse {
  status: string;
  results?: {
    values?: MassiveSingleIndicatorValue[];
  };
}

interface MassiveMACDIndicatorResponse {
  status: string;
  results?: {
    values?: MassiveMACDIndicatorValue[];
  };
}

interface MassiveIndicatorQueryOptions {
  timespan?: MassiveIndicatorTimespan;
  seriesType?: MassiveIndicatorSeriesType;
  limit?: number;
  order?: MassiveIndicatorOrder;
  adjusted?: boolean;
  timestamp?: string | number;
  timestampGte?: string | number;
  timestampGt?: string | number;
  timestampLte?: string | number;
  timestampLt?: string | number;
}

interface MassiveMovingAverageQueryOptions extends MassiveIndicatorQueryOptions {
  window?: number;
}

interface MassiveMACDQueryOptions extends MassiveIndicatorQueryOptions {
  shortWindow?: number;
  longWindow?: number;
  signalWindow?: number;
}

function toIndicatorQueryParams(options: MassiveIndicatorQueryOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {
    adjusted: options.adjusted ?? true,
    order: options.order ?? 'asc',
    series_type: options.seriesType ?? 'close',
    timespan: options.timespan ?? 'day',
    expand_underlying: false,
  };

  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    params.limit = Math.min(Math.max(Math.floor(options.limit), 1), 5000);
  }

  if (options.timestamp !== undefined) {
    params.timestamp = options.timestamp;
  }
  if (options.timestampGte !== undefined) {
    params['timestamp.gte'] = options.timestampGte;
  }
  if (options.timestampGt !== undefined) {
    params['timestamp.gt'] = options.timestampGt;
  }
  if (options.timestampLte !== undefined) {
    params['timestamp.lte'] = options.timestampLte;
  }
  if (options.timestampLt !== undefined) {
    params['timestamp.lt'] = options.timestampLt;
  }

  return params;
}

async function getSingleIndicator(
  endpoint: 'ema' | 'sma' | 'rsi',
  ticker: string,
  options: MassiveMovingAverageQueryOptions = {}
): Promise<MassiveSingleIndicatorValue[]> {
  try {
    const params = toIndicatorQueryParams(options);
    if (typeof options.window === 'number' && Number.isFinite(options.window)) {
      params.window = Math.max(Math.floor(options.window), 1);
    }

    const response = await massiveClient.get<MassiveSingleIndicatorResponse>(
      `/v1/indicators/${endpoint}/${ticker}`,
      { params },
    );

    return response.data.results?.values || [];
  } catch (error: any) {
    logger.error(`Failed to fetch ${endpoint.toUpperCase()} indicator for ${ticker}`, {
      error: error.message,
    });
    throw error;
  }
}

export async function getEMAIndicator(
  ticker: string,
  options: MassiveMovingAverageQueryOptions = {}
): Promise<MassiveSingleIndicatorValue[]> {
  return getSingleIndicator('ema', ticker, options);
}

export async function getSMAIndicator(
  ticker: string,
  options: MassiveMovingAverageQueryOptions = {}
): Promise<MassiveSingleIndicatorValue[]> {
  return getSingleIndicator('sma', ticker, options);
}

export async function getRSIIndicator(
  ticker: string,
  options: MassiveMovingAverageQueryOptions = {}
): Promise<MassiveSingleIndicatorValue[]> {
  return getSingleIndicator('rsi', ticker, options);
}

export async function getMACDIndicator(
  ticker: string,
  options: MassiveMACDQueryOptions = {}
): Promise<MassiveMACDIndicatorValue[]> {
  try {
    const params = toIndicatorQueryParams(options);
    if (typeof options.shortWindow === 'number' && Number.isFinite(options.shortWindow)) {
      params.short_window = Math.max(Math.floor(options.shortWindow), 1);
    }
    if (typeof options.longWindow === 'number' && Number.isFinite(options.longWindow)) {
      params.long_window = Math.max(Math.floor(options.longWindow), 1);
    }
    if (typeof options.signalWindow === 'number' && Number.isFinite(options.signalWindow)) {
      params.signal_window = Math.max(Math.floor(options.signalWindow), 1);
    }

    const response = await massiveClient.get<MassiveMACDIndicatorResponse>(
      `/v1/indicators/macd/${ticker}`,
      { params },
    );

    return response.data.results?.values || [];
  } catch (error: any) {
    logger.error(`Failed to fetch MACD indicator for ${ticker}`, {
      error: error.message,
    });
    throw error;
  }
}

// Options-related types
export interface OptionsContract {
  ticker: string;
  underlying_ticker: string;
  strike_price: number;
  expiration_date: string;
  contract_type: 'call' | 'put';
}

export interface OptionsContractsResponse {
  results: OptionsContract[];
  status: string;
  count: number;
  next_url?: string;
}

export interface OptionsSnapshot {
  ticker: string;
  details?: {
    ticker?: string;
    contract_type?: 'call' | 'put';
    exercise_style?: string;
    expiration_date?: string;
    strike_price?: number;
  };
  day: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;
  };
  last_quote: {
    bid: number;
    ask: number;
    bid_size: number;
    ask_size: number;
    last_updated: number;
  };
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  implied_volatility?: number;
  open_interest?: number;
}

export interface OptionsSnapshotResponse {
  status: string;
  results: OptionsSnapshot[] | OptionsSnapshot | null;
  next_url?: string;
}

export interface MassiveTickerReference {
  ticker: string;
  name?: string;
  market?: string;
  type?: string;
  locale?: string;
  primary_exchange?: string;
}

interface MassiveTickerSearchResponse {
  status: string;
  count?: number;
  results?: MassiveTickerReference[];
}

// Get options contracts for an underlying symbol
export async function getOptionsContracts(
  underlyingTicker: string,
  expirationDate?: string,
  limit: number = 250
): Promise<OptionsContract[]> {
  try {
    const normalizedUnderlyingTicker = normalizeOptionsUnderlyingTicker(underlyingTicker);
    const MAX_PAGES = 20;
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);
    const params: any = {
      underlying_ticker: normalizedUnderlyingTicker,
      limit: safeLimit,
      sort: 'strike_price'
    };

    if (expirationDate) {
      params.expiration_date = expirationDate;
    }

    const response = await massiveClient.get<OptionsContractsResponse>(
      '/v3/reference/options/contracts',
      { params }
    );

    // Without a specific expiry we only need a single page in most call-sites.
    // Full pagination is only required when pulling all strikes for one expiry.
    if (!expirationDate) {
      return response.data.results || [];
    }

    const contracts: OptionsContract[] = [...(response.data.results || [])];
    let nextUrl = response.data.next_url;
    let page = 1;

    while (nextUrl && page < MAX_PAGES) {
      const nextResponse = await massiveClient.get<OptionsContractsResponse>(nextUrl);
      contracts.push(...(nextResponse.data.results || []));
      nextUrl = nextResponse.data.next_url;
      page += 1;
    }

    if (nextUrl) {
      logger.warn(`Options contracts pagination truncated for ${normalizedUnderlyingTicker}`, {
        pagesFetched: page,
        maxPages: MAX_PAGES
      });
    }

    return contracts;
  } catch (error: any) {
    logger.error(`Failed to fetch options contracts for ${underlyingTicker}`, { error: error.message });
    throw error;
  }
}

// Get options snapshot (price, Greeks, IV)
export async function getOptionsSnapshot(
  underlyingTicker: string,
  optionTicker?: string
): Promise<OptionsSnapshot[]> {
  try {
    const snapshotUnderlyingTicker = toOptionsSnapshotUnderlyingTicker(underlyingTicker);
    const MAX_PAGES = 20;
    const normalizeResults = (results: OptionsSnapshot[] | OptionsSnapshot | null | undefined): OptionsSnapshot[] => {
      if (!results) return [];
      return Array.isArray(results) ? results : [results];
    };

    const url = optionTicker
      ? `/v3/snapshot/options/${snapshotUnderlyingTicker}/${optionTicker}`
      : `/v3/snapshot/options/${snapshotUnderlyingTicker}`;

    const response = await massiveClient.get<OptionsSnapshotResponse>(url, optionTicker ? undefined : {
      params: {
        limit: 250,
      },
    });

    const firstPage = normalizeResults(response.data.results);
    if (optionTicker) {
      return firstPage;
    }

    const snapshots: OptionsSnapshot[] = [...firstPage];
    let nextUrl = response.data.next_url;
    let page = 1;

    while (nextUrl && page < MAX_PAGES) {
      const nextResponse = await massiveClient.get<OptionsSnapshotResponse>(nextUrl);
      snapshots.push(...normalizeResults(nextResponse.data.results));
      nextUrl = nextResponse.data.next_url;
      page += 1;
    }

    if (nextUrl) {
      logger.warn(`Options snapshot pagination truncated for ${snapshotUnderlyingTicker}`, {
        pagesFetched: page,
        maxPages: MAX_PAGES
      });
    }

    return snapshots;
  } catch (error: any) {
    logger.error(`Failed to fetch options snapshot for ${underlyingTicker}`, { error: error.message });
    throw error;
  }
}

// Get available expiration dates for an underlying
export async function getOptionsExpirations(
  underlyingTicker: string
): Promise<string[]> {
  try {
    const normalizedUnderlyingTicker = normalizeOptionsUnderlyingTicker(underlyingTicker);
    const today = getCurrentEasternDate();
    const MAX_PAGES = 20;
    const expirations = new Set<string>();

    let page = 0;
    let nextUrl: string | undefined;

    do {
      const response = page === 0
        ? await massiveClient.get<OptionsContractsResponse>(
          '/v3/reference/options/contracts',
          {
            params: {
              underlying_ticker: normalizedUnderlyingTicker,
              sort: 'expiration_date',
              order: 'asc',
              'expiration_date.gte': today,
              limit: 1000,
            },
          },
        )
        : await massiveClient.get<OptionsContractsResponse>(nextUrl as string);

      for (const contract of response.data.results || []) {
        if (contract.expiration_date >= today) {
          expirations.add(contract.expiration_date);
        }
      }

      nextUrl = response.data.next_url;
      page += 1;
    } while (nextUrl && page < MAX_PAGES);

    if (nextUrl) {
      logger.warn(`Options expirations pagination truncated for ${normalizedUnderlyingTicker}`, {
        pagesFetched: page,
        maxPages: MAX_PAGES,
      });
    }

    return Array.from(expirations).sort();
  } catch (error: any) {
    logger.error(`Failed to fetch expirations for ${underlyingTicker}`, { error: error.message });
    throw error;
  }
}

export async function getNearestOptionsExpiration(
  underlyingTicker: string
): Promise<string | null> {
  try {
    const normalizedUnderlyingTicker = normalizeOptionsUnderlyingTicker(underlyingTicker);
    const today = getCurrentEasternDate();
    const response = await massiveClient.get<OptionsContractsResponse>(
      '/v3/reference/options/contracts',
      {
        params: {
          underlying_ticker: normalizedUnderlyingTicker,
          sort: 'expiration_date',
          order: 'asc',
          limit: 1,
          'expiration_date.gte': today,
        },
      },
    );

    return response.data.results?.[0]?.expiration_date ?? null;
  } catch (error: any) {
    logger.error(`Failed to fetch nearest expiration for ${underlyingTicker}`, { error: error.message });
    throw error;
  }
}

export async function searchReferenceTickers(
  query: string,
  limit: number = 20,
): Promise<MassiveTickerReference[]> {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);

    const response = await massiveClient.get<MassiveTickerSearchResponse>(
      '/v3/reference/tickers',
      {
        params: {
          search: trimmed,
          active: true,
          sort: 'ticker',
          limit: safeLimit,
        },
      },
    );

    return response.data.results || [];
  } catch (error: any) {
    logger.error(`Failed to search ticker references for query "${query}"`, { error: error.message });
    throw error;
  }
}

// ============================================
// V3 ADDITIONS: Market Context & Enrichment
// ============================================

/**
 * Market context snapshot for journal entry enrichment.
 * Auto-populated from Massive.com data at trade entry/exit times.
 */
export interface MarketContextSnapshot {
  entryContext: {
    timestamp: string;
    price: number;
    vwap: number;
    atr14: number;
    volumeVsAvg: number;
    distanceFromPDH: number;
    distanceFromPDL: number;
    nearestLevel: { name: string; price: number; distance: number };
  };
  exitContext: {
    timestamp: string;
    price: number;
    vwap: number;
    atr14: number;
    volumeVsAvg: number;
    distanceFromPDH: number;
    distanceFromPDL: number;
    nearestLevel: { name: string; price: number; distance: number };
  };
  optionsContext?: {
    ivAtEntry: number;
    ivAtExit: number;
    ivRankAtEntry: number;
    deltaAtEntry: number;
    thetaAtEntry: number;
    dteAtEntry: number;
    dteAtExit: number;
  };
  dayContext: {
    marketTrend: 'bullish' | 'bearish' | 'neutral';
    atrUsed: number;
    sessionType: 'trending' | 'range-bound' | 'volatile';
    keyLevelsActive: {
      pdh: number; pdl: number; pdc: number;
      vwap: number; atr14: number;
      pivotPP: number; pivotR1: number; pivotS1: number;
    };
  };
}

/**
 * Trade verification result from Massive.com price matching.
 */
export interface TradeVerification {
  isVerified: boolean;
  confidence: 'exact' | 'close' | 'unverifiable';
  entryPriceMatch: boolean;
  exitPriceMatch: boolean;
  priceSource: 'massive-1min';
  verifiedAt: string;
}

/**
 * Trade replay data structure for chart visualization.
 */
export interface TradeReplayData {
  entryId: string;
  symbol: string;
  tradeDate: string;
  bars: MassiveAggregate[];
  overlays: {
    entryPoint: { time: number; price: number };
    exitPoint: { time: number; price: number };
    vwapLine: { time: number; value: number }[];
    levels: {
      pdh: number; pdl: number; pdc: number;
      pivotPP: number; pivotR1: number; pivotS1: number;
    };
  };
}

/**
 * Live price update from WebSocket relay.
 */
export interface LivePriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
}

/**
 * Get market context for a specific symbol and date.
 * Used for journal entry enrichment.
 */
export async function getMarketContext(
  ticker: string,
  date: string
): Promise<{
  minuteBars: MassiveAggregate[];
  dailyBars: MassiveAggregate[];
}> {
  try {
    // Calculate date range for daily data (30 days back for ATR)
    const dateObj = new Date(date);
    const thirtyDaysBack = new Date(dateObj);
    thirtyDaysBack.setDate(thirtyDaysBack.getDate() - 45);
    const from30 = thirtyDaysBack.toISOString().split('T')[0];

    const [minuteBars, dailyBars] = await Promise.all([
      getMinuteAggregates(ticker, date),
      getDailyAggregates(ticker, from30, date),
    ]);

    return { minuteBars, dailyBars };
  } catch (error: any) {
    logger.error(`Failed to fetch market context for ${ticker} on ${date}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Verify a reported price against Massive.com 1-minute data.
 * Returns true if the reported price falls within the bar's high-low range.
 */
export async function verifyPrice(
  ticker: string,
  timestamp: string,
  reportedPrice: number,
  tolerance: number = 1.0
): Promise<TradeVerification> {
  try {
    const date = timestamp.split('T')[0];
    const minuteBars = await getMinuteAggregates(ticker, date);

    const tradeTime = new Date(timestamp).getTime();
    // Find the closest 1-minute bar
    let closestBar: MassiveAggregate | null = null;
    let minDiff = Infinity;

    for (const bar of minuteBars) {
      const diff = Math.abs(bar.t - tradeTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestBar = bar;
      }
    }

    if (!closestBar) {
      return {
        isVerified: false,
        confidence: 'unverifiable',
        entryPriceMatch: false,
        exitPriceMatch: false,
        priceSource: 'massive-1min',
        verifiedAt: new Date().toISOString(),
      };
    }

    const withinRange =
      reportedPrice >= closestBar.l - tolerance &&
      reportedPrice <= closestBar.h + tolerance;

    return {
      isVerified: withinRange,
      confidence: withinRange ? 'exact' : 'close',
      entryPriceMatch: withinRange,
      exitPriceMatch: false, // Caller sets this separately
      priceSource: 'massive-1min',
      verifiedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error(`Failed to verify price for ${ticker}`, { error: error.message });
    return {
      isVerified: false,
      confidence: 'unverifiable',
      entryPriceMatch: false,
      exitPriceMatch: false,
      priceSource: 'massive-1min',
      verifiedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get IV rank for a symbol from the options chain.
 */
export async function getIVRank(
  underlyingTicker: string
): Promise<number | null> {
  try {
    const snapshots = await getOptionsSnapshot(underlyingTicker);
    if (!snapshots.length) return null;

    // Calculate average IV across ATM options
    const ivValues = snapshots
      .filter((s) => s.implied_volatility != null)
      .map((s) => s.implied_volatility!);

    if (!ivValues.length) return null;

    const avgIV = ivValues.reduce((sum, v) => sum + v, 0) / ivValues.length;
    // IV Rank is a 0-100 percentile; approximate from current snapshot
    return Math.round(avgIV * 100);
  } catch (error: any) {
    logger.error(`Failed to fetch IV rank for ${underlyingTicker}`, {
      error: error.message,
    });
    return null;
  }
}

// Test Massive.com API connection
export async function testMassiveConnection(): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Test with SPX
    await getDailyAggregates('I:SPX', yesterday, today);
    return true;
  } catch (error) {
    logger.error('Massive.com API connection test failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
