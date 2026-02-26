import { logger } from '../lib/logger';

export type TickAggressorSide = 'buyer' | 'seller' | 'neutral';

export interface NormalizedMarketTick {
  symbol: string;
  rawSymbol: string;
  price: number;
  size: number;
  timestamp: number;
  sequence: number | null;
  bid?: number | null;
  ask?: number | null;
  bidSize?: number | null;
  askSize?: number | null;
  aggressorSide?: TickAggressorSide;
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

function toOptionalPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toOptionalNonNegativeSize(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function deriveAggressorSide(input: {
  explicit: TickAggressorSide | null;
  price: number;
  bid: number | null;
  ask: number | null;
}): TickAggressorSide {
  if (input.explicit === 'buyer' || input.explicit === 'seller' || input.explicit === 'neutral') {
    return input.explicit;
  }
  if (input.ask != null && input.price >= input.ask) return 'buyer';
  if (input.bid != null && input.price <= input.bid) return 'seller';
  return 'neutral';
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
  const bid = toOptionalPositiveNumber(tick.bid);
  const ask = toOptionalPositiveNumber(tick.ask);
  const bidSize = toOptionalNonNegativeSize(tick.bidSize);
  const askSize = toOptionalNonNegativeSize(tick.askSize);
  const explicitAggressor = tick.aggressorSide === 'buyer' || tick.aggressorSide === 'seller' || tick.aggressorSide === 'neutral'
    ? tick.aggressorSide
    : null;
  const aggressorSide = deriveAggressorSide({
    explicit: explicitAggressor,
    price,
    bid,
    ask,
  });

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
      && latest.sequence === sequence
      && (latest.bid ?? null) === bid
      && (latest.ask ?? null) === ask
      && (latest.bidSize ?? null) === bidSize
      && (latest.askSize ?? null) === askSize
      && (latest.aggressorSide ?? 'neutral') === aggressorSide;
    if (isDuplicate) return false;
  }

  const lastSequence = lastSequenceBySymbol.get(symbol);
  if (sequence !== null && typeof lastSequence === 'number' && sequence <= lastSequence) {
    const gap = lastSequence - sequence;
    if (gap > 2) {
      logger.warn('Significant tick sequence regression', {
        symbol,
        expected: lastSequence + 1,
        received: sequence,
        gap,
      });
    }
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
    bid,
    ask,
    bidSize,
    askSize,
    aggressorSide,
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
