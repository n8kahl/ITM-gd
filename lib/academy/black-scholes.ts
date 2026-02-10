import type { BlackScholesInputs, GreekValues } from '@/lib/types/academy'

/**
 * Chart data point for price visualization
 */
export interface ChartDataPoint {
  stockPrice: number
  optionPrice: number
  intrinsicValue: number
  timeValue: number
  isCurrentPrice: boolean
}

/**
 * Calculate cumulative standard normal distribution (CDF)
 * Uses error function approximation (accurate to ~0.00012)
 */
export function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const t2 = t * t
  const t3 = t2 * t
  const t4 = t3 * t
  const t5 = t4 * t

  const y = 1.0 - (((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * t * Math.exp(-absX * absX))
  return 0.5 * (1.0 + sign * y)
}

/**
 * Calculate standard normal probability density function (PDF)
 * phi(x) = (1/sqrt(2*pi)) * e^(-x^2/2)
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * Calculate d1 component of Black-Scholes formula
 * d1 = [ln(S/K) + (r + sigma^2/2)T] / (sigma*sqrt(T))
 */
export function calculateD1(inputs: BlackScholesInputs): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, impliedVolatility: sigma, interestRate: r } = inputs

  const T = days / 365.0
  if (T <= 0 || sigma <= 0) return 0

  const numerator = Math.log(S / K) + (r + (sigma * sigma) / 2) * T
  const denominator = sigma * Math.sqrt(T)

  return numerator / denominator
}

/**
 * Calculate d2 component of Black-Scholes formula
 * d2 = d1 - sigma*sqrt(T)
 */
export function calculateD2(inputs: BlackScholesInputs, d1: number): number {
  const { daysToExpiration: days, impliedVolatility: sigma } = inputs
  const T = days / 365.0
  return d1 - sigma * Math.sqrt(T)
}

/**
 * Calculate option price using Black-Scholes
 * Call: C = S*N(d1) - K*e^(-rT)*N(d2)
 * Put:  P = K*e^(-rT)*N(-d2) - S*N(-d1)
 */
export function calculateOptionPrice(inputs: BlackScholesInputs, d1: number, d2: number): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, interestRate: r, optionType } = inputs

  const T = days / 365.0
  const discountFactor = Math.exp(-r * T)

  if (optionType === 'call') {
    return S * normalCDF(d1) - K * discountFactor * normalCDF(d2)
  } else {
    return K * discountFactor * normalCDF(-d2) - S * normalCDF(-d1)
  }
}

/**
 * Delta: dC/dS = N(d1) for calls, N(d1) - 1 for puts
 * Represents the rate of option price change per $1 stock move
 */
export function calculateDelta(inputs: BlackScholesInputs, d1: number): number {
  const { optionType } = inputs
  const nD1 = normalCDF(d1)

  if (optionType === 'call') {
    return nD1
  } else {
    return nD1 - 1
  }
}

/**
 * Gamma: d^2C/dS^2 = N'(d1) / (S*sigma*sqrt(T))
 * Represents the rate of delta change (acceleration of option price)
 */
export function calculateGamma(inputs: BlackScholesInputs, d1: number): number {
  const { stockPrice: S, daysToExpiration: days, impliedVolatility: sigma } = inputs

  const T = days / 365.0
  if (T <= 0 || sigma <= 0 || S <= 0) return 0

  const nPrimeD1 = normalPDF(d1)
  return nPrimeD1 / (S * sigma * Math.sqrt(T))
}

/**
 * Theta (daily): (dC/dT) / 365
 * Call: -[S*N'(d1)*sigma / (2*sqrt(T))] - r*K*e^(-rT)*N(d2)
 * Put:  -[S*N'(d1)*sigma / (2*sqrt(T))] + r*K*e^(-rT)*N(-d2)
 * Returns daily theta (divide yearly by 365)
 */
export function calculateTheta(inputs: BlackScholesInputs, d1: number, d2: number): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, impliedVolatility: sigma, interestRate: r, optionType } = inputs

  const T = days / 365.0
  if (T <= 0 || sigma <= 0) return 0

  const nPrimeD1 = normalPDF(d1)
  const discountFactor = Math.exp(-r * T)

  // First component: decay from time value
  const timeDecay = -(S * nPrimeD1 * sigma) / (2 * Math.sqrt(T))

  // Second component: rate impact
  let rateComponent = 0
  if (optionType === 'call') {
    rateComponent = -r * K * discountFactor * normalCDF(d2)
  } else {
    rateComponent = r * K * discountFactor * normalCDF(-d2)
  }

  const yearlyTheta = timeDecay + rateComponent
  return yearlyTheta / 365.0 // Convert to daily
}

/**
 * Vega: dC/dsigma = S*N'(d1)*sqrt(T)
 * Same for calls and puts
 * Returns value change per 1% (0.01) IV change
 * Divide by 100 to get per-1% value
 */
export function calculateVega(inputs: BlackScholesInputs, d1: number): number {
  const { stockPrice: S, daysToExpiration: days } = inputs

  const T = days / 365.0
  if (T <= 0) return 0

  const nPrimeD1 = normalPDF(d1)
  // Returns vega per 1% change in IV (divide by 100)
  return (S * nPrimeD1 * Math.sqrt(T)) / 100.0
}

/**
 * Rho: dC/dr = K*T*e^(-rT)*N(d2) for calls
 *       dP/dr = -K*T*e^(-rT)*N(-d2) for puts
 * Returns value change per 1% (0.01) interest rate change
 */
export function calculateRho(inputs: BlackScholesInputs, d2: number): number {
  const { strikePrice: K, daysToExpiration: days, interestRate: r, optionType } = inputs

  const T = days / 365.0
  const discountFactor = Math.exp(-r * T)

  if (optionType === 'call') {
    return K * T * discountFactor * normalCDF(d2) / 100.0
  } else {
    return -K * T * discountFactor * normalCDF(-d2) / 100.0
  }
}

/**
 * Main calculation function - computes all Greeks at once
 */
export function calculateAllGreeks(inputs: BlackScholesInputs): GreekValues {
  // Validate inputs
  if (inputs.stockPrice <= 0 || inputs.strikePrice <= 0 || inputs.daysToExpiration <= 0 || inputs.impliedVolatility <= 0) {
    return {
      optionPrice: 0,
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    }
  }

  const d1 = calculateD1(inputs)
  const d2 = calculateD2(inputs, d1)
  const optionPrice = calculateOptionPrice(inputs, d1, d2)
  const delta = calculateDelta(inputs, d1)
  const gamma = calculateGamma(inputs, d1)
  const theta = calculateTheta(inputs, d1, d2)
  const vega = calculateVega(inputs, d1)
  const rho = calculateRho(inputs, d2)

  return {
    optionPrice: Math.max(0, optionPrice), // Option prices can't be negative
    delta,
    gamma,
    theta,
    vega,
    rho,
  }
}

/**
 * Generate chart data points showing option price across stock prices
 * Keeps all other variables constant, varies stock price only
 */
export function generateChartData(inputs: BlackScholesInputs, dataPoints: number = 41): ChartDataPoint[] {
  const data: ChartDataPoint[] = []

  // Range: strike +/- 30 (or +/- 30% if strike < $100)
  const range = inputs.strikePrice < 100
    ? inputs.strikePrice * 0.30
    : 30

  const minPrice = Math.max(1, inputs.strikePrice - range)
  const maxPrice = inputs.strikePrice + range
  const step = (maxPrice - minPrice) / (dataPoints - 1)

  for (let i = 0; i < dataPoints; i++) {
    const stockPrice = minPrice + (i * step)
    const priceInputs: BlackScholesInputs = {
      ...inputs,
      stockPrice,
    }

    const greeks = calculateAllGreeks(priceInputs)
    const intrinsicValue = inputs.optionType === 'call'
      ? Math.max(0, stockPrice - inputs.strikePrice)
      : Math.max(0, inputs.strikePrice - stockPrice)

    const timeValue = Math.max(0, greeks.optionPrice - intrinsicValue)

    data.push({
      stockPrice: parseFloat(stockPrice.toFixed(2)),
      optionPrice: parseFloat(greeks.optionPrice.toFixed(2)),
      intrinsicValue: parseFloat(intrinsicValue.toFixed(2)),
      timeValue: parseFloat(timeValue.toFixed(2)),
      isCurrentPrice: Math.abs(stockPrice - inputs.stockPrice) < 0.5,
    })
  }

  return data
}
