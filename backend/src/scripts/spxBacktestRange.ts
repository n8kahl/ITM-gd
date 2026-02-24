import {
  runSPXWinRateBacktest,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import { toEasternTime } from '../services/marketHours';

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysAgo(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function defaultDateRangeEt(): { from: string; to: string } {
  const et = toEasternTime(new Date());
  const to = et.dateStr;
  const from = daysAgo(to, 1);
  return { from, to };
}

function parseResolution(value: string | null): SPXBacktestPriceResolution {
  if (!value) return 'second';
  const normalized = value.toLowerCase();
  if (normalized === 'minute') return 'minute';
  if (normalized === 'second') return 'second';
  return 'auto';
}

function parseSource(value: string | null): SPXWinRateBacktestSource {
  if (!value) return 'spx_setup_instances';
  const normalized = value.toLowerCase();
  return normalized === 'auto' ? 'auto' : 'spx_setup_instances';
}

async function main() {
  const defaults = defaultDateRangeEt();
  const startDate = parseArg('startDate') || parseArg('from') || defaults.from;
  const endDate = parseArg('endDate') || parseArg('to') || defaults.to;

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD for --startDate/--endDate');
  }
  if (startDate > endDate) {
    throw new Error(`Invalid range: startDate ${startDate} is after endDate ${endDate}`);
  }

  const source = parseSource(parseArg('source'));
  const resolution = parseResolution(parseArg('bars') || parseArg('resolution'));
  const includeBlockedSetups = parseArg('includeBlockedSetups') === 'true';
  const includeHiddenTiers = parseArg('includeHiddenTiers') === 'true';

  const profile = await getActiveSPXOptimizationProfile();
  const result = await runSPXWinRateBacktest({
    from: startDate,
    to: endDate,
    source,
    resolution,
    includeBlockedSetups,
    includeHiddenTiers,
    executionModel: {
      partialAtT1Pct: profile.tradeManagement.partialAtT1Pct,
      moveStopToBreakevenAfterT1: profile.tradeManagement.moveStopToBreakeven,
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX range backtest failed: ${message}`);
  process.exit(1);
});

