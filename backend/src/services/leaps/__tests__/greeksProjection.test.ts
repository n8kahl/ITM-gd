import { generateGreeksProjection, assessGreeksTrend } from '../greeksProjection';

/**
 * Tests for Greeks Projection Service
 */

describe('Greeks Projection', () => {
  describe('generateGreeksProjection', () => {
    it('generates projections for a call option', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      expect(result.symbol).toBe('NDX');
      expect(result.optionType).toBe('call');
      expect(result.strike).toBe(20000);
      expect(result.currentPrice).toBe(21000);
      expect(result.currentDte).toBe(300);
      expect(result.impliedVolatility).toBe(0.25);
      expect(result.projections.length).toBeGreaterThan(0);
    });

    it('generates projections for a put option', () => {
      const result = generateGreeksProjection(
        'SPX', 'put', 6000, 5800, 200, 0.20
      );

      expect(result.optionType).toBe('put');
      expect(result.projections.length).toBeGreaterThan(0);
      // Put delta should be negative
      expect(result.projections[0].delta).toBeLessThan(0);
    });

    it('includes current snapshot as first projection', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      const first = result.projections[0];
      expect(first.notes).toBe('Current');
      expect(first.dte).toBe(300);
    });

    it('projections decrease in DTE over time', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      for (let i = 1; i < result.projections.length; i++) {
        expect(result.projections[i].dte).toBeLessThan(result.projections[i - 1].dte);
      }
    });

    it('delta increases towards 1 for deep ITM call as expiry approaches', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 18000, 21000, 300, 0.20  // Deep ITM
      );

      const first = result.projections[0];
      const last = result.projections[result.projections.length - 1];

      // Deep ITM call should have high delta
      expect(first.delta).toBeGreaterThan(0.7);
      // At expiry, delta should be 1 (ITM)
      expect(last.delta).toBe(1);
    });

    it('theta increases (more negative) as expiry approaches', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      // Exclude the expiry point (theta = 0)
      const nonExpiry = result.projections.filter(p => p.dte > 0);
      if (nonExpiry.length >= 2) {
        const first = nonExpiry[0];
        const later = nonExpiry[nonExpiry.length - 1];
        // Theta should be more negative (larger absolute value) closer to expiry
        expect(Math.abs(later.theta)).toBeGreaterThanOrEqual(Math.abs(first.theta));
      }
    });

    it('handles short DTE correctly', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 10, 0.25
      );

      // Should have fewer projection points
      expect(result.projections.length).toBeGreaterThan(0);
      // Last should be at expiry
      const last = result.projections[result.projections.length - 1];
      expect(last.dte).toBe(0);
    });

    it('vega decreases as expiry approaches', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      const nonExpiry = result.projections.filter(p => p.dte > 0);
      if (nonExpiry.length >= 2) {
        const first = nonExpiry[0];
        const later = nonExpiry[nonExpiry.length - 1];
        expect(later.vega).toBeLessThanOrEqual(first.vega);
      }
    });

    it('projected value at expiry equals intrinsic value for ITM call', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 20000, 21000, 300, 0.25
      );

      const expiry = result.projections.find(p => p.dte === 0);
      if (expiry) {
        // Intrinsic = max(21000 - 20000, 0) = 1000
        expect(expiry.projectedValue).toBe(1000);
      }
    });

    it('projected value at expiry is 0 for OTM call', () => {
      const result = generateGreeksProjection(
        'NDX', 'call', 22000, 21000, 300, 0.25  // OTM
      );

      const expiry = result.projections.find(p => p.dte === 0);
      if (expiry) {
        expect(expiry.projectedValue).toBe(0);
      }
    });
  });

  describe('assessGreeksTrend', () => {
    it('returns improving when delta increased and theta manageable', () => {
      const result = assessGreeksTrend(0.8, 0.5, -3, 200);
      expect(result).toBe('improving');
    });

    it('returns deteriorating when all factors are negative', () => {
      const result = assessGreeksTrend(0.3, 0.5, -15, 30);
      expect(result).toBe('deteriorating');
    });

    it('returns stable for mixed signals', () => {
      const result = assessGreeksTrend(0.6, 0.5, -12, 150);
      expect(result).toBe('stable');
    });

    it('considers time remaining in assessment', () => {
      // Same Greeks but < 90 DTE
      const result = assessGreeksTrend(0.8, 0.5, -3, 60);
      expect(result).toBe('stable'); // timeOk = false
    });
  });
});
