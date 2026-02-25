import { supabase } from '../../../config/database';
import { persistSetupInstancesForWinRate, summarizeSPXWinRateRows } from '../outcomeTracker';

jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('spx/outcomeTracker analytics summary', () => {
  it('computes top-level triggered/resolved win-rate metrics', () => {
    const rows = [
      {
        engine_setup_id: 's1',
        session_date: '2026-02-21',
        setup_type: 'fade_at_wall',
        direction: 'bullish',
        regime: 'ranging',
        tier: 'sniper_primary',
        triggered_at: '2026-02-21T14:30:00.000Z',
        final_outcome: 't2_before_stop',
        t1_hit_at: '2026-02-21T14:32:00.000Z',
        t2_hit_at: '2026-02-21T14:34:00.000Z',
        stop_hit_at: null,
      },
      {
        engine_setup_id: 's2',
        session_date: '2026-02-21',
        setup_type: 'breakout_vacuum',
        direction: 'bullish',
        regime: 'trending',
        tier: 'sniper_secondary',
        triggered_at: '2026-02-21T14:40:00.000Z',
        final_outcome: 't1_before_stop',
        t1_hit_at: '2026-02-21T14:42:00.000Z',
        t2_hit_at: null,
        stop_hit_at: null,
      },
      {
        engine_setup_id: 's3',
        session_date: '2026-02-21',
        setup_type: 'mean_reversion',
        direction: 'bearish',
        regime: 'compression',
        tier: 'watchlist',
        triggered_at: '2026-02-21T15:00:00.000Z',
        final_outcome: 'stop_before_t1',
        t1_hit_at: null,
        t2_hit_at: null,
        stop_hit_at: '2026-02-21T15:02:00.000Z',
      },
      {
        engine_setup_id: 's4',
        session_date: '2026-02-21',
        setup_type: 'trend_continuation',
        direction: 'bullish',
        regime: 'trending',
        tier: 'watchlist',
        triggered_at: '2026-02-21T15:15:00.000Z',
        final_outcome: null,
        t1_hit_at: null,
        t2_hit_at: null,
        stop_hit_at: null,
      },
      {
        engine_setup_id: 's5',
        session_date: '2026-02-21',
        setup_type: 'trend_continuation',
        direction: 'bullish',
        regime: 'trending',
        tier: 'watchlist',
        triggered_at: null,
        final_outcome: 't2_before_stop',
        t1_hit_at: null,
        t2_hit_at: null,
        stop_hit_at: null,
      },
    ] as any[];

    const summary = summarizeSPXWinRateRows(rows, {
      from: '2026-02-20',
      to: '2026-02-21',
    });

    expect(summary.triggeredCount).toBe(4);
    expect(summary.resolvedCount).toBe(3);
    expect(summary.pendingCount).toBe(1);
    expect(summary.t1Wins).toBe(2);
    expect(summary.t2Wins).toBe(1);
    expect(summary.stopsBeforeT1).toBe(1);
    expect(summary.t1WinRatePct).toBe(66.67);
    expect(summary.t2WinRatePct).toBe(33.33);
    expect(summary.failureRatePct).toBe(33.33);
  });

  it('builds setup type, regime, and tier bucket breakdowns', () => {
    const rows = [
      {
        engine_setup_id: 'a',
        session_date: '2026-02-21',
        setup_type: 'fade_at_wall',
        direction: 'bullish',
        regime: 'ranging',
        tier: 'sniper_primary',
        triggered_at: '2026-02-21T14:30:00.000Z',
        final_outcome: 't2_before_stop',
        t1_hit_at: '2026-02-21T14:32:00.000Z',
        t2_hit_at: '2026-02-21T14:34:00.000Z',
        stop_hit_at: null,
      },
      {
        engine_setup_id: 'b',
        session_date: '2026-02-21',
        setup_type: 'fade_at_wall',
        direction: 'bullish',
        regime: 'ranging',
        tier: 'sniper_primary',
        triggered_at: '2026-02-21T14:36:00.000Z',
        final_outcome: 'stop_before_t1',
        t1_hit_at: null,
        t2_hit_at: null,
        stop_hit_at: '2026-02-21T14:37:00.000Z',
      },
      {
        engine_setup_id: 'c',
        session_date: '2026-02-21',
        setup_type: 'breakout_vacuum',
        direction: 'bullish',
        regime: 'trending',
        tier: 'sniper_secondary',
        triggered_at: '2026-02-21T14:45:00.000Z',
        final_outcome: 't1_before_stop',
        t1_hit_at: '2026-02-21T14:47:00.000Z',
        t2_hit_at: null,
        stop_hit_at: null,
      },
    ] as any[];

    const summary = summarizeSPXWinRateRows(rows, {
      from: '2026-02-21',
      to: '2026-02-21',
    });

    const fade = summary.bySetupType.find((bucket) => bucket.key === 'fade_at_wall');
    expect(fade).toBeTruthy();
    expect(fade?.triggeredCount).toBe(2);
    expect(fade?.resolvedCount).toBe(2);
    expect(fade?.t1Wins).toBe(1);
    expect(fade?.t2Wins).toBe(1);
    expect(fade?.stopsBeforeT1).toBe(1);

    const ranging = summary.byRegime.find((bucket) => bucket.key === 'ranging');
    expect(ranging?.triggeredCount).toBe(2);

    const sniperPrimary = summary.byTier.find((bucket) => bucket.key === 'sniper_primary');
    expect(sniperPrimary?.triggeredCount).toBe(2);
  });
});

describe('spx/outcomeTracker touch persistence', () => {
  const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('upserts level touch rows keyed by setup instance id', async () => {
    const setupInstancesTable = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn(),
      in: jest.fn().mockResolvedValue({
        data: [{
          id: 'instance-1',
          engine_setup_id: 'setup-1',
          session_date: '2026-02-23',
          setup_type: 'mean_reversion',
          direction: 'bullish',
          regime: 'ranging',
          tier: 'sniper_primary',
          triggered_at: '2026-02-23T14:31:00.000Z',
          final_outcome: null,
          t1_hit_at: null,
          t2_hit_at: null,
          stop_hit_at: null,
        }],
        error: null,
      }),
      update: jest.fn(),
      eq: jest.fn(),
    };
    setupInstancesTable.select.mockReturnValue(setupInstancesTable as any);
    setupInstancesTable.update.mockReturnValue(setupInstancesTable as any);
    setupInstancesTable.eq
      .mockReturnValueOnce(setupInstancesTable as any)
      .mockResolvedValueOnce({ error: null } as any);

    const levelTouchesTable = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockFrom.mockImplementation(((table: string) => {
      if (table === 'spx_setup_instances') return setupInstancesTable as any;
      if (table === 'spx_level_touches') return levelTouchesTable as any;
      throw new Error(`Unexpected table ${table}`);
    }) as any);

    await persistSetupInstancesForWinRate([
      {
        id: 'setup-1',
        stableIdHash: 'abc123',
        type: 'mean_reversion',
        direction: 'bullish',
        entryZone: { low: 5000, high: 5001 },
        stop: 4998.5,
        baseStop: 4998.9,
        geometryStopScale: 1.05,
        atr14: 12.7,
        vixRegime: 'low',
        netGex: 1250000,
        gexNet: 1250000,
        gexDistanceBp: 2.8,
        gexCallWall: 5020,
        gexPutWall: 4980,
        gexFlipPoint: 5005,
        target1: { price: 5003, label: 'Target 1' },
        target2: { price: 5005, label: 'Target 2' },
        confluenceScore: 4,
        confluenceSources: ['ema_alignment'],
        clusterZone: {
          id: 'zone-1',
          priceLow: 5000,
          priceHigh: 5001,
          clusterScore: 4,
          type: 'defended',
          sources: [],
          testCount: 0,
          lastTestAt: null,
          held: null,
          holdRate: null,
        },
        regime: 'ranging',
        status: 'triggered',
        score: 82,
        probability: 63,
        createdAt: '2026-02-23T14:30:00.000Z',
        triggeredAt: '2026-02-23T14:31:00.000Z',
        triggerContext: {
          triggerBarTimestamp: '2026-02-23T14:31:00.000Z',
          triggerBarPatternType: 'hammer',
          triggerBarVolume: 1400,
          penetrationDepth: 0.4,
          triggerLatencyMs: 0,
        },
      } as any,
    ], {
      observedAt: '2026-02-23T14:31:30.000Z',
    });

    expect(setupInstancesTable.upsert).toHaveBeenCalledTimes(1);
    const [trackedRows] = setupInstancesTable.upsert.mock.calls[0];
    expect(Array.isArray(trackedRows)).toBe(true);
    expect(trackedRows[0]?.metadata).toMatchObject({
      atr14: 12.7,
      baseStop: 4998.9,
      geometryStopScale: 1.05,
      vixRegime: 'low',
      netGex: 1250000,
      gexNet: 1250000,
      gexDistanceBp: 2.8,
      gexCallWall: 5020,
      gexPutWall: 4980,
      gexFlipPoint: 5005,
      stopContext: {
        atr14: 12.7,
        baseStop: 4998.9,
        geometryStopScale: 1.05,
        vixRegime: 'low',
        netGex: 1250000,
        gexDistanceBp: 2.8,
      },
    });

    expect(levelTouchesTable.upsert).toHaveBeenCalledTimes(1);
    const [rows, options] = levelTouchesTable.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: 'setup_instance_id' });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toMatchObject({
      setup_instance_id: 'instance-1',
      level_price: 5000.5,
      outcome: 'unknown',
      candle_pattern: 'hammer',
      volume: 1400,
    });
  });
});
