import {
  calculateBlackScholes,
  calculateImpliedVolatility,
  daysToExpiry,
  daysToYears,
  calculatePositionGreeks
} from '../blackScholes';
import { BlackScholesInputs } from '../types';

describe('Black-Scholes Option Pricing', () => {
  // Test data based on common SPX option scenarios
  const baseInputs: BlackScholesInputs = {
    spotPrice: 5900,
    strikePrice: 5900,
    timeToExpiry: 30 / 365, // 30 days
    riskFreeRate: 0.045, // 4.5%
    volatility: 0.15, // 15% IV
    dividendYield: 0.014, // 1.4% for SPX
    optionType: 'call'
  };

  describe('calculateBlackScholes', () => {
    it('should calculate call option price and Greeks', () => {
      const result = calculateBlackScholes(baseInputs);

      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('greeks');
      expect(result.greeks).toHaveProperty('delta');
      expect(result.greeks).toHaveProperty('gamma');
      expect(result.greeks).toHaveProperty('theta');
      expect(result.greeks).toHaveProperty('vega');
      expect(result.greeks).toHaveProperty('rho');

      // ATM call should have delta around 0.5
      expect(result.greeks.delta).toBeGreaterThan(0.4);
      expect(result.greeks.delta).toBeLessThan(0.6);

      // Gamma should be positive
      expect(result.greeks.gamma).toBeGreaterThan(0);

      // Theta should be negative for long options
      expect(result.greeks.theta).toBeLessThan(0);

      // Vega should be positive
      expect(result.greeks.vega).toBeGreaterThan(0);
    });

    it('should calculate put option price and Greeks', () => {
      const putInputs: BlackScholesInputs = {
        ...baseInputs,
        optionType: 'put'
      };

      const result = calculateBlackScholes(putInputs);

      // ATM put should have delta around -0.5
      expect(result.greeks.delta).toBeGreaterThan(-0.6);
      expect(result.greeks.delta).toBeLessThan(-0.4);

      // Gamma should be positive (same as call)
      expect(result.greeks.gamma).toBeGreaterThan(0);

      // Theta should be negative for long options
      expect(result.greeks.theta).toBeLessThan(0);

      // Vega should be positive
      expect(result.greeks.vega).toBeGreaterThan(0);
    });

    it('should calculate ITM call correctly', () => {
      const itmInputs: BlackScholesInputs = {
        ...baseInputs,
        strikePrice: 5800 // $100 ITM
      };

      const result = calculateBlackScholes(itmInputs);

      // ITM call should have delta closer to 1
      expect(result.greeks.delta).toBeGreaterThan(0.65);

      // Price should be at least intrinsic value
      const intrinsicValue = baseInputs.spotPrice - itmInputs.strikePrice;
      expect(result.price).toBeGreaterThanOrEqual(intrinsicValue);
    });

    it('should calculate OTM call correctly', () => {
      const otmInputs: BlackScholesInputs = {
        ...baseInputs,
        strikePrice: 6000 // $100 OTM
      };

      const result = calculateBlackScholes(otmInputs);

      // OTM call should have delta less than 0.5
      expect(result.greeks.delta).toBeLessThan(0.5);

      // Price should be less than ATM
      const atmResult = calculateBlackScholes(baseInputs);
      expect(result.price).toBeLessThan(atmResult.price);
    });

    it('should handle option at expiration', () => {
      const expiryInputs: BlackScholesInputs = {
        ...baseInputs,
        timeToExpiry: 0 // At expiration
      };

      const result = calculateBlackScholes(expiryInputs);

      // At expiration, price should be intrinsic value
      // For ATM, intrinsic is 0
      expect(result.price).toBe(0);

      // Greeks should be zero at expiration
      expect(result.greeks.gamma).toBe(0);
      expect(result.greeks.theta).toBe(0);
      expect(result.greeks.vega).toBe(0);
    });

    it('should show higher price with higher IV', () => {
      const lowIV = calculateBlackScholes(baseInputs);

      const highIVInputs: BlackScholesInputs = {
        ...baseInputs,
        volatility: 0.30 // Double the IV
      };
      const highIV = calculateBlackScholes(highIVInputs);

      // Higher IV should result in higher price
      expect(highIV.price).toBeGreaterThan(lowIV.price);

      // Vega should be higher with more time
      expect(highIV.greeks.vega).toBeGreaterThan(0);
    });

    it('should show time decay effect', () => {
      const longDated = calculateBlackScholes({
        ...baseInputs,
        timeToExpiry: 90 / 365 // 90 days
      });

      const shortDated = calculateBlackScholes({
        ...baseInputs,
        timeToExpiry: 7 / 365 // 7 days
      });

      // Longer dated options should be more expensive
      expect(longDated.price).toBeGreaterThan(shortDated.price);

      // Theta should be larger (more negative) for short-dated
      expect(Math.abs(shortDated.greeks.theta)).toBeGreaterThan(Math.abs(longDated.greeks.theta));
    });
  });

  describe('calculateImpliedVolatility', () => {
    it('should calculate IV from market price', () => {
      // First, calculate a price with known IV
      const knownIV = 0.20; // 20%
      const inputs: BlackScholesInputs = {
        ...baseInputs,
        volatility: knownIV
      };

      const result = calculateBlackScholes(inputs);
      const marketPrice = result.price;

      // Now solve for IV given the market price
      const { volatility: _v, ...inputsWithoutVol } = inputs;
      const calculatedIV = calculateImpliedVolatility(marketPrice, inputsWithoutVol);

      // Should be close to original IV
      expect(calculatedIV).not.toBeNull();
      if (calculatedIV !== null) {
        expect(Math.abs(calculatedIV - knownIV)).toBeLessThan(0.01); // Within 1%
      }
    });

    it('should return null for invalid prices', () => {
      const { volatility: _v, ...inputsWithoutVol } = baseInputs;

      // Price too high to be realistic
      const iv1 = calculateImpliedVolatility(10000, inputsWithoutVol);
      expect(iv1).toBeNull();

      // Negative price
      const iv2 = calculateImpliedVolatility(-100, inputsWithoutVol);
      expect(iv2).toBeNull();
    });
  });

  describe('Helper functions', () => {
    it('should calculate days to expiry', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expiryDate = tomorrow.toISOString().split('T')[0];

      const days = daysToExpiry(expiryDate);
      expect(days).toBe(1);
    });

    it('should handle past expiry dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expiryDate = yesterday.toISOString().split('T')[0];

      const days = daysToExpiry(expiryDate);
      expect(days).toBe(0); // Should return 0, not negative
    });

    it('should convert days to years', () => {
      expect(daysToYears(365)).toBeCloseTo(1, 2);
      expect(daysToYears(30)).toBeCloseTo(0.082, 2);
      expect(daysToYears(7)).toBeCloseTo(0.019, 2);
    });
  });

  describe('calculatePositionGreeks', () => {
    it('should scale Greeks by quantity and multiplier', () => {
      const contractGreeks = {
        delta: 0.5,
        gamma: 0.01,
        theta: -5,
        vega: 10,
        rho: 2
      };

      const quantity = 10;
      const multiplier = 100;

      const positionGreeks = calculatePositionGreeks(contractGreeks, quantity, multiplier);

      expect(positionGreeks.delta).toBe(0.5 * 10 * 100); // 500
      expect(positionGreeks.gamma).toBeCloseTo(0.01 * 10 * 100, 2); // 10
      expect(positionGreeks.theta).toBe(-5 * 10 * 100); // -5000
      expect(positionGreeks.vega).toBe(10 * 10 * 100); // 10000
    });

    it('should handle short positions (negative quantity)', () => {
      const contractGreeks = {
        delta: 0.5,
        gamma: 0.01,
        theta: -5,
        vega: 10,
        rho: 2
      };

      const quantity = -5; // Short 5 contracts
      const multiplier = 100;

      const positionGreeks = calculatePositionGreeks(contractGreeks, quantity, multiplier);

      // Delta should be negative for short positions
      expect(positionGreeks.delta).toBe(0.5 * -5 * 100); // -250
    });
  });
});
