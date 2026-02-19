/**
 * Macro Context Service
 * Provides economic calendar, Fed policy status, sector rotation analysis,
 * and earnings season data for LEAPS position context.
 *
 * Uses curated data for major economic events. Can be extended with
 * external API integration (FRED, etc.) in the future.
 */

import { isTradingDay } from '../marketHours';
import { getEconomicCalendar as getFREDEconomicCalendar, getCurrentFedFundsRate } from '../economic';
import { logger } from '../../lib/logger';

// ============================================
// TYPES
// ============================================

export interface EconomicEvent {
  date: string;           // ISO date
  event: string;
  expected: string | null;
  previous: string | null;
  actual: string | null;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  relevance: string;
}

export interface FedPolicy {
  currentRate: string;
  nextMeetingDate: string;
  marketImpliedProbabilities: {
    hold: number;
    cut25: number;
    hike25: number;
  };
  currentTone: 'hawkish' | 'dovish' | 'neutral';
  expectedOutcome: string;
}

export interface SectorData {
  name: string;
  returns: {
    oneDay: number;
    oneWeek: number;
    oneMonth: number;
  };
  relativeStrength: 'strong' | 'neutral' | 'weak';
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface EarningsEvent {
  company: string;
  symbol: string;
  date: string;
  reported: boolean;
  beatEstimate: boolean | null;
  expectedMoveIV: number;
}

export interface MacroContext {
  economicCalendar: EconomicEvent[];
  fedPolicy: FedPolicy;
  sectorRotation: {
    sectors: SectorData[];
    moneyFlowDirection: string;
  };
  earningsSeason: {
    currentPhase: string;
    beatRate: number;
    upcomingEvents: EarningsEvent[];
    implication: string;
  };
  timestamp: string;
}

// ============================================
// RECURRING ECONOMIC EVENTS CALENDAR
// ============================================

/**
 * Generate upcoming economic events based on typical schedules.
 * Major US economic releases follow regular monthly patterns.
 */
function generateEconomicCalendar(): EconomicEvent[] {
  const now = new Date();
  const events: EconomicEvent[] = [];

  // Generate events for the next 30 days
  for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth();
    const dateStr = date.toISOString().split('T')[0];

    // Skip weekends and market holidays
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    if (!isTradingDay(date)) continue;

    // CPI - typically around 10th-14th of each month
    if (dayOfMonth >= 10 && dayOfMonth <= 14 && dayOfWeek === 3) {
      events.push({
        date: dateStr,
        event: 'Consumer Price Index (CPI)',
        expected: null,
        previous: null,
        actual: null,
        impact: 'HIGH',
        relevance: 'Key inflation measure - affects Fed policy and rate expectations',
      });
    }

    // Employment Report - first Friday of month
    if (dayOfMonth <= 7 && dayOfWeek === 5) {
      events.push({
        date: dateStr,
        event: 'Nonfarm Payrolls',
        expected: null,
        previous: null,
        actual: null,
        impact: 'HIGH',
        relevance: 'Key employment data - signals economic strength/weakness',
      });
    }

    // ISM Manufacturing - first business day of month
    if (dayOfMonth <= 3 && dayOfWeek >= 1 && dayOfWeek <= 5 && events.filter(e => e.event.includes('ISM') && e.date.slice(0, 7) === dateStr.slice(0, 7)).length === 0) {
      events.push({
        date: dateStr,
        event: 'ISM Manufacturing PMI',
        expected: null,
        previous: null,
        actual: null,
        impact: 'HIGH',
        relevance: 'Leading indicator of US manufacturing sector health',
      });
    }

    // GDP - typically last week of month in Jan, Apr, Jul, Oct (quarterly)
    if ((month === 0 || month === 3 || month === 6 || month === 9) && dayOfMonth >= 25 && dayOfMonth <= 31 && dayOfWeek === 4) {
      events.push({
        date: dateStr,
        event: 'GDP (Quarterly)',
        expected: null,
        previous: null,
        actual: null,
        impact: 'HIGH',
        relevance: 'Measures overall economic output - impacts growth expectations',
      });
    }

    // Retail Sales - typically around 15th of month
    if (dayOfMonth >= 14 && dayOfMonth <= 17 && dayOfWeek === 3) {
      events.push({
        date: dateStr,
        event: 'Retail Sales',
        expected: null,
        previous: null,
        actual: null,
        impact: 'MEDIUM',
        relevance: 'Consumer spending indicator - signals economic momentum',
      });
    }

    // PPI - typically 1-2 days before CPI
    if (dayOfMonth >= 9 && dayOfMonth <= 13 && dayOfWeek === 2) {
      events.push({
        date: dateStr,
        event: 'Producer Price Index (PPI)',
        expected: null,
        previous: null,
        actual: null,
        impact: 'MEDIUM',
        relevance: 'Wholesale inflation - leading indicator for consumer inflation',
      });
    }
  }

  // Sort by date and return first 14 days worth
  return events
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
}

// ============================================
// FOMC MEETING DATES
// ============================================

const FOMC_DATES: string[] = [
  // 2026 FOMC meetings (2-day meetings, end date listed)
  '2026-01-28', '2026-03-18', '2026-05-06',
  '2026-06-17', '2026-07-29', '2026-09-16',
  '2026-11-04', '2026-12-16',
  // 2027
  '2027-01-27', '2027-03-17', '2027-05-05',
  '2027-06-16', '2027-07-28', '2027-09-22',
  '2027-11-03', '2027-12-15',
];

function getNextFOMCDate(): string {
  const now = new Date().toISOString().split('T')[0];
  return FOMC_DATES.find(d => d >= now) || FOMC_DATES[FOMC_DATES.length - 1];
}

// ============================================
// SECTOR DATA
// ============================================

function getSectorRotation(): { sectors: SectorData[]; moneyFlowDirection: string } {
  // In production, this would fetch from market data API
  // For now, provide structured data that can be populated
  const sectors: SectorData[] = [
    {
      name: 'Technology',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'strong',
      trend: 'bullish',
    },
    {
      name: 'Healthcare',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'neutral',
      trend: 'neutral',
    },
    {
      name: 'Financials',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'neutral',
      trend: 'neutral',
    },
    {
      name: 'Energy',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'weak',
      trend: 'bearish',
    },
    {
      name: 'Consumer Discretionary',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'neutral',
      trend: 'neutral',
    },
    {
      name: 'Industrials',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'strong',
      trend: 'bullish',
    },
    {
      name: 'Real Estate',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'weak',
      trend: 'bearish',
    },
    {
      name: 'Utilities',
      returns: { oneDay: 0, oneWeek: 0, oneMonth: 0 },
      relativeStrength: 'neutral',
      trend: 'neutral',
    },
  ];

  const strong = sectors.filter(s => s.relativeStrength === 'strong').map(s => s.name);
  const weak = sectors.filter(s => s.relativeStrength === 'weak').map(s => s.name);

  const moneyFlowDirection = [
    strong.length > 0 ? `INTO ${strong.join(', ')}` : '',
    weak.length > 0 ? `OUT OF ${weak.join(', ')}` : '',
  ].filter(Boolean).join(' | ') || 'Neutral rotation';

  return { sectors, moneyFlowDirection };
}

// ============================================
// EARNINGS SEASON
// ============================================

function getEarningsSeason(): MacroContext['earningsSeason'] {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3);

  const phases: Record<number, string> = {
    0: 'Q4 Earnings Season',
    1: 'Q1 Earnings Season',
    2: 'Q2 Earnings Season',
    3: 'Q3 Earnings Season',
  };

  // Major tech earnings (approximate dates vary by year)
  const majorEarnings: EarningsEvent[] = [
    { company: 'Apple', symbol: 'AAPL', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.04 },
    { company: 'Microsoft', symbol: 'MSFT', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.03 },
    { company: 'Amazon', symbol: 'AMZN', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.05 },
    { company: 'Alphabet', symbol: 'GOOGL', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.04 },
    { company: 'NVIDIA', symbol: 'NVDA', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.07 },
    { company: 'Meta', symbol: 'META', date: '', reported: false, beatEstimate: null, expectedMoveIV: 0.06 },
  ];

  return {
    currentPhase: phases[quarter],
    beatRate: 0.78, // Historical average ~78%
    upcomingEvents: majorEarnings,
    implication: 'Earnings season can increase volatility - monitor for trend confirmation or reversal signals',
  };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Get comprehensive macro context for LEAPS analysis.
 * Uses FRED API for real economic calendar data when available,
 * falls back to procedural generation otherwise.
 */
export async function getMacroContext(): Promise<MacroContext> {
  // Try FRED-powered economic calendar first, fall back to procedural
  let economicCalendar: EconomicEvent[];
  try {
    const fredEvents = await getFREDEconomicCalendar(30);
    economicCalendar = fredEvents.length > 0 ? fredEvents : generateEconomicCalendar();
    if (fredEvents.length > 0) {
      logger.debug('Macro context using FRED economic calendar', { eventCount: fredEvents.length });
    }
  } catch {
    economicCalendar = generateEconomicCalendar();
    logger.debug('Macro context falling back to procedural economic calendar');
  }

  // Try to get real Fed Funds rate from FRED, fall back to hardcoded
  let currentRate = '4.25-4.50%';
  try {
    const fredRate = await getCurrentFedFundsRate();
    if (fredRate) {
      currentRate = fredRate;
    }
  } catch {
    // Use hardcoded fallback
  }

  const fedPolicy: FedPolicy = {
    currentRate,
    nextMeetingDate: getNextFOMCDate(),
    marketImpliedProbabilities: {
      hold: 0.65,
      cut25: 0.30,
      hike25: 0.05,
    },
    currentTone: 'neutral',
    expectedOutcome: 'Rates likely on hold near-term, potential cuts later in year',
  };

  const sectorRotation = getSectorRotation();
  const earningsSeason = getEarningsSeason();

  return {
    economicCalendar,
    fedPolicy,
    sectorRotation,
    earningsSeason,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Assess macro impact on a specific symbol/position
 */
export async function assessMacroImpact(symbol: string): Promise<{
  upcomingCatalysts: Array<{ date: string; event: string; expectedImpact: string }>;
  bullishFactors: string[];
  bearishFactors: string[];
  riskFactors: string[];
  overallOutlook: 'bullish' | 'bearish' | 'neutral';
  adviceForLEAPS: string;
}> {
  const macro = await getMacroContext();
  const istech = symbol === 'NDX';

  const upcomingCatalysts = macro.economicCalendar
    .filter(e => e.impact === 'HIGH')
    .slice(0, 5)
    .map(e => ({
      date: e.date,
      event: e.event,
      expectedImpact: e.relevance,
    }));

  // Add FOMC
  upcomingCatalysts.push({
    date: macro.fedPolicy.nextMeetingDate,
    event: 'FOMC Meeting',
    expectedImpact: 'Fed rate decision and forward guidance - key for growth stock valuations',
  });

  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];
  const riskFactors: string[] = [];

  // Fed analysis
  if (macro.fedPolicy.marketImpliedProbabilities.cut25 > 0.3) {
    bullishFactors.push('Market pricing in rate cuts - bullish for growth stocks');
  }
  if (macro.fedPolicy.currentTone === 'hawkish') {
    bearishFactors.push('Fed maintaining hawkish tone - headwind for valuations');
  }
  if (macro.fedPolicy.currentTone === 'dovish') {
    bullishFactors.push('Fed leaning dovish - supportive of equity valuations');
  }

  // Sector analysis
  const techSector = macro.sectorRotation.sectors.find(s => s.name === 'Technology');
  if (techSector) {
    if (techSector.relativeStrength === 'strong') {
      bullishFactors.push(istech
        ? 'Technology sector showing relative strength - directly bullish for NDX'
        : 'Technology sector showing strength - generally supportive');
    } else if (techSector.relativeStrength === 'weak') {
      if (istech) bearishFactors.push('Technology sector underperforming - headwind for NDX');
    }
  }

  // Earnings
  if (macro.earningsSeason.beatRate > 0.75) {
    bullishFactors.push(`Strong earnings season (${(macro.earningsSeason.beatRate * 100).toFixed(0)}% beat rate)`);
  }

  // Risk factors
  riskFactors.push('CPI data could trigger volatility if above expectations');
  riskFactors.push('FOMC communications may shift rate expectations');
  if (istech) {
    riskFactors.push('Tech valuations sensitive to rate expectations');
  }

  // Overall outlook
  let overallOutlook: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (bullishFactors.length > bearishFactors.length + 1) overallOutlook = 'bullish';
  if (bearishFactors.length > bullishFactors.length + 1) overallOutlook = 'bearish';

  // LEAPS advice
  let adviceForLEAPS: string;
  if (overallOutlook === 'bullish') {
    adviceForLEAPS = `Macro environment supports holding ${symbol} LEAPS. Monitor upcoming catalysts for potential entry opportunities on pullbacks.`;
  } else if (overallOutlook === 'bearish') {
    adviceForLEAPS = `Caution warranted for ${symbol} LEAPS. Consider hedging or reducing exposure. Wait for clearer signals before adding.`;
  } else {
    adviceForLEAPS = `Mixed macro signals for ${symbol}. Maintain existing LEAPS positions but avoid aggressive additions. Watch upcoming economic data for direction.`;
  }

  return {
    upcomingCatalysts,
    bullishFactors,
    bearishFactors,
    riskFactors,
    overallOutlook,
    adviceForLEAPS,
  };
}
