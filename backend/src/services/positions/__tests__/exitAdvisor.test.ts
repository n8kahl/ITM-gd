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
