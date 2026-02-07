import { MassiveAggregate } from '../../../config/massive';

export interface PreMarketLevels {
  PMH: number; // Pre-Market High
  PML: number; // Pre-Market Low
  PMC?: number; // Pre-Market Close (last pre-market price)
}

/**
 * Calculate PMH (Pre-Market High) and PML (Pre-Market Low)
 * From 4:00 AM ET to 9:30 AM ET extended hours data
 */
export function calculatePreMarketLevels(preMarketData: MassiveAggregate[]): PreMarketLevels | null {
  if (preMarketData.length === 0) {
    console.log('No pre-market data available');
    return null;
  }

  // Find the highest and lowest prices during pre-market session
  const PMH = Math.max(...preMarketData.map(candle => candle.h));
  const PML = Math.min(...preMarketData.map(candle => candle.l));

  // Get the last pre-market close (last candle before 9:30 AM)
  const lastCandle = preMarketData[preMarketData.length - 1];
  const PMC = lastCandle?.c;

  return {
    PMH: Number(PMH.toFixed(2)),
    PML: Number(PML.toFixed(2)),
    PMC: PMC ? Number(PMC.toFixed(2)) : undefined
  };
}

/**
 * Determine if current price is above or below PMH/PML
 */
export function analyzePreMarketPosition(
  currentPrice: number,
  preMarketLevels: PreMarketLevels | null
): {
  abovePMH: boolean;
  belowPML: boolean;
  withinRange: boolean;
} {
  if (!preMarketLevels) {
    return {
      abovePMH: false,
      belowPML: false,
      withinRange: false
    };
  }

  return {
    abovePMH: currentPrice > preMarketLevels.PMH,
    belowPML: currentPrice < preMarketLevels.PML,
    withinRange: currentPrice >= preMarketLevels.PML && currentPrice <= preMarketLevels.PMH
  };
}
