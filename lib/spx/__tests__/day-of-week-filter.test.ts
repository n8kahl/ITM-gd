import { describe, it, expect, vi } from 'vitest';

vi.mock('@/backend/src/services/marketHours', () => ({
  toEasternTime: vi.fn().mockReturnValue({ dateStr: '2026-02-23', hour: 10, minute: 30 }),
}));

import {
  getCalendarContext,
  shouldBlockStrategies,
  isSetupTypeAllowed,
  getGEXAdaptiveStopMultiplier,
} from '@/backend/src/services/spx/calendarService';

const FOMC_OVERRIDES = {
  fomcMeetingDates: new Set(['2026-01-28', '2026-01-29']),
  fomcAnnouncementDates: new Set(['2026-01-29']),
};

describe('calendarService', () => {
  describe('getCalendarContext', () => {
    it('returns context with correct structure', () => {
      const ctx = getCalendarContext('2026-02-23');
      expect(ctx.date).toBe('2026-02-23');
      expect(ctx.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(ctx.dayOfWeek).toBeLessThanOrEqual(6);
      expect(ctx.events).toBeDefined();
      expect(ctx.strategyRestrictions).toBeDefined();
    });

    it('detects FOMC announcement dates', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      expect(ctx.isFOMCAnnouncement).toBe(true);
      expect(ctx.events).toContain('fomc_announcement');
    });

    it('detects FOMC meeting dates', () => {
      const ctx = getCalendarContext('2026-01-28', FOMC_OVERRIDES);
      expect(ctx.isFOMCMeeting).toBe(true);
    });

    it('detects OPEX Friday correctly', () => {
      // Third Friday of March 2026 is March 20
      const ctx = getCalendarContext('2026-03-20');
      expect(ctx.isOPEXFriday).toBe(true);
      expect(ctx.events).toContain('opex_friday');
    });

    it('returns no events for normal days', () => {
      const ctx = getCalendarContext('2026-02-24');
      expect(ctx.isFOMCMeeting).toBe(false);
      expect(ctx.isFOMCAnnouncement).toBe(false);
      expect(ctx.isOPEXFriday).toBe(false);
      expect(ctx.events).toContain('none');
    });

    it('restricts strategies on FOMC announcement', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      expect(ctx.strategyRestrictions).toContain('block_all_until_2:30pm_et');
    });

    it('restricts strategies on OPEX Friday', () => {
      const ctx = getCalendarContext('2026-03-20');
      expect(ctx.strategyRestrictions).toContain('only_fade_at_wall_and_mean_reversion');
    });
  });

  describe('shouldBlockStrategies', () => {
    it('blocks strategies on FOMC announcement before 2:30 PM', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      const result = shouldBlockStrategies(ctx, 840); // 2:00 PM ET
      expect(result.blocked).toBe(true);
    });

    it('allows strategies on FOMC announcement after 2:30 PM', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      const result = shouldBlockStrategies(ctx, 900); // 3:00 PM ET
      expect(result.blocked).toBe(false);
    });

    it('does not block on normal days', () => {
      const ctx = getCalendarContext('2026-02-24');
      const result = shouldBlockStrategies(ctx, 600);
      expect(result.blocked).toBe(false);
    });
  });

  describe('isSetupTypeAllowed', () => {
    it('blocks all strategies on FOMC pre-announcement', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      expect(isSetupTypeAllowed('fade_at_wall', ctx, 840)).toBe(false);
      expect(isSetupTypeAllowed('trend_continuation', ctx, 840)).toBe(false);
    });

    it('allows strategies on FOMC post-announcement', () => {
      const ctx = getCalendarContext('2026-01-29', FOMC_OVERRIDES);
      expect(isSetupTypeAllowed('fade_at_wall', ctx, 900)).toBe(true);
    });

    it('only allows fade_at_wall and mean_reversion on OPEX Friday', () => {
      const ctx = getCalendarContext('2026-03-20');
      expect(isSetupTypeAllowed('fade_at_wall', ctx, 600)).toBe(true);
      expect(isSetupTypeAllowed('mean_reversion', ctx, 600)).toBe(true);
      expect(isSetupTypeAllowed('trend_continuation', ctx, 600)).toBe(false);
      expect(isSetupTypeAllowed('orb_breakout', ctx, 600)).toBe(false);
    });
  });

  describe('getGEXAdaptiveStopMultiplier', () => {
    it('tightens stops for positive GEX', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(500000, 'fade_at_wall');
      expect(multiplier).toBeLessThan(1.0);
    });

    it('widens stops for negative GEX + mean reversion', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'mean_reversion');
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBe(1.125);
    });

    it('widens stops for negative GEX + other strategies', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(-300000, 'trend_continuation');
      expect(multiplier).toBe(1.10);
    });

    it('returns 1.0 for zero GEX', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(0, 'fade_at_wall');
      expect(multiplier).toBe(1.0);
    });

    it('returns 1.0 for non-finite GEX', () => {
      const multiplier = getGEXAdaptiveStopMultiplier(NaN, 'fade_at_wall');
      expect(multiplier).toBe(1.0);
    });
  });
});
