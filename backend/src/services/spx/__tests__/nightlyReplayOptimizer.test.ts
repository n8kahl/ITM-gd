import { runSPXNightlyReplayOptimizerCycle } from '../nightlyReplayOptimizer';

const mockGetActiveSPXOptimizationProfile = jest.fn();
const mockRunSPXOptimizerScan = jest.fn();
const mockBackfillHistoricalSPXSetupInstances = jest.fn();

jest.mock('../optimizer', () => ({
  getActiveSPXOptimizationProfile: (...args: unknown[]) => mockGetActiveSPXOptimizationProfile(...args),
  runSPXOptimizerScan: (...args: unknown[]) => mockRunSPXOptimizerScan(...args),
}));

jest.mock('../historicalReconstruction', () => ({
  backfillHistoricalSPXSetupInstances: (...args: unknown[]) => mockBackfillHistoricalSPXSetupInstances(...args),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('spx/nightlyReplayOptimizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_ENABLED;
    delete process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_FAIL_ON_ERRORS;
    delete process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_MAX_FAILED_DAYS;
    delete process.env.SPX_OPTIMIZER_NIGHTLY_REPLAY_LOOKBACK_DAYS;

    mockGetActiveSPXOptimizationProfile.mockResolvedValue({
      walkForward: {
        trainingDays: 20,
        validationDays: 5,
      },
    });
    mockBackfillHistoricalSPXSetupInstances.mockResolvedValue({
      from: '2026-01-29',
      to: '2026-02-21',
      rows: [],
      attemptedDays: 18,
      successfulDays: 18,
      failedDays: 0,
    });
    mockRunSPXOptimizerScan.mockResolvedValue({
      profile: { source: 'scan' },
      scorecard: {
        optimizationApplied: true,
        optimized: { tradeCount: 12 },
        improvementPct: {
          t1WinRateDelta: 4.2,
          t2WinRateDelta: 2.1,
          objectiveDelta: 2,
          objectiveConservativeDelta: 1.5,
          expectancyRDelta: 0.2,
        },
        blockerMix: {
          totalOpportunityCount: 0,
          macroBlockedCount: 0,
          microBlockedCount: 0,
          macroBlockedPct: 0,
          microBlockedPct: 0,
          baselineTriggerRatePct: 0,
          optimizedTriggerRatePct: 0,
          triggerRateDeltaPct: 0,
          triggerRateGuardrailPassed: true,
          bySetupRegimeTimeBucket: [],
        },
      },
    });
  });

  it('runs replay reconstruction before optimizer scan using the walk-forward window', async () => {
    const result = await runSPXNightlyReplayOptimizerCycle({
      asOfDateEt: '2026-02-21',
      mode: 'nightly_auto',
    });

    expect(mockBackfillHistoricalSPXSetupInstances).toHaveBeenCalledWith({
      from: '2026-01-29',
      to: '2026-02-21',
    });
    expect(mockRunSPXOptimizerScan).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-01-29',
      to: '2026-02-21',
      mode: 'nightly_auto',
    }));
    expect(result.replayRange).toEqual({
      from: '2026-01-29',
      to: '2026-02-21',
      lookbackDays: 24,
    });
    expect(result.replaySummary?.failedDays).toBe(0);
  });

  it('fails closed when replay quality gate exceeds allowed failed days', async () => {
    mockBackfillHistoricalSPXSetupInstances.mockResolvedValue({
      from: '2026-01-29',
      to: '2026-02-21',
      rows: [{ date: '2026-02-20', setupsGenerated: 0, setupsTriggeredAtGeneration: 0, errors: ['missing bars'] }],
      attemptedDays: 18,
      successfulDays: 17,
      failedDays: 1,
    });

    await expect(runSPXNightlyReplayOptimizerCycle({
      asOfDateEt: '2026-02-21',
      mode: 'nightly_auto',
    })).rejects.toThrow('SPX nightly replay reconstruction failed quality gate.');

    expect(mockRunSPXOptimizerScan).not.toHaveBeenCalled();
  });
});
