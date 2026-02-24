import { cacheGet, cacheSet } from '../../config/redis';
import { getMinuteAggregates, type MassiveAggregate } from '../../config/massive';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';

const ATR_CACHE_PREFIX = 'spx:atr';
const ATR_DEFAULT_PERIOD = 14;
const ATR_CACHE_TTL_SECONDS = 60;

export interface AtrComputationBar {
  t: number;
  c: number;
  o?: number;
  h?: number;
  l?: number;
}

function toAtrBarHigh(bar: AtrComputationBar): number {
  if (typeof bar.h === 'number' && Number.isFinite(bar.h)) return bar.h;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.max(bar.o, bar.c);
  return bar.c;
}

function toAtrBarLow(bar: AtrComputationBar): number {
  if (typeof bar.l === 'number' && Number.isFinite(bar.l)) return bar.l;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.min(bar.o, bar.c);
  return bar.c;
}

function toAtrDateString(input?: { asOfTimestamp?: string; date?: string }): string {
  if (input?.date) return input.date;

  if (input?.asOfTimestamp) {
    const parsed = new Date(input.asOfTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return toEasternTime(parsed).dateStr;
    }
  }

  return toEasternTime(new Date()).dateStr;
}

function toAsOfMs(asOfTimestamp?: string): number | null {
  if (!asOfTimestamp) return null;
  const parsed = Date.parse(asOfTimestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateAtrFromBars(
  bars: AtrComputationBar[],
  period = ATR_DEFAULT_PERIOD,
): number | null {
  if (!Array.isArray(bars) || bars.length < period + 1) return null;

  const sortedBars = [...bars]
    .filter((bar) => Number.isFinite(bar.c) && Number.isFinite(bar.t))
    .sort((a, b) => a.t - b.t);

  if (sortedBars.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < sortedBars.length; i += 1) {
    const current = sortedBars[i];
    const previousClose = sortedBars[i - 1].c;
    const high = toAtrBarHigh(current);
    const low = toAtrBarLow(current);
    const tr = Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose),
    );

    if (Number.isFinite(tr) && tr >= 0) {
      trueRanges.push(tr);
    }
  }

  if (trueRanges.length < period) return null;
  const latest = trueRanges.slice(-period);
  const atr = latest.reduce((sum, value) => sum + value, 0) / period;
  return Number.isFinite(atr) ? Number(atr.toFixed(4)) : null;
}

function atrCacheKey(input: {
  ticker: string;
  period: number;
  date: string;
  asOfTimestamp?: string;
}): string {
  const asOfBucket = input.asOfTimestamp
    ? input.asOfTimestamp.slice(0, 16)
    : 'live';
  return `${ATR_CACHE_PREFIX}:${input.ticker}:${input.date}:p${input.period}:${asOfBucket}`;
}

export async function getIntradayAtr(input: {
  ticker: string;
  period?: number;
  date?: string;
  asOfTimestamp?: string;
  forceRefresh?: boolean;
}): Promise<number | null> {
  const period = Number.isFinite(input.period)
    ? Math.max(2, Math.floor(input.period as number))
    : ATR_DEFAULT_PERIOD;
  const date = toAtrDateString({ date: input.date, asOfTimestamp: input.asOfTimestamp });
  const cacheKey = atrCacheKey({
    ticker: input.ticker,
    period,
    date,
    asOfTimestamp: input.asOfTimestamp,
  });

  if (!input.forceRefresh) {
    const cached = await cacheGet<number>(cacheKey);
    if (typeof cached === 'number' && Number.isFinite(cached)) {
      return cached;
    }
  }

  const bars = await getMinuteAggregates(input.ticker, date);
  if (!Array.isArray(bars) || bars.length === 0) return null;

  const asOfMs = toAsOfMs(input.asOfTimestamp);
  const atrBars: AtrComputationBar[] = (asOfMs == null
    ? bars
    : bars.filter((bar) => bar.t <= asOfMs)
  ).map((bar: MassiveAggregate) => ({
    t: bar.t,
    c: bar.c,
    o: bar.o,
    h: bar.h,
    l: bar.l,
  }));

  const atr = calculateAtrFromBars(atrBars, period);
  if (atr == null) return null;

  await cacheSet(cacheKey, atr, ATR_CACHE_TTL_SECONDS).catch((error) => {
    logger.warn('SPX ATR cache write failed', {
      ticker: input.ticker,
      date,
      period,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return atr;
}
