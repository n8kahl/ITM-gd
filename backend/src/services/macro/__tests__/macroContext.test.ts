import { getMacroContext, assessMacroImpact } from '../macroContext';

/**
 * Tests for Macro Context Service
 */

describe('Macro Context Service', () => {
  describe('getMacroContext', () => {
    it('returns complete macro context structure', () => {
      const context = getMacroContext();

      expect(context.economicCalendar).toBeDefined();
      expect(context.fedPolicy).toBeDefined();
      expect(context.sectorRotation).toBeDefined();
      expect(context.earningsSeason).toBeDefined();
      expect(context.timestamp).toBeDefined();
    });

    it('returns economic calendar events', () => {
      const context = getMacroContext();

      expect(Array.isArray(context.economicCalendar)).toBe(true);
      // May or may not have events depending on date
      for (const event of context.economicCalendar) {
        expect(event.date).toBeTruthy();
        expect(event.event).toBeTruthy();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(event.impact);
        expect(event.relevance).toBeTruthy();
      }
    });

    it('returns valid Fed policy', () => {
      const context = getMacroContext();
      const fed = context.fedPolicy;

      expect(fed.currentRate).toBeTruthy();
      expect(fed.nextMeetingDate).toBeTruthy();
      expect(fed.marketImpliedProbabilities.hold).toBeGreaterThanOrEqual(0);
      expect(fed.marketImpliedProbabilities.cut25).toBeGreaterThanOrEqual(0);
      expect(fed.marketImpliedProbabilities.hike25).toBeGreaterThanOrEqual(0);
      // Probabilities should approximately sum to 1
      const total = fed.marketImpliedProbabilities.hold +
        fed.marketImpliedProbabilities.cut25 +
        fed.marketImpliedProbabilities.hike25;
      expect(total).toBeCloseTo(1.0, 1);
      expect(['hawkish', 'dovish', 'neutral']).toContain(fed.currentTone);
    });

    it('returns sector rotation data', () => {
      const context = getMacroContext();

      expect(Array.isArray(context.sectorRotation.sectors)).toBe(true);
      expect(context.sectorRotation.sectors.length).toBeGreaterThan(0);
      expect(context.sectorRotation.moneyFlowDirection).toBeTruthy();

      for (const sector of context.sectorRotation.sectors) {
        expect(sector.name).toBeTruthy();
        expect(['strong', 'neutral', 'weak']).toContain(sector.relativeStrength);
        expect(['bullish', 'bearish', 'neutral']).toContain(sector.trend);
      }
    });

    it('returns earnings season data', () => {
      const context = getMacroContext();
      const earnings = context.earningsSeason;

      expect(earnings.currentPhase).toBeTruthy();
      expect(earnings.beatRate).toBeGreaterThan(0);
      expect(earnings.beatRate).toBeLessThanOrEqual(1);
      expect(earnings.implication).toBeTruthy();
    });

    it('next FOMC date is in the future', () => {
      const context = getMacroContext();
      const nextMeeting = new Date(context.fedPolicy.nextMeetingDate);
      expect(nextMeeting.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('assessMacroImpact', () => {
    it('returns impact assessment for NDX', () => {
      const impact = assessMacroImpact('NDX');

      expect(impact.upcomingCatalysts).toBeDefined();
      expect(Array.isArray(impact.upcomingCatalysts)).toBe(true);
      expect(Array.isArray(impact.bullishFactors)).toBe(true);
      expect(Array.isArray(impact.bearishFactors)).toBe(true);
      expect(Array.isArray(impact.riskFactors)).toBe(true);
      expect(['bullish', 'bearish', 'neutral']).toContain(impact.overallOutlook);
      expect(impact.adviceForLEAPS).toBeTruthy();
    });

    it('returns impact assessment for SPX', () => {
      const impact = assessMacroImpact('SPX');

      expect(impact.overallOutlook).toBeTruthy();
      expect(impact.adviceForLEAPS).toBeTruthy();
      expect(impact.riskFactors.length).toBeGreaterThan(0);
    });

    it('includes FOMC as a catalyst', () => {
      const impact = assessMacroImpact('NDX');

      const hasFomc = impact.upcomingCatalysts.some(c =>
        c.event.includes('FOMC')
      );
      expect(hasFomc).toBe(true);
    });

    it('NDX assessment mentions tech-specific factors', () => {
      const impact = assessMacroImpact('NDX');

      // Should have at least one tech-related factor or risk
      const allText = [
        ...impact.bullishFactors,
        ...impact.bearishFactors,
        ...impact.riskFactors,
      ].join(' ').toLowerCase();

      expect(allText).toMatch(/tech|ndx|growth/i);
    });

    it('provides specific LEAPS advice based on outlook', () => {
      const impact = assessMacroImpact('NDX');

      // Advice should mention the symbol
      expect(impact.adviceForLEAPS).toContain('NDX');
    });
  });
});
