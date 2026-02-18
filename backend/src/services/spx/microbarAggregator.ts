import type { NormalizedMarketTick } from '../tickCache';

export type MicrobarInterval = '1s' | '5s';

export interface TickMicrobar {
  symbol: string;
  interval: MicrobarInterval;
  bucketStartMs: number;
  bucketEndMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  updatedAtMs: number;
  finalized: boolean;
  source: 'tick';
}

interface WorkingMicrobar {
  symbol: string;
  interval: MicrobarInterval;
  intervalMs: number;
  bucketStartMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  updatedAtMs: number;
}

const INTERVALS: Array<{ interval: MicrobarInterval; intervalMs: number }> = [
  { interval: '1s', intervalMs: 1000 },
  { interval: '5s', intervalMs: 5000 },
];

const workingByKey = new Map<string, WorkingMicrobar>();

function mapToReadonlyMicrobar(bar: WorkingMicrobar, finalized: boolean): TickMicrobar {
  return {
    symbol: bar.symbol,
    interval: bar.interval,
    bucketStartMs: bar.bucketStartMs,
    bucketEndMs: bar.bucketStartMs + bar.intervalMs,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    trades: bar.trades,
    updatedAtMs: bar.updatedAtMs,
    finalized,
    source: 'tick',
  };
}

function buildKey(symbol: string, interval: MicrobarInterval): string {
  return `${symbol}:${interval}`;
}

function toBucketStart(timestampMs: number, intervalMs: number): number {
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

export function ingestTickMicrobars(tick: NormalizedMarketTick): TickMicrobar[] {
  const symbol = tick.symbol;
  const events: TickMicrobar[] = [];

  for (const { interval, intervalMs } of INTERVALS) {
    const key = buildKey(symbol, interval);
    const bucketStartMs = toBucketStart(tick.timestamp, intervalMs);
    const working = workingByKey.get(key);

    if (!working) {
      const created: WorkingMicrobar = {
        symbol,
        interval,
        intervalMs,
        bucketStartMs,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
        trades: 1,
        updatedAtMs: tick.timestamp,
      };
      workingByKey.set(key, created);
      events.push(mapToReadonlyMicrobar(created, false));
      continue;
    }

    if (bucketStartMs < working.bucketStartMs) {
      continue;
    }

    if (bucketStartMs > working.bucketStartMs) {
      events.push(mapToReadonlyMicrobar(working, true));

      const rolled: WorkingMicrobar = {
        symbol,
        interval,
        intervalMs,
        bucketStartMs,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
        trades: 1,
        updatedAtMs: tick.timestamp,
      };
      workingByKey.set(key, rolled);
      events.push(mapToReadonlyMicrobar(rolled, false));
      continue;
    }

    working.high = Math.max(working.high, tick.price);
    working.low = Math.min(working.low, tick.price);
    working.close = tick.price;
    working.volume += tick.size;
    working.trades += 1;
    working.updatedAtMs = tick.timestamp;
    events.push(mapToReadonlyMicrobar(working, false));
  }

  return events;
}

export function resetMicrobarAggregator(): void {
  workingByKey.clear();
}

export function getWorkingMicrobar(symbol: string, interval: MicrobarInterval): TickMicrobar | null {
  const bar = workingByKey.get(buildKey(symbol, interval));
  if (!bar) return null;
  return mapToReadonlyMicrobar(bar, false);
}

