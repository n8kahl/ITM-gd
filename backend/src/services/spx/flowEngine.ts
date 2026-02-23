import { cacheGet, cacheSet } from '../../config/redis';
import { getAggregates, getOptionsSnapshot, type OptionsSnapshot } from '../../config/massive';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { SPXFlowEvent } from './types';
import { nowIso, round, stableId } from './utils';

const FLOW_CACHE_KEY = 'spx_command_center:flow';
const FLOW_CACHE_TTL_SECONDS = 20;
const FLOW_FETCH_TIMEOUT_MS = 15000;
let flowInFlight: Promise<SPXFlowEvent[]> | null = null;
const MIN_FLOW_VOLUME = 10;
const MIN_FLOW_PREMIUM = 10000;
const MAX_FLOW_EVENTS = 80;
const FLOW_INTERVAL_LOOKBACK_MINUTES = 120;
const FLOW_INTERVAL_MIN_VOLUME = 2;
const FLOW_INTERVAL_MIN_PREMIUM = 25000;
const FLOW_INTERVAL_SWEEP_VOLUME = 28;
const FLOW_CONTRACT_SCAN_LIMIT = 24;
const FLOW_BARS_BATCH_SIZE = 6;
const FLOW_EXPIRY_WINDOW_DAYS = 7;

function toIsoFromTimestamp(rawTimestamp: number | undefined): string {
  if (!rawTimestamp || !Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
    return nowIso();
  }

  const ms = rawTimestamp > 1e15
    ? Math.floor(rawTimestamp / 1_000_000)
    : rawTimestamp > 1e12
      ? Math.floor(rawTimestamp / 1_000)
      : rawTimestamp;

  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) {
    return nowIso();
  }

  return parsed.toISOString();
}

function toMidPrice(snapshot: OptionsSnapshot): number {
  const dayClose = snapshot.day?.close;
  if (typeof dayClose === 'number' && dayClose > 0) {
    return dayClose;
  }

  const bid = snapshot.last_quote?.bid ?? 0;
  const ask = snapshot.last_quote?.ask ?? 0;
  if (bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }

  return Math.max(bid, ask, 0);
}

function toFlowEvent(
  symbol: 'SPX' | 'SPY',
  snapshot: OptionsSnapshot,
): SPXFlowEvent | null {
  const details = snapshot.details;
  const strike = details?.strike_price;
  const expiry = details?.expiration_date;
  const contractType = details?.contract_type;

  if (
    typeof strike !== 'number'
    || typeof expiry !== 'string'
    || (contractType !== 'call' && contractType !== 'put')
  ) {
    return null;
  }

  const volume = Math.max(0, snapshot.day?.volume || 0);
  if (volume < MIN_FLOW_VOLUME) {
    return null;
  }

  const openInterest = Math.max(0, snapshot.open_interest || 0);
  const mid = toMidPrice(snapshot);
  const premium = round(mid * volume * 100, 2);
  if (premium < MIN_FLOW_PREMIUM) {
    return null;
  }

  const relativeSize = openInterest > 0 ? volume / openInterest : volume / 100;
  const type: SPXFlowEvent['type'] = relativeSize >= 0.5 ? 'sweep' : 'block';

  const seed = [
    symbol,
    strike.toFixed(2),
    expiry,
    contractType,
    volume,
    Math.round(premium),
    snapshot.ticker,
  ].join('|');

  return {
    id: stableId('spx_flow', seed),
    type,
    symbol,
    strike: round(strike, 2),
    expiry,
    size: Math.round(volume),
    direction: contractType === 'call' ? 'bullish' : 'bearish',
    premium,
    timestamp: toIsoFromTimestamp(snapshot.last_quote?.last_updated),
  };
}

interface FlowContractCandidate {
  ticker: string;
  symbol: 'SPX' | 'SPY';
  strike: number;
  expiry: string;
  contractType: 'call' | 'put';
  dayVolume: number;
  premiumEstimate: number;
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isExpiryInWindow(expiry: string, sessionDate: string): boolean {
  if (expiry < sessionDate) return false;
  return expiry <= addDays(sessionDate, FLOW_EXPIRY_WINDOW_DAYS);
}

function toFlowContractCandidates(input: {
  symbol: 'SPX' | 'SPY';
  sessionDate: string;
  snapshots: OptionsSnapshot[];
}): FlowContractCandidate[] {
  return input.snapshots
    .map((snapshot) => {
      const details = snapshot.details;
      const ticker = typeof snapshot.ticker === 'string' ? snapshot.ticker.trim().toUpperCase() : '';
      const strike = details?.strike_price;
      const expiry = details?.expiration_date;
      const contractType = details?.contract_type;
      if (!ticker || typeof strike !== 'number' || typeof expiry !== 'string' || (contractType !== 'call' && contractType !== 'put')) {
        return null;
      }
      if (!isExpiryInWindow(expiry, input.sessionDate)) return null;

      const dayVolume = Math.max(0, snapshot.day?.volume || 0);
      if (dayVolume < MIN_FLOW_VOLUME) return null;
      const premiumEstimate = round(toMidPrice(snapshot) * dayVolume * 100, 2);
      if (premiumEstimate < MIN_FLOW_PREMIUM) return null;

      return {
        ticker,
        symbol: input.symbol,
        strike: round(strike, 2),
        expiry,
        contractType,
        dayVolume,
        premiumEstimate,
      } as FlowContractCandidate;
    })
    .filter((candidate): candidate is FlowContractCandidate => candidate !== null)
    .sort((a, b) => {
      if (b.premiumEstimate !== a.premiumEstimate) return b.premiumEstimate - a.premiumEstimate;
      return b.dayVolume - a.dayVolume;
    });
}

async function loadContractMinuteBars(input: {
  ticker: string;
  sessionDate: string;
}): Promise<Array<{ t: number; c: number; v: number }>> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Flow interval bars timeout for ${input.ticker}`)), FLOW_FETCH_TIMEOUT_MS),
  );
  try {
    const response = await Promise.race([
      getAggregates(input.ticker, 1, 'minute', input.sessionDate, input.sessionDate),
      timeout,
    ]);
    const rawBars = (response.results || [])
      .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c) && Number.isFinite(bar.v) && bar.c > 0 && bar.v >= FLOW_INTERVAL_MIN_VOLUME)
      .map((bar) => ({ t: bar.t, c: bar.c, v: bar.v }));
    if (rawBars.length === 0) return [];

    const latestMs = rawBars[rawBars.length - 1].t;
    const minMs = latestMs - (FLOW_INTERVAL_LOOKBACK_MINUTES * 60_000);
    return rawBars.filter((bar) => bar.t >= minMs);
  } catch (error) {
    logger.warn('Flow interval contract bars unavailable', {
      ticker: input.ticker,
      sessionDate: input.sessionDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function flowEventsFromIntervalBars(input: {
  candidate: FlowContractCandidate;
  bars: Array<{ t: number; c: number; v: number }>;
}): SPXFlowEvent[] {
  if (input.bars.length === 0) return [];

  const premiums = input.bars.map((bar) => bar.c * bar.v * 100);
  const avgPremium = premiums.reduce((sum, value) => sum + value, 0) / premiums.length;
  const threshold = Math.max(FLOW_INTERVAL_MIN_PREMIUM, avgPremium * 1.35);

  return input.bars
    .map((bar) => {
      const premium = round(bar.c * bar.v * 100, 2);
      if (premium < threshold) return null;
      const isSweep = bar.v >= FLOW_INTERVAL_SWEEP_VOLUME || premium >= Math.max(FLOW_INTERVAL_MIN_PREMIUM * 2, avgPremium * 2.1);
      return {
        id: stableId('spx_flow_interval', `${input.candidate.symbol}|${input.candidate.ticker}|${bar.t}|${bar.v}|${premium}`),
        type: isSweep ? 'sweep' : 'block',
        symbol: input.candidate.symbol,
        strike: input.candidate.strike,
        expiry: input.candidate.expiry,
        size: Math.round(bar.v),
        direction: input.candidate.contractType === 'call' ? 'bullish' : 'bearish',
        premium,
        timestamp: new Date(bar.t).toISOString(),
      } satisfies SPXFlowEvent;
    })
    .filter((event): event is SPXFlowEvent => event !== null);
}

async function fetchFlowFromIntervalizedSnapshots(input: {
  sessionDate: string;
  spxSnapshots: OptionsSnapshot[];
  spySnapshots: OptionsSnapshot[];
}): Promise<SPXFlowEvent[]> {
  const candidates = [
    ...toFlowContractCandidates({
      symbol: 'SPX',
      sessionDate: input.sessionDate,
      snapshots: input.spxSnapshots,
    }),
    ...toFlowContractCandidates({
      symbol: 'SPY',
      sessionDate: input.sessionDate,
      snapshots: input.spySnapshots,
    }),
  ]
    .sort((a, b) => b.premiumEstimate - a.premiumEstimate)
    .slice(0, FLOW_CONTRACT_SCAN_LIMIT);

  if (candidates.length === 0) return [];

  const events: SPXFlowEvent[] = [];
  for (let index = 0; index < candidates.length; index += FLOW_BARS_BATCH_SIZE) {
    const batch = candidates.slice(index, index + FLOW_BARS_BATCH_SIZE);
    const rows = await Promise.all(batch.map(async (candidate) => ({
      candidate,
      bars: await loadContractMinuteBars({
        ticker: candidate.ticker,
        sessionDate: input.sessionDate,
      }),
    })));
    for (const row of rows) {
      events.push(...flowEventsFromIntervalBars({
        candidate: row.candidate,
        bars: row.bars,
      }));
    }
  }

  return events
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp.localeCompare(a.timestamp);
      if (b.premium !== a.premium) return b.premium - a.premium;
      return b.size - a.size;
    })
    .slice(0, MAX_FLOW_EVENTS);
}

async function fetchFlowFromSnapshots(forceRefresh: boolean): Promise<SPXFlowEvent[]> {
  const fetchWithTimeout = async (symbol: string): Promise<OptionsSnapshot[]> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Flow snapshot timeout for ${symbol}`)), FLOW_FETCH_TIMEOUT_MS),
    );
    try {
      return await Promise.race([getOptionsSnapshot(symbol), timeout]);
    } catch (error) {
      logger.warn('Flow snapshot fetch failed or timed out', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  };

  const [spxSnapshots, spySnapshots] = await Promise.all([
    fetchWithTimeout('SPX'),
    fetchWithTimeout('SPY'),
  ]);

  const sessionDate = toEasternTime(new Date()).dateStr;
  const intervalized = await fetchFlowFromIntervalizedSnapshots({
    sessionDate,
    spxSnapshots,
    spySnapshots,
  });
  if (intervalized.length > 0) {
    return intervalized;
  }

  const events: SPXFlowEvent[] = [];
  for (const snapshot of spxSnapshots) {
    const event = toFlowEvent('SPX', snapshot);
    if (event) events.push(event);
  }

  for (const snapshot of spySnapshots) {
    const event = toFlowEvent('SPY', snapshot);
    if (event) events.push(event);
  }

  const sorted = events
    .sort((a, b) => {
      if (b.premium !== a.premium) return b.premium - a.premium;
      if (b.size !== a.size) return b.size - a.size;
      return b.timestamp.localeCompare(a.timestamp);
    })
    .slice(0, MAX_FLOW_EVENTS);

  if (sorted.length > 0 || forceRefresh) {
    return sorted;
  }

  return [];
}

export async function getFlowEvents(options?: {
  forceRefresh?: boolean;
}): Promise<SPXFlowEvent[]> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && flowInFlight) {
    return flowInFlight;
  }

  const run = async (): Promise<SPXFlowEvent[]> => {
    if (!forceRefresh) {
      const cached = await cacheGet<SPXFlowEvent[]>(FLOW_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    let events: SPXFlowEvent[] = [];

    try {
      events = await fetchFlowFromSnapshots(forceRefresh);
    } catch {
      events = [];
    }

    if (events.length === 0) {
      // Real-only flow mode: do not inject synthetic prints into decision logic.
      // Downstream services must treat empty flow as unavailable/neutral.
      events = [];
    }

    await cacheSet(FLOW_CACHE_KEY, events, FLOW_CACHE_TTL_SECONDS);
    return events;
  };

  if (forceRefresh) {
    return run();
  }

  flowInFlight = run();
  try {
    return await flowInFlight;
  } finally {
    flowInFlight = null;
  }
}
