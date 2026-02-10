'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  Target,
  Calculator,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionResult {
  dollarRisk: number
  riskPerContract: number
  maxContracts: number
  totalCost: number
  maxLoss: number
  accountRiskPercent: number
}

type RiskLevel = 'conservative' | 'moderate' | 'aggressive'

// ---------------------------------------------------------------------------
// Utility: compute position sizing
// ---------------------------------------------------------------------------

function calculatePosition(
  accountSize: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  direction: 'long' | 'short',
): PositionResult | null {
  if (accountSize <= 0 || entryPrice <= 0 || stopLoss <= 0) return null

  // Validate stop loss direction
  if (direction === 'long' && stopLoss >= entryPrice) return null
  if (direction === 'short' && stopLoss <= entryPrice) return null

  const dollarRisk = accountSize * (riskPercent / 100)
  const riskPerContract = Math.abs(entryPrice - stopLoss) * 100
  if (riskPerContract <= 0) return null

  const maxContracts = Math.floor(dollarRisk / riskPerContract)
  const totalCost = entryPrice * 100 * maxContracts
  const maxLoss = riskPerContract * maxContracts
  const accountRiskPercent = (maxLoss / accountSize) * 100

  return {
    dollarRisk,
    riskPerContract,
    maxContracts,
    totalCost,
    maxLoss,
    accountRiskPercent,
  }
}

function getRiskLevel(pct: number): RiskLevel {
  if (pct <= 2) return 'conservative'
  if (pct <= 5) return 'moderate'
  return 'aggressive'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NumberInputProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  icon?: React.ReactNode
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
  icon,
}: NumberInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, '')
      const v = parseFloat(raw)
      if (!isNaN(v)) {
        const clamped = max !== undefined ? Math.min(v, max) : v
        onChange(Math.max(min ?? 0, clamped))
      } else if (raw === '') {
        onChange(0)
      }
    },
    [onChange, min, max],
  )

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={value || ''}
          onChange={handleChange}
          className={cn(
            'w-full h-10 rounded-md border border-white/10 bg-white/5 text-sm text-white text-right',
            'font-mono focus:border-[#10B981] focus:outline-none focus:ring-0 transition-colors',
            prefix ? 'pl-7 pr-3' : 'px-3',
            suffix ? 'pr-8' : '',
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk meter (semicircle gauge)
// ---------------------------------------------------------------------------

function RiskMeter({ percent }: { percent: number }) {
  // Clamp to 0-10 for visual display
  const clamped = Math.min(Math.max(percent, 0), 10)
  // Angle: 0% = -90deg, 10% = +90deg => maps 0-10 to 180 degrees
  const angle = -90 + (clamped / 10) * 180

  const level = getRiskLevel(percent)
  const needleColor =
    level === 'conservative'
      ? '#10B981'
      : level === 'moderate'
        ? '#F59E0B'
        : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-28 overflow-hidden">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arc segments */}
          {/* Green zone: 0-2% (0-36deg of 180) */}
          <path
            d="M 20 100 A 80 80 0 0 1 56 32"
            fill="none"
            stroke="#10B981"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.3"
          />
          {/* Yellow zone: 2-5% (36-90deg of 180) */}
          <path
            d="M 56 32 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="12"
            opacity="0.3"
          />
          <path
            d="M 100 20 A 80 80 0 0 1 144 32"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="12"
            opacity="0.3"
          />
          {/* Red zone: 5%+ (90-180deg of 180) */}
          <path
            d="M 144 32 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#EF4444"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Labels */}
          <text x="15" y="108" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="start">
            0%
          </text>
          <text x="96" y="14" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">
            5%
          </text>
          <text x="185" y="108" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="end">
            10%
          </text>

          {/* Needle */}
          <g transform={`rotate(${angle}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="30"
              stroke={needleColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* Center dot */}
          <circle cx="100" cy="100" r="5" fill={needleColor} />
          <circle cx="100" cy="100" r="3" fill="#0A0A0B" />
        </svg>
      </div>
      <div className="mt-1 text-center">
        <p className="text-2xl font-bold font-mono" style={{ color: needleColor }}>
          {percent.toFixed(2)}%
        </p>
        <p className="text-xs text-white/40 capitalize">{level} Risk</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

interface ResultCardProps {
  label: string
  value: string
  icon: React.ReactNode
  highlight?: boolean
}

function ResultCard({ label, value, icon, highlight }: ResultCardProps) {
  return (
    <div
      className={cn(
        'bg-[#0A0A0B]/60 backdrop-blur-xl border rounded-xl p-4 space-y-1',
        highlight ? 'border-[#10B981]/30' : 'border-white/5',
      )}
    >
      <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          'text-lg font-semibold font-mono tracking-tight',
          highlight ? 'text-[#10B981]' : 'text-white',
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PositionSizer() {
  const [accountSize, setAccountSize] = useState(25000)
  const [riskPercent, setRiskPercent] = useState(1)
  const [entryPrice, setEntryPrice] = useState(5.0)
  const [stopLoss, setStopLoss] = useState(3.5)
  const [direction, setDirection] = useState<'long' | 'short'>('long')

  const result = useMemo(
    () => calculatePosition(accountSize, riskPercent, entryPrice, stopLoss, direction),
    [accountSize, riskPercent, entryPrice, stopLoss, direction],
  )

  const handleRiskSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRiskPercent(parseFloat(e.target.value))
    },
    [],
  )

  const handleRiskInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v)) {
        setRiskPercent(Math.min(5, Math.max(0.5, v)))
      }
    },
    [],
  )

  // Warning / success messages
  const warnings: string[] = []
  const successes: string[] = []

  if (result) {
    if (result.accountRiskPercent > 5) {
      warnings.push(
        `Risk of ${result.accountRiskPercent.toFixed(1)}% exceeds 5% aggressive threshold. Consider reducing position size.`,
      )
    } else if (result.accountRiskPercent > 3) {
      warnings.push(
        `Risk of ${result.accountRiskPercent.toFixed(1)}% is above 3%. Moderate risk -- ensure you have conviction.`,
      )
    }
    if (result.totalCost > accountSize * 0.25) {
      warnings.push(
        `Position cost ($${result.totalCost.toLocaleString()}) exceeds 25% of account. High concentration risk.`,
      )
    }
    if (warnings.length === 0 && result.maxContracts > 0) {
      successes.push(
        `Position size within conservative parameters. Risk: ${result.accountRiskPercent.toFixed(2)}% of account.`,
      )
    }
  }

  // Validation error
  const validationError = useMemo(() => {
    if (direction === 'long' && stopLoss >= entryPrice) {
      return 'Stop loss must be below entry price for long positions.'
    }
    if (direction === 'short' && stopLoss <= entryPrice) {
      return 'Stop loss must be above entry price for short positions.'
    }
    return null
  }, [direction, entryPrice, stopLoss])

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#10B981]" />
          Position Size Calculator
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Calculate optimal position sizing based on your risk tolerance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#10B981]" />
            Trade Parameters
          </h3>

          {/* Direction toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setDirection('long')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5',
                direction === 'long'
                  ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                  : 'bg-white/5 text-white/50 hover:text-white/70',
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Long
            </button>
            <button
              type="button"
              onClick={() => setDirection('short')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5',
                direction === 'short'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'bg-white/5 text-white/50 hover:text-white/70',
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Short
            </button>
          </div>

          <NumberInput
            label="Account Size"
            value={accountSize}
            onChange={setAccountSize}
            min={100}
            prefix="$"
            icon={<DollarSign className="h-3 w-3" />}
          />

          {/* Risk % slider + input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                <Percent className="h-3 w-3" />
                Risk Percentage
              </label>
              <span className="text-xs font-mono text-[#F3E5AB]">
                {riskPercent.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.1}
                value={riskPercent}
                onChange={handleRiskSlider}
                className="flex-1 h-1.5 appearance-none rounded-full bg-white/10 accent-[#10B981] cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:shadow-[#10B981]/20 [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-[#10B981] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <input
                type="number"
                min={0.5}
                max={5}
                step={0.1}
                value={riskPercent}
                onChange={handleRiskInput}
                className="w-20 h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white text-right
                  font-mono focus:border-[#10B981] focus:outline-none focus:ring-0 transition-colors
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/30 px-0.5">
              <span>Conservative</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
          </div>

          <NumberInput
            label="Entry Price (per contract)"
            value={entryPrice}
            onChange={setEntryPrice}
            min={0.01}
            step={0.05}
            prefix="$"
            icon={<Target className="h-3 w-3" />}
          />

          <NumberInput
            label="Stop Loss Price (per contract)"
            value={stopLoss}
            onChange={setStopLoss}
            min={0.01}
            step={0.05}
            prefix="$"
            icon={<Shield className="h-3 w-3" />}
          />

          {/* Validation error */}
          {validationError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{validationError}</p>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="space-y-5">
          {/* Risk meter */}
          <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-white/80 mb-3 self-start">
              Risk Assessment
            </h3>
            <RiskMeter percent={result?.accountRiskPercent ?? 0} />
          </div>

          {/* Result cards */}
          {result && result.maxContracts > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Recommended Contracts"
                value={result.maxContracts.toString()}
                icon={<Target className="h-3 w-3" />}
                highlight
              />
              <ResultCard
                label="Dollar Risk"
                value={`$${result.dollarRisk.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={<DollarSign className="h-3 w-3" />}
              />
              <ResultCard
                label="Max Loss"
                value={`$${result.maxLoss.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={<TrendingDown className="h-3 w-3" />}
              />
              <ResultCard
                label="Position Cost"
                value={`$${result.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={<Calculator className="h-3 w-3" />}
              />
              <div className="col-span-2">
                <ResultCard
                  label="Account Risk %"
                  value={`${result.accountRiskPercent.toFixed(2)}%`}
                  icon={<Percent className="h-3 w-3" />}
                />
              </div>
            </div>
          ) : (
            <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-6 text-center">
              <p className="text-sm text-white/40">
                {validationError
                  ? 'Fix the validation error to see results.'
                  : 'Enter valid trade parameters to calculate position size.'}
              </p>
            </div>
          )}

          {/* Warnings / success */}
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-200">{w}</p>
            </div>
          ))}
          {successes.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 p-3"
            >
              <CheckCircle2 className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-200">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulas reference */}
      <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/80 mb-3">Formulas Used</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-white/40 font-mono">
          <p>
            <span className="text-[#F3E5AB]">Dollar Risk</span> = Account x (Risk% / 100)
          </p>
          <p>
            <span className="text-[#F3E5AB]">Risk/Contract</span> = |Entry - Stop| x 100
          </p>
          <p>
            <span className="text-[#F3E5AB]">Max Contracts</span> = floor(Dollar Risk /
            Risk per Contract)
          </p>
          <p>
            <span className="text-[#F3E5AB]">Total Cost</span> = Entry x 100 x Contracts
          </p>
          <p>
            <span className="text-[#F3E5AB]">Account Risk %</span> = (Max Loss / Account)
            x 100
          </p>
        </div>
      </div>
    </div>
  )
}
