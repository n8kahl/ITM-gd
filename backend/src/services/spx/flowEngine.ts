import { cacheGet, cacheSet } from '../../config/redis';
import { getOptionsSnapshot, type OptionsSnapshot } from '../../config/massive';
import type { SPXFlowEvent } from './types';
import { nowIso, round, stableId } from './utils';

const FLOW_CACHE_KEY = 'spx_command_center:flow';
const FLOW_CACHE_TTL_SECONDS = 20;
let flowInFlight: Promise<SPXFlowEvent[]> | null = null;
const MIN_FLOW_VOLUME = 10;
const MIN_FLOW_PREMIUM = 10000;
const MAX_FLOW_EVENTS = 20;

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

async function fetchFlowFromSnapshots(forceRefresh: boolean): Promise<SPXFlowEvent[]> {
  const [spxSnapshots, spySnapshots] = await Promise.all([
    getOptionsSnapshot('SPX'),
    getOptionsSnapshot('SPY'),
  ]);

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
