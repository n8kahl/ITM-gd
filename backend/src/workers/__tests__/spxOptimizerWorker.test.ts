const mockGetSPXOptimizerNightlyStatus = jest.fn();
const mockPersistSPXOptimizerNightlyStatus = jest.fn();
const mockRunSPXNightlyReplayOptimizerCycle = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/spx/optimizer', () => ({
  getSPXOptimizerNightlyStatus: (...args: any[]) => mockGetSPXOptimizerNightlyStatus(...args),
  persistSPXOptimizerNightlyStatus: (...args: any[]) => mockPersistSPXOptimizerNightlyStatus(...args),
}));

jest.mock('../../services/spx/nightlyReplayOptimizer', () => ({
  runSPXNightlyReplayOptimizerCycle: (...args: any[]) => mockRunSPXNightlyReplayOptimizerCycle(...args),
}));

import {
  getSPXOptimizerWorkerStatus,
  shouldRunSPXOptimizerNightly,
  startSPXOptimizerWorker,
  stopSPXOptimizerWorker,
} from '../spxOptimizerWorker';

describe('SPX optimizer nightly worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRunSPXNightlyReplayOptimizerCycle.mockResolvedValue({
      asOfDateEt: '2026-02-17',
      replayEnabled: true,
      replayRange: { from: '2026-01-20', to: '2026-02-17', lookbackDays: 20 },
      replaySummary: null,
      optimizerResult: {
        scorecard: {
          optimizationApplied: false,
          optimized: { tradeCount: 0 },
          improvementPct: {
            t1WinRateDelta: 0,
            t2WinRateDelta: 0,
            objectiveDelta: 0,
            objectiveConservativeDelta: 0,
            expectancyRDelta: 0,
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
          dataQuality: { failClosedActive: false, gatePassed: true, reasons: [] },
        },
      },
    });
    mockGetSPXOptimizerNightlyStatus.mockResolvedValue({
      lastRunDateEt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastErrorMessage: null,
    });
    mockPersistSPXOptimizerNightlyStatus.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopSPXOptimizerWorker();
    jest.useRealTimers();
  });

  it('runs once after target minute ET on a trading day', () => {
    const atTarget = new Date('2026-02-18T00:15:00.000Z'); // 19:15 ET prior session date
    const result = shouldRunSPXOptimizerNightly(atTarget, null);

    expect(result.shouldRun).toBe(true);
    expect(result.dateEt).toBe('2026-02-17');
  });

  it('does not run before target minute ET', () => {
    const beforeTarget = new Date('2026-02-17T23:30:00.000Z'); // 18:30 ET
    const result = shouldRunSPXOptimizerNightly(beforeTarget, null);

    expect(result.shouldRun).toBe(false);
    expect(result.dateEt).toBe('2026-02-17');
  });

  it('does not run twice for same ET date', () => {
    const afterTarget = new Date('2026-02-18T00:30:00.000Z'); // 19:30 ET 2026-02-17
    const result = shouldRunSPXOptimizerNightly(afterTarget, '2026-02-17');

    expect(result.shouldRun).toBe(false);
  });

  it('reports schedule metadata for settings UI', async () => {
    const status = await getSPXOptimizerWorkerStatus(new Date('2026-02-17T23:30:00.000Z'));

    expect(status.mode).toBe('nightly_auto');
    expect(status.timezone).toBe('America/New_York');
    expect(typeof status.targetTimeEt).toBe('string');
    expect(status.nextEligibleRunAtEt).toContain('ET');
  });

  it('schedules only one timer when start is called repeatedly', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    startSPXOptimizerWorker();
    startSPXOptimizerWorker();

    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    timeoutSpy.mockRestore();
  });
});
