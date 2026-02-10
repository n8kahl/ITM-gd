import { MassiveAggregate } from '../../../config/massive';

export interface PreviousDayLevels {
  PDH: number;  // Previous Day High
  PDL: number;  // Previous Day Low
  PDC: number;  // Previous Day Close
  PWH?: number; // Previous Week High
  PWL?: number; // Previous Week Low
}

function toEtDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(date);
}

/**
 * Calculate PDH (Previous Day High), PDL (Previous Day Low), PDC (Previous Day Close)
 * Uses the most recent completed trading day
 */
export function calculatePreviousDayLevels(dailyData: MassiveAggregate[]): PreviousDayLevels {
  if (dailyData.length === 0) {
    throw new Error('No daily data available for PDH/PDL/PDC calculation');
  }

  const sortedBars = [...dailyData].sort((a, b) => a.t - b.t);
  let previousDayIndex = sortedBars.length - 1;

  if (sortedBars.length > 1) {
    const todayEt = toEtDateKey(new Date());
    const lastBarEt = toEtDateKey(new Date(sortedBars[sortedBars.length - 1].t));

    // If today's daily bar is present (possibly partial), use the prior completed session.
    if (lastBarEt === todayEt) {
      previousDayIndex -= 1;
    }
  }

  const safePreviousDayIndex = Math.max(previousDayIndex, 0);
  const previousDay = sortedBars[safePreviousDayIndex];

  // Get previous week levels (5 trading days back if available)
  let PWH: number | undefined;
  let PWL: number | undefined;

  if (safePreviousDayIndex >= 4) {
    // Look at last 5 completed trading days for weekly high/low
    const lastWeek = sortedBars.slice(safePreviousDayIndex - 4, safePreviousDayIndex + 1);
    PWH = Math.max(...lastWeek.map(d => d.h));
    PWL = Math.min(...lastWeek.map(d => d.l));
  }

  return {
    PDH: previousDay.h,
    PDL: previousDay.l,
    PDC: previousDay.c,
    PWH,
    PWL
  };
}

/**
 * Calculate distance from current price to levels
 */
export function calculateDistances(
  currentPrice: number,
  levels: PreviousDayLevels,
  atr: number
): {
  PDH: { price: number; distance: number; distancePct: number; distanceATR: number };
  PDL: { price: number; distance: number; distancePct: number; distanceATR: number };
  PDC: { price: number; distance: number; distancePct: number; distanceATR: number };
  PWH?: { price: number; distance: number; distancePct: number; distanceATR: number };
  PWL?: { price: number; distance: number; distancePct: number; distanceATR: number };
} {
  const result: any = {
    PDH: calculateSingleDistance(currentPrice, levels.PDH, atr),
    PDL: calculateSingleDistance(currentPrice, levels.PDL, atr),
    PDC: calculateSingleDistance(currentPrice, levels.PDC, atr)
  };

  if (levels.PWH) {
    result.PWH = calculateSingleDistance(currentPrice, levels.PWH, atr);
  }

  if (levels.PWL) {
    result.PWL = calculateSingleDistance(currentPrice, levels.PWL, atr);
  }

  return result;
}

function calculateSingleDistance(currentPrice: number, levelPrice: number, atr: number) {
  const distance = levelPrice - currentPrice;
  const distancePct = (distance / currentPrice) * 100;
  const distanceATR = atr > 0 ? distance / atr : 0;

  return {
    price: levelPrice,
    distance: Number(distance.toFixed(2)),
    distancePct: Number(distancePct.toFixed(2)),
    distanceATR: Number(distanceATR.toFixed(2))
  };
}
