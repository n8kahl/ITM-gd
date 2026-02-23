import { runSPXWinRateBacktest } from '../services/spx/winRateBacktest';
import { persistBacktestRowsForWinRate } from '../services/spx/outcomeTracker';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';

/**
 * Resolves outcomes for existing unresolved setups in spx_setup_instances
 * by running the strict 1-second bar backtest and persisting results.
 *
 * SAFETY: This script does NOT delete or purge any existing rows.
 * It only UPDATES rows with backtest-derived outcomes (triggered_at,
 * final_outcome, t1_hit_at, t2_hit_at, stop_hit_at, realized_r).
 *
 * Usage:
 *   pnpm --dir backend exec ts-node src/scripts/spxResolveOutcomes.ts [from] [to]
 *
 * Examples:
 *   pnpm --dir backend exec ts-node src/scripts/spxResolveOutcomes.ts 2026-01-02 2026-02-22
 *   pnpm --dir backend exec ts-node src/scripts/spxResolveOutcomes.ts  # defaults to full range
 */
async function main() {
  const from = (process.argv[2] || '2026-01-02').trim();
  const to = (process.argv[3] || '2026-02-22').trim();

  console.log(`\n=== SPX Outcome Resolution ===`);
  console.log(`Range: ${from} → ${to}`);
  console.log(`Source: spx_setup_instances`);
  console.log(`Resolution: second (strict)\n`);

  const optimizerProfile = await getActiveSPXOptimizationProfile();
  console.log(`Optimizer profile loaded: partialAtT1=${optimizerProfile.tradeManagement.partialAtT1Pct}, moveStopBE=${optimizerProfile.tradeManagement.moveStopToBreakeven}`);

  console.log(`\nRunning backtest (fetching Massive.com bars)...`);
  const startTime = Date.now();

  const result = await runSPXWinRateBacktest({
    from,
    to,
    source: 'spx_setup_instances',
    resolution: 'second',
    includeRows: true,
    includeBlockedSetups: true,
    includePausedSetups: true,
    includeHiddenTiers: true,
    executionModel: {
      partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
      moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
    },
  });

  const backtestMs = Date.now() - startTime;
  console.log(`Backtest complete in ${(backtestMs / 1000).toFixed(1)}s\n`);

  console.log(`=== Backtest Summary ===`);
  console.log(`Setups loaded: ${result.setupCount}`);
  console.log(`Evaluated: ${result.evaluatedSetupCount}`);
  console.log(`Skipped: ${result.skippedSetupCount}`);
  console.log(`Resolution used: ${result.resolutionUsed}`);
  console.log(`Used minute bar fallback: ${result.usedMassiveMinuteBars}`);
  console.log(`Missing bar sessions: ${result.missingBarsSessions.length} [${result.missingBarsSessions.join(', ')}]`);
  console.log(`Fallback sessions: ${result.resolutionFallbackSessions.length} [${result.resolutionFallbackSessions.join(', ')}]`);
  console.log(`Ambiguous bars: ${result.ambiguousBarCount}`);

  console.log(`\n=== Win Rate Analytics ===`);
  console.log(`Triggered: ${result.analytics.triggeredCount}`);
  console.log(`Resolved: ${result.analytics.resolvedCount}`);
  console.log(`Pending: ${result.analytics.pendingCount}`);
  console.log(`T1 wins: ${result.analytics.t1Wins} (${result.analytics.t1WinRatePct.toFixed(1)}%)`);
  console.log(`T2 wins: ${result.analytics.t2Wins} (${result.analytics.t2WinRatePct.toFixed(1)}%)`);
  console.log(`Stops: ${result.analytics.stopsBeforeT1} (${result.analytics.failureRatePct.toFixed(1)}%)`);

  console.log(`\n=== Profitability ===`);
  console.log(`Resolved with R: ${result.profitability.withRealizedRCount}`);
  console.log(`Average R: ${result.profitability.averageRealizedR.toFixed(3)}`);
  console.log(`Median R: ${result.profitability.medianRealizedR.toFixed(3)}`);
  console.log(`Cumulative R: ${result.profitability.cumulativeRealizedR.toFixed(3)}`);
  console.log(`Expectancy R: ${result.profitability.expectancyR.toFixed(3)}`);
  console.log(`Positive rate: ${result.profitability.positiveRealizedRatePct.toFixed(1)}%`);

  if (result.profitability.bySetupType.length > 0) {
    console.log(`\n=== By Setup Type ===`);
    for (const bucket of result.profitability.bySetupType) {
      console.log(`  ${bucket.key}: ${bucket.tradeCount} trades, avg R=${bucket.averageRealizedR.toFixed(3)}, cum R=${bucket.cumulativeRealizedR.toFixed(3)}`);
    }
  }

  if (result.analytics.bySetupType.length > 0) {
    console.log(`\n=== Win Rates by Setup Type ===`);
    for (const bucket of result.analytics.bySetupType) {
      console.log(`  ${bucket.key}: ${bucket.resolvedCount} resolved, T1=${bucket.t1WinRatePct.toFixed(1)}%, T2=${bucket.t2WinRatePct.toFixed(1)}%, Fail=${bucket.failureRatePct.toFixed(1)}%`);
    }
  }

  const rows = result.rows || [];
  if (rows.length === 0) {
    console.log(`\nNo rows to persist (backtest returned 0 evaluated rows).`);
    return;
  }

  console.log(`\nPersisting ${rows.length} backtest rows to spx_setup_instances...`);
  const persistStart = Date.now();
  await persistBacktestRowsForWinRate(rows);
  const persistMs = Date.now() - persistStart;
  console.log(`Persistence complete in ${(persistMs / 1000).toFixed(1)}s`);

  if (result.notes.length > 0) {
    console.log(`\n=== Notes ===`);
    for (const note of result.notes) {
      console.log(`  - ${note}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSPX outcome resolution failed: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
