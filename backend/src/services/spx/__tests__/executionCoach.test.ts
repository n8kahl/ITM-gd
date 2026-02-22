import { buildExecutionCoachMessageFromTransition } from '../executionCoach';
import type { SetupTransitionEvent } from '../tickEvaluator';

function buildEvent(overrides?: Partial<SetupTransitionEvent>): SetupTransitionEvent {
  const baseSetup = {
    id: 'setup-1',
    type: 'trend_pullback' as const,
    direction: 'bullish' as const,
    entryZone: { low: 6032, high: 6034 },
    stop: 6028,
    target1: { price: 6040, label: 'T1' },
    target2: { price: 6046, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['flow_confirmation', 'ema_alignment'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6031,
      priceHigh: 6035,
      clusterScore: 4,
      type: 'defended' as const,
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: true,
      holdRate: 68,
    },
    regime: 'trending' as const,
    status: 'triggered' as const,
    probability: 71,
    recommendedContract: null,
    createdAt: '2026-02-22T14:35:00.000Z',
    triggeredAt: '2026-02-22T14:41:10.000Z',
    tradeManagement: {
      partialAtT1Pct: 0.6,
      moveStopToBreakeven: true,
    },
  };

  return {
    id: 'event-1',
    setupId: 'setup-1',
    symbol: 'SPX',
    direction: 'bullish',
    fromPhase: 'ready',
    toPhase: 'triggered',
    price: 6033.5,
    timestamp: '2026-02-22T14:41:12.000Z',
    reason: 'entry',
    setup: baseSetup,
    ...overrides,
  };
}

describe('spx/executionCoach', () => {
  it('builds deterministic ENTER directive from triggered transition', () => {
    const message = buildExecutionCoachMessageFromTransition(buildEvent());

    expect(message).toBeTruthy();
    expect(message?.id).toBe('coach_execution_event-1');
    expect(message?.type).toBe('pre_trade');
    expect(message?.priority).toBe('setup');
    expect(message?.setupId).toBe('setup-1');
    expect(message?.content).toContain('Execution command: ENTER');
    expect(message?.structuredData.source).toBe('setup_transition');

    const directive = (message?.structuredData as { executionDirective?: { command?: string; transitionId?: string } })
      .executionDirective;
    expect(directive?.command).toBe('ENTER');
    expect(directive?.transitionId).toBe('event-1');
  });

  it('builds T1 directive with partial sizing guidance', () => {
    const message = buildExecutionCoachMessageFromTransition(buildEvent({
      id: 'event-t1',
      fromPhase: 'triggered',
      toPhase: 'target1_hit',
      reason: 'target1',
    }));

    expect(message).toBeTruthy();
    expect(message?.type).toBe('in_trade');
    expect(message?.content).toContain('TAKE 60% at T1');

    const directive = (message?.structuredData as { executionDirective?: { command?: string } }).executionDirective;
    expect(directive?.command).toBe('MOVE_STOP_TO_BREAKEVEN');
  });

  it('builds EXIT_STOP directive on stop invalidation', () => {
    const message = buildExecutionCoachMessageFromTransition(buildEvent({
      id: 'event-stop',
      fromPhase: 'triggered',
      toPhase: 'invalidated',
      reason: 'stop',
      setup: {
        ...buildEvent().setup,
        status: 'invalidated',
        invalidationReason: 'stop_breach_confirmed',
      },
    }));

    expect(message).toBeTruthy();
    expect(message?.type).toBe('alert');
    expect(message?.priority).toBe('alert');
    expect(message?.content).toContain('EXIT now');
    const directive = (message?.structuredData as { executionDirective?: { command?: string } }).executionDirective;
    expect(directive?.command).toBe('EXIT_STOP');
  });

  it('returns null for non-actionable transitions', () => {
    const message = buildExecutionCoachMessageFromTransition(buildEvent({
      id: 'event-ready',
      toPhase: 'ready',
      reason: 'entry',
    }));

    expect(message).toBeNull();
  });
});
