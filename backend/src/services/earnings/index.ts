import axios from 'axios';
import { massiveClient, getDailyAggregates } from '../../config/massive';
import { supabase } from '../../config/database';
import { POPULAR_SYMBOLS, formatMassiveTicker, sanitizeSymbols } from '../../lib/symbols';
import { logger } from '../../lib/logger';
import { analyzeIVProfile } from '../options/ivAnalysis';
import { fetchExpirationDates, fetchOptionsChain } from '../options/optionsChainFetcher';
import type { OptionContract } from '../options/types';
import { cacheGet, cacheSet } from '../../config/redis';

export type EarningsTiming = 'BMO' | 'AMC' | 'DURING';

export interface EarningsCalendarEvent {
  symbol: string;
  date: string;
  time: EarningsTiming;
  confirmed: boolean;
}

export interface EarningsHistoricalMove {
  date: string;
  expectedMove: number;
  actualMove: number;
  direction: 'up' | 'down';
  surprise: 'beat' | 'miss' | 'in-line' | 'unknown';
}

export interface EarningsStrategy {
  name: string;
  description: string;
  setup: Record<string, unknown>;
  riskReward: string;
  bestWhen: string;
  expectedMaxLoss: string;
  expectedMaxGain: string;
  probability: number;
}

export interface EarningsAnalysis {
  symbol: string;
  earningsDate: string | null;
  daysUntil: number | null;
  expectedMove: {
    points: number;
    pct: number;
  };
  historicalMoves: EarningsHistoricalMove[];
  avgHistoricalMove: number;
  moveOverpricing: number;
  currentIV: number | null;
  preEarningsIVRank: number | null;
  projectedIVCrushPct: number | null;
  straddlePricing: {
    atmStraddle: number;
    referenceExpiry: string | null;
    assessment: 'overpriced' | 'underpriced' | 'fair';
  };
  suggestedStrategies: EarningsStrategy[];
  asOf: string;
}

interface CorporateEventRecord {
  ticker?: string;
  symbol?: string;
  event_type?: string;
  type?: string;
  name?: string;
  execution_date?: string;
  event_date?: string;
  report_date?: string;
  date?: string;
  session?: string;
  time?: string;
  timing?: string;
  event_timing?: string;
  confirmed?: boolean;
  eps_actual?: number | null;
  eps_estimate?: number | null;
}

interface CorporateEventsResponse {
  results?: CorporateEventRecord[];
  next_url?: string;
}

interface CalendarFetchOptions {
  symbols: string[];
  fromDate: string;
  toDate: string;
}

interface MoveResult {
  actualMove: number;
  direction: 'up' | 'down';
}

interface AlphaVantageEarningsEvent {
  symbol?: string;
  reportDate?: string;
}

interface AlphaVantageEarningsResponse {
  quarterlyEarnings?: Array<{
    reportedDate?: string;
    surprise?: string;
    surprisePercentage?: string;
  }>;
  Note?: string;
  Information?: string;
  ['Error Message']?: string;
}

const DEFAULT_DAYS_AHEAD = 14;
const MAX_DAYS_AHEAD = 60;
const HISTORY_LOOKBACK_DAYS = 900;
const HISTORY_MAX_QUARTERS = 8;
const DEFAULT_WATCHLIST = [...POPULAR_SYMBOLS].slice(0, 6);
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const EARNINGS_REDIS_CACHE_TTL_SECONDS = 60 * 60;
const ALPHA_VANTAGE_BASE_URL = process.env.ALPHA_VANTAGE_BASE_URL || 'https://www.alphavantage.co/query';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const ALPHA_VANTAGE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ENABLE_TMX_CORPORATE_EVENTS = process.env.ENABLE_TMX_CORPORATE_EVENTS === 'true';
const CORPORATE_EVENT_ENDPOINTS = [
  '/tmx/v1/corporate-events',
] as const;
const TMX_EARNINGS_TYPES = [
  'earnings_announcement_date',
  'earnings_results_announcement',
  'earnings_conference_call',
].join(',');
const alphaCalendarCache = new Map<string, { expiresAt: number; events: EarningsCalendarEvent[] }>();
const alphaHistoryCache = new Map<string, {
  expiresAt: number;
  events: Array<{ date: string; timing: EarningsTiming; surprise: EarningsHistoricalMove['surprise'] }>;
}>();

function round(value: number, digits: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function getEventDate(event: CorporateEventRecord): string | null {
  const raw = event.execution_date || event.event_date || event.report_date || event.date;
  if (!raw || typeof raw !== 'string') return null;

  const date = raw.length >= 10 ? raw.slice(0, 10) : raw;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function classifyEarningsTiming(event: CorporateEventRecord): EarningsTiming {
  const raw = String(event.event_timing || event.timing || event.session || event.time || event.name || '').toLowerCase();

  if (raw.includes('after') || raw.includes('amc') || raw.includes('post')) {
    return 'AMC';
  }

  if (raw.includes('before') || raw.includes('bmo') || raw.includes('pre')) {
    return 'BMO';
  }

  return 'DURING';
}

function parseEarningsSurprise(event: CorporateEventRecord): EarningsHistoricalMove['surprise'] {
  const actual = typeof event.eps_actual === 'number' ? event.eps_actual : null;
  const estimate = typeof event.eps_estimate === 'number' ? event.eps_estimate : null;

  if (actual == null || estimate == null) return 'unknown';
  if (actual > estimate) return 'beat';
  if (actual < estimate) return 'miss';
  return 'in-line';
}

function sanitizeWatchlist(symbols?: string[]): string[] {
  if (!symbols || symbols.length === 0) return DEFAULT_WATCHLIST;
  const sanitized = sanitizeSymbols(symbols, 25);
  return sanitized.length > 0 ? sanitized : DEFAULT_WATCHLIST;
}

function buildEarningsCalendarCacheKey(symbols: string[], daysAhead: number): string {
  const normalizedSymbols = [...symbols].sort().join(',');
  return `earnings:calendar:${daysAhead}:${normalizedSymbols}`;
}

function buildEarningsAnalysisCacheKey(symbol: string): string {
  return `earnings:analysis:${symbol}`;
}

function getAlphaVantageHorizon(daysAhead: number): '3month' | '6month' | '12month' {
  if (daysAhead <= 90) return '3month';
  if (daysAhead <= 180) return '6month';
  return '12month';
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      current.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      current.push(field);
      field = '';
      if (current.some((value) => value.length > 0)) {
        rows.push(current);
      }
      current = [];
      continue;
    }

    field += char;
  }

  current.push(field);
  if (current.some((value) => value.length > 0)) {
    rows.push(current);
  }

  return rows;
}

function extractAlphaCalendarEvents(csvText: string): AlphaVantageEarningsEvent[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  const symbolIndex = headers.findIndex((header) => header.toLowerCase() === 'symbol');
  const reportDateIndex = headers.findIndex((header) => header.toLowerCase() === 'reportdate');

  if (symbolIndex === -1 || reportDateIndex === -1) {
    return [];
  }

  return rows.slice(1).map((row) => ({
    symbol: row[symbolIndex]?.trim(),
    reportDate: row[reportDateIndex]?.trim(),
  }));
}

function parseAlphaSurprise(value: string | undefined): EarningsHistoricalMove['surprise'] {
  if (!value) return 'unknown';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'unknown';
  if (numeric > 0.00001) return 'beat';
  if (numeric < -0.00001) return 'miss';
  return 'in-line';
}

function pickAtmContract(contracts: OptionContract[], spotPrice: number): OptionContract | null {
  const valid = contracts.filter((contract) => Number.isFinite(contract.strike) && contract.strike > 0);
  if (valid.length === 0) return null;

  return valid.reduce((best, current) => (
    Math.abs(current.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? current : best
  ));
}

function markPrice(contract: OptionContract | null): number {
  if (!contract) return 0;
  const bid = Number.isFinite(contract.bid) ? contract.bid : 0;
  const ask = Number.isFinite(contract.ask) ? contract.ask : 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  if (mid > 0) return mid;
  return Number.isFinite(contract.last) && contract.last > 0 ? contract.last : 0;
}

async function fetchAlphaVantageCalendar(options: CalendarFetchOptions): Promise<EarningsCalendarEvent[]> {
  if (!ALPHA_VANTAGE_API_KEY) return [];

  const horizon = getAlphaVantageHorizon(
    Math.max(1, Math.ceil((new Date(`${options.toDate}T00:00:00.000Z`).getTime() - new Date(`${options.fromDate}T00:00:00.000Z`).getTime()) / (24 * 60 * 60 * 1000))),
  );

  const events: EarningsCalendarEvent[] = [];

  for (const symbol of options.symbols) {
    const cacheKey = `${symbol}:${horizon}`;
    const now = Date.now();
    const cached = alphaCalendarCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      events.push(...cached.events.filter((event) => event.date >= options.fromDate && event.date <= options.toDate));
      continue;
    }

    try {
      const response = await axios.get<string>(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'EARNINGS_CALENDAR',
          symbol,
          horizon,
          apikey: ALPHA_VANTAGE_API_KEY,
        },
        responseType: 'text',
        timeout: 15000,
      });

      const rawBody = typeof response.data === 'string' ? response.data.trim() : '';
      if (!rawBody) continue;

      if (rawBody.startsWith('{')) {
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        if (payload.Note || payload.Information || payload['Error Message']) {
          logger.warn('Alpha Vantage earnings calendar returned info/error payload', {
            symbol,
            message: payload.Note || payload.Information || payload['Error Message'],
          });
          continue;
        }
      }

      const parsed = extractAlphaCalendarEvents(rawBody)
        .map((row) => ({
          symbol: String(row.symbol || '').toUpperCase(),
          date: String(row.reportDate || '').slice(0, 10),
          time: 'DURING' as EarningsTiming,
          confirmed: true,
        }))
        .filter((event) => (
          event.symbol === symbol
          && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
          && event.date >= options.fromDate
          && event.date <= options.toDate
        ));

      alphaCalendarCache.set(cacheKey, {
        events: parsed,
        expiresAt: now + ALPHA_VANTAGE_CACHE_TTL_MS,
      });

      events.push(...parsed);
    } catch (error: any) {
      logger.warn('Alpha Vantage earnings calendar request failed', {
        symbol,
        error: error?.message || String(error),
      });
    }
  }

  return events;
}

async function fetchAlphaVantageHistoricalEvents(
  symbol: string,
  todayIso: string,
): Promise<Array<{ date: string; timing: EarningsTiming; surprise: EarningsHistoricalMove['surprise'] }>> {
  if (!ALPHA_VANTAGE_API_KEY) return [];

  const now = Date.now();
  const cached = alphaHistoryCache.get(symbol);
  if (cached && cached.expiresAt > now) {
    return cached.events.filter((event) => event.date < todayIso).slice(0, HISTORY_MAX_QUARTERS);
  }

  try {
    const response = await axios.get<AlphaVantageEarningsResponse>(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'EARNINGS',
        symbol,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 15000,
    });

    const payload = response.data;
    if (payload.Note || payload.Information || payload['Error Message']) {
      logger.warn('Alpha Vantage earnings history returned info/error payload', {
        symbol,
        message: payload.Note || payload.Information || payload['Error Message'],
      });
      return [];
    }

    const events = (payload.quarterlyEarnings || [])
      .map((quarter) => {
        const date = String(quarter.reportedDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        const surprise = parseAlphaSurprise(quarter.surprise ?? quarter.surprisePercentage);
        return { date, timing: 'DURING' as EarningsTiming, surprise };
      })
      .filter((entry): entry is { date: string; timing: EarningsTiming; surprise: EarningsHistoricalMove['surprise'] } => entry != null)
      .sort((a, b) => b.date.localeCompare(a.date));

    alphaHistoryCache.set(symbol, {
      events,
      expiresAt: now + ALPHA_VANTAGE_CACHE_TTL_MS,
    });

    return events.filter((event) => event.date < todayIso).slice(0, HISTORY_MAX_QUARTERS);
  } catch (error: any) {
    logger.warn('Alpha Vantage earnings history request failed', {
      symbol,
      error: error?.message || String(error),
    });
    return [];
  }
}

async function fetchCorporateEvents(options: CalendarFetchOptions): Promise<CorporateEventRecord[]> {
  const params = {
    limit: 200,
    sort: 'date.asc',
    'type.any_of': TMX_EARNINGS_TYPES,
  } as Record<string, unknown>;

  const events: CorporateEventRecord[] = [];

  for (const symbol of options.symbols) {
    const symbolParams = {
      ...params,
      ticker: symbol,
      'date.gte': options.fromDate,
      'date.lte': options.toDate,
    };

    let resolved = false;
    for (const endpoint of CORPORATE_EVENT_ENDPOINTS) {
      try {
        const response = await massiveClient.get<CorporateEventsResponse>(endpoint, {
          params: symbolParams,
        });

        events.push(...(response.data.results || []));

        let nextUrl = response.data.next_url;
        let pageCount = 1;

        while (nextUrl && pageCount < 3) {
          const nextResponse = await massiveClient.get<CorporateEventsResponse>(nextUrl);
          events.push(...(nextResponse.data.results || []));
          nextUrl = nextResponse.data.next_url;
          pageCount += 1;
        }

        resolved = true;
        break;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 404 || status === 400) {
          continue;
        }

        logger.warn('Earnings corporate-events request failed', {
          endpoint,
          symbol,
          status,
          error: error?.message || String(error),
        });
      }
    }

    if (!resolved) {
      logger.warn('Falling back: no corporate-events endpoint available for symbol', { symbol });
    }
  }

  return events;
}

async function estimateHistoricalMove(symbol: string, eventDate: string, timing: EarningsTiming): Promise<MoveResult | null> {
  const start = formatDate(addDays(new Date(`${eventDate}T00:00:00.000Z`), -5));
  const end = formatDate(addDays(new Date(`${eventDate}T00:00:00.000Z`), 5));
  const bars = await getDailyAggregates(formatMassiveTicker(symbol), start, end);

  if (bars.length < 2) return null;

  const sorted = [...bars].sort((a, b) => a.t - b.t);
  const eventIndex = sorted.findIndex((bar) => formatDate(new Date(bar.t)) === eventDate);

  if (eventIndex === -1) return null;

  const prevBar = sorted[eventIndex - 1];
  const eventBar = sorted[eventIndex];
  const nextBar = sorted[eventIndex + 1];

  if (!eventBar) return null;

  let prePrice: number | null = null;
  let postPrice: number | null = null;

  if (timing === 'AMC') {
    prePrice = eventBar.c;
    postPrice = nextBar?.c ?? null;
  } else {
    prePrice = prevBar?.c ?? null;
    postPrice = eventBar.c;
  }

  if (!prePrice || !postPrice || prePrice <= 0 || postPrice <= 0) return null;

  const movePct = Math.abs(((postPrice - prePrice) / prePrice) * 100);

  return {
    actualMove: round(movePct),
    direction: postPrice >= prePrice ? 'up' : 'down',
  };
}

async function estimateExpectedMovePct(symbol: string, eventDate: string): Promise<number | null> {
  const end = formatDate(addDays(new Date(`${eventDate}T00:00:00.000Z`), -1));
  const start = formatDate(addDays(new Date(`${eventDate}T00:00:00.000Z`), -45));
  const bars = await getDailyAggregates(formatMassiveTicker(symbol), start, end);

  if (bars.length < 22) return null;

  const closes = bars
    .map((bar) => bar.c)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (closes.length < 22) return null;

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const trailing = returns.slice(-20);
  if (trailing.length < 5) return null;

  const hvAnnual = stdDev(trailing) * Math.sqrt(252);
  const oneDayMovePct = hvAnnual / Math.sqrt(252) * 100;
  return round(oneDayMovePct);
}

function buildSuggestedStrategies(input: {
  symbol: string;
  moveOverpricing: number;
  expectedMovePct: number;
  ivRank: number | null;
  directionalBias: 'bullish' | 'bearish' | 'neutral';
  currentPrice: number;
}): EarningsStrategy[] {
  const strategies: EarningsStrategy[] = [];
  const { symbol, moveOverpricing, expectedMovePct, ivRank, directionalBias, currentPrice } = input;

  if (moveOverpricing > 20) {
    strategies.push({
      name: 'Wait For IV Reset',
      description: `Implied move is ${round(moveOverpricing)}% above historical realized moves. Premium is expensive for pre-earnings long options.`,
      setup: {
        type: 'wait_for_iv_reset',
        trigger: 'post_earnings_or_confirmed_breakout',
      },
      riskReward: 'Capital preservation focus',
      bestWhen: 'Expected move is overpriced and directional conviction is low',
      expectedMaxLoss: 'No position until confirmation',
      expectedMaxGain: 'Depends on confirmed setup',
      probability: clamp(Math.round(60 + Math.min(moveOverpricing, 30) * 0.2), 58, 72),
    });
  } else if (moveOverpricing < -10) {
    strategies.push({
      name: 'Long Option (Single-Leg)',
      description: `Implied move is discounted versus history by ${round(Math.abs(moveOverpricing))}%. A single-leg option can capture outsized movement.`,
      setup: {
        type: directionalBias === 'bearish' ? 'long_put' : 'long_call',
        strikeAround: round(currentPrice),
      },
      riskReward: 'Risk defined to premium paid',
      bestWhen: 'Expected move is underpriced and directional follow-through appears likely',
      expectedMaxLoss: 'Option premium paid',
      expectedMaxGain: 'Large if trend extends',
      probability: clamp(Math.round(48 + Math.min(Math.abs(moveOverpricing), 30) * 0.5), 45, 62),
    });
  }

  if ((ivRank ?? 0) > 80) {
    strategies.push({
      name: 'High-IV Caution',
      description: 'IV rank is elevated. Prefer waiting for post-event volatility compression before initiating long options.',
      setup: {
        type: 'high_iv_caution',
        ivRank,
      },
      riskReward: 'Avoid adverse IV crush',
      bestWhen: 'IV rank > 80',
      expectedMaxLoss: 'No position until IV cools',
      expectedMaxGain: 'Cleaner entries after event',
      probability: 64,
    });
  }

  if (directionalBias === 'bullish') {
    strategies.push({
      name: 'Directional Long Call',
      description: 'Directional bullish setup using a single-leg call with defined premium risk.',
      setup: {
        type: 'long_call',
        strikeAround: round(currentPrice),
        firstTargetAround: round(currentPrice * (1 + expectedMovePct / 100)),
      },
      riskReward: 'Risk 1 to make 1.0-2.5+',
      bestWhen: 'Historical post-earnings drift is upward',
      expectedMaxLoss: 'Option premium paid',
      expectedMaxGain: 'Large if trend extends',
      probability: 52,
    });
  }

  if (directionalBias === 'bearish') {
    strategies.push({
      name: 'Directional Long Put',
      description: 'Directional bearish setup using a single-leg put with defined premium risk.',
      setup: {
        type: 'long_put',
        strikeAround: round(currentPrice),
        firstTargetAround: round(currentPrice * (1 - expectedMovePct / 100)),
      },
      riskReward: 'Risk 1 to make 1.0-2.5+',
      bestWhen: 'Historical post-earnings drift is downward',
      expectedMaxLoss: 'Option premium paid',
      expectedMaxGain: 'Large if trend extends',
      probability: 51,
    });
  }

  if (strategies.length === 0) {
    strategies.push({
      name: 'Wait for Post-Earnings Setup',
      description: `Implied and historical moves are aligned for ${symbol}. Consider waiting for reaction-day trend setup instead of pre-event positioning.`,
      setup: { type: 'wait_for_confirmation' },
      riskReward: 'Capital preservation focus',
      bestWhen: 'No clear volatility mispricing or directional bias',
      expectedMaxLoss: 'Opportunity cost only',
      expectedMaxGain: 'Depends on confirmed setup execution',
      probability: 65,
    });
  }

  return strategies.slice(0, 4);
}

export class EarningsService {
  async getEarningsCalendar(watchlist: string[] = [], daysAhead: number = DEFAULT_DAYS_AHEAD): Promise<EarningsCalendarEvent[]> {
    const symbols = sanitizeWatchlist(watchlist);
    const safeDaysAhead = clamp(Math.round(daysAhead || DEFAULT_DAYS_AHEAD), 1, MAX_DAYS_AHEAD);
    const redisCacheKey = buildEarningsCalendarCacheKey(symbols, safeDaysAhead);

    const cachedCalendar = await cacheGet<EarningsCalendarEvent[]>(redisCacheKey);
    if (cachedCalendar) {
      logger.info('Earnings calendar cache hit', { symbols: symbols.length, daysAhead: safeDaysAhead });
      return cachedCalendar;
    }

    const today = new Date();
    const fromDate = formatDate(today);
    const toDate = formatDate(addDays(today, safeDaysAhead));

    const alphaEvents = await fetchAlphaVantageCalendar({
      symbols,
      fromDate,
      toDate,
    });

    if (alphaEvents.length > 0) {
      const deduped = Array.from(new Map(
        alphaEvents.map((event) => [`${event.symbol}:${event.date}`, event]),
      ).values()).sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
      await cacheSet(redisCacheKey, deduped, EARNINGS_REDIS_CACHE_TTL_SECONDS);
      return deduped;
    }

    if (!ENABLE_TMX_CORPORATE_EVENTS) {
      await cacheSet(redisCacheKey, [], EARNINGS_REDIS_CACHE_TTL_SECONDS);
      return [];
    }

    const rawEvents = await fetchCorporateEvents({
      symbols,
      fromDate,
      toDate,
    });

    const parsedEvents = rawEvents
      .map((event) => {
        const symbol = String(event.ticker || event.symbol || '').toUpperCase();
        const date = getEventDate(event);
        if (!symbol || !date || !symbols.includes(symbol)) return null;
        if (date < fromDate || date > toDate) return null;

        return {
          symbol,
          date,
          time: classifyEarningsTiming(event),
          confirmed: Boolean(event.confirmed ?? true),
        } as EarningsCalendarEvent;
      })
      .filter((event): event is EarningsCalendarEvent => event != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));

    if (parsedEvents.length > 0) {
      await cacheSet(redisCacheKey, parsedEvents, EARNINGS_REDIS_CACHE_TTL_SECONDS);
      return parsedEvents;
    }

    await cacheSet(redisCacheKey, [], EARNINGS_REDIS_CACHE_TTL_SECONDS);
    return [];
  }

  async getEarningsAnalysis(symbolInput: string): Promise<EarningsAnalysis> {
    const symbol = sanitizeSymbols([symbolInput], 1)[0];
    if (!symbol) {
      throw new Error('Invalid symbol format');
    }

    const redisCacheKey = buildEarningsAnalysisCacheKey(symbol);
    const cachedAnalysis = await cacheGet<EarningsAnalysis>(redisCacheKey);
    if (cachedAnalysis) {
      logger.info('Earnings analysis cache hit', { symbol });
      return cachedAnalysis;
    }

    const today = new Date();
    const calendar = await this.getEarningsCalendar([symbol], 90);
    const nextEvent = calendar.find((event) => event.date >= formatDate(today)) || null;

    if (nextEvent) {
      const cached = await this.getCachedAnalysis(symbol, nextEvent.date);
      if (cached) {
        await cacheSet(redisCacheKey, cached, EARNINGS_REDIS_CACHE_TTL_SECONDS);
        return cached;
      }
    }

    const expiryDates = await fetchExpirationDates(symbol);
    const targetExpiry = nextEvent
      ? expiryDates.find((expiry) => expiry >= nextEvent.date) || expiryDates[0]
      : expiryDates[0];

    if (!targetExpiry) {
      throw new Error(`No options expirations found for ${symbol}`);
    }

    const chain = await fetchOptionsChain(symbol, targetExpiry, 20);
    const atmCall = pickAtmContract(chain.options.calls, chain.currentPrice);
    const atmPut = pickAtmContract(chain.options.puts, chain.currentPrice);

    const straddle = markPrice(atmCall) + markPrice(atmPut);
    const expectedMovePct = chain.currentPrice > 0 ? (straddle / chain.currentPrice) * 100 : 0;

    const todayIso = formatDate(today);
    const historyFrom = formatDate(addDays(today, -HISTORY_LOOKBACK_DAYS));
    const historyTo = todayIso;

    let historicalEvents = await fetchAlphaVantageHistoricalEvents(symbol, todayIso);

    if (historicalEvents.length === 0 && ENABLE_TMX_CORPORATE_EVENTS) {
      const rawHistory = await fetchCorporateEvents({
        symbols: [symbol],
        fromDate: historyFrom,
        toDate: historyTo,
      });

      historicalEvents = rawHistory
        .map((event) => {
          const date = getEventDate(event);
          if (!date || date >= todayIso) return null;

          return {
            date,
            timing: classifyEarningsTiming(event),
            surprise: parseEarningsSurprise(event),
          };
        })
        .filter((event): event is { date: string; timing: EarningsTiming; surprise: EarningsHistoricalMove['surprise'] } => event != null)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, HISTORY_MAX_QUARTERS);
    }

    const historicalMoves: EarningsHistoricalMove[] = [];

    for (const event of historicalEvents) {
      try {
        const [realized, expected] = await Promise.all([
          estimateHistoricalMove(symbol, event.date, event.timing),
          estimateExpectedMovePct(symbol, event.date),
        ]);

        if (!realized) continue;

        historicalMoves.push({
          date: event.date,
          expectedMove: round(expected ?? realized.actualMove),
          actualMove: round(realized.actualMove),
          direction: realized.direction,
          surprise: event.surprise,
        });
      } catch (error: any) {
        logger.warn('Failed to derive historical earnings move', {
          symbol,
          date: event.date,
          error: error?.message || String(error),
        });
      }
    }

    const avgHistoricalMove = round(average(historicalMoves.map((move) => move.actualMove)));
    const moveOverpricing = avgHistoricalMove > 0
      ? round(((expectedMovePct - avgHistoricalMove) / avgHistoricalMove) * 100)
      : 0;

    const ivProfile = await analyzeIVProfile(symbol, {
      strikeRange: 20,
      maxExpirations: 4,
    });

    const currentIV = ivProfile.ivRank.currentIV;
    const preEarningsIVRank = ivProfile.ivRank.ivRank;
    const projectedIVCrushPct = currentIV == null
      ? null
      : round(clamp(15 + ((preEarningsIVRank ?? 50) / 100) * 25, 15, 50));

    const upCount = historicalMoves.filter((move) => move.direction === 'up').length;
    const directionalBias: 'bullish' | 'bearish' | 'neutral' = historicalMoves.length < 4
      ? 'neutral'
      : upCount / historicalMoves.length >= 0.65
        ? 'bullish'
        : upCount / historicalMoves.length <= 0.35
          ? 'bearish'
          : 'neutral';

    const suggestedStrategies = buildSuggestedStrategies({
      symbol,
      moveOverpricing,
      expectedMovePct: round(expectedMovePct),
      ivRank: preEarningsIVRank,
      directionalBias,
      currentPrice: chain.currentPrice,
    });

    const assessment: EarningsAnalysis['straddlePricing']['assessment'] = moveOverpricing > 20
      ? 'overpriced'
      : moveOverpricing < -10
        ? 'underpriced'
        : 'fair';

    const earningsDate = nextEvent?.date ?? null;
    const daysUntil = earningsDate
      ? Math.max(0, Math.ceil((new Date(`${earningsDate}T00:00:00.000Z`).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
      : null;

    const analysis: EarningsAnalysis = {
      symbol,
      earningsDate,
      daysUntil,
      expectedMove: {
        points: round(straddle),
        pct: round(expectedMovePct),
      },
      historicalMoves,
      avgHistoricalMove,
      moveOverpricing,
      currentIV,
      preEarningsIVRank,
      projectedIVCrushPct,
      straddlePricing: {
        atmStraddle: round(straddle),
        referenceExpiry: targetExpiry,
        assessment,
      },
      suggestedStrategies,
      asOf: new Date().toISOString(),
    };

    if (earningsDate) {
      await this.setCachedAnalysis(symbol, earningsDate, analysis);
    }

    await cacheSet(redisCacheKey, analysis, EARNINGS_REDIS_CACHE_TTL_SECONDS);

    return analysis;
  }

  private async getCachedAnalysis(symbol: string, earningsDate: string): Promise<EarningsAnalysis | null> {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('ai_coach_earnings_cache')
        .select('analysis_data, expires_at')
        .eq('symbol', symbol)
        .eq('earnings_date', earningsDate)
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (error) {
        logger.warn('Failed to load earnings cache', { symbol, earningsDate, error: error.message });
        return null;
      }

      if (!data?.analysis_data || !data.expires_at) return null;

      return data.analysis_data as EarningsAnalysis;
    } catch (error: any) {
      logger.warn('Failed to parse earnings cache payload', {
        symbol,
        earningsDate,
        error: error?.message || String(error),
      });
      return null;
    }
  }

  private async setCachedAnalysis(symbol: string, earningsDate: string, analysis: EarningsAnalysis): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS).toISOString();

      const { error } = await supabase
        .from('ai_coach_earnings_cache')
        .upsert({
          symbol,
          earnings_date: earningsDate,
          analysis_data: analysis,
          cached_at: now.toISOString(),
          expires_at: expiresAt,
        }, { onConflict: 'symbol,earnings_date' });

      if (error) {
        logger.warn('Failed to persist earnings cache', { symbol, earningsDate, error: error.message });
      }
    } catch (error: any) {
      logger.warn('Unexpected earnings cache write error', {
        symbol,
        earningsDate,
        error: error?.message || String(error),
      });
    }
  }
}

export const earningsService = new EarningsService();

export async function getEarningsCalendar(watchlist: string[] = [], daysAhead: number = DEFAULT_DAYS_AHEAD): Promise<EarningsCalendarEvent[]> {
  return earningsService.getEarningsCalendar(watchlist, daysAhead);
}

export async function getEarningsAnalysis(symbol: string): Promise<EarningsAnalysis> {
  return earningsService.getEarningsAnalysis(symbol);
}

export const __testables = {
  classifyEarningsTiming,
  buildSuggestedStrategies,
  getAlphaVantageHorizon,
  parseCsvRows,
  extractAlphaCalendarEvents,
  parseAlphaSurprise,
  ENABLE_TMX_CORPORATE_EVENTS,
};
