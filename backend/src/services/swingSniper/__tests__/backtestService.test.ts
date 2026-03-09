import { buildSwingSniperBacktestReport } from '../backtestService';

const mockListSignalSnapshots = jest.fn();
const mockGetDailyAggregates = jest.fn();

jest.mock('../persistence', () => ({
  listSwingSniperSignalSnapshots: (...args: unknown[]) => mockListSignalSnapshots(...args),
}));

jest.mock('../../../config/massive', () => ({
  getDailyAggregates: (...args: unknown[]) => mockGetDailyAggregates(...args),
}));

function buildBars(count: number): Array<{ t: number; c: number }> {
  const base = new Date('2025-10-01T00:00:00.000Z');
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + index);
    return {
      t: date.getTime(),
      c: 100 + (index * 0.35) + Math.sin(index / 4) * 2.8,
    };
  });
}

function buildSnapshot(index: number) {
  const date = new Date('2025-11-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + (index * 7));
  const dateOnly = date.toISOString().slice(0, 10);

  return {
    symbol: 'NVDA',
    asOf: `${dateOnly}T15:30:00.000Z`,
    asOfDate: dateOnly,
    capturedFrom: 'dossier' as const,
    score: 80 + (index % 5),
    direction: index % 3 === 0 ? 'short_vol' as const : 'long_vol' as const,
    setupLabel: 'Test setup',
    thesis: 'Test thesis',
    currentPrice: 100 + index,
    currentIV: 36 + (index % 4),
    realizedVol20: 28 + (index % 3),
    ivRank: 40 + index,
    ivPercentile: 45 + index,
    ivVsRvGap: -4 + index * 0.5,
    catalystDate: null,
    catalystDaysUntil: 6,
    snapshot: {},
    createdAt: `${dateOnly}T15:35:00.000Z`,
  };
}

describe('buildSwingSniperBacktestReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a ready backtest payload when snapshots and bars are available', async () => {
    mockListSignalSnapshots.mockResolvedValue(Array.from({ length: 10 }, (_, index) => buildSnapshot(index)));
    mockGetDailyAggregates.mockResolvedValue(buildBars(220));

    const result = await buildSwingSniperBacktestReport('user-1', 'NVDA');

    expect(result.symbol).toBe('NVDA');
    expect(result.status).toMatch(/ready|limited/);
    expect(result.summary.sampleSize).toBeGreaterThan(0);
    expect(result.summary.resolvedSamples).toBeGreaterThan(0);
    expect(result.summary.hitRatePct).not.toBeNull();
    expect(result.confidence.confidenceWeight).toBeGreaterThan(0.7);
    expect(result.confidence.confidenceWeight).toBeLessThanOrEqual(1.28);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('returns unavailable payload when no snapshots exist', async () => {
    mockListSignalSnapshots.mockResolvedValue([]);
    mockGetDailyAggregates.mockResolvedValue(buildBars(220));

    const result = await buildSwingSniperBacktestReport('user-1', 'NVDA');

    expect(result.status).toBe('unavailable');
    expect(result.summary.sampleSize).toBe(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.caveats[0]).toContain('No archived signal snapshots');
  });

  it('returns unavailable payload when historical bars are unavailable', async () => {
    mockListSignalSnapshots.mockResolvedValue(Array.from({ length: 8 }, (_, index) => buildSnapshot(index)));
    mockGetDailyAggregates.mockRejectedValue(new Error('Massive down'));

    const result = await buildSwingSniperBacktestReport('user-1', 'NVDA');

    expect(result.status).toBe('unavailable');
    expect(result.summary.resolvedSamples).toBe(0);
    expect(result.caveats[0]).toContain('Historical bars are insufficient');
  });
});
