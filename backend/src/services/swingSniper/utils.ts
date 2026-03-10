import { getDailyAggregates } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { formatMassiveTicker } from '../../lib/symbols';
import type {
  SwingSniperDirection,
  SwingSniperEdgeState,
  SwingSniperVolBenchmark,
} from './types';

const VOL_BENCHMARK_TTL_SECONDS = 15 * 60;

export function round(value: number, digits: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function toLogReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    const current = closes[index];
    if (previous > 0 && current > 0) {
      returns.push(Math.log(current / previous));
    }
  }
  return returns;
}

function deriveRealizedVolSeries(closes: number[], window: number): Array<number | null> {
  if (closes.length < window + 1) {
    return closes.map(() => null);
  }

  const logReturns = toLogReturns(closes);
  const series: Array<number | null> = [null];

  for (let end = 1; end <= logReturns.length; end += 1) {
    if (end < window) {
      series.push(null);
      continue;
    }

    const sample = logReturns.slice(end - window, end);
    const realizedVol = standardDeviation(sample) * Math.sqrt(252) * 100;
    series.push(round(realizedVol));
  }

  return series;
}

function buildDateLabel(date: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
  } catch {
    return date.slice(5);
  }
}

function latestValue(series: Array<number | null>): number | null {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const value = series[index];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export async function getSwingSniperVolBenchmark(symbol: string): Promise<SwingSniperVolBenchmark> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `swing-sniper:vol-benchmark:${normalizedSymbol}`;
  const cached = await cacheGet<SwingSniperVolBenchmark>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const from = new Date(now.getTime() - 160 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const bars = await getDailyAggregates(formatMassiveTicker(normalizedSymbol), from, to);

  const closes = bars
    .map((bar) => bar.c)
    .filter((value) => Number.isFinite(value) && value > 0);
  const dates = bars.map((bar) => new Date(bar.t).toISOString().slice(0, 10));

  const rv10Series = deriveRealizedVolSeries(closes, 10);
  const rv20Series = deriveRealizedVolSeries(closes, 20);
  const rv30Series = deriveRealizedVolSeries(closes, 30);

  const recentVolumeRows = bars.slice(-20)
    .map((bar) => ({
      close: safeNumber(bar.c),
      volume: safeNumber((bar as unknown as { v?: number }).v),
    }))
    .filter((row): row is { close: number; volume: number } => row.close != null && row.volume != null && row.close > 0 && row.volume >= 0);

  const avgVolume20 = recentVolumeRows.length > 0
    ? round(average(recentVolumeRows.map((row) => row.volume)))
    : null;
  const avgDollarVolume20 = recentVolumeRows.length > 0
    ? round(average(recentVolumeRows.map((row) => row.volume * row.close)))
    : null;

  const liquidityScore = avgDollarVolume20 == null
    ? null
    : round(clamp(
      ((Math.log10(avgDollarVolume20 + 1) - 6) * 22 * 0.7)
      + ((Math.log10((avgVolume20 ?? 0) + 1) - 4) * 25 * 0.3),
      0,
      100,
    ), 1);

  const liquidityTier: SwingSniperVolBenchmark['liquidityTier'] = liquidityScore == null
    ? 'unknown'
    : liquidityScore >= 72
      ? 'deep'
      : liquidityScore >= 45
        ? 'adequate'
        : 'thin';

  const overlayBase = dates.slice(-30).map((date, index, rows) => {
    const absoluteIndex = dates.length - rows.length + index;
    return {
      date,
      label: buildDateLabel(date),
      rv: rv20Series[absoluteIndex] ?? null,
    };
  });

  const payload: SwingSniperVolBenchmark = {
    rv10: latestValue(rv10Series),
    rv20: latestValue(rv20Series),
    rv30: latestValue(rv30Series),
    avgVolume20,
    avgDollarVolume20,
    liquidityScore,
    liquidityTier,
    overlayBase,
  };

  await cacheSet(cacheKey, payload, VOL_BENCHMARK_TTL_SECONDS);
  return payload;
}

export function daysUntil(date: string, now: Date = new Date()): number {
  const target = new Date(`${date}T00:00:00.000Z`).getTime();
  const start = new Date(now.toISOString().slice(0, 10)).getTime();
  return Math.ceil((target - start) / (24 * 60 * 60 * 1000));
}

export function describeDaysUntilLabel(days: number | null): string {
  if (days == null) return 'No dated catalyst';
  if (days <= 0) return 'Now';
  return `${days}D`;
}

export function buildEdgeState(
  direction: SwingSniperDirection,
  ivRankAtSave: number | null,
  ivRankNow: number | null,
): SwingSniperEdgeState {
  if (ivRankAtSave == null || ivRankNow == null) return 'stable';

  const delta = round(ivRankNow - ivRankAtSave, 1);

  if (direction === 'long_vol') {
    if (delta >= 18) return 'invalidated';
    if (delta >= 8) return 'narrowing';
    if (delta <= -8) return 'improving';
    return 'stable';
  }

  if (direction === 'short_vol') {
    if (delta <= -18) return 'invalidated';
    if (delta <= -8) return 'narrowing';
    if (delta >= 8) return 'improving';
    return 'stable';
  }

  if (Math.abs(delta) >= 18) return 'invalidated';
  if (Math.abs(delta) >= 8) return delta > 0 ? 'narrowing' : 'improving';
  return 'stable';
}

export async function mapConcurrent<TInput, TResult>(
  inputs: TInput[],
  concurrency: number,
  worker: (input: TInput, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(inputs.length);
  let cursor = 0;

  const execute = async () => {
    while (cursor < inputs.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(inputs[currentIndex], currentIndex);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, inputs.length)) }, () => execute());
  await Promise.all(workers);
  return results;
}
