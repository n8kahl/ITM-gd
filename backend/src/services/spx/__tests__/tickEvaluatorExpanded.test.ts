import type { Setup } from '../types';
import type { NormalizedMarketTick } from '../../tickCache';
import {
  evaluateTickSetupTransitions,
  resetTickEvaluatorState,
  syncTickEvaluatorSetups,
} from '../tickEvaluator';

function makeSetup(overrides?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 5017, high: 5018 },
    stop: 5005,
    target1: { price: 5022, label: 'Target 1' },
    target2: { price: 5026, label: 'Target 2' },
    confluenceScore: 4,
    confluenceSources: ['gex_alignment'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 5017,
      priceHigh: 5018,
      clusterScore: 4,
      type: 'defended',
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: true,
      holdRate: 70,
    },
    regime: 'ranging',
    status: 'ready',
    probability: 70,
    recommendedContract: null,
    createdAt: '2026-02-24T12:00:00.000Z',
    triggeredAt: null,
    ...overrides,
  };
}

function makeTick(price: number, timestamp: number, sequence: number): NormalizedMarketTick {
  return {
    symbol: 'SPX',
    rawSymbol: 'I:SPX',
    price,
    size: 1,
    timestamp,
    sequence,
  };
}

describe('spx/tickEvaluator expanded edge cases', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetTickEvaluatorState();
    process.env = {
      ...originalEnv,
      SPX_SETUP_STOP_CONFIRMATION_TICKS: '2',
      SPX_SETUP_MOVE_STOP_TO_BREAKEVEN_AFTER_T1: 'true',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Group 1: price gap entry detection', () => {
    it('triggers bullish entry when price gaps down through the entry zone', () => {
      syncTickEvaluatorSetups([makeSetup({ direction: 'bullish' })]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5015, 1700000002500, 2));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('triggered');
      expect(events[0].reason).toBe('entry');
    });

    it('triggers bearish entry when price gaps up through the entry zone', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          direction: 'bearish',
          stop: 5030,
          target1: { price: 5014, label: 'Target 1' },
          target2: { price: 5010, label: 'Target 2' },
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5015, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5020, 1700000002500, 2));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('triggered');
      expect(events[0].reason).toBe('entry');
    });

    it('does not trigger bearish entry when price crosses in the wrong direction', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          direction: 'bearish',
          stop: 5030,
          target1: { price: 5014, label: 'Target 1' },
          target2: { price: 5010, label: 'Target 2' },
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);
      expect(evaluateTickSetupTransitions(makeTick(5015, 1700000002500, 2))).toHaveLength(0);
    });

    it('still triggers normally when price lands inside the entry zone without a full bridge', () => {
      syncTickEvaluatorSetups([makeSetup()]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5018, 1700000002500, 2));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('triggered');
    });

    it('does not falsely trigger when price moves but does not cross through the full zone', () => {
      syncTickEvaluatorSetups([makeSetup()]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);
      expect(evaluateTickSetupTransitions(makeTick(5019, 1700000002500, 2))).toHaveLength(0);
    });

    it('only triggers setups whose direction and zone are actually crossed', () => {
      const bullishCross = makeSetup({ id: 'bullish-cross' });
      const bearishWrongDirection = makeSetup({
        id: 'bearish-wrong',
        direction: 'bearish',
        stop: 5030,
        target1: { price: 5014, label: 'Target 1' },
        target2: { price: 5010, label: 'Target 2' },
      });
      const otherZone = makeSetup({
        id: 'other-zone',
        entryZone: { low: 5009, high: 5010 },
      });
      syncTickEvaluatorSetups([bullishCross, bearishWrongDirection, otherZone]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5015, 1700000002500, 2));
      expect(events).toHaveLength(1);
      expect(events[0].setupId).toBe('bullish-cross');
    });
  });

  describe('Group 2: simultaneous hit edge cases', () => {
    it('does not emit target transitions on the same tick as a ready->triggered entry', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          target1: { price: 5007, label: 'Target 1' },
          target2: { price: 5010, label: 'Target 2' },
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);

      const entryEvents = evaluateTickSetupTransitions(makeTick(5008, 1700000002500, 2));
      expect(entryEvents).toHaveLength(1);
      expect(entryEvents[0].toPhase).toBe('triggered');
      expect(entryEvents[0].reason).toBe('entry');

      const targetEvents = evaluateTickSetupTransitions(makeTick(5008, 1700000004000, 3), {
        minTransitionGapMs: 0,
      });
      expect(targetEvents).toHaveLength(1);
      expect(targetEvents[0].toPhase).toBe('target1_hit');
      expect(targetEvents[0].reason).toBe('target1');
    });

    it('prioritizes stop invalidation over entry when a ready setup gaps below stop', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          stop: 5010,
          target1: { price: 5020, label: 'Target 1' },
          target2: { price: 5030, label: 'Target 2' },
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5000, 1700000002500, 2), {
        minStopBreachTicks: 1,
      });
      expect(events).toHaveLength(1);
      expect(events[0].fromPhase).toBe('ready');
      expect(events[0].toPhase).toBe('invalidated');
      expect(events[0].reason).toBe('stop');
    });

    it('prioritizes stop over target1 when both are true on the same triggered tick', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          status: 'triggered',
          triggeredAt: '2026-02-24T12:01:00.000Z',
          stop: 5010,
          target1: { price: 5010, label: 'Target 1' },
          target2: { price: 5015, label: 'Target 2' },
        }),
      ]);

      const events = evaluateTickSetupTransitions(makeTick(5010, 1700000002500, 1), {
        minStopBreachTicks: 1,
      });
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('invalidated');
      expect(events[0].reason).toBe('stop');
    });
  });

  describe('Group 3: stop confirmation streak', () => {
    it('breaks the stop streak when an in-between tick no longer breaches stop', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          status: 'triggered',
          triggeredAt: '2026-02-24T12:01:00.000Z',
          stop: 5010,
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5009, 1700000001000, 1))).toHaveLength(0);
      expect(evaluateTickSetupTransitions(makeTick(5012, 1700000002500, 2))).toHaveLength(0);
      expect(evaluateTickSetupTransitions(makeTick(5009, 1700000004000, 3))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5008, 1700000005500, 4));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('invalidated');
    });

    it('confirms stop after two consecutive breach ticks', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          status: 'triggered',
          triggeredAt: '2026-02-24T12:01:00.000Z',
          stop: 5010,
        }),
      ]);

      expect(evaluateTickSetupTransitions(makeTick(5009, 1700000001000, 1))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5008, 1700000002500, 2));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('invalidated');
      expect(events[0].reason).toBe('stop');
    });

    it('allows stop confirmation after debounce window elapses', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          stop: 5010,
        }),
      ]);

      const entry = evaluateTickSetupTransitions(makeTick(5017.5, 1700000001000, 1));
      expect(entry).toHaveLength(1);
      expect(entry[0].toPhase).toBe('triggered');

      expect(evaluateTickSetupTransitions(makeTick(5009, 1700000001200, 2))).toHaveLength(0);

      const events = evaluateTickSetupTransitions(makeTick(5008, 1700000002700, 3));
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('invalidated');
      expect(events[0].reason).toBe('stop');
    });

    it('evaluates stop at breakeven after target1 when moveStopToBreakeven is enabled', () => {
      syncTickEvaluatorSetups([
        makeSetup({
          status: 'triggered',
          triggeredAt: '2026-02-24T12:01:00.000Z',
          stop: 5010,
          target1: { price: 5020, label: 'Target 1' },
          target2: { price: 5030, label: 'Target 2' },
          tradeManagement: {
            partialAtT1Pct: 0.65,
            moveStopToBreakeven: true,
          },
        }),
      ]);

      const t1 = evaluateTickSetupTransitions(makeTick(5020, 1700000001000, 1));
      expect(t1).toHaveLength(1);
      expect(t1[0].toPhase).toBe('target1_hit');

      const events = evaluateTickSetupTransitions(makeTick(5017.4, 1700000002500, 2), {
        minStopBreachTicks: 1,
      });
      expect(events).toHaveLength(1);
      expect(events[0].toPhase).toBe('invalidated');
      expect(events[0].reason).toBe('stop');
    });
  });
});
