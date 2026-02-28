import {
  buildTradeStreamSnapshot,
  sortTradeStreamItems,
  type TradeStreamAssemblySetup,
  type TradeStreamPastResolutionRecord,
} from '../tradeStream';
import type { TradeStreamItem } from '../types';

const FEED_TRUST = {
  source: 'live',
  generatedAt: '2026-02-28T14:30:00.000Z',
  ageMs: 15_000,
  degraded: false,
  stale: false,
  reason: null,
} as const;

let setupSeed = 0;
let recordSeed = 0;

function createSetup(overrides: Partial<TradeStreamAssemblySetup> = {}): TradeStreamAssemblySetup {
  const id = overrides.id ?? `setup-${setupSeed++}`;

  return {
    id,
    stableIdHash: overrides.stableIdHash ?? id,
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6020, high: 6022 },
    stop: 6016,
    target1: { price: 6028, label: 'T1' },
    target2: { price: 6034, label: 'T2' },
    confluenceScore: 4.1,
    confluenceSources: ['flow_confirmation'],
    clusterZone: {
      id: `cluster-${id}`,
      priceLow: 6018,
      priceHigh: 6024,
      clusterScore: 4,
      type: 'defended',
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: true,
      holdRate: 65,
    },
    regime: 'trending',
    status: 'forming',
    probability: 70,
    recommendedContract: null,
    createdAt: '2026-02-28T14:00:00.000Z',
    triggeredAt: null,
    ...overrides,
  };
}

function createPastRecord(overrides: Partial<TradeStreamPastResolutionRecord> = {}): TradeStreamPastResolutionRecord {
  const id = overrides.id ?? `record-${recordSeed++}`;

  return {
    id,
    stableIdHash: overrides.stableIdHash ?? id,
    status: 'resolved',
    direction: 'bearish',
    setupType: 'breakout_vacuum',
    entryZone: { low: 6018, high: 6020 },
    stop: 6024,
    target1: 6008,
    target2: 5998,
    probability: 74,
    confluenceScore: 4.4,
    evR: 2.1,
    alignmentScore: 0.84,
    momentPriority: 90,
    recommendedAction: 'REVIEW',
    actionBlockedReason: 'resolved',
    timing: {
      createdAt: '2026-02-28T14:10:00.000Z',
      triggeredAt: '2026-02-28T14:14:00.000Z',
      resolvedAt: '2026-02-28T14:24:00.000Z',
    },
    reason: {
      triggerContext: 'Resolved historical record.',
      gateReasons: [],
      decisionDrivers: ['Outcome persisted from tracker.'],
      decisionRisks: [],
    },
    outcome: {
      result: 'target1',
      rMultiple: 1,
      resolvedBy: 'target1',
    },
    ...overrides,
  };
}

function createTradeStreamItem(overrides: Partial<TradeStreamItem> = {}): TradeStreamItem {
  const id = overrides.id ?? 'item-default';
  return {
    id,
    stableIdHash: overrides.stableIdHash ?? `stable-${id}`,
    lifecycleState: overrides.lifecycleState ?? 'forming',
    status: overrides.status ?? 'forming',
    direction: overrides.direction ?? 'bullish',
    setupType: overrides.setupType ?? 'fade_at_wall',
    entryZone: overrides.entryZone ?? { low: 6020, high: 6022 },
    stop: overrides.stop ?? 6016,
    target1: overrides.target1 ?? 6028,
    target2: overrides.target2 ?? 6034,
    probability: overrides.probability ?? 70,
    confluenceScore: overrides.confluenceScore ?? 4.1,
    evR: overrides.evR ?? 2,
    alignmentScore: overrides.alignmentScore ?? 0.8,
    momentPriority: overrides.momentPriority ?? 90,
    recommendedAction: overrides.recommendedAction ?? 'WAIT',
    actionBlockedReason: overrides.actionBlockedReason ?? null,
    freshness: overrides.freshness ?? {
      source: 'live',
      generatedAt: FEED_TRUST.generatedAt,
      ageMs: 15_000,
      degraded: false,
    },
    timing: overrides.timing ?? {
      createdAt: '2026-02-28T14:00:00.000Z',
      triggeredAt: null,
      resolvedAt: null,
      etaToTriggerMs: 120_000,
    },
    reason: overrides.reason ?? {
      triggerContext: 'default',
      gateReasons: [],
      decisionDrivers: [],
      decisionRisks: [],
    },
    outcome: overrides.outcome ?? null,
  };
}

describe('spx/tradeStream', () => {
  beforeEach(() => {
    setupSeed = 0;
    recordSeed = 0;
  });

  it('orders unordered mixed input by lifecycle, urgency, timing, and stable hash deterministically', () => {
    const snapshot = buildTradeStreamSnapshot({
      setups: [
        createSetup({
          id: 'setup-forming-b',
          stableIdHash: 'stable-forming-b',
          status: 'forming',
          momentPriority: 84,
          etaToTriggerMs: 420_000,
          createdAt: '2026-02-28T14:18:00.000Z',
        }),
        createSetup({
          id: 'setup-triggered-b',
          stableIdHash: 'stable-triggered-b',
          type: 'trend_continuation',
          direction: 'bearish',
          status: 'triggered',
          momentPriority: 93,
          triggeredAt: '2026-02-28T14:28:30.000Z',
        }),
        createSetup({
          id: 'setup-forming-a',
          stableIdHash: 'stable-forming-a',
          type: 'vwap_reclaim',
          status: 'ready',
          momentPriority: 84,
          etaToTriggerMs: 180_000,
          createdAt: '2026-02-28T14:19:00.000Z',
        }),
        createSetup({
          id: 'setup-triggered-a',
          stableIdHash: 'stable-triggered-a',
          type: 'trend_continuation',
          direction: 'bearish',
          status: 'triggered',
          momentPriority: 93,
          triggeredAt: '2026-02-28T14:28:30.000Z',
        }),
        createSetup({
          id: 'setup-past-b',
          stableIdHash: 'stable-past-b',
          type: 'mean_reversion',
          status: 'expired',
          momentPriority: 99,
          statusUpdatedAt: '2026-02-28T14:22:00.000Z',
        }),
      ],
      resolutionRecords: [
        createPastRecord({
          id: 'record-past-a',
          stableIdHash: 'stable-past-a',
          momentPriority: 99,
          timing: {
            createdAt: '2026-02-28T14:21:00.000Z',
            triggeredAt: '2026-02-28T14:24:00.000Z',
            resolvedAt: '2026-02-28T14:29:55.000Z',
          },
          outcome: {
            result: 'target2',
            rMultiple: 1.9,
            resolvedBy: 'target2',
          },
        }),
      ],
      feedTrust: FEED_TRUST,
      generatedAt: FEED_TRUST.generatedAt,
    });

    expect(snapshot.items.map((item) => item.id)).toEqual([
      'setup-forming-a',
      'setup-forming-b',
      'setup-triggered-a',
      'setup-triggered-b',
      'record-past-a',
      'setup-past-b',
    ]);
  });

  it('selects now focus by urgency-first comparator without lifecycle-rank tie breaks', () => {
    const snapshot = buildTradeStreamSnapshot({
      setups: [
        createSetup({
          id: 'focus-forming',
          stableIdHash: 'stable-focus-forming',
          status: 'ready',
          momentPriority: 100,
          createdAt: '2026-02-28T14:25:00.000Z',
        }),
        createSetup({
          id: 'focus-triggered',
          stableIdHash: 'stable-focus-triggered',
          status: 'triggered',
          momentPriority: 100,
          triggeredAt: '2026-02-28T14:29:00.000Z',
        }),
      ],
      feedTrust: FEED_TRUST,
      generatedAt: FEED_TRUST.generatedAt,
    });

    expect(snapshot.nowFocusItemId).toBe('focus-triggered');
  });

  it('derives countsByLifecycle from mapped lifecycle states', () => {
    const snapshot = buildTradeStreamSnapshot({
      setups: [
        createSetup({ id: 'count-forming', status: 'forming' }),
        createSetup({ id: 'count-ready', status: 'ready' }),
        createSetup({ id: 'count-triggered', status: 'triggered', triggeredAt: '2026-02-28T14:20:00.000Z' }),
        createSetup({ id: 'count-invalidated', status: 'invalidated' }),
        createSetup({ id: 'count-expired', status: 'expired' }),
      ],
      pastRecords: [createPastRecord({ id: 'count-record-past' })],
      feedTrust: FEED_TRUST,
      generatedAt: FEED_TRUST.generatedAt,
    });

    expect(snapshot.countsByLifecycle).toEqual({
      forming: 2,
      triggered: 1,
      past: 3,
    });
  });

  it('returns an empty snapshot contract when no inputs are provided', () => {
    const snapshot = buildTradeStreamSnapshot({
      setups: [],
      pastRecords: [],
      resolutionRecords: [],
      feedTrust: FEED_TRUST,
      generatedAt: FEED_TRUST.generatedAt,
    });

    expect(snapshot.items).toEqual([]);
    expect(snapshot.nowFocusItemId).toBeNull();
    expect(snapshot.countsByLifecycle).toEqual({
      forming: 0,
      triggered: 0,
      past: 0,
    });
    expect(snapshot.feedTrust).toEqual(FEED_TRUST);
  });

  it('prefers past record over active setup when stableIdHash conflicts', () => {
    const snapshot = buildTradeStreamSnapshot({
      setups: [
        createSetup({
          id: 'active-setup',
          stableIdHash: 'stable-conflict',
          status: 'triggered',
          momentPriority: 95,
          triggeredAt: '2026-02-28T14:27:00.000Z',
        }),
      ],
      pastRecords: [
        createPastRecord({
          id: 'past-record',
          stableIdHash: 'stable-conflict',
          momentPriority: 80,
          status: 'resolved',
          outcome: {
            result: 'target1',
            rMultiple: 1,
            resolvedBy: 'target1',
          },
        }),
      ],
      feedTrust: FEED_TRUST,
      generatedAt: FEED_TRUST.generatedAt,
    });

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].id).toBe('past-record');
    expect(snapshot.items[0].lifecycleState).toBe('past');
    expect(snapshot.countsByLifecycle).toEqual({
      forming: 0,
      triggered: 0,
      past: 1,
    });
  });

  it('uses stableIdHash then id as deterministic lifecycle-local tie-breaks', () => {
    const sortedStableHashTie = sortTradeStreamItems([
      createTradeStreamItem({
        id: 'forming-z',
        stableIdHash: 'stable-z',
        lifecycleState: 'forming',
        momentPriority: 84,
        timing: {
          createdAt: '2026-02-28T14:00:00.000Z',
          triggeredAt: null,
          resolvedAt: null,
          etaToTriggerMs: 300_000,
        },
      }),
      createTradeStreamItem({
        id: 'forming-a',
        stableIdHash: 'stable-a',
        lifecycleState: 'forming',
        momentPriority: 84,
        timing: {
          createdAt: '2026-02-28T14:00:00.000Z',
          triggeredAt: null,
          resolvedAt: null,
          etaToTriggerMs: 300_000,
        },
      }),
    ]);

    expect(sortedStableHashTie.map((item) => item.id)).toEqual(['forming-a', 'forming-z']);

    const sortedIdTie = sortTradeStreamItems([
      createTradeStreamItem({
        id: 'triggered-b',
        stableIdHash: 'stable-same',
        lifecycleState: 'triggered',
        status: 'triggered',
        momentPriority: 93,
        timing: {
          createdAt: '2026-02-28T14:10:00.000Z',
          triggeredAt: '2026-02-28T14:29:00.000Z',
          resolvedAt: null,
          etaToTriggerMs: null,
        },
      }),
      createTradeStreamItem({
        id: 'triggered-a',
        stableIdHash: 'stable-same',
        lifecycleState: 'triggered',
        status: 'triggered',
        momentPriority: 93,
        timing: {
          createdAt: '2026-02-28T14:10:00.000Z',
          triggeredAt: '2026-02-28T14:29:00.000Z',
          resolvedAt: null,
          etaToTriggerMs: null,
        },
      }),
    ]);

    expect(sortedIdTie.map((item) => item.id)).toEqual(['triggered-a', 'triggered-b']);
  });
});
