'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  CandlestickChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { TradingChart, type LevelAnnotation } from './trading-chart'
import { ChartToolbar } from './chart-toolbar'
import {
  getChartData,
  AICoachAPIError,
  type ChartTimeframe,
  type ChartBar,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

export interface ChartRequest {
  symbol: string
  timeframe: ChartTimeframe
  levels?: {
    resistance?: Array<{ name: string; price: number; distance?: string }>
    support?: Array<{ name: string; price: number; distance?: string }>
    indicators?: {
      vwap?: number
      atr14?: number
    }
  }
}

interface CenterPanelProps {
  onSendPrompt?: (prompt: string) => void
  chartRequest?: ChartRequest | null
}

// ============================================
// CONSTANTS
// ============================================

const EXAMPLE_PROMPTS = [
  {
    icon: Target,
    label: 'Key Levels',
    prompt: "Where's PDH for SPX today?",
    description: 'Get pivot points, support & resistance',
  },
  {
    icon: TrendingUp,
    label: 'Market Status',
    prompt: "What's the current market status?",
    description: 'Check if market is open, pre-market, or closed',
  },
  {
    icon: BarChart3,
    label: 'ATR Analysis',
    prompt: "What's the ATR for SPX and NDX?",
    description: 'Volatility measurement for position sizing',
  },
  {
    icon: Zap,
    label: 'VWAP Check',
    prompt: "Where is VWAP for SPX right now?",
    description: 'Volume-weighted average price for intraday reference',
  },
]

// Level annotation colors by type
const LEVEL_COLORS: Record<string, string> = {
  PDH: '#ef4444',   // red — resistance
  PMH: '#f97316',   // orange — resistance
  R1: '#ef4444',
  R2: '#dc2626',
  R3: '#b91c1c',
  PDL: '#10B981',   // emerald — support
  PML: '#22d3ee',   // cyan — support
  S1: '#10B981',
  S2: '#059669',
  S3: '#047857',
  PDC: '#a78bfa',   // purple — close
  PP: '#f3e5ab',    // champagne — pivot
  VWAP: '#eab308',  // yellow — indicator
}

// ============================================
// COMPONENT
// ============================================

export function CenterPanel({ onSendPrompt, chartRequest }: CenterPanelProps) {
  const { session } = useMemberAuth()

  // Chart state
  const [showChart, setShowChart] = useState(false)
  const [chartSymbol, setChartSymbol] = useState('SPX')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1D')
  const [chartBars, setChartBars] = useState<ChartBar[]>([])
  const [chartLevels, setChartLevels] = useState<LevelAnnotation[]>([])
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  // Fetch chart data
  const fetchChartData = useCallback(async (symbol: string, timeframe: ChartTimeframe) => {
    const token = session?.access_token
    if (!token) return

    setIsLoadingChart(true)
    setChartError(null)

    try {
      const data = await getChartData(symbol, timeframe, token)
      setChartBars(data.bars)
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to load chart data'
      setChartError(message)
      setChartBars([])
    } finally {
      setIsLoadingChart(false)
    }
  }, [session?.access_token])

  // Build level annotations from chart request
  const buildLevelAnnotations = useCallback((request: ChartRequest): LevelAnnotation[] => {
    const annotations: LevelAnnotation[] = []

    if (request.levels?.resistance) {
      for (const level of request.levels.resistance) {
        annotations.push({
          price: level.price,
          label: level.name,
          color: LEVEL_COLORS[level.name] || '#ef4444',
          lineWidth: 1,
          lineStyle: 'dashed',
        })
      }
    }

    if (request.levels?.support) {
      for (const level of request.levels.support) {
        annotations.push({
          price: level.price,
          label: level.name,
          color: LEVEL_COLORS[level.name] || '#10B981',
          lineWidth: 1,
          lineStyle: 'dashed',
        })
      }
    }

    if (request.levels?.indicators?.vwap) {
      annotations.push({
        price: request.levels.indicators.vwap,
        label: 'VWAP',
        color: LEVEL_COLORS.VWAP,
        lineWidth: 2,
        lineStyle: 'solid',
      })
    }

    return annotations
  }, [])

  // Handle chart request from AI
  useEffect(() => {
    if (!chartRequest) return

    setShowChart(true)
    setChartSymbol(chartRequest.symbol)
    setChartTimeframe(chartRequest.timeframe)

    // Build annotations from levels
    if (chartRequest.levels) {
      setChartLevels(buildLevelAnnotations(chartRequest))
    }

    // Fetch chart data
    fetchChartData(chartRequest.symbol, chartRequest.timeframe)
  }, [chartRequest, fetchChartData, buildLevelAnnotations])

  // Refetch when symbol or timeframe changes manually
  const handleSymbolChange = useCallback((symbol: string) => {
    setChartSymbol(symbol)
    fetchChartData(symbol, chartTimeframe)
  }, [chartTimeframe, fetchChartData])

  const handleTimeframeChange = useCallback((timeframe: ChartTimeframe) => {
    setChartTimeframe(timeframe)
    fetchChartData(chartSymbol, timeframe)
  }, [chartSymbol, fetchChartData])

  // Handle example prompt click — open chart view
  const handleShowChart = useCallback(() => {
    setShowChart(true)
    fetchChartData(chartSymbol, chartTimeframe)
  }, [chartSymbol, chartTimeframe, fetchChartData])

  // ============================================
  // RENDER: Chart View
  // ============================================

  if (showChart) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with toolbar */}
        <div className="border-b border-white/5">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <CandlestickChart className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-medium text-white">{chartSymbol} Chart</h2>
              {chartLevels.length > 0 && (
                <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                  {chartLevels.length} levels
                </span>
              )}
            </div>
            <button
              onClick={() => setShowChart(false)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Back
            </button>
          </div>
          <ChartToolbar
            symbol={chartSymbol}
            timeframe={chartTimeframe}
            onSymbolChange={handleSymbolChange}
            onTimeframeChange={handleTimeframeChange}
            isLoading={isLoadingChart}
          />
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          {chartError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-red-400 mb-2">{chartError}</p>
                <button
                  onClick={() => fetchChartData(chartSymbol, chartTimeframe)}
                  className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <TradingChart
              bars={chartBars}
              levels={chartLevels}
              symbol={chartSymbol}
              timeframe={chartTimeframe}
              isLoading={isLoadingChart}
            />
          )}
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: Welcome View
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white">AI Coach Center</h2>
          <p className="text-xs text-white/40">Charts, analytics & insights</p>
        </div>
        <button
          onClick={handleShowChart}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
        >
          <CandlestickChart className="w-3.5 h-3.5" />
          Open Chart
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {/* Welcome */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Welcome to AI Coach
            </h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Your AI-powered trading assistant. Ask about key levels, market conditions,
              options data, and more. Try one of the examples below to get started.
            </p>
          </div>

          {/* Example Prompts */}
          <div className="grid gap-3">
            {EXAMPLE_PROMPTS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => onSendPrompt?.(item.prompt)}
                  className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          {item.label}
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-white/40 mb-1.5">{item.description}</p>
                      <p className="text-xs text-emerald-500/70 italic">
                        &ldquo;{item.prompt}&rdquo;
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Chart Preview Card */}
          <button
            onClick={handleShowChart}
            className="w-full mt-4 group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CandlestickChart className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    Live Chart
                  </span>
                  <ArrowRight className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-white/40 mb-1.5">
                  Interactive candlestick chart with key level annotations
                </p>
                <p className="text-xs text-emerald-500/70 italic">
                  SPX &amp; NDX with PDH, PMH, pivots, VWAP overlays
                </p>
              </div>
            </div>
          </button>

          {/* Upcoming Features Teaser */}
          <div className="mt-8 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
              Coming Soon
            </h4>
            <div className="space-y-2">
              {[
                'Options chain visualization',
                'Position P&L dashboard',
                'Trade journal integration',
                'Real-time price alerts',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs text-white/30">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/30" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
