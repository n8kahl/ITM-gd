'use client'

import { useState, useMemo } from 'react'
import { Activity, TrendingUp, Clock, Zap, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GreekValue {
  name: string
  symbol: string
  value: number
  description: string
  impact: string
}

interface Position {
  label: string
  type: 'call' | 'put'
  action: 'long' | 'short'
  strike: number
  expiry: string
  quantity: number
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho: number
  }
}

interface GreeksDashboardConfig {
  underlying: string
  underlyingPrice: number
  positions: Position[]
  instructions: string
  interactiveMode?: boolean
  scenarios?: Array<{
    label: string
    priceChange: number
    ivChange: number
    timeChange: number
  }>
}

interface GreeksDashboardProps {
  config: GreeksDashboardConfig
  onComplete?: () => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Greek icon helper
// ---------------------------------------------------------------------------

function greekIcon(symbol: string) {
  switch (symbol) {
    case 'delta':
      return <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
    case 'gamma':
      return <Activity className="h-4 w-4" strokeWidth={1.5} />
    case 'theta':
      return <Clock className="h-4 w-4" strokeWidth={1.5} />
    case 'vega':
      return <Zap className="h-4 w-4" strokeWidth={1.5} />
    default:
      return <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcademyGreeksDashboard({
  config,
  onComplete,
  disabled = false,
}: GreeksDashboardProps) {
  const { underlying, underlyingPrice, positions, instructions, scenarios } = config
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null)
  const [activeScenario, setActiveScenario] = useState<number | null>(null)
  const [explored, setExplored] = useState(false)

  // Aggregate portfolio greeks
  const portfolioGreeks = useMemo(() => {
    const totals = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
    for (const pos of positions) {
      const mult = pos.action === 'long' ? 1 : -1
      totals.delta += pos.greeks.delta * pos.quantity * mult
      totals.gamma += pos.greeks.gamma * pos.quantity * mult
      totals.theta += pos.greeks.theta * pos.quantity * mult
      totals.vega += pos.greeks.vega * pos.quantity * mult
      totals.rho += pos.greeks.rho * pos.quantity * mult
    }
    return totals
  }, [positions])

  const greekDescriptions: GreekValue[] = [
    {
      name: 'Delta',
      symbol: 'delta',
      value: portfolioGreeks.delta,
      description: 'Rate of change in option price per $1 move in underlying',
      impact: portfolioGreeks.delta > 0 ? 'Bullish exposure' : portfolioGreeks.delta < 0 ? 'Bearish exposure' : 'Delta neutral',
    },
    {
      name: 'Gamma',
      symbol: 'gamma',
      value: portfolioGreeks.gamma,
      description: 'Rate of change in delta per $1 move in underlying',
      impact: portfolioGreeks.gamma > 0 ? 'Long gamma — benefits from movement' : 'Short gamma — exposed to movement risk',
    },
    {
      name: 'Theta',
      symbol: 'theta',
      value: portfolioGreeks.theta,
      description: 'Daily time decay of the position',
      impact: portfolioGreeks.theta > 0 ? 'Collecting time premium' : 'Paying time premium',
    },
    {
      name: 'Vega',
      symbol: 'vega',
      value: portfolioGreeks.vega,
      description: 'Sensitivity to 1% change in implied volatility',
      impact: portfolioGreeks.vega > 0 ? 'Long vol — benefits from IV increase' : 'Short vol — benefits from IV decrease',
    },
    {
      name: 'Rho',
      symbol: 'rho',
      value: portfolioGreeks.rho,
      description: 'Sensitivity to 1% change in interest rates',
      impact: 'Generally small impact for short-dated options',
    },
  ]

  const handleExplore = () => {
    if (!explored) {
      setExplored(true)
      onComplete?.()
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Greeks Dashboard</h3>
          <p className="text-sm text-white/50 mt-0.5">
            {underlying} &middot; ${underlyingPrice.toFixed(2)}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          Exploration Activity
        </span>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Portfolio Greeks Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {greekDescriptions.map((greek) => (
          <div
            key={greek.symbol}
            className="rounded-lg bg-white/5 border border-white/5 p-3 space-y-1"
          >
            <div className="flex items-center gap-1.5 text-white/50">
              {greekIcon(greek.symbol)}
              <span className="text-xs font-medium">{greek.name}</span>
            </div>
            <p
              className={`text-lg font-mono font-semibold ${
                greek.value > 0
                  ? 'text-emerald-400'
                  : greek.value < 0
                    ? 'text-rose-400'
                    : 'text-white/60'
              }`}
            >
              {greek.value >= 0 ? '+' : ''}
              {greek.value.toFixed(2)}
            </p>
            <p className="text-[10px] text-white/40 leading-tight">{greek.impact}</p>
          </div>
        ))}
      </div>

      {/* Positions Detail */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white/80">Positions</h4>
        {positions.map((pos, idx) => (
          <div key={idx} className="rounded-lg border border-white/5 bg-white/[0.03]">
            <button
              onClick={() => {
                setExpandedPosition(expandedPosition === idx ? null : idx)
                handleExplore()
              }}
              disabled={disabled}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    pos.action === 'long'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {pos.action.toUpperCase()}
                </span>
                <span className="text-sm text-white">
                  {pos.quantity}x {pos.strike} {pos.type.toUpperCase()}
                </span>
                <span className="text-xs text-white/40">{pos.expiry}</span>
              </div>
              {expandedPosition === idx ? (
                <ChevronUp className="h-4 w-4 text-white/40" strokeWidth={1.5} />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/40" strokeWidth={1.5} />
              )}
            </button>
            {expandedPosition === idx && (
              <div className="px-4 pb-3 grid grid-cols-5 gap-2 text-xs">
                {Object.entries(pos.greeks).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <p className="text-white/40 capitalize">{key}</p>
                    <p className={`font-mono ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {val >= 0 ? '+' : ''}
                      {val.toFixed(3)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Scenario Analysis */}
      {scenarios && scenarios.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white/80">What-If Scenarios</h4>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scenario, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveScenario(activeScenario === idx ? null : idx)
                  handleExplore()
                }}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                  activeScenario === idx
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
                }`}
              >
                {scenario.label}
              </button>
            ))}
          </div>
          {activeScenario !== null && scenarios[activeScenario] && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-sm space-y-2">
              <p className="text-white/70">
                <span className="text-white font-medium">Price:</span>{' '}
                {scenarios[activeScenario].priceChange >= 0 ? '+' : ''}
                ${scenarios[activeScenario].priceChange.toFixed(2)} |{' '}
                <span className="text-white font-medium">IV:</span>{' '}
                {scenarios[activeScenario].ivChange >= 0 ? '+' : ''}
                {scenarios[activeScenario].ivChange}% |{' '}
                <span className="text-white font-medium">Time:</span>{' '}
                {scenarios[activeScenario].timeChange}d
              </p>
              <div className="grid grid-cols-5 gap-3 pt-1">
                {Object.entries(portfolioGreeks).map(([key, base]) => {
                  // Simplified scenario impact estimation
                  const scenario = scenarios[activeScenario!]
                  let adjusted = base
                  if (key === 'delta') adjusted += portfolioGreeks.gamma * scenario.priceChange
                  if (key === 'theta') adjusted *= (1 - scenario.timeChange * 0.05)
                  if (key === 'vega') adjusted *= (1 + scenario.ivChange * 0.01)

                  return (
                    <div key={key} className="text-center">
                      <p className="text-white/40 capitalize text-xs">{key}</p>
                      <p className={`font-mono text-xs ${adjusted >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {adjusted >= 0 ? '+' : ''}
                        {adjusted.toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete button for exploration */}
      {!explored && (
        <p className="text-xs text-white/40 italic">
          Interact with the positions and scenarios above to complete this activity.
        </p>
      )}
    </div>
  )
}
