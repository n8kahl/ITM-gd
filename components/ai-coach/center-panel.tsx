'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  CandlestickChart,
  TableProperties,
  Calculator,
  Camera,
  BookOpen,
  Bell,
  Search,
  Clock,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import dynamic from 'next/dynamic'
import type { LevelAnnotation } from './trading-chart'
import { OptionsChain } from './options-chain'
import { PositionForm } from './position-form'
import { ScreenshotUpload } from './screenshot-upload'
import { TradeJournal } from './trade-journal'
import { AlertsPanel } from './alerts-panel'
import { OpportunityScanner } from './opportunity-scanner'
import { LEAPSDashboard } from './leaps-dashboard'
import { MacroContext } from './macro-context'
import { Onboarding, hasCompletedOnboarding } from './onboarding'

const TradingChart = dynamic(
  () => import('./trading-chart').then(mod => ({ default: mod.TradingChart })),
  { ssr: false }
)
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

type CenterView = 'onboarding' | 'welcome' | 'chart' | 'options' | 'position' | 'screenshot' | 'journal' | 'alerts' | 'scanner' | 'leaps' | 'macro'

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

const TABS: { view: CenterView; icon: typeof CandlestickChart; label: string }[] = [
  { view: 'chart', icon: CandlestickChart, label: 'Chart' },
  { view: 'options', icon: TableProperties, label: 'Options' },
  { view: 'position', icon: Calculator, label: 'Analyze' },
  { view: 'journal', icon: BookOpen, label: 'Journal' },
  { view: 'screenshot', icon: Camera, label: 'Screenshot' },
  { view: 'alerts', icon: Bell, label: 'Alerts' },
  { view: 'scanner', icon: Search, label: 'Scanner' },
  { view: 'leaps', icon: Clock, label: 'LEAPS' },
  { view: 'macro', icon: Globe, label: 'Macro' },
]

// Level annotation colors by type
const LEVEL_COLORS: Record<string, string> = {
  PDH: '#ef4444',
  PMH: '#f97316',
  R1: '#ef4444',
  R2: '#dc2626',
  R3: '#b91c1c',
  PDL: '#10B981',
  PML: '#22d3ee',
  S1: '#10B981',
  S2: '#059669',
  S3: '#047857',
  PDC: '#a78bfa',
  PP: '#f3e5ab',
  VWAP: '#eab308',
}

// ============================================
// COMPONENT
// ============================================

export function CenterPanel({ onSendPrompt, chartRequest }: CenterPanelProps) {
  const { session } = useMemberAuth()

  const [activeView, setActiveView] = useState<CenterView>(() => {
    // Show onboarding on first visit
    if (typeof window !== 'undefined' && !hasCompletedOnboarding()) {
      return 'onboarding'
    }
    return 'welcome'
  })

  // Chart state
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

    setActiveView('chart')
    setChartSymbol(chartRequest.symbol)
    setChartTimeframe(chartRequest.timeframe)

    if (chartRequest.levels) {
      setChartLevels(buildLevelAnnotations(chartRequest))
    }

    fetchChartData(chartRequest.symbol, chartRequest.timeframe)
  }, [chartRequest, fetchChartData, buildLevelAnnotations])

  const handleSymbolChange = useCallback((symbol: string) => {
    setChartSymbol(symbol)
    fetchChartData(symbol, chartTimeframe)
  }, [chartTimeframe, fetchChartData])

  const handleTimeframeChange = useCallback((timeframe: ChartTimeframe) => {
    setChartTimeframe(timeframe)
    fetchChartData(chartSymbol, timeframe)
  }, [chartSymbol, fetchChartData])

  const handleShowChart = useCallback(() => {
    setActiveView('chart')
    fetchChartData(chartSymbol, chartTimeframe)
  }, [chartSymbol, chartTimeframe, fetchChartData])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — shown for non-welcome/non-onboarding views */}
      {activeView !== 'welcome' && activeView !== 'onboarding' && (
        <div className="border-b border-white/5 px-2 flex items-center gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.view}
                onClick={() => {
                  setActiveView(tab.view)
                  if (tab.view === 'chart') fetchChartData(chartSymbol, chartTimeframe)
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2',
                  activeView === tab.view
                    ? 'text-emerald-400 border-emerald-500'
                    : 'text-white/40 hover:text-white/60 border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            onClick={() => setActiveView('welcome')}
            className="text-xs text-white/30 hover:text-white/60 px-2 py-2 transition-colors"
          >
            Home
          </button>
        </div>
      )}

      {/* View content */}
      <div className="flex-1 min-h-0">
        {activeView === 'onboarding' && (
          <Onboarding
            onComplete={() => setActiveView('welcome')}
            onSkip={() => setActiveView('welcome')}
            onTryFeature={(feature) => setActiveView(feature as CenterView)}
          />
        )}

        {activeView === 'welcome' && (
          <WelcomeView
            onSendPrompt={onSendPrompt}
            onShowChart={handleShowChart}
            onShowOptions={() => setActiveView('options')}
            onShowPosition={() => setActiveView('position')}
            onShowJournal={() => setActiveView('journal')}
            onShowAlerts={() => setActiveView('alerts')}
            onShowScanner={() => setActiveView('scanner')}
            onShowLeaps={() => setActiveView('leaps')}
            onShowMacro={() => setActiveView('macro')}
          />
        )}

        {activeView === 'chart' && (
          <ChartView
            symbol={chartSymbol}
            timeframe={chartTimeframe}
            bars={chartBars}
            levels={chartLevels}
            isLoading={isLoadingChart}
            error={chartError}
            onSymbolChange={handleSymbolChange}
            onTimeframeChange={handleTimeframeChange}
            onRetry={() => fetchChartData(chartSymbol, chartTimeframe)}
          />
        )}

        {activeView === 'options' && (
          <OptionsChain initialSymbol={chartSymbol} />
        )}

        {activeView === 'position' && (
          <PositionForm onClose={() => setActiveView('welcome')} />
        )}

        {activeView === 'journal' && (
          <TradeJournal onClose={() => setActiveView('welcome')} />
        )}

        {activeView === 'alerts' && (
          <AlertsPanel onClose={() => setActiveView('welcome')} />
        )}

        {activeView === 'scanner' && (
          <OpportunityScanner
            onClose={() => setActiveView('welcome')}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'screenshot' && (
          <ScreenshotUpload onClose={() => setActiveView('welcome')} />
        )}

        {activeView === 'leaps' && (
          <LEAPSDashboard
            onClose={() => setActiveView('welcome')}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'macro' && (
          <MacroContext
            onClose={() => setActiveView('welcome')}
            onSendPrompt={onSendPrompt}
          />
        )}
      </div>
    </div>
  )
}

// ============================================
// CHART VIEW
// ============================================

function ChartView({
  symbol,
  timeframe,
  bars,
  levels,
  isLoading,
  error,
  onSymbolChange,
  onTimeframeChange,
  onRetry,
}: {
  symbol: string
  timeframe: ChartTimeframe
  bars: ChartBar[]
  levels: LevelAnnotation[]
  isLoading: boolean
  error: string | null
  onSymbolChange: (s: string) => void
  onTimeframeChange: (t: ChartTimeframe) => void
  onRetry: () => void
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <CandlestickChart className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-medium text-white">{symbol} Chart</h2>
            {levels.length > 0 && (
              <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                {levels.length} levels
              </span>
            )}
          </div>
        </div>
        <ChartToolbar
          symbol={symbol}
          timeframe={timeframe}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
          isLoading={isLoading}
        />
      </div>

      <div className="flex-1 min-h-0">
        {error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <button onClick={onRetry} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <TradingChart
            bars={bars}
            levels={levels}
            symbol={symbol}
            timeframe={timeframe}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}

// ============================================
// WELCOME VIEW
// ============================================

function WelcomeView({
  onSendPrompt,
  onShowChart,
  onShowOptions,
  onShowPosition,
  onShowJournal,
  onShowAlerts,
  onShowScanner,
  onShowLeaps,
  onShowMacro,
}: {
  onSendPrompt?: (prompt: string) => void
  onShowChart: () => void
  onShowOptions: () => void
  onShowPosition: () => void
  onShowJournal: () => void
  onShowAlerts: () => void
  onShowScanner: () => void
  onShowLeaps: () => void
  onShowMacro: () => void
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white">AI Coach Center</h2>
          <p className="text-xs text-white/40">Charts, options & analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowChart}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
          >
            <CandlestickChart className="w-3.5 h-3.5" />
            Chart
          </button>
          <button
            onClick={onShowOptions}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
          >
            <TableProperties className="w-3.5 h-3.5" />
            Options
          </button>
          <button
            onClick={onShowPosition}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
          >
            <Calculator className="w-3.5 h-3.5" />
            Analyze
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
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

          {/* Quick Access Cards */}
          <div className="grid grid-cols-4 md:grid-cols-4 gap-3 mt-4">
            <button
              onClick={onShowChart}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <CandlestickChart className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Live Chart</p>
              <p className="text-[10px] text-white/30 mt-0.5">SPX &amp; NDX</p>
            </button>
            <button
              onClick={onShowOptions}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <TableProperties className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Options</p>
              <p className="text-[10px] text-white/30 mt-0.5">Greeks &amp; IV</p>
            </button>
            <button
              onClick={onShowPosition}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Calculator className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Analyze</p>
              <p className="text-[10px] text-white/30 mt-0.5">P&amp;L &amp; Risk</p>
            </button>
            <button
              onClick={onShowJournal}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <BookOpen className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Journal</p>
              <p className="text-[10px] text-white/30 mt-0.5">Trade Log</p>
            </button>
            <button
              onClick={onShowAlerts}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Bell className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Alerts</p>
              <p className="text-[10px] text-white/30 mt-0.5">Price Watch</p>
            </button>
            <button
              onClick={onShowScanner}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Search className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Scanner</p>
              <p className="text-[10px] text-white/30 mt-0.5">Find Setups</p>
            </button>
            <button
              onClick={onShowLeaps}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Clock className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">LEAPS</p>
              <p className="text-[10px] text-white/30 mt-0.5">Long-Term</p>
            </button>
            <button
              onClick={onShowMacro}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Globe className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Macro</p>
              <p className="text-[10px] text-white/30 mt-0.5">Econ Data</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
