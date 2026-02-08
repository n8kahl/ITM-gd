import { calculateBlackScholes, daysToYears } from '../options/blackScholes';

/**
 * LEAPS Roll Calculator
 * Calculates the cost/benefit of rolling a LEAPS position to a new strike/expiry
 */

export interface RollInput {
  currentStrike: number;
  currentExpiry: string;       // YYYY-MM-DD
  newStrike: number;
  newExpiry?: string;           // YYYY-MM-DD, defaults to current
  optionType: 'call' | 'put';
  currentPrice: number;        // Current underlying price
  impliedVolatility: number;   // Current IV (decimal)
  quantity: number;
}

export interface RollLeg {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  value: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

export interface RollAnalysis {
  current: RollLeg;
  new: RollLeg;
  rollAnalysis: {
    netCreditDebit: number;     // Positive = credit, negative = debit
    capitalFreed: number;
    newBreakEven: number;
    recommendation: string;
    pros: string[];
    cons: string[];
  };
}

const RISK_FREE_RATE = 0.045;

function calculateDte(expiryStr: string): number {
  const expiry = new Date(expiryStr);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate the roll from one LEAPS position to another
 */
export function calculateRoll(input: RollInput): RollAnalysis {
  const {
    currentStrike,
    currentExpiry,
    newStrike,
    newExpiry = currentExpiry,
    optionType,
    currentPrice,
    impliedVolatility,
    quantity,
  } = input;

  const currentDte = calculateDte(currentExpiry);
  const newDte = calculateDte(newExpiry);

  // Price current position
  const currentResult = calculateBlackScholes({
    spotPrice: currentPrice,
    strikePrice: currentStrike,
    timeToExpiry: daysToYears(currentDte),
    riskFreeRate: RISK_FREE_RATE,
    volatility: impliedVolatility,
    optionType,
  });

  // Price new position
  const newResult = calculateBlackScholes({
    spotPrice: currentPrice,
    strikePrice: newStrike,
    timeToExpiry: daysToYears(newDte),
    riskFreeRate: RISK_FREE_RATE,
    volatility: impliedVolatility,
    optionType,
  });

  const currentValue = currentResult.price;
  const newValue = newResult.price;

  // Net credit/debit: close current (receive) + open new (pay)
  // If rolling up (higher strike call): current is more expensive, so receive more
  const netCreditDebit = Number(((currentValue - newValue) * Math.abs(quantity) * 100).toFixed(2));

  // Capital freed: difference in margin/premium
  const capitalFreed = Number((Math.abs(currentValue - newValue) * Math.abs(quantity) * 100).toFixed(2));

  // New break-even
  const newBreakEven = optionType === 'call'
    ? Number((newStrike + newValue).toFixed(2))
    : Number((newStrike - newValue).toFixed(2));

  // Build pros and cons
  const pros: string[] = [];
  const cons: string[] = [];

  if (netCreditDebit > 0) {
    pros.push(`Receive net credit of $${netCreditDebit.toFixed(2)}`);
  }

  if (optionType === 'call' && newStrike > currentStrike) {
    pros.push('Lock in gains from strike appreciation');
    pros.push('Reduce capital at risk');
    cons.push('Gives up some intrinsic value');
  } else if (optionType === 'call' && newStrike < currentStrike) {
    pros.push('More delta exposure (more aggressive)');
    cons.push('Requires additional capital');
  }

  if (newDte > currentDte) {
    pros.push(`Extends duration by ${newDte - currentDte} days`);
    cons.push('Slightly higher theta in new contract');
  }

  if (Math.abs(newResult.greeks.delta) > Math.abs(currentResult.greeks.delta)) {
    pros.push('Higher delta exposure in new position');
  }

  if (Math.abs(newResult.greeks.theta) > Math.abs(currentResult.greeks.theta)) {
    cons.push('Higher daily time decay in new position');
  }

  // Recommendation
  let recommendation: string;
  if (netCreditDebit > 0 && newDte >= currentDte) {
    recommendation = 'Good roll candidate - receive credit while maintaining or extending duration';
  } else if (netCreditDebit < 0 && newDte > currentDte + 30) {
    recommendation = 'Roll requires debit but extends duration significantly - consider if time value is worth the cost';
  } else if (currentDte < 60) {
    recommendation = 'Current position has limited time remaining - rolling is recommended to avoid accelerating theta decay';
  } else {
    recommendation = 'Evaluate based on your outlook - no urgency to roll at this time';
  }

  return {
    current: {
      strike: currentStrike,
      expiry: currentExpiry,
      daysToExpiry: currentDte,
      value: Number(currentValue.toFixed(2)),
      greeks: {
        delta: currentResult.greeks.delta,
        gamma: currentResult.greeks.gamma,
        theta: currentResult.greeks.theta,
        vega: currentResult.greeks.vega,
      },
    },
    new: {
      strike: newStrike,
      expiry: newExpiry,
      daysToExpiry: newDte,
      value: Number(newValue.toFixed(2)),
      greeks: {
        delta: newResult.greeks.delta,
        gamma: newResult.greeks.gamma,
        theta: newResult.greeks.theta,
        vega: newResult.greeks.vega,
      },
    },
    rollAnalysis: {
      netCreditDebit,
      capitalFreed,
      newBreakEven,
      recommendation,
      pros,
      cons,
    },
  };
}
