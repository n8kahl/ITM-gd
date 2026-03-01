import type { SPXMultiTFConfluenceContext } from '../multiTFConfluence';
import {
  mapSnapshotToReplaySnapshotRow,
  ReplaySnapshotWriterService,
} from '../replaySnapshotWriter';
import type { SPXSnapshot } from '../types';

interface MockDb {
  from: jest.Mock;
  insert: jest.Mock;
}

function createMockDb(insertImpl?: () => Promise<{ error: { message: string; code?: string } | null }>): MockDb {
  const insert = jest.fn(insertImpl ?? (async () => ({ error: null })));
  const from = jest.fn(() => ({ insert }));

  return { from, insert };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function buildMultiTFContext(): SPXMultiTFConfluenceContext {
  return {
    asOf: '2026-02-20T15:00:00.000Z',
    source: 'computed',
    tf1h: {
      timeframe: '1h',
      ema21: 6000,
      emaReliable: true,
      ema55: 5980,
      slope21: 2,
      latestClose: 6005,
      trend: 'up',
      swingHigh: 6010,
      swingLow: 5960,
      bars: [],
    },
    tf15m: {
      timeframe: '15m',
      ema21: 6002,
      emaReliable: true,
      ema55: 5990,
      slope21: 1.2,
      latestClose: 6004,
      trend: 'up',
      swingHigh: 6008,
      swingLow: 5988,
      bars: [],
    },
    tf5m: {
      timeframe: '5m',
      ema21: 6001,
      emaReliable: true,
      ema55: 5998,
      slope21: 0.5,
      latestClose: 6002,
      trend: 'flat',
      swingHigh: 6007,
      swingLow: 5995,
      bars: [],
    },
    tf1m: {
      timeframe: '1m',
      ema21: 6000,
      emaReliable: true,
      ema55: 5999,
      slope21: -0.2,
      latestClose: 6000,
      trend: 'down',
      swingHigh: 6003,
      swingLow: 5997,
      bars: [],
    },
  };
}

function buildSnapshot(overrides: Partial<SPXSnapshot> = {}): SPXSnapshot {
  return {
    generatedAt: '2026-02-20T15:00:00.000Z',
    levels: [{
      id: 'level-1',
      symbol: 'SPX',
      category: 'structural',
      source: 'round_number',
      price: 6000,
      strength: 'strong',
      timeframe: '1d',
      metadata: {},
      chartStyle: {
        color: '#fff',
        lineStyle: 'solid',
        lineWidth: 2,
        labelFormat: '6000',
      },
    }],
    clusters: [{
      id: 'cluster-1',
      priceLow: 5994,
      priceHigh: 6002,
      clusterScore: 4.2,
      type: 'defended',
      sources: [],
      testCount: 8,
      lastTestAt: '2026-02-19T18:00:00.000Z',
      held: true,
      holdRate: 72,
    }],
    fibLevels: [],
    gex: {
      spx: {
        symbol: 'SPX',
        spotPrice: 6001,
        netGex: 123456,
        flipPoint: 5987,
        callWall: 6030,
        putWall: 5950,
        zeroGamma: 5987,
        gexByStrike: [{ strike: 6000, gex: 20000 }],
        keyLevels: [{ strike: 6030, gex: 50000, type: 'call_wall' }],
        expirationBreakdown: {
          '2026-02-20': {
            netGex: 123456,
            callWall: 6030,
            putWall: 5950,
          },
        },
        timestamp: '2026-02-20T15:00:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 600.1,
        netGex: 10000,
        flipPoint: 598,
        callWall: 603,
        putWall: 595,
        zeroGamma: 598,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-20T15:00:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6001,
        netGex: 133456,
        flipPoint: 5988,
        callWall: 6031,
        putWall: 5948,
        zeroGamma: 5988,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-20T15:00:00.000Z',
      },
    },
    basis: {
      current: 0.75,
      trend: 'expanding',
      leading: 'SPX',
      ema5: 0.6,
      ema20: 0.4,
      zscore: 1.2,
      spxPrice: 6001,
      spyPrice: 600.1,
      timestamp: '2026-02-20T15:00:00.000Z',
    },
    spyImpact: {
      beta: 10,
      correlation: 0.88,
      basisUsed: 0.75,
      spot: { spx: 6001, spy: 600.1 },
      levels: [],
      timestamp: '2026-02-20T15:00:00.000Z',
    },
    setups: [{
      id: 'setup-1',
      type: 'trend_pullback',
      direction: 'bullish',
      entryZone: { low: 5998, high: 6000 },
      stop: 5994,
      target1: { price: 6011, label: 'T1' },
      target2: { price: 6020, label: 'T2' },
      confluenceScore: 4.4,
      confluenceSources: ['multi_tf_alignment', 'flow_alignment'],
      clusterZone: {
        id: 'cluster-1',
        priceLow: 5994,
        priceHigh: 6002,
        clusterScore: 4.2,
        type: 'defended',
        sources: [],
        testCount: 8,
        lastTestAt: '2026-02-19T18:00:00.000Z',
        held: true,
        holdRate: 72,
      },
      regime: 'trending',
      status: 'ready',
      probability: 66,
      recommendedContract: null,
      createdAt: '2026-02-20T14:55:00.000Z',
      triggeredAt: null,
      evR: 0.78,
      volumeTrend: 'rising',
      memoryContext: {
        tests: 12,
        resolved: 10,
        wins: 7,
        losses: 3,
        winRatePct: 70,
        confidence: 0.84,
        score: 78,
        lookbackSessions: 5,
        tolerancePoints: 2.5,
      },
      multiTFConfluence: {
        score: 81.5,
        aligned: true,
        tf1hStructureAligned: 25,
        tf15mSwingProximity: 21,
        tf5mMomentumAlignment: 19,
        tf1mMicrostructure: 16,
      },
    }],
    regime: {
      regime: 'trending',
      direction: 'bullish',
      probability: 68,
      magnitude: 'medium',
      confidence: 80,
      timestamp: '2026-02-20T15:00:00.000Z',
    },
    prediction: {
      regime: 'trending',
      direction: { bullish: 62, bearish: 22, neutral: 16 },
      magnitude: { small: 30, medium: 55, large: 15 },
      timingWindow: { description: '1-3 bars', actionable: true },
      nextTarget: {
        upside: { price: 6020, zone: 'call_wall' },
        downside: { price: 5987, zone: 'flip' },
      },
      probabilityCone: [],
      confidence: 72,
    },
    flow: [
      {
        id: 'flow-1',
        type: 'sweep',
        symbol: 'SPX',
        strike: 6000,
        expiry: '2026-02-20',
        size: 45,
        direction: 'bullish',
        premium: 160000,
        timestamp: '2026-02-20T14:59:00.000Z',
      },
      {
        id: 'flow-2',
        type: 'block',
        symbol: 'SPX',
        strike: 5990,
        expiry: '2026-02-20',
        size: 30,
        direction: 'bearish',
        premium: 70000,
        timestamp: '2026-02-20T14:58:00.000Z',
      },
    ],
    flowAggregation: {
      generatedAt: '2026-02-20T15:00:00.000Z',
      source: 'computed',
      directionalBias: 'bullish',
      primaryWindow: '5m',
      latestEventAt: '2026-02-20T14:59:00.000Z',
      windows: {
        '5m': {
          window: '5m',
          startAt: '2026-02-20T14:55:00.000Z',
          endAt: '2026-02-20T15:00:00.000Z',
          eventCount: 2,
          sweepCount: 1,
          blockCount: 1,
          bullishPremium: 160000,
          bearishPremium: 70000,
          totalPremium: 230000,
          flowScore: 69.57,
          bias: 'bullish',
        },
        '15m': {
          window: '15m',
          startAt: '2026-02-20T14:45:00.000Z',
          endAt: '2026-02-20T15:00:00.000Z',
          eventCount: 3,
          sweepCount: 2,
          blockCount: 1,
          bullishPremium: 190000,
          bearishPremium: 80000,
          totalPremium: 270000,
          flowScore: 70.37,
          bias: 'bullish',
        },
        '30m': {
          window: '30m',
          startAt: '2026-02-20T14:30:00.000Z',
          endAt: '2026-02-20T15:00:00.000Z',
          eventCount: 5,
          sweepCount: 3,
          blockCount: 2,
          bullishPremium: 220000,
          bearishPremium: 90000,
          totalPremium: 310000,
          flowScore: 70.97,
          bias: 'bullish',
        },
      },
    },
    coachMessages: [],
    environmentGate: {
      passed: true,
      reason: null,
      reasons: [],
      vixRegime: 'normal',
      dynamicReadyThreshold: 3,
      caution: false,
      breakdown: {
        vixRegime: {
          passed: true,
          value: 17.5,
          regime: 'normal',
        },
        expectedMoveConsumption: {
          passed: true,
          value: 62,
          expectedMovePoints: 16,
        },
        macroCalendar: {
          passed: true,
          caution: false,
          nextEvent: {
            event: 'FOMC Minutes',
            at: '2026-02-20T19:00:00.000Z',
            minutesUntil: 240,
          },
        },
        sessionTime: {
          passed: true,
          minuteEt: 600,
          minutesUntilClose: 360,
          source: 'local',
        },
        compression: {
          passed: true,
          realizedVolPct: 12,
          impliedVolPct: 14,
          spreadPct: 4,
        },
      },
    },
    standbyGuidance: null,
    ...overrides,
  };
}

describe('spx/replaySnapshotWriter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps SPX snapshot context to replay_snapshots row fields', () => {
    const snapshot = buildSnapshot();
    const row = mapSnapshotToReplaySnapshotRow({
      snapshot,
      capturedAt: new Date('2026-02-20T15:00:00.000Z'),
      multiTFContext: buildMultiTFContext(),
    });

    expect(row.session_date).toBe('2026-02-20');
    expect(row.symbol).toBe('SPX');
    expect(row.gex_net_gamma).toBe(123456);
    expect(row.gex_call_wall).toBe(6030);
    expect(row.gex_put_wall).toBe(5950);
    expect(row.gex_flip_point).toBe(5987);
    expect(row.flow_bias_5m).toBe('bullish');
    expect(row.flow_bias_15m).toBe('bullish');
    expect(row.flow_bias_30m).toBe('bullish');
    expect(row.flow_event_count).toBe(2);
    expect(row.flow_sweep_count).toBe(1);
    expect(row.flow_bullish_premium).toBe(160000);
    expect(row.flow_bearish_premium).toBe(70000);
    expect(row.regime).toBe('trending');
    expect(row.regime_direction).toBe('bullish');
    expect(row.regime_probability).toBe(68);
    expect(row.regime_confidence).toBe(80);
    expect(row.regime_volume_trend).toBe('rising');
    expect(row.mtf_1h_trend).toBe('up');
    expect(row.mtf_15m_trend).toBe('up');
    expect(row.mtf_5m_trend).toBe('flat');
    expect(row.mtf_1m_trend).toBe('down');
    expect(row.mtf_composite).toBe(81.5);
    expect(row.mtf_aligned).toBe(true);
    expect(row.vix_value).toBe(17.5);
    expect(row.vix_regime).toBe('normal');
    expect(row.env_gate_passed).toBe(true);
    expect(row.session_minute_et).toBe(600);
    expect(row.macro_next_event).toEqual({
      event: 'FOMC Minutes',
      at: '2026-02-20T19:00:00.000Z',
      minutesUntil: 240,
    });
    expect(row.basis_value).toBe(0.75);
    expect(row.spx_price).toBe(6001);
    expect(row.spy_price).toBe(600.1);
    expect(row.rr_ratio).toBeCloseTo(2.4, 6);
    expect(row.ev_r).toBe(0.78);
    expect(row.memory_setup_type).toBe('trend_pullback');
    expect(row.memory_test_count).toBe(12);
    expect(row.memory_win_rate).toBe(70);
    expect(row.memory_hold_rate).toBe(72);
    expect(row.memory_confidence).toBe(0.84);
    expect(row.memory_score).toBe(78);
  });

  it('flushes inserts in batches of 5 rows', async () => {
    const db = createMockDb();
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: { warn: jest.fn(), debug: jest.fn() },
      env: { REPLAY_SNAPSHOT_ENABLED: 'true' },
      isMarketOpen: jest.fn(() => true),
    });

    const snapshot = buildSnapshot();

    for (let index = 0; index < 6; index += 1) {
      await writer.capture({
        snapshot,
        captureMode: 'setup_transition',
        capturedAt: new Date(`2026-02-20T15:0${index}:00.000Z`),
      });
    }

    expect(db.from).toHaveBeenCalledWith('replay_snapshots');
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect((db.insert.mock.calls[0]?.[0] as unknown[]).length).toBe(5);

    await writer.flush();

    expect(db.insert).toHaveBeenCalledTimes(2);
    expect((db.insert.mock.calls[1]?.[0] as unknown[]).length).toBe(1);
    expect(writer.getPendingCount()).toBe(0);
  });

  it('start enables periodic flush loop for pending rows', async () => {
    jest.useFakeTimers();

    const db = createMockDb();
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: { warn: jest.fn(), debug: jest.fn() },
      env: {
        REPLAY_SNAPSHOT_ENABLED: 'true',
        REPLAY_SNAPSHOT_INTERVAL_MS: '25',
      },
      isMarketOpen: jest.fn(() => true),
    });

    writer.start();
    await writer.capture({
      snapshot: buildSnapshot(),
      captureMode: 'setup_transition',
    });

    expect(writer.getPendingCount()).toBe(1);
    expect(db.insert).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25);
    await flushMicrotasks();

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect((db.insert.mock.calls[0]?.[0] as unknown[]).length).toBe(1);
    expect(writer.getPendingCount()).toBe(0);

    await writer.stop();
  });

  it('stop clears loop and flushes pending rows once', async () => {
    jest.useFakeTimers();

    const db = createMockDb();
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: { warn: jest.fn(), debug: jest.fn() },
      env: {
        REPLAY_SNAPSHOT_ENABLED: 'true',
        REPLAY_SNAPSHOT_INTERVAL_MS: '60000',
      },
      isMarketOpen: jest.fn(() => true),
    });

    writer.start();
    await writer.capture({
      snapshot: buildSnapshot(),
      captureMode: 'setup_transition',
    });

    expect(writer.getPendingCount()).toBe(1);
    await writer.stop();

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect((db.insert.mock.calls[0]?.[0] as unknown[]).length).toBe(1);
    expect(writer.getPendingCount()).toBe(0);

    jest.advanceTimersByTime(60000);
    await flushMicrotasks();
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('no-ops when REPLAY_SNAPSHOT_ENABLED is false', async () => {
    const db = createMockDb();
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: { warn: jest.fn(), debug: jest.fn() },
      env: { REPLAY_SNAPSHOT_ENABLED: 'false' },
      isMarketOpen: jest.fn(() => true),
    });

    await writer.capture({
      snapshot: buildSnapshot(),
      captureMode: 'setup_transition',
    });
    await writer.flush();

    expect(db.insert).not.toHaveBeenCalled();
    expect(writer.getPendingCount()).toBe(0);
  });

  it('skips interval capture when market is closed', async () => {
    const db = createMockDb();
    const mockIsMarketOpen = jest.fn(() => false);
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: { warn: jest.fn(), debug: jest.fn() },
      env: { REPLAY_SNAPSHOT_ENABLED: 'true' },
      isMarketOpen: mockIsMarketOpen,
    });

    await writer.capture({
      snapshot: buildSnapshot(),
      captureMode: 'interval',
      capturedAt: new Date('2026-02-21T15:00:00.000Z'),
    });
    await writer.flush();

    expect(mockIsMarketOpen).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(writer.getPendingCount()).toBe(0);
  });

  it('swallows insert errors and keeps caller path fail-open', async () => {
    const db = createMockDb(async () => {
      throw new Error('db unavailable');
    });
    const mockLogger = { warn: jest.fn(), debug: jest.fn() };
    const writer = new ReplaySnapshotWriterService({
      db: db as any,
      logger: mockLogger,
      env: { REPLAY_SNAPSHOT_ENABLED: 'true' },
      isMarketOpen: jest.fn(() => true),
    });

    const snapshot = buildSnapshot();

    await expect((async () => {
      for (let index = 0; index < 5; index += 1) {
        await writer.capture({
          snapshot,
          captureMode: 'setup_transition',
          capturedAt: new Date(`2026-02-20T15:1${index}:00.000Z`),
        });
      }
    })()).resolves.not.toThrow();

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(writer.getPendingCount()).toBe(0);
  });
});
