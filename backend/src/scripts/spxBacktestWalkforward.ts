import {
  runSPXWinRateBacktest,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestResult,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import { toEasternTime } from '../services/marketHours';

interface WalkforwardWindow {
  index: number;
  from: string;
  to: string;
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function parseNumberArg(name: string, fallback: number, min: number, max: number): number {
  const value = parseArg(name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseResolution(value: string | null): SPXBacktestPriceResolution {
  if (!value) return 'minute';
  const normalized = value.toLowerCase();
  if (normalized === 'minute') return 'minute';
  if (normalized === 'second') return 'second';
  return 'auto';
}

function parseSource(value: string | null): SPXWinRateBacktestSource {
  if (!value) return 'spx_setup_instances';
  return value.toLowerCase() === 'auto' ? 'auto' : 'spx_setup_instances';
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function shiftUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function lastCompletedTradingDayEt(now: Date): string {
  const et = toEasternTime(now);
  const base = new Date(`${et.dateStr}T12:00:00.000Z`);
  let candidate = shiftUtcDays(base, -1);
  while (isWeekend(candidate)) {
    candidate = shiftUtcDays(candidate, -1);
  }
  return toDateOnly(candidate);
}

function previousTradingDay(dateStr: string): string {
  let date = shiftUtcDays(new Date(`${dateStr}T12:00:00.000Z`), -1);
  while (isWeekend(date)) {
    date = shiftUtcDays(date, -1);
  }
  return toDateOnly(date);
}

function buildWindows(input: { weeks: number; endDate: string }): WalkforwardWindow[] {
  const windows: WalkforwardWindow[] = [];
  let cursor = input.endDate;

  for (let i = 0; i < input.weeks; i += 1) {
    const end = cursor;
    let start = end;
    for (let day = 0; day < 4; day += 1) {
      start = previousTradingDay(start);
    }
    windows.unshift({
      index: input.weeks - i,
      from: start,
      to: end,
    });
    cursor = previousTradingDay(start);
  }

  return windows;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function aggregate(results: SPXWinRateBacktestResult[]) {
  const totals = results.reduce(
    (acc, result) => {
      acc.triggered += result.analytics.triggeredCount;
      acc.resolved += result.analytics.resolvedCount;
      acc.t1Wins += result.analytics.t1Wins;
      acc.t2Wins += result.analytics.t2Wins;
      acc.failures += result.analytics.stopsBeforeT1;
      acc.realizedCount += result.profitability.withRealizedRCount;
      acc.cumulativeR += result.profitability.cumulativeRealizedR;
      return acc;
    },
    {
      triggered: 0,
      resolved: 0,
      t1Wins: 0,
      t2Wins: 0,
      failures: 0,
      realizedCount: 0,
      cumulativeR: 0,
    },
  );

  const t1WinRatePct = totals.resolved > 0 ? round((totals.t1Wins / totals.resolved) * 100) : 0;
  const t2WinRatePct = totals.resolved > 0 ? round((totals.t2Wins / totals.resolved) * 100) : 0;
  const failureRatePct = totals.resolved > 0 ? round((totals.failures / totals.resolved) * 100) : 0;
  const expectancyR = totals.realizedCount > 0 ? round(totals.cumulativeR / totals.realizedCount, 4) : 0;

  return {
    triggeredCount: totals.triggered,
    resolvedCount: totals.resolved,
    t1Wins: totals.t1Wins,
    t2Wins: totals.t2Wins,
    failures: totals.failures,
    t1WinRatePct,
    t2WinRatePct,
    failureRatePct,
    cumulativeRealizedR: round(totals.cumulativeR, 4),
    expectancyR,
  };
}

async function main() {
  const weeks = parseNumberArg('weeks', 4, 1, 12);
  const instrument = (parseArg('instrument') || 'SPX').toUpperCase();
  if (instrument !== 'SPX') {
    throw new Error(`Unsupported instrument "${instrument}". This script supports SPX only.`);
  }

  const resolution = parseResolution(parseArg('bars') || parseArg('resolution'));
  const source = parseSource(parseArg('source'));
  const includeBlockedSetups = parseArg('includeBlockedSetups') === 'true';
  const includeHiddenTiers = parseArg('includeHiddenTiers') === 'true';
  const recomputeStopsArg = parseArg('recomputeStops');
  const recomputeStops = recomputeStopsArg == null
    ? true
    : recomputeStopsArg === 'true';
  const forcedEnd = parseArg('to');
  const endDate = forcedEnd || lastCompletedTradingDayEt(new Date());
  const windows = buildWindows({ weeks, endDate });
  const profile = await getActiveSPXOptimizationProfile();

  const perWindow: Array<{
    index: number;
    from: string;
    to: string;
    setupCount: number;
    evaluatedSetupCount: number;
    t1WinRatePct: number;
    t2WinRatePct: number;
    failureRatePct: number;
    expectancyR: number;
    notes: string[];
  }> = [];
  const results: SPXWinRateBacktestResult[] = [];

  for (const window of windows) {
    const result = await runSPXWinRateBacktest({
      from: window.from,
      to: window.to,
      source,
      resolution,
      includeBlockedSetups,
      includeHiddenTiers,
      executionModel: {
        partialAtT1Pct: profile.tradeManagement.partialAtT1Pct,
        moveStopToBreakevenAfterT1: profile.tradeManagement.moveStopToBreakeven,
      },
      recomputeStops,
    });
    results.push(result);
    perWindow.push({
      index: window.index,
      from: window.from,
      to: window.to,
      setupCount: result.setupCount,
      evaluatedSetupCount: result.evaluatedSetupCount,
      t1WinRatePct: result.analytics.t1WinRatePct,
      t2WinRatePct: result.analytics.t2WinRatePct,
      failureRatePct: result.analytics.failureRatePct,
      expectancyR: result.profitability.expectancyR,
      notes: result.notes,
    });
  }

  const rollup = aggregate(results);
  console.log(JSON.stringify({
    mode: 'walkforward',
    generatedAt: new Date().toISOString(),
    config: {
      weeks,
      instrument,
      source,
      resolution,
      includeBlockedSetups,
      includeHiddenTiers,
      recomputeStops,
      endDate,
    },
    aggregate: rollup,
    windows: perWindow,
  }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX walk-forward backtest failed: ${message}`);
  process.exit(1);
});
