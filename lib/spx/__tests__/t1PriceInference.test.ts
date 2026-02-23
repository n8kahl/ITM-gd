import { describe, it, expect } from 'vitest';
import { inferTargetOptionPrice } from '@/backend/src/services/broker/tradier/executionEngine';

describe('T1 Price Inference (S5)', () => {
  it('uses geometry-based pricing when setup data is available', () => {
    const result = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
      setupTarget1Price: 5830,
      setupEntryMid: 5810,
      setupStop: 5800,
      delta: 0.25,
      gamma: 0.002,
    });
    // Should NOT be the old 1.35x hardcode
    expect(result).not.toBe(Number((5.00 * 1.35).toFixed(2)));
    expect(result).toBeGreaterThan(0);
  });

  it('falls back to 1.35x when no setup geometry available', () => {
    const result = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
    });
    expect(result).toBe(Number((5.00 * 1.35).toFixed(2)));
  });

  it('uses expectedPnlAtTarget1 when available', () => {
    const result = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
      expectedPnlAtTarget1: 200,
    });
    const mid = (4.80 + 5.20) / 2;
    const expected = mid + (200 / 100);
    expect(result).toBe(Number(Math.max(0.05, expected).toFixed(2)));
  });

  it('produces different prices for different strategy geometries', () => {
    const fadeResult = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
      setupTarget1Price: 5815, // 1.2R closer target
      setupEntryMid: 5810,
      setupStop: 5800,
      delta: 0.20,
      gamma: 0.001,
    });

    const orbResult = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
      setupTarget1Price: 5850, // 2.4R farther target
      setupEntryMid: 5810,
      setupStop: 5800,
      delta: 0.30,
      gamma: 0.003,
    });

    // ORB target is farther away = higher option price
    expect(orbResult).toBeGreaterThan(fadeResult);
  });

  it('handles zero delta gracefully', () => {
    const result = inferTargetOptionPrice({
      entryLimitPrice: 5.00,
      bid: 4.80,
      ask: 5.20,
      setupTarget1Price: 5830,
      setupEntryMid: 5810,
      setupStop: 5800,
      delta: 0,
      gamma: 0.002,
    });
    expect(result).toBeGreaterThan(0);
  });

  it('never returns below minimum price', () => {
    const result = inferTargetOptionPrice({
      entryLimitPrice: 0.01,
      bid: 0.01,
      ask: 0.02,
      setupTarget1Price: 5801,
      setupEntryMid: 5800,
      setupStop: 5799,
      delta: 0.01,
      gamma: 0,
    });
    expect(result).toBeGreaterThanOrEqual(0.05);
  });
});
