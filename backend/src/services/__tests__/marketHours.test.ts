import { getMarketStatus, isTradingDay, isMarketOpen } from '../marketHours';

describe('Market Hours Service', () => {
  describe('getMarketStatus', () => {
    it('should detect weekend (Saturday)', () => {
      // Saturday Feb 7, 2026 12:00 PM ET = 5:00 PM UTC
      const sat = new Date('2026-02-07T17:00:00Z');
      const status = getMarketStatus(sat);
      expect(status.status).toBe('closed');
      expect(status.session).toBe('weekend');
    });

    it('should detect weekend (Sunday)', () => {
      // Sunday Feb 8, 2026 12:00 PM ET = 5:00 PM UTC
      const sun = new Date('2026-02-08T17:00:00Z');
      const status = getMarketStatus(sun);
      expect(status.status).toBe('closed');
      expect(status.session).toBe('weekend');
    });

    it('should detect pre-market during EST', () => {
      // Monday Feb 2, 2026 7:00 AM ET = 12:00 PM UTC (EST, no DST)
      const preMarket = new Date('2026-02-02T12:00:00Z');
      const status = getMarketStatus(preMarket);
      expect(status.status).toBe('pre-market');
      expect(status.session).toBe('extended');
      expect(status.timeUntilOpen).toBeDefined();
    });

    it('should detect regular hours during EST', () => {
      // Monday Feb 2, 2026 11:00 AM ET = 4:00 PM UTC (EST)
      const open = new Date('2026-02-02T16:00:00Z');
      const status = getMarketStatus(open);
      expect(status.status).toBe('open');
      expect(status.session).toBe('regular');
      expect(status.timeSinceOpen).toBeDefined();
    });

    it('should detect regular hours during EDT (DST)', () => {
      // Monday Jun 1, 2026 11:00 AM ET = 3:00 PM UTC (EDT, offset -4)
      const open = new Date('2026-06-01T15:00:00Z');
      const status = getMarketStatus(open);
      expect(status.status).toBe('open');
      expect(status.session).toBe('regular');
    });

    it('should detect pre-market during EDT', () => {
      // Monday Jun 1, 2026 7:00 AM ET = 11:00 AM UTC (EDT)
      const preMarket = new Date('2026-06-01T11:00:00Z');
      const status = getMarketStatus(preMarket);
      expect(status.status).toBe('pre-market');
    });

    it('should detect after-hours', () => {
      // Monday Feb 2, 2026 5:00 PM ET = 10:00 PM UTC (EST)
      const afterHours = new Date('2026-02-02T22:00:00Z');
      const status = getMarketStatus(afterHours);
      expect(status.status).toBe('after-hours');
      expect(status.session).toBe('extended');
    });

    it('should detect closed overnight', () => {
      // Tuesday Feb 3, 2026 2:00 AM ET = 7:00 AM UTC (EST)
      const closed = new Date('2026-02-03T07:00:00Z');
      const status = getMarketStatus(closed);
      expect(status.status).toBe('closed');
      expect(status.session).toBe('none');
    });

    it('should detect holiday (Christmas 2026)', () => {
      // Friday Dec 25, 2026 11:00 AM ET = 4:00 PM UTC
      const christmas = new Date('2026-12-25T16:00:00Z');
      const status = getMarketStatus(christmas);
      expect(status.status).toBe('closed');
      expect(status.session).toBe('holiday');
      expect(status.holidayName).toContain('Christmas');
    });

    it('should detect MLK Day 2026', () => {
      // Monday Jan 19, 2026 11:00 AM ET = 4:00 PM UTC
      const mlk = new Date('2026-01-19T16:00:00Z');
      const status = getMarketStatus(mlk);
      expect(status.status).toBe('closed');
      expect(status.session).toBe('holiday');
    });

    it('should detect early close day', () => {
      // Black Friday Nov 27, 2026 11:00 AM ET = 4:00 PM UTC (open, but early close)
      const blackFriday = new Date('2026-11-27T16:00:00Z');
      const status = getMarketStatus(blackFriday);
      expect(status.status).toBe('open');
      expect(status.message).toContain('early close');
    });

    it('should show closed after early close time', () => {
      // Black Friday Nov 27, 2026 2:00 PM ET = 7:00 PM UTC (after 1pm close)
      const afterEarlyClose = new Date('2026-11-27T19:00:00Z');
      const status = getMarketStatus(afterEarlyClose);
      expect(status.status).toBe('after-hours');
    });

    it('should handle DST transition correctly (March)', () => {
      // Before DST: March 7, 2026 (Sat before DST)
      // DST starts 2nd Sunday of March = March 8, 2026
      // March 9, 2026 (Monday) should be EDT (-4)
      const afterDST = new Date('2026-03-09T14:00:00Z'); // 10:00 AM ET (EDT)
      const status = getMarketStatus(afterDST);
      expect(status.status).toBe('open');
    });

    it('should calculate timeSinceOpen correctly', () => {
      // Monday Feb 2, 2026 at exactly 9:30 AM ET = 2:30 PM UTC (EST, offset -5)
      const opening = new Date('2026-02-02T14:30:00Z');
      const status = getMarketStatus(opening);
      expect(status.status).toBe('open');
      expect(status.timeSinceOpen).toBe('0h 0m');
    });
  });

  describe('isTradingDay', () => {
    it('should return true for a regular weekday', () => {
      const monday = new Date('2026-02-02T16:00:00Z'); // Monday
      expect(isTradingDay(monday)).toBe(true);
    });

    it('should return false for Saturday', () => {
      const sat = new Date('2026-02-07T16:00:00Z');
      expect(isTradingDay(sat)).toBe(false);
    });

    it('should return false for a holiday', () => {
      const christmas = new Date('2026-12-25T16:00:00Z');
      expect(isTradingDay(christmas)).toBe(false);
    });

    it('should return true for an early close day', () => {
      const blackFriday = new Date('2026-11-27T16:00:00Z');
      expect(isTradingDay(blackFriday)).toBe(true);
    });
  });

  describe('isMarketOpen', () => {
    it('should return true during market hours', () => {
      const open = new Date('2026-02-02T16:00:00Z'); // 11 AM ET
      expect(isMarketOpen(open)).toBe(true);
    });

    it('should return false during pre-market', () => {
      const preMarket = new Date('2026-02-02T12:00:00Z'); // 7 AM ET
      expect(isMarketOpen(preMarket)).toBe(false);
    });

    it('should return false on weekend', () => {
      const sat = new Date('2026-02-07T16:00:00Z');
      expect(isMarketOpen(sat)).toBe(false);
    });
  });
});
