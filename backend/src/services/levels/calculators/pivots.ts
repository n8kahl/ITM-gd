import { MassiveAggregate } from '../../../config/massive';

export interface StandardPivots {
  pp: number;  // Pivot Point
  r1: number;  // Resistance 1
  r2: number;  // Resistance 2
  r3: number;  // Resistance 3
  s1: number;  // Support 1
  s2: number;  // Support 2
  s3: number;  // Support 3
}

export interface CamarillaPivots {
  h4: number;  // High 4
  h3: number;  // High 3
  l3: number;  // Low 3
  l4: number;  // Low 4
}

export interface FibonacciPivots {
  r3: number;  // Resistance 3
  r2: number;  // Resistance 2
  r1: number;  // Resistance 1
  s1: number;  // Support 1
  s2: number;  // Support 2
  s3: number;  // Support 3
}

export interface PivotLevels {
  standard: StandardPivots;
  camarilla: CamarillaPivots;
  fibonacci: FibonacciPivots;
}

/**
 * Calculate Standard Pivot Points
 * Uses previous day's High, Low, Close
 *
 * Formulas:
 * Pivot Point (PP) = (High + Low + Close) / 3
 * R1 = (2 * PP) - Low
 * R2 = PP + (High - Low)
 * R3 = High + 2 * (PP - Low)
 * S1 = (2 * PP) - High
 * S2 = PP - (High - Low)
 * S3 = Low - 2 * (High - PP)
 */
export function calculateStandardPivots(previousDay: MassiveAggregate): StandardPivots {
  const { h: high, l: low, c: close } = previousDay;

  // Pivot Point
  const pp = (high + low + close) / 3;

  // Resistance levels
  const r1 = (2 * pp) - low;
  const r2 = pp + (high - low);
  const r3 = high + 2 * (pp - low);

  // Support levels
  const s1 = (2 * pp) - high;
  const s2 = pp - (high - low);
  const s3 = low - 2 * (high - pp);

  return {
    pp: Number(pp.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    r2: Number(r2.toFixed(2)),
    r3: Number(r3.toFixed(2)),
    s1: Number(s1.toFixed(2)),
    s2: Number(s2.toFixed(2)),
    s3: Number(s3.toFixed(2))
  };
}

/**
 * Calculate Camarilla Pivot Points
 * More sensitive, designed for intraday trading
 *
 * Formulas:
 * H4 = Close + (High - Low) * 1.1 / 2
 * H3 = Close + (High - Low) * 1.1 / 4
 * L3 = Close - (High - Low) * 1.1 / 4
 * L4 = Close - (High - Low) * 1.1 / 2
 */
export function calculateCamarillaPivots(previousDay: MassiveAggregate): CamarillaPivots {
  const { h: high, l: low, c: close } = previousDay;
  const range = high - low;

  const h4 = close + (range * 1.1 / 2);
  const h3 = close + (range * 1.1 / 4);
  const l3 = close - (range * 1.1 / 4);
  const l4 = close - (range * 1.1 / 2);

  return {
    h4: Number(h4.toFixed(2)),
    h3: Number(h3.toFixed(2)),
    l3: Number(l3.toFixed(2)),
    l4: Number(l4.toFixed(2))
  };
}

/**
 * Calculate Fibonacci Pivot Points
 * Uses Fibonacci ratios (0.382, 0.618, 1.0)
 *
 * Formulas:
 * PP = (High + Low + Close) / 3
 * R1 = PP + 0.382 * (High - Low)
 * R2 = PP + 0.618 * (High - Low)
 * R3 = PP + 1.000 * (High - Low)
 * S1 = PP - 0.382 * (High - Low)
 * S2 = PP - 0.618 * (High - Low)
 * S3 = PP - 1.000 * (High - Low)
 */
export function calculateFibonacciPivots(previousDay: MassiveAggregate): FibonacciPivots {
  const { h: high, l: low, c: close } = previousDay;
  const pp = (high + low + close) / 3;
  const range = high - low;

  const r1 = pp + (0.382 * range);
  const r2 = pp + (0.618 * range);
  const r3 = pp + (1.000 * range);
  const s1 = pp - (0.382 * range);
  const s2 = pp - (0.618 * range);
  const s3 = pp - (1.000 * range);

  return {
    r3: Number(r3.toFixed(2)),
    r2: Number(r2.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    s1: Number(s1.toFixed(2)),
    s2: Number(s2.toFixed(2)),
    s3: Number(s3.toFixed(2))
  };
}

/**
 * Calculate all pivot types
 */
export function calculateAllPivots(dailyData: MassiveAggregate[]): PivotLevels {
  if (dailyData.length === 0) {
    throw new Error('No daily data available for pivot calculation');
  }

  // Use the most recent completed day
  const previousDay = dailyData[dailyData.length - 1];

  return {
    standard: calculateStandardPivots(previousDay),
    camarilla: calculateCamarillaPivots(previousDay),
    fibonacci: calculateFibonacciPivots(previousDay)
  };
}
