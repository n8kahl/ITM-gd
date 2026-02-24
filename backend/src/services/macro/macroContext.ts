/**
 * Macro Context Service
 * Provides economic calendar, Fed policy status, sector rotation analysis,
 * and earnings season data for LEAPS position context.
 */

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
  nextMeetingDate: string | null;
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
// ECONOMIC CALENDAR HELPERS
// ============================================

function isFedMeetingEvent(eventName: string): boolean {
  const normalized = eventName.toLowerCase();
  return (
    normalized.includes('fomc')
    || normalized.includes('federal reserve')
    || normalized.includes('federal open market')
  );
}

function getNextFedMeetingDate(economicCalendar: EconomicEvent[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = economicCalendar
    .filter((event) => event.date >= today && isFedMeetingEvent(event.event))
    .sort((a, b) => a.date.localeCompare(b.date));

  return candidates[0]?.date ?? null;
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
 * Uses live economic calendar data only. No procedural event generation.
 */
export async function getMacroContext(): Promise<MacroContext> {
  let economicCalendar: EconomicEvent[] = [];
  try {
    economicCalendar = await getFREDEconomicCalendar(30);
    logger.debug('Macro context using live economic calendar feed', { eventCount: economicCalendar.length });
  } catch (error) {
    logger.warn('Macro context economic calendar feed unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    economicCalendar = [];
  }

  if (economicCalendar.length === 0) {
    logger.warn('Macro context has no economic calendar events available');
  }

  let currentRate = 'Unavailable';
  try {
    const fredRate = await getCurrentFedFundsRate();
    if (fredRate) {
      currentRate = fredRate;
    }
  } catch {
    // Keep unavailable fallback
  }

  const nextMeetingDate = getNextFedMeetingDate(economicCalendar);

  const fedPolicy: FedPolicy = {
    currentRate,
    nextMeetingDate,
    marketImpliedProbabilities: {
      hold: 0.65,
      cut25: 0.30,
      hike25: 0.05,
    },
    currentTone: 'neutral',
    expectedOutcome: nextMeetingDate
      ? 'Live calendar available - monitor upcoming Fed communication for rate path shifts'
      : 'Fed meeting schedule unavailable from live feed',
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
  if (upcomingCatalysts.length > 0) {
    riskFactors.push(...upcomingCatalysts.slice(0, 2).map((catalyst) =>
      `${catalyst.event} (${catalyst.date}) may increase volatility around release`,
    ));
  } else {
    riskFactors.push('No high-impact macro catalysts available from live calendar feed');
  }

  if (macro.fedPolicy.nextMeetingDate) {
    riskFactors.push(`Fed communication risk remains elevated into ${macro.fedPolicy.nextMeetingDate}`);
  } else {
    riskFactors.push('Fed meeting schedule unavailable from live feed; treat policy timing as uncertain');
  }

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
