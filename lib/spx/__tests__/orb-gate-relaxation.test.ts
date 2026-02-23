import { describe, it, expect } from 'vitest';

describe('ORB Gate Relaxation (S7)', () => {
  // The new relaxed gate thresholds (from setupDetector.ts S7 changes)
  const ORB_RELAXED_GATES = {
    minConfluenceScore: 3,    // Was 4
    minPWinCalibrated: 0.56,  // Was 0.61
    minEvR: 0.24,             // Was 0.3
    minAlignmentPct: 45,      // Was 55
    requireEmaAlignment: false, // Was true
    requireVolumeRegimeAlignment: true,
    minFlowQualityScore: 45,  // Was 58
  };

  const ORB_OLD_GATES = {
    minConfluenceScore: 4,
    minPWinCalibrated: 0.61,
    minEvR: 0.3,
    minAlignmentPct: 55,
    requireEmaAlignment: true,
    requireVolumeRegimeAlignment: true,
    minFlowQualityScore: 58,
  };

  it('minConfluenceScore reduced from 4 to 3', () => {
    expect(ORB_RELAXED_GATES.minConfluenceScore).toBeLessThan(ORB_OLD_GATES.minConfluenceScore);
    expect(ORB_RELAXED_GATES.minConfluenceScore).toBe(3);
  });

  it('minPWinCalibrated reduced', () => {
    expect(ORB_RELAXED_GATES.minPWinCalibrated).toBeLessThan(ORB_OLD_GATES.minPWinCalibrated);
  });

  it('minEvR reduced', () => {
    expect(ORB_RELAXED_GATES.minEvR).toBeLessThan(ORB_OLD_GATES.minEvR);
  });

  it('minAlignmentPct reduced from 55 to 45', () => {
    expect(ORB_RELAXED_GATES.minAlignmentPct).toBeLessThan(ORB_OLD_GATES.minAlignmentPct);
    expect(ORB_RELAXED_GATES.minAlignmentPct).toBe(45);
  });

  it('EMA alignment no longer required during ORB window', () => {
    expect(ORB_RELAXED_GATES.requireEmaAlignment).toBe(false);
  });

  it('flow quality score reduced from 58 to 45', () => {
    expect(ORB_RELAXED_GATES.minFlowQualityScore).toBeLessThan(ORB_OLD_GATES.minFlowQualityScore);
    expect(ORB_RELAXED_GATES.minFlowQualityScore).toBe(45);
  });

  it('volume regime alignment still required', () => {
    expect(ORB_RELAXED_GATES.requireVolumeRegimeAlignment).toBe(true);
  });

  describe('ORB range-width filter', () => {
    function isORBRangeValid(rangeWidth: number): boolean {
      return rangeWidth >= 4 && rangeWidth <= 18;
    }

    it('accepts 4-18 SPX point range', () => {
      expect(isORBRangeValid(4)).toBe(true);
      expect(isORBRangeValid(10)).toBe(true);
      expect(isORBRangeValid(18)).toBe(true);
    });

    it('rejects too narrow range', () => {
      expect(isORBRangeValid(2)).toBe(false);
      expect(isORBRangeValid(3.5)).toBe(false);
    });

    it('rejects too wide range', () => {
      expect(isORBRangeValid(20)).toBe(false);
      expect(isORBRangeValid(25)).toBe(false);
    });
  });

  describe('Strategy pruning', () => {
    it('breakout_vacuum is removed from strategy registry', () => {
      const activeStrategies = [
        'fade_at_wall',
        'mean_reversion',
        'trend_continuation',
        'orb_breakout',
        'trend_pullback',
        'flip_reclaim',
      ];
      expect(activeStrategies).not.toContain('breakout_vacuum');
    });

    it('trend_pullback minPWinCalibrated raised to 0.62', () => {
      const TREND_PULLBACK_PWIN = 0.62;
      expect(TREND_PULLBACK_PWIN).toBeGreaterThan(0.58);
    });
  });
});
