import { calculateBlackScholes, daysToYears } from '../options/blackScholes';

/**
 * Greeks projection service for LEAPS positions
 * Projects how Greeks and option value change over time using Black-Scholes
 */

export interface GreeksSnapshot {
  dte: number;
  date: string;
  delta: number;
  gamma: number;
  theta: number;   // $/day
  vega: number;
  projectedValue: number;
  notes: string;
}

export interface GreeksProjectionResult {
  symbol: string;
  optionType: 'call' | 'put';
  strike: number;
  currentPrice: number;
  currentDte: number;
  impliedVolatility: number;
  projections: GreeksSnapshot[];
}

const RISK_FREE_RATE = 0.045; // ~4.5% current rate approximation

/**
 * Project Greeks at a specific DTE
 */
function projectAtDte(
  spotPrice: number,
  strikePrice: number,
  dte: number,
  volatility: number,
  optionType: 'call' | 'put',
  riskFreeRate: number = RISK_FREE_RATE
): GreeksSnapshot {
  const timeToExpiry = daysToYears(dte);

  const result = calculateBlackScholes({
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    volatility,
    optionType,
  });

  const projDate = new Date();
  projDate.setDate(projDate.getDate() + (dte > 0 ? 0 : 0)); // placeholder, overridden

  return {
    dte,
    date: '', // Set by caller
    delta: result.greeks.delta,
    gamma: result.greeks.gamma,
    theta: result.greeks.theta,
    vega: result.greeks.vega,
    projectedValue: result.price,
    notes: '',
  };
}

/**
 * Generate a full Greeks projection for a LEAPS position
 * Shows how Greeks evolve from now until expiry
 */
export function generateGreeksProjection(
  symbol: string,
  optionType: 'call' | 'put',
  strike: number,
  currentPrice: number,
  daysToExpiry: number,
  impliedVolatility: number
): GreeksProjectionResult {
  const projections: GreeksSnapshot[] = [];
  const now = new Date();

  // Define projection points
  const points: Array<{ dteOffset: number; label: string }> = [
    { dteOffset: 0, label: 'Current' },
    { dteOffset: 7, label: '1 week out' },
    { dteOffset: 14, label: '2 weeks out' },
    { dteOffset: 30, label: '1 month out' },
    { dteOffset: 60, label: '2 months out' },
    { dteOffset: 90, label: '3 months out' },
    { dteOffset: 180, label: '6 months out' },
    { dteOffset: 270, label: '9 months out' },
    { dteOffset: 365, label: '1 year out' },
  ];

  for (const point of points) {
    const dte = daysToExpiry - point.dteOffset;
    if (dte <= 0) {
      // At or past expiry
      const intrinsic = optionType === 'call'
        ? Math.max(0, currentPrice - strike)
        : Math.max(0, strike - currentPrice);

      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + daysToExpiry);

      projections.push({
        dte: 0,
        date: expiryDate.toISOString().split('T')[0],
        delta: optionType === 'call' ? (currentPrice > strike ? 1 : 0) : (currentPrice < strike ? -1 : 0),
        gamma: 0,
        theta: 0,
        vega: 0,
        projectedValue: Number(intrinsic.toFixed(2)),
        notes: `At expiry (if ${symbol} stays at $${currentPrice.toFixed(0)})`,
      });
      break;
    }

    const snapshot = projectAtDte(currentPrice, strike, dte, impliedVolatility, optionType);
    const projDate = new Date(now);
    projDate.setDate(projDate.getDate() + point.dteOffset);

    snapshot.date = projDate.toISOString().split('T')[0];
    snapshot.notes = point.label;
    projections.push(snapshot);
  }

  return {
    symbol,
    optionType,
    strike,
    currentPrice,
    currentDte: daysToExpiry,
    impliedVolatility,
    projections,
  };
}

/**
 * Assess how Greeks are trending for a LEAPS position
 */
export function assessGreeksTrend(
  currentDelta: number,
  entryDelta: number,
  currentTheta: number,
  daysToExpiry: number
): 'improving' | 'deteriorating' | 'stable' {
  const deltaImproving = Math.abs(currentDelta) > Math.abs(entryDelta);
  const thetaManageable = Math.abs(currentTheta) < 10; // Less than $10/day
  const timeOk = daysToExpiry > 90;

  if (deltaImproving && thetaManageable && timeOk) return 'improving';
  if (!deltaImproving && !thetaManageable && !timeOk) return 'deteriorating';
  return 'stable';
}
