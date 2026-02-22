import { ExitAdvisor } from '../exitAdvisor';

describe('ExitAdvisor', () => {
  const advisor = new ExitAdvisor();

  it('returns profit-taking and protective-stop advice for winning long calls', () => {
    const advice = advisor.generateAdviceFromInputs([
      {
        positionId: 'pos-1',
        symbol: 'SPX',
        type: 'call',
        quantity: 1,
        strike: 6000,
        expiry: '2026-02-20',
        currentPrice: 42,
        currentValue: 4200,
        pnl: 2200,
        pnlPct: 110,
        daysToExpiry: 11,
        maxLoss: 2000,
        greeks: {
          delta: 45,
          gamma: 0.2,
          theta: -65,
          vega: 24,
        },
      },
    ]);

    expect(advice.some((item) => item.type === 'take_profit')).toBe(true);
    expect(advice.some((item) => item.type === 'stop_loss')).toBe(true);
    expect(advice.some((item) => (
      item.suggestedAction.action === 'scale_out'
      && item.suggestedAction.milestone === '1R'
      && item.suggestedAction.closePct === 65
      && item.suggestedAction.moveStopToBreakeven === true
    ))).toBe(true);
    expect(advice.some((item) => (
      item.suggestedAction.action === 'trail_stop'
      && item.suggestedAction.trailModel === 'pivot_runner'
    ))).toBe(true);
  });

  it('issues deterministic 2R scale guidance for high-R winners', () => {
    const advice = advisor.generateAdviceFromInputs([
      {
        positionId: 'pos-1b',
        symbol: 'SPX',
        type: 'call',
        quantity: 1,
        strike: 6000,
        expiry: '2026-02-20',
        currentPrice: 60,
        currentValue: 6000,
        pnl: 2600,
        pnlPct: 130,
        daysToExpiry: 8,
        maxLoss: 1000,
      },
    ]);

    expect(advice.some((item) => (
      item.suggestedAction.action === 'scale_out'
      && item.suggestedAction.milestone === '2R'
      && item.suggestedAction.closePct === 25
      && item.suggestedAction.retainedRunnerPct === 10
    ))).toBe(true);
    expect(advice.some((item) => (
      item.suggestedAction.action === 'trail_stop'
      && item.suggestedAction.trailModel === 'pivot_runner_tight'
    ))).toBe(true);
  });

  it('returns stop-loss advice for large drawdowns', () => {
    const advice = advisor.generateAdviceFromInputs([
      {
        positionId: 'pos-2',
        symbol: 'NDX',
        type: 'put',
        quantity: 1,
        strike: 21000,
        expiry: '2026-03-20',
        currentPrice: 40,
        currentValue: 4000,
        pnl: -2500,
        pnlPct: -55,
        daysToExpiry: 39,
        maxLoss: 4500,
      },
    ]);

    expect(advice.some((item) => item.type === 'stop_loss')).toBe(true);
    expect(advice.some((item) => item.suggestedAction.trigger === 'loss_threshold')).toBe(true);
  });

  it('returns time-decay suggestions near expiry', () => {
    const advice = advisor.generateAdviceFromInputs([
      {
        positionId: 'pos-3',
        symbol: 'SPY',
        type: 'call',
        quantity: 1,
        strike: 600,
        expiry: new Date(Date.now() + (3 * 86400000)).toISOString().slice(0, 10),
        currentPrice: 4.5,
        currentValue: 450,
        pnl: 120,
        pnlPct: 36,
        daysToExpiry: 3,
        maxLoss: 330,
        greeks: {
          delta: 25,
          gamma: 0.08,
          theta: -60,
          vega: 8,
        },
      },
    ]);

    expect(advice.some((item) => item.type === 'time_decay')).toBe(true);
    expect(advice.some((item) => item.type === 'stop_loss')).toBe(true);
  });
});
