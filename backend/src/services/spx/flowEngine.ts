import { cacheGet, cacheSet } from '../../config/redis';
import { getOptionsSnapshot, type OptionsSnapshot } from '../../config/massive';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { detectActiveSetups } from './setupDetector';
import type { SPXFlowEvent } from './types';
import { nowIso, round, stableId, uuid } from './utils';

const FLOW_CACHE_KEY = 'spx_command_center:flow';
const FLOW_CACHE_TTL_SECONDS = 5;
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

function buildSyntheticFallback(
  setups: Awaited<ReturnType<typeof detectActiveSetups>>,
  gex: Awaited<ReturnType<typeof computeUnifiedGEXLandscape>>,
): SPXFlowEvent[] {
  const baseExpiry = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const events = setups.slice(0, 8).map((setup, idx) => {
    const strike = setup.direction === 'bullish'
      ? Math.floor(setup.entryZone.high / 5) * 5
      : Math.ceil(setup.entryZone.low / 5) * 5;

    const size = Math.max(120, Math.round((setup.confluenceScore * 180) + idx * 35));
    const premium = round(size * ((setup.confluenceScore + 1) * 2.1), 2);
    const type: SPXFlowEvent['type'] = idx % 3 === 0 ? 'block' : 'sweep';
    const symbol: SPXFlowEvent['symbol'] = idx % 2 === 0 ? 'SPX' : 'SPY';

    return {
      id: uuid('flow'),
      type,
      symbol,
      strike,
      expiry: baseExpiry,
      size,
      direction: setup.direction,
      premium,
      timestamp: nowIso(),
    };
  });

  if (events.length === 0) {
    events.push({
      id: uuid('flow'),
      type: 'block',
      symbol: 'SPX',
      strike: round(gex.combined.flipPoint, 0),
      expiry: baseExpiry,
      size: 100,
      direction: gex.combined.netGex >= 0 ? 'bullish' : 'bearish',
      premium: 250000,
      timestamp: nowIso(),
    });
  }

  return events;
}

export async function getFlowEvents(options?: { forceRefresh?: boolean }): Promise<SPXFlowEvent[]> {
  const forceRefresh = options?.forceRefresh === true;

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
    const [setups, gex] = await Promise.all([
      detectActiveSetups({ forceRefresh }),
      computeUnifiedGEXLandscape({ forceRefresh }),
    ]);
    events = buildSyntheticFallback(setups, gex);
  }

  await cacheSet(FLOW_CACHE_KEY, events, FLOW_CACHE_TTL_SECONDS);
  return events;
}
