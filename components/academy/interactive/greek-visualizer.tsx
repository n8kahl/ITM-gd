'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { calculateAllGreeks, generateChartData } from '@/lib/academy/black-scholes'
import type { BlackScholesInputs, GreekValues } from '@/lib/types/academy'
import {
  Info,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Gauge,
  Percent,
  DollarSign,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'

// ---------------------------------------------------------------------------
// Educational tooltips
// ---------------------------------------------------------------------------

const GREEK_TOOLTIPS: Record<string, string> = {
  delta:
    'Rate of change of option price vs stock price. Call delta 0-1, put delta -1 to 0.',
  gamma:
    'Rate of change of delta. Peaks at-the-money. High gamma = non-linear risk.',
  theta:
    'Daily time decay in dollars. Long options lose money daily (negative theta).',
  vega:
    'Sensitivity to IV changes. Per 1% IV change. Same for calls and puts.',
  rho:
    'Sensitivity to interest rate changes. Smallest impact of all Greeks.',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex items-center justify-center rounded-full text-white/40 hover:text-[#10B981] transition-colors"
        aria-label="More info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg bg-[#0A0A0B]/95 backdrop-blur-xl border border-white/10 p-3 text-xs text-white/70 shadow-xl">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-white/10" />
        </div>
      )}
    </div>
  )
}

interface SliderInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Display formatter (e.g. add $ or %) */
  format?: (v: number) => string
  icon?: React.ReactNode
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  icon,
}: SliderInputProps) {
  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value))
    },
    [onChange],
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v)) {
        onChange(Math.min(max, Math.max(min, v)))
      }
    },
    [onChange, min, max],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <span className="text-xs font-mono text-[#F3E5AB]">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSlider}
          className="flex-1 h-1.5 appearance-none rounded-full bg-white/10 accent-[#10B981] cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:shadow-[#10B981]/20 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#10B981] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInput}
          className="w-20 h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white text-right
            font-mono focus:border-[#10B981] focus:outline-none focus:ring-0 transition-colors
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    </div>
  )
}

interface GreekCardProps {
  label: string
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  tooltip?: string
  color?: string
  icon: React.ReactNode
}

function GreekCard({
  label,
  value,
  decimals = 4,
  prefix = '',
  suffix = '',
  tooltip,
  color = 'text-white',
  icon,
}: GreekCardProps) {
  const displayValue = isFinite(value) ? value.toFixed(decimals) : '0.0000'

  return (
    <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
          {icon}
          {label}
        </div>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className={cn('text-xl font-semibold font-mono tracking-tight', color)}>
        {prefix}
        {displayValue}
        {suffix}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg bg-[#0A0A0B]/95 backdrop-blur-xl border border-white/10 p-3 shadow-xl text-xs space-y-1">
      <p className="text-white/60 font-medium">Stock: ${Number(label).toFixed(2)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-mono">
          {entry.name}: ${Number(entry.value).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GreekVisualizer() {
  // Inputs state
  const [stockPrice, setStockPrice] = useState(100)
  const [strikePrice, setStrikePrice] = useState(100)
  const [daysToExpiration, setDaysToExpiration] = useState(30)
  const [impliedVolatility, setImpliedVolatility] = useState(0.3)
  const [interestRate, setInterestRate] = useState(0.05)
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')

  const inputs: BlackScholesInputs = useMemo(
    () => ({
      stockPrice,
      strikePrice,
      daysToExpiration,
      impliedVolatility,
      interestRate,
      optionType,
    }),
    [stockPrice, strikePrice, daysToExpiration, impliedVolatility, interestRate, optionType],
  )

  // Calculate Greeks
  const greeks: GreekValues = useMemo(() => calculateAllGreeks(inputs), [inputs])

  // Generate chart data
  const chartData = useMemo(() => generateChartData(inputs, 80), [inputs])

  // Moneyness label
  const moneyness = useMemo(() => {
    if (optionType === 'call') {
      if (stockPrice > strikePrice) return 'ITM'
      if (stockPrice < strikePrice) return 'OTM'
      return 'ATM'
    }
    if (stockPrice < strikePrice) return 'ITM'
    if (stockPrice > strikePrice) return 'OTM'
    return 'ATM'
  }, [stockPrice, strikePrice, optionType])

  const moneynessColor =
    moneyness === 'ITM'
      ? 'text-[#10B981]'
      : moneyness === 'OTM'
        ? 'text-red-400'
        : 'text-[#F3E5AB]'

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Black-Scholes Greek Visualizer
          </h2>
          <p className="text-sm text-white/40">
            Adjust parameters to see real-time Greek calculations
          </p>
        </div>
        <div className={cn('text-sm font-semibold px-3 py-1 rounded-full border', moneynessColor, 'border-current/20 bg-current/5')}>
          {moneyness}
        </div>
      </div>

      {/* Main grid: inputs + greeks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column — Inputs */}
        <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#10B981]" />
            Parameters
          </h3>

          {/* Call / Put toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setOptionType('call')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold transition-all duration-300',
                optionType === 'call'
                  ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                  : 'bg-white/5 text-white/50 hover:text-white/70',
              )}
            >
              Call
            </button>
            <button
              type="button"
              onClick={() => setOptionType('put')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold transition-all duration-300',
                optionType === 'put'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'bg-white/5 text-white/50 hover:text-white/70',
              )}
            >
              Put
            </button>
          </div>

          <SliderInput
            label="Stock Price"
            value={stockPrice}
            min={1}
            max={600}
            step={1}
            onChange={setStockPrice}
            format={(v) => `$${v.toFixed(0)}`}
            icon={<DollarSign className="h-3 w-3" />}
          />

          <SliderInput
            label="Strike Price"
            value={strikePrice}
            min={1}
            max={600}
            step={1}
            onChange={setStrikePrice}
            format={(v) => `$${v.toFixed(0)}`}
            icon={<TrendingUp className="h-3 w-3" />}
          />

          <SliderInput
            label="Days to Expiration"
            value={daysToExpiration}
            min={1}
            max={365}
            step={1}
            onChange={setDaysToExpiration}
            format={(v) => `${v}d`}
            icon={<Clock className="h-3 w-3" />}
          />

          <SliderInput
            label="Implied Volatility"
            value={impliedVolatility}
            min={0.05}
            max={1.5}
            step={0.01}
            onChange={setImpliedVolatility}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            icon={<Gauge className="h-3 w-3" />}
          />

          <SliderInput
            label="Interest Rate"
            value={interestRate}
            min={0}
            max={0.1}
            step={0.005}
            onChange={setInterestRate}
            format={(v) => `${(v * 100).toFixed(1)}%`}
            icon={<Percent className="h-3 w-3" />}
          />
        </div>

        {/* Right column — Greek output cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-[#F3E5AB]" />
            Greeks Output
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Option Price */}
            <GreekCard
              label="Option Price"
              value={greeks.optionPrice}
              decimals={2}
              prefix="$"
              color="text-[#10B981]"
              icon={<DollarSign className="h-3 w-3" />}
            />

            {/* Delta */}
            <GreekCard
              label="Delta"
              value={greeks.delta}
              decimals={4}
              tooltip={GREEK_TOOLTIPS.delta}
              color={greeks.delta >= 0 ? 'text-[#10B981]' : 'text-red-400'}
              icon={<TrendingUp className="h-3 w-3" />}
            />

            {/* Gamma */}
            <GreekCard
              label="Gamma"
              value={greeks.gamma}
              decimals={4}
              tooltip={GREEK_TOOLTIPS.gamma}
              color="text-[#F3E5AB]"
              icon={<Activity className="h-3 w-3" />}
            />

            {/* Theta (daily) */}
            <GreekCard
              label="Theta (daily)"
              value={greeks.theta}
              decimals={4}
              prefix="$"
              tooltip={GREEK_TOOLTIPS.theta}
              color="text-red-400"
              icon={<Clock className="h-3 w-3" />}
            />

            {/* Vega (per 1% IV) */}
            <GreekCard
              label="Vega (1% IV)"
              value={greeks.vega}
              decimals={4}
              prefix="$"
              tooltip={GREEK_TOOLTIPS.vega}
              color="text-purple-400"
              icon={<Gauge className="h-3 w-3" />}
            />

            {/* Rho */}
            <GreekCard
              label="Rho"
              value={greeks.rho}
              decimals={4}
              prefix="$"
              tooltip={GREEK_TOOLTIPS.rho}
              color="text-blue-400"
              icon={<Percent className="h-3 w-3" />}
            />
          </div>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white/80">
          Option Price vs Stock Price
        </h3>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="stockPrice"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
                stroke="rgba(255,255,255,0.1)"
              />
              <RechartsTooltip content={<ChartTooltipContent />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
              />
              <ReferenceLine
                x={strikePrice}
                stroke="rgba(255,255,255,0.2)"
                strokeDasharray="4 4"
                label={{
                  value: 'Strike',
                  fill: 'rgba(255,255,255,0.3)',
                  fontSize: 10,
                  position: 'top',
                }}
              />
              <ReferenceLine
                x={stockPrice}
                stroke="#10B981"
                strokeDasharray="4 4"
                label={{
                  value: 'Current',
                  fill: '#10B981',
                  fontSize: 10,
                  position: 'top',
                }}
              />
              <Line
                type="monotone"
                dataKey="optionPrice"
                name="Option Price"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: '#10B981' }}
              />
              <Line
                type="monotone"
                dataKey="intrinsicValue"
                name="Intrinsic Value"
                stroke="#F3E5AB"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="timeValue"
                name="Time Value"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
