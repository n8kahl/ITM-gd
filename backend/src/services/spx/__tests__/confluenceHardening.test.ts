import {
  computeFlowWindowAggregation,
  createNeutralFlowWindowAggregation,
  deriveFlowWindowSignal,
} from '../flowAggregator';
import { __testables } from '../setupDetector';
import type { SPXFlowEvent } from '../types';

const BASE_WEIGHTED_INPUT = {
  flowQualityScore: 50,
  flowConfirmed: false,
  emaAligned: true,
  emaFastSlope: 0,
  zoneQualityScore: 80,
  gexAligned: true,
  regimeAligned: true,
  regimeConflict: false,
  multiTFComposite: 50 as number | null,
  memoryScoreBoost: 0,
};

const AS_OF = new Date('2026-02-25T15:30:00.000Z');

function buildFlowEvent(input: {
  id: string;
  direction: 'bullish' | 'bearish';
  premium: number;
  minutesAgo: number;
  type?: 'sweep' | 'block';
}): SPXFlowEvent {
  return {
    id: input.id,
    type: input.type || 'block',
    symbol: 'SPX',
    strike: 6000,
    expiry: '2026-02-25',
    size: 25,
    direction: input.direction,
    premium: input.premium,
    timestamp: new Date(AS_OF.getTime() - (input.minutesAgo * 60 * 1000)).toISOString(),
  };
}

describe('spx/confluence hardening - weighted confluence null safety', () => {
  it('scores lower when multiTFComposite is null vs explicit 50', () => {
    const withNeutral = __testables.calculateWeightedConfluence(BASE_WEIGHTED_INPUT);
    const withMissing = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      multiTFComposite: null,
    });

    expect(withMissing.composite).toBeLessThan(withNeutral.composite);
  });

  it('uses 35 as the missing multiTF contribution (3.5 points at 10% weight)', () => {
    const withMissing = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      multiTFComposite: null,
    });

    const contribution = withMissing.multiTF * 0.1;
    expect(withMissing.multiTF).toBe(35);
    expect(contribution).toBeCloseTo(3.5, 6);
    expect(contribution).not.toBeCloseTo(5, 6);
  });

  it('treats multiTFComposite = 0 as real data, not missing', () => {
    const withZero = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      multiTFComposite: 0,
    });
    const withMissing = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      multiTFComposite: null,
    });

    expect(withZero.multiTF).toBe(0);
    expect(withZero.composite).toBeLessThan(withMissing.composite);
  });

  it('scores lower when all optional weighted inputs are null vs neutral defaults', () => {
    const withNeutralOptionals = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      emaFastSlope: 0,
      multiTFComposite: 50,
    });
    const withMissingOptionals = __testables.calculateWeightedConfluence({
      ...BASE_WEIGHTED_INPUT,
      emaFastSlope: null,
      multiTFComposite: null,
    });

    expect(withMissingOptionals.composite).toBeLessThan(withNeutralOptionals.composite);
  });
});

describe('spx/confluence hardening - flow zero-event handling', () => {
  it('returns flowScore = 0 when total premium is zero', () => {
    const aggregation = computeFlowWindowAggregation({
      flowEvents: [],
      asOf: AS_OF,
    });

    expect(aggregation.windows['5m'].flowScore).toBe(0);
    expect(aggregation.windows['15m'].flowScore).toBe(0);
    expect(aggregation.windows['30m'].flowScore).toBe(0);
  });

  it('never confirms a zero-event window with flowScore = 0', () => {
    const aggregation = createNeutralFlowWindowAggregation(AS_OF);
    const bullishSignal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bullish',
    });
    const bearishSignal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bearish',
    });

    expect(bullishSignal.confirmed).toBe(false);
    expect(bearishSignal.confirmed).toBe(false);
  });

  it('keeps confirmed=false for a single event below FLOW_SIGNAL_MIN_EVENTS', () => {
    const aggregation = computeFlowWindowAggregation({
      flowEvents: [
        buildFlowEvent({
          id: 'single',
          direction: 'bullish',
          premium: 10_000,
          minutesAgo: 1,
        }),
      ],
      asOf: AS_OF,
    });
    const signal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bullish',
    });

    expect(signal.confirmed).toBe(false);
  });

  it('keeps confirmation true for active windows with adequate events and premium', () => {
    const aggregation = computeFlowWindowAggregation({
      flowEvents: [
        buildFlowEvent({
          id: 'a',
          direction: 'bullish',
          premium: 80_000,
          minutesAgo: 1,
          type: 'sweep',
        }),
        buildFlowEvent({
          id: 'b',
          direction: 'bullish',
          premium: 70_000,
          minutesAgo: 3,
          type: 'block',
        }),
      ],
      asOf: AS_OF,
    });
    const signal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bullish',
    });

    expect(signal.confirmed).toBe(true);
    expect(signal.window).toBe('5m');
  });
});

describe('spx/confluence hardening - decay timestamp safety', () => {
  it('decays missing timestamps as one half-life old (~0.5 factor)', () => {
    const nowMs = Date.parse('2026-02-25T15:30:00.000Z');
    const score = __testables.computeDecayedConfluence({
      components: { gex: 1 },
      componentTimestampsMs: {},
      nowMs,
    });

    expect(score).toBeCloseTo(0.5, 2);
  });

  it('decays less for recent valid timestamps than for missing timestamps', () => {
    const nowMs = Date.parse('2026-02-25T15:30:00.000Z');
    const missingTimestampScore = __testables.computeDecayedConfluence({
      components: { gex: 1 },
      componentTimestampsMs: {},
      nowMs,
    });
    const recentTimestampScore = __testables.computeDecayedConfluence({
      components: { gex: 1 },
      componentTimestampsMs: { gex: nowMs - (2 * 60_000) },
      nowMs,
    });

    expect(recentTimestampScore).toBeGreaterThan(missingTimestampScore);
  });

  it('treats timestamp = 0 as missing (half-life decay), not infinitely old', () => {
    const nowMs = Date.parse('2026-02-25T15:30:00.000Z');
    const score = __testables.computeDecayedConfluence({
      components: { zone: 1 },
      componentTimestampsMs: { zone: 0 },
      nowMs,
    });

    expect(score).toBeCloseTo(0.5, 2);
  });
});
