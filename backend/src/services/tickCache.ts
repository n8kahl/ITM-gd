import { logger } from '../lib/logger';

export interface NormalizedMarketTick {
  symbol: string;
  rawSymbol: string;
  price: number;
  size: number;
  timestamp: number;
  sequence: number | null;
}

const DEFAULT_MAX_TICKS_PER_SYMBOL = 6000;

let maxTicksPerSymbol = DEFAULT_MAX_TICKS_PER_SYMBOL;
const latestTickBySymbol = new Map<string, NormalizedMarketTick>();
const tickBufferBySymbol = new Map<string, NormalizedMarketTick[]>();
const lastSequenceBySymbol = new Map<string, number>();

export function normalizeTickSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^I:/, '');
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function trimBuffer(symbol: string): void {
  const buffer = tickBufferBySymbol.get(symbol);
  if (!buffer || buffer.length <= maxTicksPerSymbol) return;

  const overflow = buffer.length - maxTicksPerSymbol;
  buffer.splice(0, overflow);
}

export function configureTickCache(options?: { maxTicksPerSymbol?: number }): void {
  const requested = options?.maxTicksPerSymbol;
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return;

  maxTicksPerSymbol = Math.max(1, Math.floor(requested));
  for (const symbol of tickBufferBySymbol.keys()) {
    trimBuffer(symbol);
  }
}

export function ingestTick(tick: NormalizedMarketTick): boolean {
  const symbol = normalizeTickSymbol(tick.symbol);
  if (!symbol) return false;

  const price = toFiniteNumber(tick.price, 0);
  const size = Math.max(0, Math.floor(toFiniteNumber(tick.size, 0)));
  const timestamp = Math.floor(toFiniteNumber(tick.timestamp, 0));
  const sequence = typeof tick.sequence === 'number' && Number.isFinite(tick.sequence)
    ? Math.floor(tick.sequence)
    : null;

  if (price <= 0 || timestamp <= 0) {
    logger.debug('Rejected invalid tick', { symbol, price, timestamp });
    return false;
  }

  const latest = latestTickBySymbol.get(symbol);
  if (latest) {
    const isDuplicate =
      latest.price === price
      && latest.size === size
      && latest.timestamp === timestamp
      && latest.sequence === sequence;
    if (isDuplicate) return false;
  }

  const lastSequence = lastSequenceBySymbol.get(symbol);
  if (sequence !== null && typeof lastSequence === 'number' && sequence <= lastSequence) {
    return false;
  }

  if (sequence === null && latest && timestamp < latest.timestamp) {
    return false;
  }

  const normalized: NormalizedMarketTick = {
    symbol,
    rawSymbol: tick.rawSymbol || tick.symbol,
    price,
    size,
    timestamp,
    sequence,
  };

  latestTickBySymbol.set(symbol, normalized);
  if (sequence !== null) {
    lastSequenceBySymbol.set(symbol, sequence);
  }

  const buffer = tickBufferBySymbol.get(symbol) || [];
  buffer.push(normalized);
  tickBufferBySymbol.set(symbol, buffer);
  trimBuffer(symbol);
  return true;
}

export function getLatestTick(symbol: string): NormalizedMarketTick | null {
  return latestTickBySymbol.get(normalizeTickSymbol(symbol)) || null;
}

export function getRecentTicks(symbol: string, limit: number = 250): NormalizedMarketTick[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  const buffer = tickBufferBySymbol.get(normalizeTickSymbol(symbol)) || [];
  if (buffer.length <= safeLimit) return [...buffer];
  return buffer.slice(buffer.length - safeLimit);
}

export function getTickCacheStats(): {
  symbols: number;
  latestCount: number;
  bufferedTicks: number;
  maxTicksPerSymbol: number;
} {
  let bufferedTicks = 0;
  for (const ticks of tickBufferBySymbol.values()) {
    bufferedTicks += ticks.length;
  }

  return {
    symbols: tickBufferBySymbol.size,
    latestCount: latestTickBySymbol.size,
    bufferedTicks,
    maxTicksPerSymbol,
  };
}

export function resetTickCache(): void {
  latestTickBySymbol.clear();
  tickBufferBySymbol.clear();
  lastSequenceBySymbol.clear();
  maxTicksPerSymbol = DEFAULT_MAX_TICKS_PER_SYMBOL;
}
