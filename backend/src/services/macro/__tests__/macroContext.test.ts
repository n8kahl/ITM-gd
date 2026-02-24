jest.mock('../../economic', () => ({
  getEconomicCalendar: jest.fn().mockResolvedValue([]),
  getCurrentFedFundsRate: jest.fn().mockResolvedValue(null),
}));

import { getMacroContext, assessMacroImpact } from '../macroContext';
import { getEconomicCalendar, getCurrentFedFundsRate } from '../../economic';

const mockGetEconomicCalendar = getEconomicCalendar as jest.MockedFunction<typeof getEconomicCalendar>;
const mockGetCurrentFedFundsRate = getCurrentFedFundsRate as jest.MockedFunction<typeof getCurrentFedFundsRate>;

/**
 * Tests for Macro Context Service
 */

describe('Macro Context Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEconomicCalendar.mockResolvedValue([]);
    mockGetCurrentFedFundsRate.mockResolvedValue(null);
  });

  describe('getMacroContext', () => {
    it('returns complete macro context structure', async () => {
      const context = await getMacroContext();

      expect(context.economicCalendar).toBeDefined();
      expect(context.fedPolicy).toBeDefined();
      expect(context.sectorRotation).toBeDefined();
      expect(context.earningsSeason).toBeDefined();
      expect(context.timestamp).toBeDefined();
    });

    it('returns economic calendar events', async () => {
      const context = await getMacroContext();

      expect(Array.isArray(context.economicCalendar)).toBe(true);
      for (const event of context.economicCalendar) {
        expect(event.date).toBeTruthy();
        expect(event.event).toBeTruthy();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(event.impact);
        expect(event.relevance).toBeTruthy();
      }
    });

    it('returns valid Fed policy', async () => {
      const context = await getMacroContext();
      const fed = context.fedPolicy;

      expect(fed.currentRate).toBeTruthy();
      expect(fed.nextMeetingDate).toBeNull();
      expect(fed.marketImpliedProbabilities.hold).toBeGreaterThanOrEqual(0);
      expect(fed.marketImpliedProbabilities.cut25).toBeGreaterThanOrEqual(0);
      expect(fed.marketImpliedProbabilities.hike25).toBeGreaterThanOrEqual(0);

      const total = fed.marketImpliedProbabilities.hold
        + fed.marketImpliedProbabilities.cut25
        + fed.marketImpliedProbabilities.hike25;
      expect(total).toBeCloseTo(1.0, 1);
      expect(['hawkish', 'dovish', 'neutral']).toContain(fed.currentTone);
    });

    it('derives next Fed meeting from live economic events only', async () => {
      mockGetEconomicCalendar.mockResolvedValue([
        {
          date: '2099-03-18',
          event: 'Federal Reserve (FOMC)',
          expected: null,
          previous: null,
          actual: null,
          impact: 'HIGH',
          relevance: 'Fed policy decision',
        },
      ]);

      const context = await getMacroContext();
      expect(context.fedPolicy.nextMeetingDate).toBe('2099-03-18');
    });

    it('returns sector rotation data', async () => {
      const context = await getMacroContext();

      expect(Array.isArray(context.sectorRotation.sectors)).toBe(true);
      expect(context.sectorRotation.sectors.length).toBeGreaterThan(0);
      expect(context.sectorRotation.moneyFlowDirection).toBeTruthy();

      for (const sector of context.sectorRotation.sectors) {
        expect(sector.name).toBeTruthy();
        expect(['strong', 'neutral', 'weak']).toContain(sector.relativeStrength);
        expect(['bullish', 'bearish', 'neutral']).toContain(sector.trend);
      }
    });

    it('returns earnings season data', async () => {
      const context = await getMacroContext();
      const earnings = context.earningsSeason;

      expect(earnings.currentPhase).toBeTruthy();
      expect(earnings.beatRate).toBeGreaterThan(0);
      expect(earnings.beatRate).toBeLessThanOrEqual(1);
      expect(earnings.implication).toBeTruthy();
    });
  });

  describe('assessMacroImpact', () => {
    it('returns impact assessment for NDX', async () => {
      const impact = await assessMacroImpact('NDX');

      expect(impact.upcomingCatalysts).toBeDefined();
      expect(Array.isArray(impact.upcomingCatalysts)).toBe(true);
      expect(Array.isArray(impact.bullishFactors)).toBe(true);
      expect(Array.isArray(impact.bearishFactors)).toBe(true);
      expect(Array.isArray(impact.riskFactors)).toBe(true);
      expect(['bullish', 'bearish', 'neutral']).toContain(impact.overallOutlook);
      expect(impact.adviceForLEAPS).toBeTruthy();
    });

    it('returns impact assessment for SPX', async () => {
      const impact = await assessMacroImpact('SPX');

      expect(impact.overallOutlook).toBeTruthy();
      expect(impact.adviceForLEAPS).toBeTruthy();
      expect(impact.riskFactors.length).toBeGreaterThan(0);
    });

    it('includes live Fed events as catalysts when available', async () => {
      mockGetEconomicCalendar.mockResolvedValue([
        {
          date: '2099-03-18',
          event: 'Federal Reserve (FOMC)',
          expected: null,
          previous: null,
          actual: null,
          impact: 'HIGH',
          relevance: 'Fed policy decision',
        },
      ]);

      const impact = await assessMacroImpact('NDX');
      const hasFomc = impact.upcomingCatalysts.some((c) => c.event.includes('FOMC'));
      expect(hasFomc).toBe(true);
    });

    it('NDX assessment mentions tech-specific factors', async () => {
      const impact = await assessMacroImpact('NDX');

      const allText = [
        ...impact.bullishFactors,
        ...impact.bearishFactors,
        ...impact.riskFactors,
      ].join(' ').toLowerCase();

      expect(allText).toMatch(/tech|ndx|growth/i);
    });

    it('provides specific LEAPS advice based on outlook', async () => {
      const impact = await assessMacroImpact('NDX');

      expect(impact.adviceForLEAPS).toContain('NDX');
    });
  });
});
