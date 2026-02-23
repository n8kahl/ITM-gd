const mockRunSPXOptimizerScan = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/spx/optimizer', () => ({
  runSPXOptimizerScan: (...args: any[]) => mockRunSPXOptimizerScan(...args),
}));

const originalNightlyEnabled = process.env.SPX_OPTIMIZER_NIGHTLY_ENABLED;

let getSPXOptimizerWorkerStatus: typeof import('../spxOptimizerWorker').getSPXOptimizerWorkerStatus;
let shouldRunSPXOptimizerNightly: typeof import('../spxOptimizerWorker').shouldRunSPXOptimizerNightly;
let startSPXOptimizerWorker: typeof import('../spxOptimizerWorker').startSPXOptimizerWorker;
let stopSPXOptimizerWorker: typeof import('../spxOptimizerWorker').stopSPXOptimizerWorker;

describe('SPX optimizer nightly worker', () => {
  beforeEach(async () => {
    jest.resetModules();
    process.env.SPX_OPTIMIZER_NIGHTLY_ENABLED = 'true';
    ({
      getSPXOptimizerWorkerStatus,
      shouldRunSPXOptimizerNightly,
      startSPXOptimizerWorker,
      stopSPXOptimizerWorker,
    } = await import('../spxOptimizerWorker'));
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopSPXOptimizerWorker();
    jest.useRealTimers();
  });

  afterAll(() => {
    if (originalNightlyEnabled == null) {
      delete process.env.SPX_OPTIMIZER_NIGHTLY_ENABLED;
      return;
    }
    process.env.SPX_OPTIMIZER_NIGHTLY_ENABLED = originalNightlyEnabled;
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

  it('reports schedule metadata for settings UI', () => {
    const status = getSPXOptimizerWorkerStatus(new Date('2026-02-17T23:30:00.000Z'));

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
