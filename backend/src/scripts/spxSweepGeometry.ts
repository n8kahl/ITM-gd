import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import {
  type SweepFamily,
  ALL_SWEEP_FAMILIES,
  loadSetups,
  loadBarsBySession,
  geometryCandidateGrid,
  evaluateFamilyConfig,
  type CandidateResult,
} from '../services/spx/geometrySweep';

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

async function main() {
  const from = (process.argv[2] || '2026-01-01').trim();
  const to = (process.argv[3] || '2026-02-20').trim();
  const rawFamilies = (process.argv[4] || '').trim();
  const fastMode = (process.argv[5] || '').trim().toLowerCase() === 'fast'
    || String(process.env.SPX_SWEEP_FAST || '').trim().toLowerCase() === 'true';
  const families: SweepFamily[] = rawFamilies.length > 0
    ? rawFamilies
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is SweepFamily => (
        item === 'fade_at_wall'
        || item === 'mean_reversion'
        || item === 'trend_pullback'
        || item === 'orb_breakout'
      ))
    : [...ALL_SWEEP_FAMILIES];

  const profile = await getActiveSPXOptimizationProfile();
  const paused = new Set(profile.driftControl.pausedSetupTypes);
  const allSetups = await loadSetups(from, to);
  const sweepSetups = allSetups.filter((setup) => (
    (families as string[]).includes(setup.setupType)
    && setup.gateStatus !== 'blocked'
    && setup.tier !== 'hidden'
    && !paused.has(setup.setupType)
  ));

  const sessions = Array.from(new Set(sweepSetups.map((setup) => setup.sessionDate))).sort();
  const barsBySession = await loadBarsBySession(sessions);

  const byFamily: Record<SweepFamily, CandidateResult[]> = {
    fade_at_wall: [],
    mean_reversion: [],
    trend_pullback: [],
    orb_breakout: [],
  };

  for (const family of families) {
    const familySetups = sweepSetups.filter((setup) => setup.setupType === family);
    const configs = geometryCandidateGrid({
      family,
      baselinePartial: profile.tradeManagement.partialAtT1Pct,
      fastMode,
    });
    for (const config of configs) {
      byFamily[family].push(evaluateFamilyConfig({
        family,
        setups: familySetups,
        barsBySession,
        config,
        objectiveWeights: profile.walkForward.objectiveWeights,
      }));
    }
    byFamily[family].sort((a, b) => {
      if (b.metrics.objectiveScoreConservative !== a.metrics.objectiveScoreConservative) {
        return b.metrics.objectiveScoreConservative - a.metrics.objectiveScoreConservative;
      }
      if (b.metrics.expectancyLowerBoundR !== a.metrics.expectancyLowerBoundR) {
        return b.metrics.expectancyLowerBoundR - a.metrics.expectancyLowerBoundR;
      }
      return b.metrics.triggered - a.metrics.triggered;
    });
  }

  const summary = families.map((family) => {
    const ranked = byFamily[family];
    const baseline = ranked.find((row) => row.config.label.startsWith('baseline|')) || ranked[0];
    const best = ranked[0];
    return {
      family,
      setupCount: sweepSetups.filter((setup) => setup.setupType === family).length,
      baseline,
      best,
      delta: {
        objectiveConservative: round(best.metrics.objectiveScoreConservative - baseline.metrics.objectiveScoreConservative, 2),
        expectancyR: round(best.metrics.expectancyR - baseline.metrics.expectancyR, 4),
        t1WinRatePct: round(best.metrics.t1WinRatePct - baseline.metrics.t1WinRatePct, 2),
        t2WinRatePct: round(best.metrics.t2WinRatePct - baseline.metrics.t2WinRatePct, 2),
        failureRatePct: round(best.metrics.failureRatePct - baseline.metrics.failureRatePct, 2),
      },
      top5: ranked.slice(0, 5),
    };
  });

  console.log(JSON.stringify({
    range: { from, to },
    fastMode,
    selectedFamilies: families,
    pausedSetupTypes: Array.from(paused),
    profileTradeManagement: profile.tradeManagement,
    objectiveWeights: profile.walkForward.objectiveWeights,
    sessionsLoaded: sessions.length,
    sweepSetups: sweepSetups.length,
    families: summary,
  }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX geometry sweep failed: ${message}`);
  process.exit(1);
});
