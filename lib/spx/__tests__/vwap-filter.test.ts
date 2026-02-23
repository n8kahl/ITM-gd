import { describe, it, expect, vi } from 'vitest';

vi.mock('@/backend/src/services/marketHours', () => ({
  toEasternTime: vi.fn().mockReturnValue({ dateStr: '2026-02-23', hour: 11, minute: 0 }),
}));

// Import directly to test the pure functions
import { computeVWAP, evaluateVWAPAlignment, type VWAPState } from '@/backend/src/services/spx/vwapService';

describe('VWAP Service', () => {
  describe('computeVWAP', () => {
    it('returns null for empty bars', () => {
      expect(computeVWAP([])).toBeNull();
    });

    it('computes VWAP from minute bars', () => {
      const bars = [
        { timestamp: '2026-02-23T09:31:00', open: 5800, high: 5810, low: 5795, close: 5805, volume: 1000 },
        { timestamp: '2026-02-23T09:32:00', open: 5805, high: 5815, low: 5800, close: 5812, volume: 1500 },
        { timestamp: '2026-02-23T09:33:00', open: 5812, high: 5820, low: 5808, close: 5818, volume: 800 },
      ];
      const result = computeVWAP(bars);
      expect(result).not.toBeNull();
      expect(result!.vwap).toBeGreaterThan(0);
      expect(result!.barCount).toBe(3);
      expect(result!.upperBand1SD).toBeGreaterThan(result!.vwap);
      expect(result!.lowerBand1SD).toBeLessThan(result!.vwap);
    });

    it('returns null for zero volume bars', () => {
      const bars = [
        { timestamp: '2026-02-23T09:31:00', open: 5800, high: 5810, low: 5795, close: 5805, volume: 0 },
      ];
      expect(computeVWAP(bars)).toBeNull();
    });

    it('computes deviation bands correctly', () => {
      const bars = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2026-02-23T09:${(31 + i).toString().padStart(2, '0')}:00`,
        open: 5800 + i,
        high: 5810 + i,
        low: 5795 + i,
        close: 5805 + i,
        volume: 1000,
      }));
      const result = computeVWAP(bars);
      expect(result).not.toBeNull();
      expect(result!.upperBand2SD).toBeGreaterThan(result!.upperBand1SD);
      expect(result!.lowerBand2SD).toBeLessThan(result!.lowerBand1SD);
    });
  });

  describe('evaluateVWAPAlignment', () => {
    const baseVWAP: VWAPState = {
      vwap: 5800,
      upperBand1SD: 5810,
      lowerBand1SD: 5790,
      upperBand2SD: 5820,
      lowerBand2SD: 5780,
      priceRelativeToVWAP: 'above',
      deviationFromVWAP: 5,
      deviationBands: 0.3,
      isReliable: true,
      barCount: 30,
      lastUpdated: new Date().toISOString(),
    };

    it('returns no filter when VWAP is null', () => {
      const result = evaluateVWAPAlignment(null, 'bullish');
      expect(result.filtered).toBe(false);
      expect(result.aligned).toBe(true);
      expect(result.confluenceBonus).toBe(0);
    });

    it('returns no filter during grace period', () => {
      const unreliable = { ...baseVWAP, isReliable: false };
      const result = evaluateVWAPAlignment(unreliable, 'bullish');
      expect(result.filtered).toBe(false);
      expect(result.reason).toBe('vwap_grace_period');
    });

    it('aligns bullish with price above VWAP', () => {
      const result = evaluateVWAPAlignment(baseVWAP, 'bullish');
      expect(result.aligned).toBe(true);
      expect(result.filtered).toBe(false);
    });

    it('filters bullish with price below VWAP', () => {
      const below = { ...baseVWAP, priceRelativeToVWAP: 'below' as const };
      const result = evaluateVWAPAlignment(below, 'bullish');
      expect(result.aligned).toBe(false);
      expect(result.filtered).toBe(true);
    });

    it('filters bearish with price above VWAP', () => {
      const result = evaluateVWAPAlignment(baseVWAP, 'bearish');
      expect(result.aligned).toBe(false);
      expect(result.filtered).toBe(true);
    });

    it('aligns bearish with price below VWAP', () => {
      const below = { ...baseVWAP, priceRelativeToVWAP: 'below' as const };
      const result = evaluateVWAPAlignment(below, 'bearish');
      expect(result.aligned).toBe(true);
      expect(result.filtered).toBe(false);
    });

    it('adds confluence bonus when near VWAP and aligned', () => {
      const nearVWAP = { ...baseVWAP, deviationBands: 0.3 };
      const result = evaluateVWAPAlignment(nearVWAP, 'bullish');
      expect(result.confluenceBonus).toBe(1);
    });

    it('no confluence bonus when far from VWAP', () => {
      const farVWAP = { ...baseVWAP, deviationBands: 1.5 };
      const result = evaluateVWAPAlignment(farVWAP, 'bullish');
      expect(result.confluenceBonus).toBe(0);
    });

    it('returns stale reason for old VWAP data', () => {
      const stale = { ...baseVWAP, lastUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
      const result = evaluateVWAPAlignment(stale, 'bullish');
      expect(result.filtered).toBe(false);
      expect(result.reason).toBe('vwap_stale');
    });
  });
});
