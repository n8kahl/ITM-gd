import type { NormalizedMarketTick, TickAggressorSide } from '../tickCache';

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
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  deltaVolume: number;
  bidSize: number | null;
  askSize: number | null;
  bidAskImbalance: number | null;
  bidSizeAtClose: number | null;
  askSizeAtClose: number | null;
  askBidSizeRatio: number | null;
  quoteCoveragePct: number;
  avgSpreadBps: number | null;
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
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  bidSizeSum: number;
  askSizeSum: number;
  bidSizeSamples: number;
  askSizeSamples: number;
  bidSizeAtClose: number | null;
  askSizeAtClose: number | null;
  quoteSamples: number;
  spreadBpsSum: number;
  spreadBpsSamples: number;
  updatedAtMs: number;
}

const INTERVALS: Array<{ interval: MicrobarInterval; intervalMs: number }> = [
  { interval: '1s', intervalMs: 1000 },
  { interval: '5s', intervalMs: 5000 },
];

const workingByKey = new Map<string, WorkingMicrobar>();

function mapToReadonlyMicrobar(bar: WorkingMicrobar, finalized: boolean): TickMicrobar {
  const bidSize = bar.bidSizeSamples > 0 ? bar.bidSizeSum / bar.bidSizeSamples : null;
  const askSize = bar.askSizeSamples > 0 ? bar.askSizeSum / bar.askSizeSamples : null;
  const bidAskImbalance = bidSize != null && askSize != null && (bidSize + askSize) > 0
    ? (bidSize - askSize) / (bidSize + askSize)
    : null;
  const askBidSizeRatio = bar.bidSizeAtClose != null && bar.bidSizeAtClose > 0 && bar.askSizeAtClose != null
    ? bar.askSizeAtClose / bar.bidSizeAtClose
    : null;
  const quoteCoveragePct = bar.trades > 0
    ? bar.quoteSamples / bar.trades
    : 0;
  const avgSpreadBps = bar.spreadBpsSamples > 0
    ? bar.spreadBpsSum / bar.spreadBpsSamples
    : null;

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
    buyVolume: bar.buyVolume,
    sellVolume: bar.sellVolume,
    neutralVolume: bar.neutralVolume,
    deltaVolume: bar.buyVolume - bar.sellVolume,
    bidSize: bidSize == null ? null : Number(bidSize.toFixed(2)),
    askSize: askSize == null ? null : Number(askSize.toFixed(2)),
    bidAskImbalance: bidAskImbalance == null ? null : Number(bidAskImbalance.toFixed(4)),
    bidSizeAtClose: bar.bidSizeAtClose,
    askSizeAtClose: bar.askSizeAtClose,
    askBidSizeRatio: askBidSizeRatio == null ? null : Number(askBidSizeRatio.toFixed(4)),
    quoteCoveragePct: Number(quoteCoveragePct.toFixed(4)),
    avgSpreadBps: avgSpreadBps == null ? null : Number(avgSpreadBps.toFixed(4)),
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

function classifyAggressorSide(tick: NormalizedMarketTick): TickAggressorSide {
  if (tick.aggressorSide === 'buyer' || tick.aggressorSide === 'seller' || tick.aggressorSide === 'neutral') {
    return tick.aggressorSide;
  }
  if (tick.ask != null && tick.price >= tick.ask) return 'buyer';
  if (tick.bid != null && tick.price <= tick.bid) return 'seller';
  return 'neutral';
}

function applyTickToWorkingBar(bar: WorkingMicrobar, tick: NormalizedMarketTick): void {
  const volume = Math.max(0, Math.floor(tick.size));
  const aggressorSide = classifyAggressorSide(tick);
  if (aggressorSide === 'buyer') {
    bar.buyVolume += volume;
  } else if (aggressorSide === 'seller') {
    bar.sellVolume += volume;
  } else {
    bar.neutralVolume += volume;
  }
  if (typeof tick.bidSize === 'number' && Number.isFinite(tick.bidSize) && tick.bidSize >= 0) {
    bar.bidSizeSum += tick.bidSize;
    bar.bidSizeSamples += 1;
    bar.bidSizeAtClose = Math.floor(tick.bidSize);
  }
  if (typeof tick.askSize === 'number' && Number.isFinite(tick.askSize) && tick.askSize >= 0) {
    bar.askSizeSum += tick.askSize;
    bar.askSizeSamples += 1;
    bar.askSizeAtClose = Math.floor(tick.askSize);
  }
  if (
    typeof tick.bidSize === 'number'
    && Number.isFinite(tick.bidSize)
    && tick.bidSize >= 0
    && typeof tick.askSize === 'number'
    && Number.isFinite(tick.askSize)
    && tick.askSize >= 0
  ) {
    bar.quoteSamples += 1;
  }
  if (
    typeof tick.bid === 'number'
    && Number.isFinite(tick.bid)
    && tick.bid > 0
    && typeof tick.ask === 'number'
    && Number.isFinite(tick.ask)
    && tick.ask >= tick.bid
  ) {
    const mid = (tick.ask + tick.bid) / 2;
    if (mid > 0) {
      const spreadBps = ((tick.ask - tick.bid) / mid) * 10_000;
      bar.spreadBpsSum += spreadBps;
      bar.spreadBpsSamples += 1;
    }
  }
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
        volume: Math.max(0, Math.floor(tick.size)),
        trades: 1,
        buyVolume: 0,
        sellVolume: 0,
        neutralVolume: 0,
        bidSizeSum: 0,
        askSizeSum: 0,
        bidSizeSamples: 0,
        askSizeSamples: 0,
        bidSizeAtClose: null,
        askSizeAtClose: null,
        quoteSamples: 0,
        spreadBpsSum: 0,
        spreadBpsSamples: 0,
        updatedAtMs: tick.timestamp,
      };
      applyTickToWorkingBar(created, tick);
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
        volume: Math.max(0, Math.floor(tick.size)),
        trades: 1,
        buyVolume: 0,
        sellVolume: 0,
        neutralVolume: 0,
        bidSizeSum: 0,
        askSizeSum: 0,
        bidSizeSamples: 0,
        askSizeSamples: 0,
        bidSizeAtClose: null,
        askSizeAtClose: null,
        quoteSamples: 0,
        spreadBpsSum: 0,
        spreadBpsSamples: 0,
        updatedAtMs: tick.timestamp,
      };
      applyTickToWorkingBar(rolled, tick);
      workingByKey.set(key, rolled);
      events.push(mapToReadonlyMicrobar(rolled, false));
      continue;
    }

    working.high = Math.max(working.high, tick.price);
    working.low = Math.min(working.low, tick.price);
    working.close = tick.price;
    working.volume += Math.max(0, Math.floor(tick.size));
    working.trades += 1;
    working.updatedAtMs = tick.timestamp;
    applyTickToWorkingBar(working, tick);
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
