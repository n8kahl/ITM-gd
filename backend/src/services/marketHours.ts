/**
 * DST-aware market hours and holiday calendar for US equity markets.
 * All times are relative to US Eastern Time (ET).
 *
 * This module is the single source of truth for:
 *   - DST detection (isUSEasternDST)
 *   - UTC → ET conversion (toEasternTime, getETOffset)
 *   - NYSE/NASDAQ holidays (2025-2028)
 *   - Market session status (pre-market, regular, after-hours, closed)
 */

// NYSE/NASDAQ holidays for 2025-2028
// Markets close at 1:00 PM ET on early close days
const MARKET_HOLIDAYS: Record<string, 'closed' | 'early'> = {
  // 2025
  '2025-01-01': 'closed', // New Year's Day
  '2025-01-20': 'closed', // MLK Day
  '2025-02-17': 'closed', // Presidents' Day
  '2025-04-18': 'closed', // Good Friday
  '2025-05-26': 'closed', // Memorial Day
  '2025-06-19': 'closed', // Juneteenth
  '2025-07-03': 'early',  // Independence Day Eve
  '2025-07-04': 'closed', // Independence Day
  '2025-09-01': 'closed', // Labor Day
  '2025-11-27': 'closed', // Thanksgiving
  '2025-11-28': 'early',  // Black Friday
  '2025-12-24': 'early',  // Christmas Eve
  '2025-12-25': 'closed', // Christmas
  // 2026
  '2026-01-01': 'closed', // New Year's Day
  '2026-01-19': 'closed', // MLK Day
  '2026-02-16': 'closed', // Presidents' Day
  '2026-04-03': 'closed', // Good Friday
  '2026-05-25': 'closed', // Memorial Day
  '2026-06-19': 'closed', // Juneteenth
  '2026-07-03': 'early',  // Independence Day (observed) Eve
  '2026-07-04': 'closed', // Independence Day (Sat - observed Fri Jul 3)
  '2026-09-07': 'closed', // Labor Day
  '2026-11-26': 'closed', // Thanksgiving
  '2026-11-27': 'early',  // Black Friday
  '2026-12-24': 'early',  // Christmas Eve
  '2026-12-25': 'closed', // Christmas
  // 2027
  '2027-01-01': 'closed', // New Year's Day
  '2027-01-18': 'closed', // MLK Day
  '2027-02-15': 'closed', // Presidents' Day
  '2027-03-26': 'closed', // Good Friday
  '2027-05-31': 'closed', // Memorial Day
  '2027-06-18': 'closed', // Juneteenth (observed)
  '2027-07-04': 'closed', // Independence Day
  '2027-07-05': 'early',  // Independence Day (Mon - observed)
  '2027-09-06': 'closed', // Labor Day
  '2027-11-25': 'closed', // Thanksgiving
  '2027-11-26': 'early',  // Black Friday
  '2027-12-24': 'early',  // Christmas Eve
  '2027-12-25': 'closed', // Christmas (Sat - observed Fri Dec 24)
  // 2028
  '2028-01-01': 'closed', // New Year's Day (Sat - observed Mon)
  '2028-01-17': 'closed', // MLK Day
  '2028-02-21': 'closed', // Presidents' Day
  '2028-04-14': 'closed', // Good Friday
  '2028-05-29': 'closed', // Memorial Day
  '2028-06-19': 'closed', // Juneteenth
  '2028-07-03': 'early',  // Independence Day Eve
  '2028-07-04': 'closed', // Independence Day
  '2028-09-04': 'closed', // Labor Day
  '2028-11-23': 'closed', // Thanksgiving
  '2028-11-24': 'early',  // Black Friday
  '2028-12-25': 'closed', // Christmas
};

export interface MarketStatus {
  status: 'open' | 'pre-market' | 'after-hours' | 'closed';
  session: 'regular' | 'extended' | 'weekend' | 'holiday' | 'none';
  message: string;
  nextOpen?: string;
  timeUntilOpen?: string;
  timeSinceOpen?: string;
  closingTime?: string;
  holidayName?: string;
}

/**
 * Returns whether the US is currently in DST (2nd Sun March - 1st Sun November)
 */
export function isUSEasternDST(date: Date): boolean {
  const year = date.getUTCFullYear();

  // 2nd Sunday of March (DST starts)
  const march = new Date(Date.UTC(year, 2, 1)); // March 1
  const marchDay = march.getUTCDay(); // 0=Sun
  const dstStart = new Date(Date.UTC(year, 2, 8 + (7 - marchDay) % 7, 7)); // 2:00 AM ET = 7:00 AM UTC

  // 1st Sunday of November (DST ends)
  const november = new Date(Date.UTC(year, 10, 1)); // Nov 1
  const novDay = november.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, 1 + (7 - novDay) % 7, 6)); // 2:00 AM ET = 6:00 AM UTC

  return date >= dstStart && date < dstEnd;
}

/**
 * DST-aware UTC-to-Eastern-Time offset in hours.
 * Returns -4 during EDT (March-November) and -5 during EST.
 */
export function getETOffset(date: Date): number {
  return isUSEasternDST(date) ? -4 : -5;
}

/**
 * Convert UTC date to Eastern Time components
 */
export function toEasternTime(date: Date): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const offset = isUSEasternDST(date) ? -4 : -5; // EDT = UTC-4, EST = UTC-5
  const etMs = date.getTime() + offset * 3600 * 1000;
  const et = new Date(etMs);

  return {
    hour: et.getUTCHours(),
    minute: et.getUTCMinutes(),
    dayOfWeek: et.getUTCDay(),
    dateStr: et.toISOString().slice(0, 10),
  };
}

/**
 * Get current market status with DST awareness and holiday calendar
 */
export function getMarketStatus(now?: Date): MarketStatus {
  const date = now || new Date();
  const et = toEasternTime(date);
  const timeInMinutes = et.hour * 60 + et.minute;

  // Check weekend
  if (et.dayOfWeek === 0 || et.dayOfWeek === 6) {
    return {
      status: 'closed',
      session: 'weekend',
      message: 'Markets are closed for the weekend',
      nextOpen: 'Monday 9:30 AM ET',
    };
  }

  // Check holidays
  const holiday = MARKET_HOLIDAYS[et.dateStr];
  if (holiday === 'closed') {
    return {
      status: 'closed',
      session: 'holiday',
      message: 'Markets are closed for the holiday',
      holidayName: getHolidayName(et.dateStr),
    };
  }

  // Early close day: market closes at 1:00 PM ET (780 minutes)
  const regularClose = holiday === 'early' ? 780 : 960; // 1:00 PM vs 4:00 PM

  // Pre-market: 4:00 AM - 9:30 AM ET (240 - 570 minutes)
  if (timeInMinutes >= 240 && timeInMinutes < 570) {
    const minutesUntilOpen = 570 - timeInMinutes;
    const hours = Math.floor(minutesUntilOpen / 60);
    const mins = minutesUntilOpen % 60;

    return {
      status: 'pre-market',
      session: 'extended',
      message: 'Pre-market session is active',
      timeUntilOpen: `${hours}h ${mins}m`,
    };
  }

  // Regular hours: 9:30 AM - close
  if (timeInMinutes >= 570 && timeInMinutes <= regularClose) {
    const minutesSinceOpen = timeInMinutes - 570;
    const hours = Math.floor(minutesSinceOpen / 60);
    const mins = minutesSinceOpen % 60;

    const closeHour = Math.floor(regularClose / 60);
    const closeMin = regularClose % 60;

    return {
      status: 'open',
      session: 'regular',
      message: holiday === 'early'
        ? 'Market is open (early close today at 1:00 PM ET)'
        : 'Market is open for regular trading',
      timeSinceOpen: `${hours}h ${mins}m`,
      closingTime: `${closeHour}:${String(closeMin).padStart(2, '0')} PM ET`,
    };
  }

  // After-hours: close - 8:00 PM ET (1200 minutes)
  if (timeInMinutes > regularClose && timeInMinutes < 1200) {
    return {
      status: 'after-hours',
      session: 'extended',
      message: 'After-hours session is active',
    };
  }

  // Closed: 8:00 PM - 4:00 AM ET
  return {
    status: 'closed',
    session: 'none',
    message: 'Markets are closed',
    nextOpen: 'Tomorrow 4:00 AM ET (pre-market)',
  };
}

function getHolidayName(dateStr: string): string {
  const month = parseInt(dateStr.slice(5, 7));
  const day = parseInt(dateStr.slice(8, 10));

  if (month === 1 && day === 1) return "New Year's Day";
  if (month === 1 && day >= 15 && day <= 21) return 'Martin Luther King Jr. Day';
  if (month === 2 && day >= 15 && day <= 21) return "Presidents' Day";
  if (month === 3 || month === 4) return 'Good Friday';
  if (month === 5 && day >= 25) return 'Memorial Day';
  if (month === 6 && (day === 18 || day === 19 || day === 20)) return 'Juneteenth';
  if (month === 7 && day <= 5) return 'Independence Day';
  if (month === 9 && day <= 7) return 'Labor Day';
  if (month === 11 && day >= 22 && day <= 28) return 'Thanksgiving';
  if (month === 12 && day >= 24 && day <= 25) return 'Christmas';
  return 'Market Holiday';
}

/**
 * Check if a given date is a trading day
 */
export function isTradingDay(date: Date): boolean {
  const et = toEasternTime(date);

  // Weekend
  if (et.dayOfWeek === 0 || et.dayOfWeek === 6) return false;

  // Holiday
  const holiday = MARKET_HOLIDAYS[et.dateStr];
  if (holiday === 'closed') return false;

  return true;
}

/**
 * Check if market is currently in regular trading hours
 */
export function isMarketOpen(date?: Date): boolean {
  const status = getMarketStatus(date);
  return status.status === 'open';
}
