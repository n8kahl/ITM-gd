import type { Setup } from '../types';
import {
  applyTickStateToSetups,
  evaluateTickSetupTransitions,
  resetTickEvaluatorState,
  syncTickEvaluatorSetups,
} from '../tickEvaluator';

function makeSetup(overrides?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6000, high: 6001 },
    stop: 5995,
    target1: { price: 6004, label: 'Target 1' },
    target2: { price: 6008, label: 'Target 2' },
    confluenceScore: 4,
    confluenceSources: ['gex_alignment'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6000,
      priceHigh: 6001,
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
    createdAt: '2026-02-17T12:00:00.000Z',
    triggeredAt: null,
    ...overrides,
  };
}

describe('spx/tickEvaluator', () => {
  beforeEach(() => {
    resetTickEvaluatorState();
  });

  it('emits ready -> triggered transition when entry is touched', () => {
    const setup = makeSetup();
    syncTickEvaluatorSetups([setup]);

    const events = evaluateTickSetupTransitions({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000.5,
      size: 3,
      timestamp: 1700000000000,
      sequence: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0].fromPhase).toBe('ready');
    expect(events[0].toPhase).toBe('triggered');
    expect(events[0].setup.status).toBe('triggered');
    expect(events[0].setup.triggeredAt).toBeTruthy();
  });

  it('emits triggered -> target1_hit -> target2_hit transitions in order', () => {
    const setup = makeSetup({ status: 'triggered', triggeredAt: '2026-02-17T12:01:00.000Z' });
    syncTickEvaluatorSetups([setup]);

    const first = evaluateTickSetupTransitions({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6004,
      size: 1,
      timestamp: 1700000001000,
      sequence: 1,
    });

    expect(first).toHaveLength(1);
    expect(first[0].toPhase).toBe('target1_hit');
    expect(first[0].setup.status).toBe('triggered');

    const second = evaluateTickSetupTransitions({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6008,
      size: 1,
      timestamp: 1700000003000,
      sequence: 2,
    });

    expect(second).toHaveLength(1);
    expect(second[0].toPhase).toBe('target2_hit');
    expect(second[0].setup.status).toBe('expired');
  });

  it('applies advanced tick status over stale snapshot status', () => {
    const setup = makeSetup();
    syncTickEvaluatorSetups([setup]);
    evaluateTickSetupTransitions({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000.25,
      size: 2,
      timestamp: 1700000000000,
      sequence: 1,
    });

    const staleSnapshot = [makeSetup({ status: 'ready' })];
    const resolved = applyTickStateToSetups(staleSnapshot);

    expect(resolved[0].status).toBe('triggered');
    expect(resolved[0].triggeredAt).toBeTruthy();
  });

  it('does not evaluate non-SPX ticks', () => {
    syncTickEvaluatorSetups([makeSetup()]);
    const events = evaluateTickSetupTransitions({
      symbol: 'SPY',
      rawSymbol: 'SPY',
      price: 600,
      size: 1,
      timestamp: 1700000000000,
      sequence: 1,
    });
    expect(events).toHaveLength(0);
  });
});

