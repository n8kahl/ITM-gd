import { summarizeSPXWinRateRows } from '../outcomeTracker';

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
