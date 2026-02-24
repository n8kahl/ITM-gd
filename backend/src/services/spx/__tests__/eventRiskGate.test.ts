import { evaluateEventRiskGate } from '../eventRiskGate';

describe('spx/eventRiskGate', () => {
  it('blocks when macro calendar is in blackout', () => {
    const decision = evaluateEventRiskGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      macroCalendar: {
        passed: false,
        caution: false,
        reason: 'FOMC in 45m (blackout window)',
        nextEvent: {
          event: 'FOMC',
          at: '2026-02-20T19:00:00.000Z',
          minutesUntil: 45,
        },
      },
    });

    expect(decision.passed).toBe(false);
    expect(decision.blackout).toBe(true);
    expect(decision.source).toBe('macro');
  });

  it('adds caution for elevated high-impact news flow', () => {
    const decision = evaluateEventRiskGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      macroCalendar: {
        passed: true,
        caution: false,
        nextEvent: null,
      },
      newsSentiment: {
        generatedAt: '2026-02-20T14:59:00.000Z',
        source: 'computed',
        bias: 'bearish',
        score: -56,
        marketMovingCount: 3,
        recentHighImpactCount: 2,
        latestPublishedAt: '2026-02-20T14:58:00.000Z',
        articles: [],
      },
    });

    expect(decision.passed).toBe(true);
    expect(decision.caution).toBe(true);
    expect(decision.riskScore).toBeGreaterThanOrEqual(40);
    expect(decision.source).toBe('news');
  });

  it('can escalate to blackout on breaking extreme news', () => {
    const decision = evaluateEventRiskGate({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      macroCalendar: {
        passed: true,
        caution: false,
        nextEvent: null,
      },
      newsSentiment: {
        generatedAt: '2026-02-20T14:59:00.000Z',
        source: 'computed',
        bias: 'bearish',
        score: -72,
        marketMovingCount: 4,
        recentHighImpactCount: 3,
        latestPublishedAt: '2026-02-20T14:59:00.000Z',
        articles: [],
      },
    });

    expect(decision.passed).toBe(false);
    expect(decision.blackout).toBe(true);
    expect(decision.source).toBe('news');
  });
});
