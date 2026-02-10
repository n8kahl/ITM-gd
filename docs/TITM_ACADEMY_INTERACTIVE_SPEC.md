# TITM Academy Interactive Components & Trade Card Generation
## Comprehensive Implementation Specification

**Document Status:** Development Specification (Codex Ready)
**Target Stack:** Next.js 16, TypeScript (strict mode), Tailwind CSS 4.1, Supabase, Recharts
**Created:** February 2026

---

## SECTION 1: INTERACTIVE LEARNING COMPONENTS

### Overview
Three interactive educational components embedded within lesson pages. Each must:
- Support mobile and desktop layouts
- Provide real-time calculations and visualizations
- Include educational tooltips and explanations
- Handle numeric input validation
- Maintain state efficiently (React Context or local state)
- Be accessible (ARIA labels, keyboard navigation)

---

## COMPONENT 1: GREEK VISUALIZER

**File Location:** `/components/academy/interactive/greek-visualizer.tsx`

### 1.1 TypeScript Interfaces & Types

```typescript
/**
 * Black-Scholes input parameters
 */
interface GreekVisualizerInputs {
  stockPrice: number;           // S: Current stock price ($)
  strikePrice: number;          // K: Option strike price ($)
  daysToExpiration: number;      // T: Days until expiration (1-365)
  impliedVolatility: number;     // σ: Implied volatility (0.05-1.50 = 5%-150%)
  interestRate: number;          // r: Risk-free rate (0.00-0.10 = 0%-10%)
  optionType: 'call' | 'put';    // Option contract type
}

/**
 * Calculated Greeks output
 */
interface GreekValues {
  optionPrice: number;     // C or P: Option premium in dollars
  delta: number;           // Rate of change vs stock price (-1 to 1)
  gamma: number;           // Rate of change of delta (0 to 0.1+)
  theta: number;           // Daily time decay in dollars per day
  vega: number;            // Value change per 1% IV move in dollars
  rho: number;             // Value change per 1% interest rate move
}

/**
 * Chart data point for price visualization
 */
interface ChartDataPoint {
  stockPrice: number;
  optionPrice: number;
  intrinsicValue: number;
  timeValue: number;
  isCurrentPrice: boolean;
}

/**
 * Greek explanation for educational tooltip
 */
interface GreekExplanation {
  name: string;
  symbol: string;
  definition: string;
  interpretation: string;
  tradingUse: string;
}
```

### 1.2 Mathematical Implementation: Black-Scholes Model

**Critical Formula Implementations:**

```typescript
/**
 * Calculate cumulative standard normal distribution (CDF)
 * Uses error function approximation (accurate to ~0.00012)
 */
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * t * Math.exp(-absX * absX));
  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate standard normal probability density function (PDF)
 * φ(x) = (1/√(2π)) * e^(-x²/2)
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculate d1 component of Black-Scholes formula
 * d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
 */
function calculateD1(inputs: GreekVisualizerInputs): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, impliedVolatility: sigma, interestRate: r } = inputs;

  const T = days / 365.0;
  if (T <= 0 || sigma <= 0) return 0;

  const numerator = Math.log(S / K) + (r + (sigma * sigma) / 2) * T;
  const denominator = sigma * Math.sqrt(T);

  return numerator / denominator;
}

/**
 * Calculate d2 component of Black-Scholes formula
 * d2 = d1 - σ√T
 */
function calculateD2(inputs: GreekVisualizerInputs, d1: number): number {
  const { daysToExpiration: days, impliedVolatility: sigma } = inputs;
  const T = days / 365.0;
  return d1 - sigma * Math.sqrt(T);
}

/**
 * Calculate option price using Black-Scholes
 * Call: C = S·N(d1) - K·e^(-rT)·N(d2)
 * Put:  P = K·e^(-rT)·N(-d2) - S·N(-d1)
 */
function calculateOptionPrice(inputs: GreekVisualizerInputs, d1: number, d2: number): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, interestRate: r, optionType } = inputs;

  const T = days / 365.0;
  const discountFactor = Math.exp(-r * T);

  if (optionType === 'call') {
    return S * normalCDF(d1) - K * discountFactor * normalCDF(d2);
  } else {
    return K * discountFactor * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

/**
 * Delta: ∂C/∂S = N(d1) for calls, N(d1) - 1 for puts
 * Represents the rate of option price change per $1 stock move
 */
function calculateDelta(inputs: GreekVisualizerInputs, d1: number): number {
  const { optionType } = inputs;
  const nD1 = normalCDF(d1);

  if (optionType === 'call') {
    return nD1;
  } else {
    return nD1 - 1;
  }
}

/**
 * Gamma: ∂²C/∂S² = N'(d1) / (S·σ·√T)
 * Represents the rate of delta change (acceleration of option price)
 */
function calculateGamma(inputs: GreekVisualizerInputs, d1: number): number {
  const { stockPrice: S, daysToExpiration: days, impliedVolatility: sigma } = inputs;

  const T = days / 365.0;
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;

  const nPrimeD1 = normalPDF(d1);
  return nPrimeD1 / (S * sigma * Math.sqrt(T));
}

/**
 * Theta (daily): (∂C/∂T) / 365
 * Call: -[S·N'(d1)·σ / (2√T)] - r·K·e^(-rT)·N(d2)
 * Put:  -[S·N'(d1)·σ / (2√T)] + r·K·e^(-rT)·N(-d2)
 * Returns daily theta (divide yearly by 365)
 */
function calculateTheta(inputs: GreekVisualizerInputs, d1: number, d2: number): number {
  const { stockPrice: S, strikePrice: K, daysToExpiration: days, impliedVolatility: sigma, interestRate: r, optionType } = inputs;

  const T = days / 365.0;
  if (T <= 0 || sigma <= 0) return 0;

  const nPrimeD1 = normalPDF(d1);
  const discountFactor = Math.exp(-r * T);

  // First component: decay from time value
  const timeDecay = -(S * nPrimeD1 * sigma) / (2 * Math.sqrt(T));

  // Second component: rate impact
  let rateComponent = 0;
  if (optionType === 'call') {
    rateComponent = -r * K * discountFactor * normalCDF(d2);
  } else {
    rateComponent = r * K * discountFactor * normalCDF(-d2);
  }

  const yearlyTheta = timeDecay + rateComponent;
  return yearlyTheta / 365.0; // Convert to daily
}

/**
 * Vega: ∂C/∂σ = S·N'(d1)·√T
 * Same for calls and puts
 * Returns value change per 1% (0.01) IV change
 * Divide by 100 to get per-1% value
 */
function calculateVega(inputs: GreekVisualizerInputs, d1: number): number {
  const { stockPrice: S, daysToExpiration: days, impliedVolatility: sigma } = inputs;

  const T = days / 365.0;
  if (T <= 0) return 0;

  const nPrimeD1 = normalPDF(d1);
  // Returns vega per 1% change in IV (divide by 100)
  return (S * nPrimeD1 * Math.sqrt(T)) / 100.0;
}

/**
 * Rho: ∂C/∂r = K·T·e^(-rT)·N(d2) for calls
 *       ∂P/∂r = -K·T·e^(-rT)·N(-d2) for puts
 * Returns value change per 1% (0.01) interest rate change
 */
function calculateRho(inputs: GreekVisualizerInputs, d2: number): number {
  const { strikePrice: K, daysToExpiration: days, interestRate: r, optionType } = inputs;

  const T = days / 365.0;
  const discountFactor = Math.exp(-r * T);

  if (optionType === 'call') {
    return K * T * discountFactor * normalCDF(d2) / 100.0;
  } else {
    return -K * T * discountFactor * normalCDF(-d2) / 100.0;
  }
}

/**
 * Main calculation function - computes all Greeks at once
 */
function calculateAllGreeks(inputs: GreekVisualizerInputs): GreekValues {
  // Validate inputs
  if (inputs.stockPrice <= 0 || inputs.strikePrice <= 0 || inputs.daysToExpiration <= 0 || inputs.impliedVolatility <= 0) {
    return {
      optionPrice: 0,
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    };
  }

  const d1 = calculateD1(inputs);
  const d2 = calculateD2(inputs, d1);
  const optionPrice = calculateOptionPrice(inputs, d1, d2);
  const delta = calculateDelta(inputs, d1);
  const gamma = calculateGamma(inputs, d1);
  const theta = calculateTheta(inputs, d1, d2);
  const vega = calculateVega(inputs, d1);
  const rho = calculateRho(inputs, d2);

  return {
    optionPrice: Math.max(0, optionPrice), // Option prices can't be negative
    delta,
    gamma,
    theta,
    vega,
    rho,
  };
}
```

### 1.3 Chart Data Generation

```typescript
/**
 * Generate chart data points showing option price across stock prices
 * Keeps all other variables constant, varies stock price only
 */
function generateChartData(inputs: GreekVisualizerInputs, dataPoints: number = 41): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];

  // Range: strike ± 30 (or ± 30% if strike < $100)
  const range = inputs.strikePrice < 100
    ? inputs.strikePrice * 0.30
    : 30;

  const minPrice = Math.max(1, inputs.strikePrice - range);
  const maxPrice = inputs.strikePrice + range;
  const step = (maxPrice - minPrice) / (dataPoints - 1);

  for (let i = 0; i < dataPoints; i++) {
    const stockPrice = minPrice + (i * step);
    const priceInputs: GreekVisualizerInputs = {
      ...inputs,
      stockPrice,
    };

    const greeks = calculateAllGreeks(priceInputs);
    const intrinsicValue = inputs.optionType === 'call'
      ? Math.max(0, stockPrice - inputs.strikePrice)
      : Math.max(0, inputs.strikePrice - stockPrice);

    const timeValue = Math.max(0, greeks.optionPrice - intrinsicValue);

    data.push({
      stockPrice: parseFloat(stockPrice.toFixed(2)),
      optionPrice: parseFloat(greeks.optionPrice.toFixed(2)),
      intrinsicValue: parseFloat(intrinsicValue.toFixed(2)),
      timeValue: parseFloat(timeValue.toFixed(2)),
      isCurrentPrice: Math.abs(stockPrice - inputs.stockPrice) < 0.5,
    });
  }

  return data;
}
```

### 1.4 Educational Tooltips

```typescript
const GREEK_EXPLANATIONS: Record<string, GreekExplanation> = {
  delta: {
    name: 'Delta',
    symbol: 'Δ',
    definition: 'The rate of change of option price relative to stock price movement.',
    interpretation: 'A delta of 0.50 means the option price changes by $0.50 for every $1 stock move. Call deltas range 0 to 1; put deltas range -1 to 0.',
    tradingUse: 'Use delta to estimate position exposure. A 0.50 delta call behaves like owning 50 shares. Helps with hedging and position sizing.',
  },
  gamma: {
    name: 'Gamma',
    symbol: 'Γ',
    definition: 'The rate of change of delta. How much delta changes when the stock moves $1.',
    interpretation: 'High gamma means delta changes rapidly (non-linear risk). Low gamma means delta is stable (linear risk). Gamma peaks at-the-money.',
    tradingUse: 'Gamma risk increases near expiration or when near strike. Positive gamma (long options) benefits from large moves; negative gamma (short options) suffers from large moves.',
  },
  theta: {
    name: 'Theta',
    symbol: 'Θ',
    definition: 'The daily decay of option value due to time passing (holding all else constant).',
    interpretation: 'Theta shown here is daily decay in dollars. A theta of -0.05 means the option loses $0.05 per day due to time decay alone.',
    tradingUse: 'Long options lose money daily (negative theta). Short options gain money daily (positive theta). Accelerates near expiration. Use theta strategies for income.',
  },
  vega: {
    name: 'Vega',
    symbol: 'ν',
    definition: 'The sensitivity of option price to changes in implied volatility.',
    interpretation: 'Shown per 1% IV change. A vega of 0.30 means $0.30 gain/loss per 1% IV increase/decrease. Same for calls and puts.',
    tradingUse: 'Buy options when expecting volatility to increase (long vega). Sell options when expecting volatility to decrease (short vega). IV crush after earnings impacts vega.',
  },
  rho: {
    name: 'Rho',
    symbol: 'ρ',
    definition: 'The sensitivity of option price to changes in the risk-free interest rate.',
    interpretation: 'Per 1% interest rate change. Calls have positive rho (benefit from rate increases); puts have negative rho. Smallest impact of all Greeks.',
    tradingUse: 'Rho matters most for long-dated options and in rising-rate environments. Less critical for short-term trading. Primarily used in macro/portfolio strategies.',
  },
  optionPrice: {
    name: 'Option Price',
    symbol: 'C/P',
    definition: 'The fair value of the option contract based on Black-Scholes model.',
    interpretation: 'Represents the premium you would pay to buy (call/put) or receive to sell. In real markets, actual prices vary (bid-ask spread).',
    tradingUse: 'Use as reference for comparison to market prices. Market price above model = overpriced; below model = underpriced. Does not account for implied volatility smiles or other factors.',
  },
};
```

### 1.5 Component Implementation Structure

```typescript
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GreekCardProps {
  label: string;
  value: number;
  format: (val: number) => string;
  explanation: GreekExplanation;
  className?: string;
}

function GreekCard({ label, value, format, explanation, className }: GreekCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={cn(
      'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {format(value)}
          </div>
        </div>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label={`${label} explanation`}
          >
            <Info size={16} className="text-slate-400" />
          </button>

          {showTooltip && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 text-white rounded-lg p-3 text-xs shadow-lg z-50">
              <p className="font-semibold mb-1">{explanation.name} ({explanation.symbol})</p>
              <p className="mb-2">{explanation.definition}</p>
              <p className="mb-2"><strong>What it means:</strong> {explanation.interpretation}</p>
              <p><strong>Trading use:</strong> {explanation.tradingUse}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GreekVisualizer() {
  // State for inputs
  const [inputs, setInputs] = useState<GreekVisualizerInputs>({
    stockPrice: 100,
    strikePrice: 100,
    daysToExpiration: 30,
    impliedVolatility: 0.30,
    interestRate: 0.05,
    optionType: 'call',
  });

  // Memoized calculations
  const greeks = useMemo(() => calculateAllGreeks(inputs), [inputs]);
  const chartData = useMemo(() => generateChartData(inputs), [inputs]);

  // Input handlers with validation
  const handleInputChange = useCallback((field: keyof GreekVisualizerInputs, value: number | string) => {
    if (typeof value === 'string') {
      const optionType = value as 'call' | 'put';
      setInputs(prev => ({ ...prev, optionType }));
      return;
    }

    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) return;

    // Apply field-specific constraints
    switch (field) {
      case 'stockPrice':
        setInputs(prev => ({ ...prev, [field]: Math.max(1, Math.min(600, numValue)) }));
        break;
      case 'strikePrice':
        setInputs(prev => ({ ...prev, [field]: Math.max(1, Math.min(600, numValue)) }));
        break;
      case 'daysToExpiration':
        setInputs(prev => ({ ...prev, [field]: Math.max(1, Math.min(365, Math.floor(numValue))) }));
        break;
      case 'impliedVolatility':
        setInputs(prev => ({ ...prev, [field]: Math.max(0.05, Math.min(1.50, numValue)) }));
        break;
      case 'interestRate':
        setInputs(prev => ({ ...prev, [field]: Math.max(0, Math.min(0.10, numValue)) }));
        break;
    }
  }, []);

  // Layout: Desktop (flex) vs Mobile (stacked)
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Options Greeks Visualizer</h2>
        <p className="text-slate-600 dark:text-slate-400">Explore how the Greeks change with market parameters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: Inputs */}
        <div className="space-y-4">
          {/* Stock Price Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Stock Price (S): ${inputs.stockPrice.toFixed(0)}
            </label>
            <input
              type="range"
              min="50"
              max="600"
              step="1"
              value={inputs.stockPrice}
              onChange={(e) => handleInputChange('stockPrice', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={inputs.stockPrice}
              onChange={(e) => handleInputChange('stockPrice', e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="50"
              max="600"
              step="1"
            />
          </div>

          {/* Strike Price Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Strike Price (K): ${inputs.strikePrice.toFixed(0)}
            </label>
            <input
              type="range"
              min="50"
              max="600"
              step="1"
              value={inputs.strikePrice}
              onChange={(e) => handleInputChange('strikePrice', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={inputs.strikePrice}
              onChange={(e) => handleInputChange('strikePrice', e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="50"
              max="600"
              step="1"
            />
          </div>

          {/* Days to Expiration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Days to Expiration: {inputs.daysToExpiration}
            </label>
            <input
              type="range"
              min="1"
              max="365"
              step="1"
              value={inputs.daysToExpiration}
              onChange={(e) => handleInputChange('daysToExpiration', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={inputs.daysToExpiration}
              onChange={(e) => handleInputChange('daysToExpiration', e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="1"
              max="365"
              step="1"
            />
          </div>

          {/* Implied Volatility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Implied Volatility: {(inputs.impliedVolatility * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="1.50"
              step="0.01"
              value={inputs.impliedVolatility}
              onChange={(e) => handleInputChange('impliedVolatility', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={(inputs.impliedVolatility * 100).toFixed(1)}
              onChange={(e) => handleInputChange('impliedVolatility', parseFloat(e.target.value) / 100)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="5"
              max="150"
              step="0.5"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Interest Rate: {(inputs.interestRate * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.10"
              step="0.0025"
              value={inputs.interestRate}
              onChange={(e) => handleInputChange('interestRate', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={(inputs.interestRate * 100).toFixed(2)}
              onChange={(e) => handleInputChange('interestRate', parseFloat(e.target.value) / 100)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0"
              max="10"
              step="0.25"
            />
          </div>

          {/* Option Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Option Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => handleInputChange('optionType', 'call')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg font-medium transition-colors',
                  inputs.optionType === 'call'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                )}
              >
                Call
              </button>
              <button
                onClick={() => handleInputChange('optionType', 'put')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg font-medium transition-colors',
                  inputs.optionType === 'put'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                )}
              >
                Put
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Greeks Output */}
        <div className="space-y-3">
          <GreekCard
            label="Option Price"
            value={greeks.optionPrice}
            format={(v) => `$${v.toFixed(2)}`}
            explanation={GREEK_EXPLANATIONS.optionPrice}
          />

          <GreekCard
            label="Delta (Δ)"
            value={greeks.delta}
            format={(v) => v.toFixed(4)}
            explanation={GREEK_EXPLANATIONS.delta}
            className={greeks.delta > 0 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}
          />

          <GreekCard
            label="Gamma (Γ)"
            value={greeks.gamma}
            format={(v) => v.toFixed(4)}
            explanation={GREEK_EXPLANATIONS.gamma}
          />

          <GreekCard
            label="Theta (Θ) - Daily"
            value={greeks.theta}
            format={(v) => `${v < 0 ? '' : '+'}$${v.toFixed(4)}/day`}
            explanation={GREEK_EXPLANATIONS.theta}
          />

          <GreekCard
            label="Vega (ν) - Per 1% IV"
            value={greeks.vega}
            format={(v) => `$${v.toFixed(2)}`}
            explanation={GREEK_EXPLANATIONS.vega}
          />

          <GreekCard
            label="Rho (ρ)"
            value={greeks.rho}
            format={(v) => v.toFixed(4)}
            explanation={GREEK_EXPLANATIONS.rho}
          />
        </div>
      </div>

      {/* CHART: Option Price vs Stock Price */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Option Price Profile</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="stockPrice"
              label={{ value: 'Stock Price ($)', position: 'insideBottomRight', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
              labelFormatter={(label) => `Stock Price: $${label.toFixed(2)}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="optionPrice"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Option Price"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="intrinsicValue"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Intrinsic Value"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="timeValue"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Time Value"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### 1.6 Usage in Lessons

```typescript
// In lesson page: /app/academy/lessons/[slug]/page.tsx
import { GreekVisualizer } from '@/components/academy/interactive/greek-visualizer';

export default function LessonPage() {
  return (
    <div>
      {/* Lesson content */}
      <h2>Understanding the Greeks</h2>
      <p>Learn how options prices change...</p>

      {/* Interactive component */}
      <GreekVisualizer />

      {/* More lesson content */}
    </div>
  );
}
```

---

## COMPONENT 2: POSITION SIZER

**File Location:** `/components/academy/interactive/position-sizer.tsx`

### 2.1 TypeScript Interfaces

```typescript
interface PositionSizerInputs {
  accountSize: number;        // Total account capital in dollars
  riskPercentage: number;     // Risk as % of account (0.005 to 0.05 = 0.5% to 5%)
  entryPrice: number;         // Option entry price (per contract)
  stopLossPrice: number;      // Stop loss price (per contract)
  direction: 'long' | 'short'; // Long or short position
}

interface PositionSizerResults {
  dollarRisk: number;         // Dollar amount at risk
  riskPerContract: number;    // Loss per contract if stopped out
  maxContracts: number;       // Maximum contracts to trade
  totalPositionCost: number;  // Total capital required
  maxLoss: number;            // Maximum loss in dollars
  accountRiskPercentage: number; // Actual % of account at risk
  warningMessages: string[];  // Educational warnings
}

interface RiskMeterData {
  percentage: number;
  color: 'green' | 'yellow' | 'red';
  label: string;
}
```

### 2.2 Calculation Engine

```typescript
function calculatePositionSize(inputs: PositionSizerInputs): PositionSizerResults {
  const warnings: string[] = [];

  // Validate inputs
  if (inputs.accountSize <= 0) {
    return {
      dollarRisk: 0,
      riskPerContract: 0,
      maxContracts: 0,
      totalPositionCost: 0,
      maxLoss: 0,
      accountRiskPercentage: 0,
      warningMessages: ['Enter account size to calculate position size'],
    };
  }

  if (inputs.entryPrice <= 0 || inputs.stopLossPrice <= 0) {
    return {
      dollarRisk: 0,
      riskPerContract: 0,
      maxContracts: 0,
      totalPositionCost: 0,
      maxLoss: 0,
      accountRiskPercentage: 0,
      warningMessages: ['Enter valid entry and stop loss prices'],
    };
  }

  // Validate stop loss logic
  if (inputs.direction === 'long' && inputs.stopLossPrice >= inputs.entryPrice) {
    warnings.push('Stop loss must be below entry price for long positions');
  }
  if (inputs.direction === 'short' && inputs.stopLossPrice <= inputs.entryPrice) {
    warnings.push('Stop loss must be above entry price for short positions');
  }

  // Calculate dollar risk
  const dollarRisk = inputs.accountSize * (inputs.riskPercentage / 100);

  // Calculate risk per contract
  // Options are 100 shares per contract
  const riskPerContract = Math.abs(inputs.entryPrice - inputs.stopLossPrice) * 100;

  // Calculate max contracts (round down)
  const maxContracts = riskPerContract > 0 ? Math.floor(dollarRisk / riskPerContract) : 0;

  // Calculate total position cost
  const totalPositionCost = inputs.entryPrice * 100 * maxContracts;

  // Calculate actual max loss
  const maxLoss = maxContracts > 0 ? riskPerContract * maxContracts : 0;

  // Calculate actual account risk percentage
  const accountRiskPercentage = inputs.accountSize > 0 ? (maxLoss / inputs.accountSize) * 100 : 0;

  // Generate educational warnings
  if (accountRiskPercentage > 3) {
    warnings.push('TITM recommends risking no more than 2% per trade for optimal risk management');
  }

  if (totalPositionCost > inputs.accountSize * 0.25) {
    const positionPercent = (totalPositionCost / inputs.accountSize) * 100;
    warnings.push(`Position cost is ${positionPercent.toFixed(1)}% of your account — consider reducing size to stay below 25%`);
  }

  if (inputs.riskPercentage > 2.5) {
    warnings.push('Higher risk percentage selected — ensure you\'re comfortable with potential losses');
  }

  return {
    dollarRisk,
    riskPerContract,
    maxContracts,
    totalPositionCost,
    maxLoss,
    accountRiskPercentage,
    warningMessages: warnings,
  };
}

/**
 * Determine risk meter color and label
 */
function getRiskMeterData(percentage: number): RiskMeterData {
  if (percentage <= 2) {
    return {
      percentage,
      color: 'green',
      label: 'Conservative',
    };
  } else if (percentage <= 5) {
    return {
      percentage,
      color: 'yellow',
      label: 'Moderate',
    };
  } else {
    return {
      percentage,
      color: 'red',
      label: 'Aggressive',
    };
  }
}
```

### 2.3 Risk Meter Component

```typescript
interface RiskMeterProps {
  percentage: number;
  className?: string;
}

function RiskMeter({ percentage, className }: RiskMeterProps) {
  const riskData = getRiskMeterData(percentage);
  const colorClasses = {
    green: 'from-emerald-400 to-emerald-600',
    yellow: 'from-yellow-400 to-yellow-600',
    red: 'from-red-400 to-red-600',
  };

  // Clamp percentage to 0-10 for visual representation (10% = max on gauge)
  const displayPercentage = Math.min(percentage, 10);
  const rotation = (displayPercentage / 10) * 180 - 90; // -90 to 90 degrees

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative w-40 h-20 mb-4">
        {/* Gauge background */}
        <div className="absolute inset-0 rounded-full border-8 border-slate-200 dark:border-slate-600"
             style={{ borderRadius: '200px 200px 0 0' }}
        />

        {/* Gauge fill */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${colorClasses[riskData.color]} opacity-70`}
          style={{
            borderRadius: '200px 200px 0 0',
            clipPath: `polygon(0 100%, 0 0, ${(displayPercentage / 10) * 100}% 0, 100% 100%)`,
          }}
        />

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-16 origin-bottom bg-slate-900 dark:bg-white"
          style={{
            transform: `translateX(-50%) rotate(${rotation}deg)`,
          }}
        />

        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-slate-900 dark:bg-white rounded-full transform translate-x(-1/2) translate-y(1/2)" />
      </div>

      {/* Percentage text and label */}
      <div className="text-center">
        <div className="text-3xl font-bold text-slate-900 dark:text-white">
          {percentage.toFixed(1)}%
        </div>
        <div className={cn(
          'text-sm font-medium mt-1',
          riskData.color === 'green' && 'text-emerald-600 dark:text-emerald-400',
          riskData.color === 'yellow' && 'text-yellow-600 dark:text-yellow-400',
          riskData.color === 'red' && 'text-red-600 dark:text-red-400'
        )}>
          {riskData.label}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>0-2%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>2-5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>5%+</span>
        </div>
      </div>
    </div>
  );
}
```

### 2.4 Full Position Sizer Component

```typescript
'use client';

import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PositionSizer() {
  const [inputs, setInputs] = useState<PositionSizerInputs>({
    accountSize: 0,
    riskPercentage: 2,
    entryPrice: 0,
    stopLossPrice: 0,
    direction: 'long',
  });

  const results = useMemo(() => calculatePositionSize(inputs), [inputs]);

  const handleInputChange = (field: keyof PositionSizerInputs, value: number | string) => {
    if (typeof value === 'string') {
      setInputs(prev => ({ ...prev, direction: value as 'long' | 'short' }));
      return;
    }

    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) return;

    switch (field) {
      case 'accountSize':
        setInputs(prev => ({ ...prev, [field]: Math.max(0, numValue) }));
        break;
      case 'riskPercentage':
        setInputs(prev => ({ ...prev, [field]: Math.max(0.5, Math.min(5, numValue)) }));
        break;
      case 'entryPrice':
      case 'stopLossPrice':
        setInputs(prev => ({ ...prev, [field]: Math.max(0.01, numValue) }));
        break;
    }
  };

  const riskMeterData = getRiskMeterData(results.accountRiskPercentage);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Position Size Calculator</h2>
        <p className="text-slate-600 dark:text-slate-400">Calculate proper position sizing based on risk management rules</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Inputs */}
        <div className="space-y-4">
          {/* Account Size */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Account Size ($)
            </label>
            <input
              type="number"
              placeholder="25,000"
              value={inputs.accountSize || ''}
              onChange={(e) => handleInputChange('accountSize', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0"
            />
          </div>

          {/* Risk Percentage */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Risk Percentage: {inputs.riskPercentage.toFixed(2)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={inputs.riskPercentage}
              onChange={(e) => handleInputChange('riskPercentage', e.target.value)}
              className="w-full"
            />
            <input
              type="number"
              value={inputs.riskPercentage.toFixed(2)}
              onChange={(e) => handleInputChange('riskPercentage', e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0.5"
              max="5"
              step="0.25"
            />
          </div>

          {/* Entry Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Entry Price ($)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={inputs.entryPrice || ''}
              onChange={(e) => handleInputChange('entryPrice', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Price per contract</p>
          </div>

          {/* Stop Loss Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Stop Loss Price ($)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={inputs.stopLossPrice || ''}
              onChange={(e) => handleInputChange('stopLossPrice', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Price per contract where you exit</p>
          </div>

          {/* Direction Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Direction</label>
            <div className="flex gap-3">
              <button
                onClick={() => handleInputChange('direction', 'long')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg font-medium transition-colors',
                  inputs.direction === 'long'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                )}
              >
                Long
              </button>
              <button
                onClick={() => handleInputChange('direction', 'short')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg font-medium transition-colors',
                  inputs.direction === 'short'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                )}
              >
                Short
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {/* Risk Meter */}
          <RiskMeter percentage={results.accountRiskPercentage} />

          {/* Result Cards */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Results</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Recommended Contracts:</span>
                <span className="font-bold text-lg text-slate-900 dark:text-white">{results.maxContracts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Dollar Risk:</span>
                <span className="font-bold text-slate-900 dark:text-white">${results.dollarRisk.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Max Loss:</span>
                <span className="font-bold text-slate-900 dark:text-white">${results.maxLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Position Cost:</span>
                <span className="font-bold text-slate-900 dark:text-white">${results.totalPositionCost.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-600 flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Account Risk:</span>
                <span className={cn(
                  'font-bold text-lg',
                  results.accountRiskPercentage <= 2 && 'text-emerald-600 dark:text-emerald-400',
                  results.accountRiskPercentage > 2 && results.accountRiskPercentage <= 5 && 'text-yellow-600 dark:text-yellow-400',
                  results.accountRiskPercentage > 5 && 'text-red-600 dark:text-red-400'
                )}>
                  {results.accountRiskPercentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings Section */}
      {results.warningMessages.length > 0 && (
        <div className="mt-6 space-y-2">
          {results.warningMessages.map((message, idx) => (
            <div key={idx} className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {results.maxContracts > 0 && results.warningMessages.length === 0 && (
        <div className="mt-6 flex gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">Position sizing looks good! You're within recommended risk parameters.</p>
        </div>
      )}
    </div>
  );
}
```

---

## COMPONENT 3: OPTIONS CHAIN TRAINER

**File Location:** `/components/academy/interactive/options-chain-trainer.tsx`

### 3.1 TypeScript Interfaces

```typescript
interface ChainStrike {
  strike: number;                // Strike price
  callBid: number;              // Call bid price
  callAsk: number;              // Call ask price
  callLast: number;             // Call last traded price
  callVolume: number;           // Call volume
  callOpenInterest: number;      // Call open interest
  callIV: number;               // Call implied volatility
  putBid: number;               // Put bid price
  putAsk: number;               // Put ask price
  putLast: number;              // Put last traded price
  putVolume: number;            // Put volume
  putOpenInterest: number;       // Put open interest
  putIV: number;                // Put implied volatility
  isATM: boolean;               // Is this the at-the-money strike
}

interface QuizQuestion {
  id: string;
  type: 'bidask' | 'selection' | 'intrinsic' | 'itm' | 'profitloss' | 'highest-iv';
  question: string;
  strikePrice?: number;
  optionType?: 'call' | 'put';
  correctAnswer: number | string;
  explanation: string;
  options?: string[]; // For multiple choice
}

interface ChainTrainerState {
  underlyingPrice: number;
  optionChain: ChainStrike[];
  currentQuestionIndex: number;
  questions: QuizQuestion[];
  userAnswers: (number | string | null)[];
  showResults: boolean;
  score: number;
}
```

### 3.2 Options Chain Data Generation

```typescript
/**
 * Generate realistic options chain data
 * Includes realistic bid-ask spreads, volumes, and IV smile
 */
function generateOptionsChain(
  underlyingPrice: number,
  numStrikes: number = 11
): ChainStrike[] {
  const strikes: ChainStrike[] = [];

  // Center strikes around ATM
  const atmIndex = Math.floor(numStrikes / 2);
  const strikeSpacing = 5; // $5 between strikes

  for (let i = 0; i < numStrikes; i++) {
    const offset = (i - atmIndex) * strikeSpacing;
    const strike = Math.round(underlyingPrice + offset);

    const moneyness = strike / underlyingPrice;

    // Realistic IV smile: higher OTM, lower ATM
    const baseIV = 0.22;
    const ivSkew = Math.abs(Math.log(moneyness)) * 0.3;
    const callIV = baseIV + ivSkew;
    const putIV = baseIV + ivSkew * 1.1; // Puts slightly higher IV

    // Estimate option prices using rough approximation
    const callPrice = estimateOptionPrice(underlyingPrice, strike, callIV, 30, 'call');
    const putPrice = estimateOptionPrice(underlyingPrice, strike, putIV, 30, 'put');

    // Realistic bid-ask spreads (tighter ATM, wider OTM)
    const callSpread = Math.max(0.05, 0.15 * Math.abs(Math.log(moneyness)));
    const putSpread = Math.max(0.05, 0.15 * Math.abs(Math.log(moneyness)));

    // Realistic volume (higher ATM, lower OTM)
    const volumeAtm = 500;
    const volumeMult = Math.exp(-2 * Math.pow(Math.log(moneyness), 2));
    const callVolume = Math.floor(volumeAtm * volumeMult);
    const putVolume = Math.floor(volumeAtm * volumeMult);

    // Open interest (much higher ATM)
    const oiMult = Math.exp(-3 * Math.pow(Math.log(moneyness), 2));
    const callOI = Math.floor(5000 * oiMult);
    const putOI = Math.floor(5000 * oiMult);

    strikes.push({
      strike,
      callBid: Math.max(0, callPrice - callSpread / 2),
      callAsk: callPrice + callSpread / 2,
      callLast: callPrice,
      callVolume,
      callOpenInterest: callOI,
      callIV,
      putBid: Math.max(0, putPrice - putSpread / 2),
      putAsk: putPrice + putSpread / 2,
      putLast: putPrice,
      putVolume,
      putOpenInterest: putOI,
      putIV,
      isATM: i === atmIndex,
    });
  }

  return strikes;
}

/**
 * Quick Black-Scholes approximation for chain generation
 */
function estimateOptionPrice(
  S: number,
  K: number,
  sigma: number,
  days: number,
  type: 'call' | 'put'
): number {
  const T = days / 365;

  // Intrinsic value
  let intrinsic = 0;
  if (type === 'call') {
    intrinsic = Math.max(0, S - K);
  } else {
    intrinsic = Math.max(0, K - S);
  }

  // Time value approximation
  const timeValue = S * sigma * Math.sqrt(T) * 0.4;

  let price = intrinsic + timeValue;

  // Adjust for moneyness
  const moneyness = S / K;
  if (type === 'call' && moneyness < 0.95) {
    price *= (1 + (0.95 - moneyness) * 0.5);
  } else if (type === 'put' && moneyness > 1.05) {
    price *= (1 + (moneyness - 1.05) * 0.5);
  }

  return Math.max(0.01, price);
}
```

### 3.3 Quiz Question Generation

```typescript
/**
 * Generate 5-8 quiz questions from displayed options chain
 */
function generateQuizQuestions(chain: ChainStrike[], underlyingPrice: number): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  // Find ATM and OTM strikes
  const atmStrike = chain.find(s => s.isATM)!;
  const otmCall = chain.find(s => s.strike > underlyingPrice && !s.isATM);
  const otmPut = chain.find(s => s.strike < underlyingPrice && !s.isATM);
  const deepOTM = chain.find(s => Math.abs(s.strike - underlyingPrice) > 15);

  // Question 1: Bid-ask spread
  if (atmStrike) {
    const spread = (atmStrike.callAsk - atmStrike.callBid).toFixed(2);
    questions.push({
      id: 'q1',
      type: 'bidask',
      question: `What is the bid-ask spread of the ${atmStrike.strike} call?`,
      strikePrice: atmStrike.strike,
      optionType: 'call',
      correctAnswer: parseFloat(spread),
      explanation: `The bid-ask spread is the difference between the ask price ($${atmStrike.callAsk.toFixed(2)}) and bid price ($${atmStrike.callBid.toFixed(2)}), which equals $${spread}. Tighter spreads (lower values) indicate more liquid options.`,
    });
  }

  // Question 2: Highest open interest
  const highestOI = chain.reduce((max, s) =>
    (s.callOpenInterest + s.putOpenInterest > max.callOpenInterest + max.putOpenInterest) ? s : max
  );

  questions.push({
    id: 'q2',
    type: 'selection',
    question: 'Which strike has the highest open interest for calls?',
    strikePrice: highestOI.strike,
    optionType: 'call',
    correctAnswer: highestOI.strike.toString(),
    explanation: `The ${highestOI.strike} strike has the highest call open interest (${highestOI.callOpenInterest.toLocaleString()} contracts). ATM and near-ATM strikes typically have the highest open interest because they have the most trading activity.`,
    options: chain.slice(0, 5).map(s => s.strike.toString()),
  });

  // Question 3: Intrinsic value
  if (otmCall) {
    const intrinsic = Math.max(0, underlyingPrice - otmCall.strike);
    questions.push({
      id: 'q3',
      type: 'intrinsic',
      question: `If the underlying is trading at ${underlyingPrice}, what is the intrinsic value of the ${otmCall.strike} call?`,
      strikePrice: otmCall.strike,
      optionType: 'call',
      correctAnswer: intrinsic,
      explanation: `Intrinsic value = max(S - K, 0) = max(${underlyingPrice} - ${otmCall.strike}, 0) = $${intrinsic}. Since this call is out-of-the-money, it has zero intrinsic value. All of its value is time value.`,
    });
  }

  // Question 4: ITM/OTM determination
  if (otmPut) {
    questions.push({
      id: 'q4',
      type: 'itm',
      question: `The underlying is at ${underlyingPrice}. Is the ${otmPut.strike} put in-the-money or out-of-the-money?`,
      strikePrice: otmPut.strike,
      optionType: 'put',
      correctAnswer: 'in-the-money',
      explanation: `Since the underlying (${underlyingPrice}) is above the strike (${otmPut.strike}), this put is in-the-money. ITM puts have the right to sell at a price higher than current market. For puts: ITM when strike > spot, OTM when strike < spot.`,
      options: ['in-the-money', 'out-of-the-money', 'at-the-money'],
    });
  }

  // Question 5: Profit/Loss on bid-ask
  if (otmCall) {
    const loss = (otmCall.callBid - otmCall.callAsk) * 100;
    questions.push({
      id: 'q5',
      type: 'profitloss',
      question: `If you bought the ${otmCall.strike} call at the ask ($${otmCall.callAsk.toFixed(2)}) and immediately sold at the bid ($${otmCall.callBid.toFixed(2)}), what's your loss per contract?`,
      strikePrice: otmCall.strike,
      optionType: 'call',
      correctAnswer: Math.abs(loss),
      explanation: `Loss per contract = (Bid - Ask) × 100 = ($${otmCall.callBid.toFixed(2)} - $${otmCall.callAsk.toFixed(2)}) × 100 = $${Math.abs(loss).toFixed(2)}. This illustrates bid-ask slippage — you should enter orders at bid/ask, not at last price.`,
    });
  }

  // Question 6: Highest IV
  const highestIVStrike = chain.reduce((max, s) =>
    s.callIV > max.callIV ? s : max
  );

  questions.push({
    id: 'q6',
    type: 'highest-iv',
    question: 'Which strike has the highest implied volatility?',
    strikePrice: highestIVStrike.strike,
    optionType: 'call',
    correctAnswer: highestIVStrike.strike.toString(),
    explanation: `The ${highestIVStrike.strike} strike has the highest IV (${(highestIVStrike.callIV * 100).toFixed(1)}%). This is the IV smile/skew effect: OTM options typically have higher IV because they're priced with risk of larger moves.`,
    options: chain.map(s => s.strike.toString()).sort(() => Math.random() - 0.5).slice(0, 5),
  });

  return questions.slice(0, 8); // Return up to 8 questions
}
```

### 3.4 Full Options Chain Trainer Component

```typescript
'use client';

import React, { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OptionsChainTrainer() {
  const [state, setState] = useState<ChainTrainerState>(() => {
    const underlyingPrice = 4500;
    const optionChain = generateOptionsChain(underlyingPrice);
    const questions = generateQuizQuestions(optionChain, underlyingPrice);

    return {
      underlyingPrice,
      optionChain,
      currentQuestionIndex: 0,
      questions,
      userAnswers: Array(questions.length).fill(null),
      showResults: false,
      score: 0,
    };
  });

  const currentQuestion = state.questions[state.currentQuestionIndex];
  const userAnswer = state.userAnswers[state.currentQuestionIndex];
  const isAnswered = userAnswer !== null;
  const isCorrect = isAnswered &&
    (typeof userAnswer === 'number'
      ? Math.abs(userAnswer - (currentQuestion.correctAnswer as number)) < 0.01
      : userAnswer === currentQuestion.correctAnswer
    );

  const handleAnswer = (answer: number | string) => {
    const newAnswers = [...state.userAnswers];
    newAnswers[state.currentQuestionIndex] = answer;

    // Calculate score
    let newScore = 0;
    newAnswers.forEach((ans, idx) => {
      if (ans === null) return;
      const q = state.questions[idx];
      const correct = typeof ans === 'number' && typeof q.correctAnswer === 'number'
        ? Math.abs(ans - q.correctAnswer) < 0.01
        : ans === q.correctAnswer;
      if (correct) newScore++;
    });

    setState(prev => ({
      ...prev,
      userAnswers: newAnswers,
      score: newScore,
    }));
  };

  const handleNext = () => {
    if (state.currentQuestionIndex < state.questions.length - 1) {
      setState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));
    } else {
      setState(prev => ({
        ...prev,
        showResults: true,
      }));
    }
  };

  const handleRestart = () => {
    const underlyingPrice = 4500;
    const optionChain = generateOptionsChain(underlyingPrice);
    const questions = generateQuizQuestions(optionChain, underlyingPrice);

    setState({
      underlyingPrice,
      optionChain,
      currentQuestionIndex: 0,
      questions,
      userAnswers: Array(questions.length).fill(null),
      showResults: false,
      score: 0,
    });
  };

  // Show results screen
  if (state.showResults) {
    const percentage = (state.score / state.questions.length) * 100;
    const passThreshold = 70;
    const passed = percentage >= passThreshold;

    return (
      <div className="w-full max-w-2xl mx-auto p-4">
        <div className="text-center mb-8">
          {passed ? (
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
          ) : (
            <XCircle size={48} className="text-blue-500 mx-auto mb-4" />
          )}

          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Quiz Complete!
          </h2>

          <div className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {percentage.toFixed(0)}%
          </div>

          <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">
            You got {state.score} out of {state.questions.length} questions correct
          </p>

          {passed ? (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">
              Great job! You're ready to read real options chains.
            </p>
          ) : (
            <p className="text-blue-600 dark:text-blue-400 font-medium">
              Review the explanations below and try again!
            </p>
          )}
        </div>

        {/* Review section */}
        <div className="space-y-6 mb-6">
          {state.questions.map((question, idx) => {
            const answer = state.userAnswers[idx];
            const correct = answer !== null && (
              typeof answer === 'number' && typeof question.correctAnswer === 'number'
                ? Math.abs(answer - question.correctAnswer) < 0.01
                : answer === question.correctAnswer
            );

            return (
              <div key={question.id} className={cn(
                'p-4 rounded-lg border-2',
                correct
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
              )}>
                <div className="flex items-start gap-3 mb-2">
                  {correct ? (
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle size={20} className="text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{question.question}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{question.explanation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Restart button */}
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Options Chain Trainer</h2>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Question {state.currentQuestionIndex + 1} of {state.questions.length}
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((state.currentQuestionIndex + 1) / state.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Options Chain Table */}
      <div className="mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 dark:border-slate-600">
              <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Strike</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Call Bid</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Call Ask</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Vol</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">OI</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">IV</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Put Bid</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Put Ask</th>
            </tr>
          </thead>
          <tbody>
            {state.optionChain.map((row) => (
              <tr
                key={row.strike}
                className={cn(
                  'border-b border-slate-200 dark:border-slate-700',
                  row.isATM && 'bg-blue-50 dark:bg-blue-900/20'
                )}
              >
                <td className={cn(
                  'px-3 py-2 font-medium',
                  row.isATM ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'
                )}>
                  {row.strike} {row.isATM && '(ATM)'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">${row.callBid.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">${row.callAsk.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{row.callVolume}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{row.callOpenInterest.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{(row.callIV * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">${row.putBid.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">${row.putAsk.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Question and Answer */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {currentQuestion.question}
        </h3>

        {/* Answer input based on question type */}
        {currentQuestion.type === 'bidask' || currentQuestion.type === 'profitloss' ? (
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Enter your answer"
              value={userAnswer === null ? '' : userAnswer}
              onChange={(e) => handleAnswer(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              step="0.01"
            />
            {isAnswered && (
              <p className={cn(
                'text-sm',
                isCorrect
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-blue-600 dark:text-blue-400'
              )}>
                {isCorrect ? '✓ Correct!' : `Your answer: $${userAnswer}. Correct answer: $${currentQuestion.correctAnswer}`}
              </p>
            )}
          </div>
        ) : currentQuestion.options ? (
          <div className="space-y-2">
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                className={cn(
                  'w-full p-3 text-left rounded-lg border-2 transition-colors',
                  userAnswer === option
                    ? isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-400'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400'
                    : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            placeholder="Enter your answer"
            value={userAnswer === null ? '' : userAnswer}
            onChange={(e) => handleAnswer(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            step="0.01"
          />
        )}
      </div>

      {/* Explanation when answered */}
      {isAnswered && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <p className="text-sm text-slate-700 dark:text-slate-300">{currentQuestion.explanation}</p>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={!isAnswered}
        className={cn(
          'w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors',
          isAnswered
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
        )}
      >
        {state.currentQuestionIndex === state.questions.length - 1 ? 'See Results' : 'Next Question'}
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
```

---

**END OF SECTION 1**

Due to length constraints, the Trade Card Generation System specification will follow in the next message.

