import { __testables } from '../winRateBacktest';

type Candidate = Parameters<typeof __testables.evaluateSetupAgainstBars>[0];

function bar(t: string, o: number, h: number, l: number, c: number) {
  return {
    t: Date.parse(t),
    o,
    h,
    l,
    c,
    v: 1000,
  };
}

function baseSetup(overrides: Partial<Candidate> = {}): Candidate {
  return {
    engineSetupId: 'setup-1',
    sessionDate: '2026-02-20',
    setupType: 'fade_at_wall',
    direction: 'bullish',
    regime: 'ranging',
    tier: 'sniper_primary',
    gateStatus: null,
    entryLow: 100,
    entryHigh: 101,
    stopPrice: 98,
    target1Price: 103,
    target2Price: 105,
    firstSeenAt: '2026-02-20T14:30:00.000Z',
    triggeredAt: null,
    tradeManagement: null,
    ...overrides,
  };
}

describe('spx/winRateBacktest evaluateSetupAgainstBars', () => {
  it('classifies target2-before-stop after entry trigger', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(setup, [
      bar('2026-02-20T14:30:00.000Z', 99.5, 101.1, 99.2, 100.7),
      bar('2026-02-20T14:31:00.000Z', 100.7, 103.4, 100.1, 102.9),
      bar('2026-02-20T14:32:00.000Z', 102.9, 105.2, 102.5, 104.8),
    ]);

    expect(result.row.triggered_at).toBeTruthy();
    expect(result.row.t1_hit_at).toBeTruthy();
    expect(result.row.t2_hit_at).toBeTruthy();
    expect(result.row.final_outcome).toBe('t2_before_stop');
  });

  it('classifies stop-before-t1 when stop is breached first', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(setup, [
      bar('2026-02-20T14:30:00.000Z', 100.5, 101.2, 100.2, 100.8),
      bar('2026-02-20T14:31:00.000Z', 100.8, 101.0, 97.5, 98.1),
    ]);

    expect(result.row.final_outcome).toBe('stop_before_t1');
    expect(result.row.stop_hit_at).toBeTruthy();
    expect(result.row.t1_hit_at).toBeNull();
  });

  it('classifies t1-before-stop when target1 hits before a stop breach', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(setup, [
      bar('2026-02-20T14:30:00.000Z', 100.4, 101.0, 100.0, 100.9),
      bar('2026-02-20T14:31:00.000Z', 100.9, 103.3, 100.7, 103.1),
      bar('2026-02-20T14:32:00.000Z', 103.1, 103.2, 97.8, 98.3),
    ]);

    expect(result.row.t1_hit_at).toBeTruthy();
    expect(result.row.stop_hit_at).toBeTruthy();
    expect(result.row.final_outcome).toBe('t1_before_stop');
  });

  it('leaves untriggered setups unresolved', () => {
    const setup = baseSetup({ entryLow: 110, entryHigh: 111 });
    const result = __testables.evaluateSetupAgainstBars(setup, [
      bar('2026-02-20T14:30:00.000Z', 100, 101, 99.5, 100.3),
      bar('2026-02-20T14:31:00.000Z', 100.3, 101.2, 99.8, 100.9),
    ]);

    expect(result.row.triggered_at).toBeNull();
    expect(result.row.final_outcome).toBeNull();
    expect(result.row.t1_hit_at).toBeNull();
    expect(result.row.t2_hit_at).toBeNull();
    expect(result.row.stop_hit_at).toBeNull();
  });

  it('tracks ambiguous bars when stop and target are both touched', () => {
    const setup = baseSetup({ triggeredAt: '2026-02-20T14:29:00.000Z' });
    const result = __testables.evaluateSetupAgainstBars(setup, [
      bar('2026-02-20T14:30:00.000Z', 100, 104, 97, 102),
    ]);

    expect(result.ambiguityCount).toBe(1);
    expect(result.row.final_outcome).toBe('stop_before_t1');
  });

  it('captures realized R and entry fill when execution model is enabled', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(
      setup,
      [
        bar('2026-02-20T14:30:00.000Z', 99.5, 101.2, 99.4, 100.9),
        bar('2026-02-20T14:31:00.000Z', 100.9, 105.4, 100.6, 105.1),
      ],
      {
        enabled: true,
        entrySlipPoints: 0.4,
        targetSlipPoints: 0.3,
        stopSlipPoints: 0.2,
        commissionPerTradeR: 0.08,
        partialAtT1Pct: 0.5,
        moveStopToBreakevenAfterT1: true,
      },
    );

    expect(result.row.triggered_at).toBeTruthy();
    expect(result.row.entry_fill_price).toBeGreaterThan(100);
    expect(result.row.realized_r).not.toBeNull();
    expect(result.row.final_outcome).toBe('t2_before_stop');
    expect((result.row.realized_r || 0)).toBeGreaterThan(0);
  });

  it('accounts for runner loss after T1 when breakeven move is disabled', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(
      setup,
      [
        bar('2026-02-20T14:30:00.000Z', 99.8, 100.2, 99.7, 100.1),
        bar('2026-02-20T14:31:00.000Z', 100.1, 103.2, 100.0, 102.9),
        bar('2026-02-20T14:32:00.000Z', 102.9, 103.0, 97.8, 98.2),
      ],
      {
        enabled: true,
        entrySlipPoints: 0,
        targetSlipPoints: 0,
        stopSlipPoints: 0,
        commissionPerTradeR: 0,
        partialAtT1Pct: 0.5,
        moveStopToBreakevenAfterT1: false,
      },
    );

    expect(result.row.final_outcome).toBe('t1_before_stop');
    expect(result.row.stop_hit_at).toBeTruthy();
    expect(result.row.realized_r).toBeCloseTo(0.25, 4);
  });

  it('marks runner to close when T1 is hit but neither stop nor T2 is hit', () => {
    const setup = baseSetup();
    const result = __testables.evaluateSetupAgainstBars(
      setup,
      [
        bar('2026-02-20T14:30:00.000Z', 99.8, 100.2, 99.7, 100.1),
        bar('2026-02-20T14:31:00.000Z', 100.1, 103.2, 100.0, 102.9),
        bar('2026-02-20T14:32:00.000Z', 102.9, 103.4, 102.1, 102.5),
      ],
      {
        enabled: true,
        entrySlipPoints: 0,
        targetSlipPoints: 0,
        stopSlipPoints: 0,
        commissionPerTradeR: 0,
        partialAtT1Pct: 0.5,
        moveStopToBreakevenAfterT1: true,
      },
    );

    expect(result.row.final_outcome).toBe('t1_before_stop');
    expect(result.row.stop_hit_at).toBeNull();
    expect(result.row.realized_r).toBeCloseTo(1.375, 4);
  });

  it('honors setup-level trade management overrides in backtest execution', () => {
    const setup = baseSetup({
      tradeManagement: {
        partialAtT1Pct: 0.8,
        moveStopToBreakeven: false,
      },
    });
    const result = __testables.evaluateSetupAgainstBars(
      setup,
      [
        bar('2026-02-20T14:30:00.000Z', 99.8, 100.2, 99.7, 100.1),
        bar('2026-02-20T14:31:00.000Z', 100.1, 103.2, 100.0, 102.9),
        bar('2026-02-20T14:32:00.000Z', 102.9, 103.0, 97.8, 98.2),
      ],
      {
        enabled: true,
        entrySlipPoints: 0,
        targetSlipPoints: 0,
        stopSlipPoints: 0,
        commissionPerTradeR: 0,
        partialAtT1Pct: 0.5,
        moveStopToBreakevenAfterT1: true,
      },
    );

    expect(result.row.final_outcome).toBe('t1_before_stop');
    expect(result.row.realized_r).toBeCloseTo(1.0, 4);
  });
});
