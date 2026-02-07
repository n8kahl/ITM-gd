import { BlackScholesInputs, BlackScholesResult } from './types';

/**
 * Black-Scholes Option Pricing Model
 *
 * Calculates theoretical option price and Greeks
 * Used for SPX and NDX index options (European style, cash-settled)
 */

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using error function
 */
function normalCDF(x: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return x > 0 ? 1 - probability : probability;
}

/**
 * Standard normal probability density function (PDF)
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculate d1 for Black-Scholes formula
 */
function calculateD1(inputs: BlackScholesInputs): number {
  const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield = 0 } = inputs;

  const numerator = Math.log(spotPrice / strikePrice) +
                    (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * timeToExpiry;
  const denominator = volatility * Math.sqrt(timeToExpiry);

  return numerator / denominator;
}

/**
 * Calculate d2 for Black-Scholes formula
 */
function calculateD2(d1: number, inputs: BlackScholesInputs): number {
  const { volatility, timeToExpiry } = inputs;
  return d1 - volatility * Math.sqrt(timeToExpiry);
}

/**
 * Calculate Black-Scholes option price and Greeks
 */
export function calculateBlackScholes(inputs: BlackScholesInputs): BlackScholesResult {
  const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, dividendYield = 0, optionType } = inputs;

  // Edge case: at expiration
  if (timeToExpiry <= 0) {
    const intrinsicValue = optionType === 'call'
      ? Math.max(0, spotPrice - strikePrice)
      : Math.max(0, strikePrice - spotPrice);

    return {
      price: intrinsicValue,
      greeks: {
        delta: optionType === 'call' ? (spotPrice > strikePrice ? 1 : 0) : (spotPrice < strikePrice ? -1 : 0),
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      }
    };
  }

  // Calculate d1 and d2
  const d1 = calculateD1(inputs);
  const d2 = calculateD2(d1, inputs);

  // Calculate option price
  let price: number;
  if (optionType === 'call') {
    price = spotPrice * Math.exp(-dividendYield * timeToExpiry) * normalCDF(d1) -
            strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
  } else {
    price = strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) -
            spotPrice * Math.exp(-dividendYield * timeToExpiry) * normalCDF(-d1);
  }

  // Calculate Greeks
  const greeks = calculateGreeks(inputs, d1, d2);

  return {
    price: Number(price.toFixed(2)),
    greeks
  };
}

/**
 * Calculate all Greeks
 */
function calculateGreeks(inputs: BlackScholesInputs, d1: number, d2: number): BlackScholesResult['greeks'] {
  const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield = 0, optionType } = inputs;

  // Delta
  let delta: number;
  if (optionType === 'call') {
    delta = Math.exp(-dividendYield * timeToExpiry) * normalCDF(d1);
  } else {
    delta = -Math.exp(-dividendYield * timeToExpiry) * normalCDF(-d1);
  }

  // Gamma (same for calls and puts)
  const gamma = (Math.exp(-dividendYield * timeToExpiry) * normalPDF(d1)) /
                (spotPrice * volatility * Math.sqrt(timeToExpiry));

  // Theta (per year, divide by 365 for per day)
  let theta: number;
  const term1 = -(spotPrice * normalPDF(d1) * volatility * Math.exp(-dividendYield * timeToExpiry)) /
                (2 * Math.sqrt(timeToExpiry));

  if (optionType === 'call') {
    const term2 = riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
    const term3 = dividendYield * spotPrice * Math.exp(-dividendYield * timeToExpiry) * normalCDF(d1);
    theta = term1 - term2 + term3;
  } else {
    const term2 = riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2);
    const term3 = dividendYield * spotPrice * Math.exp(-dividendYield * timeToExpiry) * normalCDF(-d1);
    theta = term1 + term2 - term3;
  }

  // Vega (per 1% volatility change, same for calls and puts)
  // Multiply by 0.01 to get vega per 1% IV change
  const vega = spotPrice * Math.exp(-dividendYield * timeToExpiry) * normalPDF(d1) * Math.sqrt(timeToExpiry) * 0.01;

  // Rho (per 1% interest rate change)
  // Multiply by 0.01 to get rho per 1% rate change
  let rho: number;
  if (optionType === 'call') {
    rho = strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2) * 0.01;
  } else {
    rho = -strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) * 0.01;
  }

  return {
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(4)),
    theta: Number((theta / 365).toFixed(2)),  // Convert to per day
    vega: Number(vega.toFixed(2)),
    rho: Number(rho.toFixed(2))
  };
}

/**
 * Calculate implied volatility using Newton-Raphson method
 * Given market price, solve for volatility
 */
export function calculateImpliedVolatility(
  marketPrice: number,
  inputs: Omit<BlackScholesInputs, 'volatility'>
): number | null {
  const MAX_ITERATIONS = 100;
  const TOLERANCE = 0.0001;

  // Initial guess: 25% IV
  let volatility = 0.25;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = calculateBlackScholes({ ...inputs, volatility });
    const priceDiff = result.price - marketPrice;

    // Check convergence
    if (Math.abs(priceDiff) < TOLERANCE) {
      return Number(volatility.toFixed(4));
    }

    // Newton-Raphson update: newVol = oldVol - f(vol) / f'(vol)
    // f'(vol) = vega (but need to scale it back from per 1% to per 1.0)
    const vega = result.greeks.vega / 0.01;  // Scale back vega

    if (Math.abs(vega) < 0.0001) {
      // Vega too small, can't converge
      return null;
    }

    volatility = volatility - priceDiff / vega;

    // Keep volatility in reasonable bounds
    if (volatility < 0.01) volatility = 0.01;
    if (volatility > 5.0) volatility = 5.0;
  }

  // Failed to converge
  return null;
}

/**
 * Utility: Calculate days to expiry
 */
export function daysToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Utility: Convert days to years for Black-Scholes
 */
export function daysToYears(days: number): number {
  return days / 365;
}

/**
 * Calculate position Greeks (multiply by quantity and contract multiplier)
 */
export function calculatePositionGreeks(
  contractGreeks: BlackScholesResult['greeks'],
  quantity: number,
  contractMultiplier: number = 100
): BlackScholesResult['greeks'] {
  return {
    delta: Number((contractGreeks.delta * quantity * contractMultiplier).toFixed(2)),
    gamma: Number((contractGreeks.gamma * quantity * contractMultiplier).toFixed(4)),
    theta: Number((contractGreeks.theta * quantity * contractMultiplier).toFixed(2)),
    vega: Number((contractGreeks.vega * quantity * contractMultiplier).toFixed(2)),
    rho: Number((contractGreeks.rho * quantity * contractMultiplier).toFixed(2))
  };
}
