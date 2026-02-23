import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';

/**
 * S10: Calendar service for FOMC days, OPEX weeks, and day-of-week awareness.
 * Provides strategy restrictions and geometry adjustments based on calendar events.
 */

// 2026 FOMC meeting dates (announcement at 2:00 PM ET on second day)
const FOMC_DATES_2026: ReadonlySet<string> = new Set([
  '2026-01-28', '2026-01-29',
  '2026-03-17', '2026-03-18',
  '2026-05-05', '2026-05-06',
  '2026-06-16', '2026-06-17',
  '2026-07-28', '2026-07-29',
  '2026-09-15', '2026-09-16',
  '2026-10-27', '2026-10-28',
  '2026-12-15', '2026-12-16',
]);

// FOMC announcement days (Wednesday, second day of 2-day meeting)
const FOMC_ANNOUNCEMENT_DATES_2026: ReadonlySet<string> = new Set([
  '2026-01-29',
  '2026-03-18',
  '2026-05-06',
  '2026-06-17',
  '2026-07-29',
  '2026-09-16',
  '2026-10-28',
  '2026-12-16',
]);

// Post-announcement minute: 2:30 PM ET = 14*60+30 = 870
const FOMC_POST_ANNOUNCEMENT_MINUTE_ET = 870;

export type CalendarEventType = 'fomc_meeting' | 'fomc_announcement' | 'opex_week' | 'opex_friday' | 'none';

export interface CalendarContext {
  date: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ... 5=Friday
  dayName: string;
  isFOMCMeeting: boolean;
  isFOMCAnnouncement: boolean;
  isFOMCPreAnnouncement: boolean;
  isOPEXWeek: boolean;
  isOPEXFriday: boolean;
  isOPEXThursday: boolean;
  events: CalendarEventType[];
  strategyRestrictions: string[];
  postAnnouncementMinuteET: number | null;
}

/**
 * Compute the third Friday of a given month (OPEX date).
 */
function getThirdFriday(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstFridayOffset = (5 - firstDay.getDay() + 7) % 7;
  return new Date(year, month, 1 + firstFridayOffset + 14);
}

/**
 * Check if a date is within the OPEX week (Monday through Friday of third Friday week).
 */
function isOPEXWeekDate(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const thirdFriday = getThirdFriday(year, month);

  // OPEX week: Monday through Friday
  const mondayOfOPEXWeek = new Date(thirdFriday);
  mondayOfOPEXWeek.setDate(thirdFriday.getDate() - 4);

  const saturdayAfterOPEX = new Date(thirdFriday);
  saturdayAfterOPEX.setDate(thirdFriday.getDate() + 1);

  return date >= mondayOfOPEXWeek && date < saturdayAfterOPEX;
}

function isOPEXFridayDate(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const thirdFriday = getThirdFriday(year, month);

  return (
    date.getFullYear() === thirdFriday.getFullYear()
    && date.getMonth() === thirdFriday.getMonth()
    && date.getDate() === thirdFriday.getDate()
  );
}

function isOPEXThursdayDate(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const thirdFriday = getThirdFriday(year, month);

  const thursday = new Date(thirdFriday);
  thursday.setDate(thirdFriday.getDate() - 1);

  return (
    date.getFullYear() === thursday.getFullYear()
    && date.getMonth() === thursday.getMonth()
    && date.getDate() === thursday.getDate()
  );
}

/**
 * Get the full calendar context for a given date.
 */
export function getCalendarContext(dateStr?: string): CalendarContext {
  const now = toEasternTime(new Date());
  const effectiveDateStr = dateStr || now.dateStr;
  const date = new Date(`${effectiveDateStr}T12:00:00`);
  const dayOfWeek = date.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const isFOMCMeeting = FOMC_DATES_2026.has(effectiveDateStr);
  const isFOMCAnnouncement = FOMC_ANNOUNCEMENT_DATES_2026.has(effectiveDateStr);
  const isFOMCPreAnnouncement = isFOMCAnnouncement; // Same day
  const isOPEXWeek = isOPEXWeekDate(date);
  const isOPEXFriday = isOPEXFridayDate(date);
  const isOPEXThursday = isOPEXThursdayDate(date);

  const events: CalendarEventType[] = [];
  if (isFOMCAnnouncement) events.push('fomc_announcement');
  else if (isFOMCMeeting) events.push('fomc_meeting');
  if (isOPEXFriday) events.push('opex_friday');
  else if (isOPEXWeek) events.push('opex_week');
  if (events.length === 0) events.push('none');

  const strategyRestrictions: string[] = [];

  // FOMC announcement day: block all strategies until 2:30 PM ET
  if (isFOMCAnnouncement) {
    strategyRestrictions.push('block_all_until_2:30pm_et');
  }

  // OPEX Friday: only allow fade_at_wall and mean_reversion
  if (isOPEXFriday) {
    strategyRestrictions.push('only_fade_at_wall_and_mean_reversion');
  }

  // OPEX Thursday: increase T1 partial to 80%, compress T2
  if (isOPEXThursday) {
    strategyRestrictions.push('increase_t1_partial_80pct');
    strategyRestrictions.push('compress_t2_targets');
  }

  return {
    date: effectiveDateStr,
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    isFOMCMeeting,
    isFOMCAnnouncement,
    isFOMCPreAnnouncement,
    isOPEXWeek,
    isOPEXFriday,
    isOPEXThursday,
    events,
    strategyRestrictions,
    postAnnouncementMinuteET: isFOMCAnnouncement ? FOMC_POST_ANNOUNCEMENT_MINUTE_ET : null,
  };
}

/**
 * Check if strategies should be blocked right now (FOMC pre-announcement).
 */
export function shouldBlockStrategies(
  calendar: CalendarContext,
  currentMinuteET: number,
): { blocked: boolean; reason: string | null } {
  if (calendar.isFOMCAnnouncement && calendar.postAnnouncementMinuteET !== null) {
    if (currentMinuteET < calendar.postAnnouncementMinuteET) {
      return {
        blocked: true,
        reason: `FOMC announcement day: strategies blocked until 2:30 PM ET`,
      };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Check if a setup type is allowed given the current calendar context.
 */
export function isSetupTypeAllowed(
  setupType: string,
  calendar: CalendarContext,
  currentMinuteET: number,
): boolean {
  // FOMC announcement: all strategies blocked until post-announcement
  if (calendar.isFOMCAnnouncement && calendar.postAnnouncementMinuteET !== null) {
    if (currentMinuteET < calendar.postAnnouncementMinuteET) {
      return false;
    }
  }

  // OPEX Friday: only fade_at_wall and mean_reversion
  if (calendar.isOPEXFriday) {
    return setupType === 'fade_at_wall' || setupType === 'mean_reversion';
  }

  return true;
}

/**
 * Get GEX-adaptive stop multiplier.
 */
export function getGEXAdaptiveStopMultiplier(
  netGex: number,
  setupType: string,
): number {
  if (!Number.isFinite(netGex)) return 1.0;

  // Positive GEX: market is pinned, tighten stops 10-15%
  if (netGex > 0) {
    return 0.875; // 12.5% tighter (midpoint of 10-15%)
  }

  // Negative GEX: market is volatile
  if (netGex < 0) {
    // Mean reversion benefits from wider stops in negative GEX
    if (setupType === 'mean_reversion' || setupType === 'fade_at_wall') {
      return 1.125; // 12.5% wider
    }
    return 1.10; // 10% wider for other strategies
  }

  return 1.0;
}
