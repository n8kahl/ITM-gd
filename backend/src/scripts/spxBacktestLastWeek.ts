import {
  type SPXBacktestExecutionBasis,
  runSPXWinRateBacktest,
  type SPXBacktestPriceResolution,
  type SPXWinRateBacktestSource,
} from '../services/spx/winRateBacktest';
import { toEasternTime } from '../services/marketHours';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getLastCompletedWeekRangeET(now: Date = new Date()): { from: string; to: string } {
  const etNow = toEasternTime(now);
  const deltaToFriday = etNow.dayOfWeek >= 5
    ? etNow.dayOfWeek - 5
    : etNow.dayOfWeek + 2;

  const friday = shiftDate(etNow.dateStr, -deltaToFriday);
  const monday = shiftDate(friday, -4);
  return { from: monday, to: friday };
}

async function main() {
  const sourceArg = (process.argv[2] || 'instances').trim().toLowerCase();
  const resolutionArg = (process.argv[3] || 'second').trim().toLowerCase();
  const basisArg = (process.argv[4] || 'underlying').trim().toLowerCase();
  const strictBarsArg = (process.argv[5] || 'true').trim().toLowerCase();
  const source: SPXWinRateBacktestSource = sourceArg === 'instances'
    ? 'spx_setup_instances'
    : sourceArg === 'legacy'
      ? 'ai_coach_tracked_setups'
      : 'auto';
  const resolution: SPXBacktestPriceResolution = resolutionArg === 'second'
    ? 'second'
    : resolutionArg === 'minute'
      ? 'minute'
      : 'auto';
  const executionBasis: SPXBacktestExecutionBasis = basisArg === 'options'
    || basisArg === 'options_contract'
    || basisArg === 'contract'
    ? 'options_contract'
    : 'underlying';
  const strictBars = strictBarsArg === 'false' ? false : true;

  const { from, to } = getLastCompletedWeekRangeET();
  const optimizerProfile = await getActiveSPXOptimizationProfile();
  const result = await runSPXWinRateBacktest({
    from,
    to,
    source,
    resolution,
    executionBasis,
    executionModel: {
      partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
      moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
    },
    optionsReplay: {
      strictBars,
    },
  });

  // Emit machine-readable JSON so CI/reporting can consume this directly.
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX last-week backtest failed: ${message}`);
  process.exit(1);
});
