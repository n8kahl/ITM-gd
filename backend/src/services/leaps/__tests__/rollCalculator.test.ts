import { calculateRoll } from '../rollCalculator';

/**
 * Tests for LEAPS Roll Calculator
 */

describe('Roll Calculator', () => {
  const futureDate = (daysOut: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOut);
    return d.toISOString().split('T')[0];
  };

  describe('calculateRoll', () => {
    it('calculates roll for a call option', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      expect(result.current).toBeDefined();
      expect(result.new).toBeDefined();
      expect(result.rollAnalysis).toBeDefined();
      expect(result.current.strike).toBe(20000);
      expect(result.new.strike).toBe(21000);
    });

    it('calculates net credit/debit correctly', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      // Net = (current value - new value) * quantity * 100
      const expected = (result.current.value - result.new.value) * 100;
      expect(result.rollAnalysis.netCreditDebit).toBeCloseTo(expected, 0);
    });

    it('higher strike call has lower value (all else equal)', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      // Lower strike ITM call is worth more
      expect(result.current.value).toBeGreaterThan(result.new.value);
    });

    it('calculates new break-even for call', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      // Break-even = new strike + new value
      expect(result.rollAnalysis.newBreakEven).toBeCloseTo(21000 + result.new.value, 0);
    });

    it('calculates roll for a put option', () => {
      const result = calculateRoll({
        currentStrike: 6000,
        currentExpiry: futureDate(200),
        newStrike: 5800,
        optionType: 'put',
        currentPrice: 5700,
        impliedVolatility: 0.20,
        quantity: 2,
      });

      expect(result.current.strike).toBe(6000);
      expect(result.new.strike).toBe(5800);
      // Quantity multiplied into net credit/debit
      const expected = (result.current.value - result.new.value) * 2 * 100;
      expect(result.rollAnalysis.netCreditDebit).toBeCloseTo(expected, 0);
    });

    it('extending expiry increases new position value', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(100),
        newStrike: 20000,  // Same strike
        newExpiry: futureDate(300),  // Extended expiry
        optionType: 'call',
        currentPrice: 21000,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      // Longer-dated option should be worth more
      expect(result.new.value).toBeGreaterThan(result.current.value);
      expect(result.new.daysToExpiry).toBeGreaterThan(result.current.daysToExpiry);
    });

    it('provides pros and cons', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        newExpiry: futureDate(400),
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      expect(result.rollAnalysis.pros.length).toBeGreaterThan(0);
      expect(result.rollAnalysis.recommendation).toBeTruthy();
    });

    it('recommends rolling when current DTE is low', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(30),  // Low DTE
        newStrike: 20000,
        newExpiry: futureDate(300),
        optionType: 'call',
        currentPrice: 21000,
        impliedVolatility: 0.25,
        quantity: 1,
      });

      expect(result.rollAnalysis.recommendation.toLowerCase()).toContain('roll');
    });

    it('handles zero quantity gracefully', () => {
      const result = calculateRoll({
        currentStrike: 20000,
        currentExpiry: futureDate(300),
        newStrike: 21000,
        optionType: 'call',
        currentPrice: 21500,
        impliedVolatility: 0.25,
        quantity: 0,
      });

      expect(result.rollAnalysis.netCreditDebit).toBe(0);
    });
  });
});
