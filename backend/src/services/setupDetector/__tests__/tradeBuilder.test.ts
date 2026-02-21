import { buildTradeSuggestion } from '../tradeBuilder';

describe('buildTradeSuggestion', () => {
  it('enforces minimum R:R for long setups', () => {
    const suggestion = buildTradeSuggestion({
      setupType: 'vwap_cross',
      direction: 'long',
      currentPrice: 6000,
      atr: 22,
      referenceLevel: 5988,
      range: 10,
      minRiskReward: 2,
    });

    expect(suggestion).toBeTruthy();
    expect((suggestion?.riskReward || 0)).toBeGreaterThanOrEqual(2);
    expect((suggestion?.target || 0)).toBeGreaterThan(suggestion?.entry || 0);
  });

  it('rejects setups when feasible move cannot satisfy required R:R', () => {
    const suggestion = buildTradeSuggestion({
      setupType: 'level_test',
      direction: 'short',
      currentPrice: 6000,
      atr: 28,
      referenceLevel: 6020,
      range: 20,
      minRiskReward: 2,
      maxFeasibleMove: 8,
    });

    expect(suggestion).toBeUndefined();
  });

  it('builds short setup with rr metadata', () => {
    const suggestion = buildTradeSuggestion({
      setupType: 'orb_breakout',
      direction: 'short',
      currentPrice: 6000,
      atr: 18,
      referenceLevel: 6015,
      range: 12,
    });

    expect(suggestion).toBeTruthy();
    expect(suggestion?.rrQualified).toBe(true);
    expect((suggestion?.riskReward || 0)).toBeGreaterThan(1.9);
    expect((suggestion?.target || 0)).toBeLessThan(suggestion?.entry || 0);
  });
});
