'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Calendar,
  Sunrise,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useAICoachWorkflow } from '@/contexts/AICoachWorkflowContext'
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
import { EarningsDashboard } from './earnings-dashboard'
import { Onboarding, hasCompletedOnboarding } from './onboarding'
import { MorningBriefPanel } from './morning-brief'
import { TrackedSetupsPanel } from './tracked-setups-panel'
import { WidgetContextMenu } from './widget-context-menu'
import {
  alertAction,
  chartAction,
  chatAction,
  optionsAction,
  type WidgetAction,
} from './widget-actions'

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
  gexProfile?: {
    symbol?: string
    spotPrice?: number
    flipPoint?: number | null
    maxGEXStrike?: number | null
    keyLevels?: Array<{ strike: number; gexValue: number; type: 'support' | 'resistance' | 'magnet' }>
  }
}

type CenterView =
  | 'onboarding'
  | 'welcome'
  | 'chart'
  | 'options'
  | 'position'
  | 'screenshot'
  | 'journal'
  | 'alerts'
  | 'brief'
  | 'scanner'
  | 'tracked'
  | 'leaps'
  | 'earnings'
  | 'macro'

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
  { view: 'brief', icon: Sunrise, label: 'Brief' },
  { view: 'scanner', icon: Search, label: 'Scanner' },
  { view: 'tracked', icon: ListChecks, label: 'Tracked' },
  { view: 'leaps', icon: Clock, label: 'LEAPS' },
  { view: 'earnings', icon: Calendar, label: 'Earnings' },
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
  GEX_FLIP: '#facc15',
  GEX_MAX: '#a855f7',
  GEX_SUPPORT: '#22c55e',
  GEX_RESISTANCE: '#f97316',
  GEX_MAGNET: '#a855f7',
}

// ============================================
// COMPONENT
// ============================================

export function CenterPanel({ onSendPrompt, chartRequest }: CenterPanelProps) {
  const { session } = useMemberAuth()
  const {
    activeCenterView,
    activeSymbol,
    workflowPath,
    setCenterView,
    setSymbol,
    goToWorkflowStep,
    clearWorkflowPath,
  } = useAICoachWorkflow()

  const [activeView, setActiveView] = useState<CenterView>('welcome')

  // Check onboarding status after mount (localStorage not available during SSR)
  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setActiveView('onboarding')
    }
  }, [])

  // Chart state
  const [chartSymbol, setChartSymbol] = useState('SPX')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1D')
  const [chartBars, setChartBars] = useState<ChartBar[]>([])
  const [chartLevels, setChartLevels] = useState<LevelAnnotation[]>([])
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  useEffect(() => {
    if (activeCenterView && activeCenterView !== activeView) {
      setActiveView(activeCenterView as CenterView)
    }
  }, [activeCenterView, activeView])

  useEffect(() => {
    if (activeSymbol && activeSymbol !== chartSymbol) {
      setChartSymbol(activeSymbol)
    }
  }, [activeSymbol, chartSymbol])

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

  const buildGEXAnnotations = useCallback((request: ChartRequest): LevelAnnotation[] => {
    if (!request.gexProfile) return []

    const annotations: LevelAnnotation[] = []
    const seenPrices = new Set<number>()
    const addLine = (annotation: LevelAnnotation) => {
      const rounded = Number(annotation.price.toFixed(2))
      if (seenPrices.has(rounded)) return
      seenPrices.add(rounded)
      annotations.push(annotation)
    }

    if (request.gexProfile.flipPoint != null) {
      addLine({
        price: request.gexProfile.flipPoint,
        label: 'GEX Flip',
        color: LEVEL_COLORS.GEX_FLIP,
        lineWidth: 3,
        lineStyle: 'dashed',
      })
    }

    if (request.gexProfile.maxGEXStrike != null) {
      addLine({
        price: request.gexProfile.maxGEXStrike,
        label: 'Max GEX',
        color: LEVEL_COLORS.GEX_MAX,
        lineWidth: 3,
        lineStyle: 'solid',
      })
    }

    for (const level of request.gexProfile.keyLevels || []) {
      addLine({
        price: level.strike,
        label: `GEX ${level.type === 'magnet' ? 'Magnet' : level.type === 'support' ? 'Support' : 'Resistance'}`,
        color: level.type === 'support'
          ? LEVEL_COLORS.GEX_SUPPORT
          : level.type === 'resistance'
          ? LEVEL_COLORS.GEX_RESISTANCE
          : LEVEL_COLORS.GEX_MAGNET,
        lineWidth: level.type === 'magnet' ? 2 : 1,
        lineStyle: level.type === 'magnet' ? 'solid' : 'dotted',
      })
    }

    return annotations
  }, [])

  // Handle chart request from AI
  useEffect(() => {
    if (!chartRequest) return

    setActiveView('chart')
    setCenterView('chart')
    setChartSymbol(chartRequest.symbol)
    setSymbol(chartRequest.symbol)
    setChartTimeframe(chartRequest.timeframe)

    const levelAnnotations = buildLevelAnnotations(chartRequest)
    const gexAnnotations = buildGEXAnnotations(chartRequest)
    setChartLevels([...levelAnnotations, ...gexAnnotations])

    fetchChartData(chartRequest.symbol, chartRequest.timeframe)
  }, [chartRequest, fetchChartData, buildLevelAnnotations, buildGEXAnnotations, setCenterView, setSymbol])

  useEffect(() => {
    const handleChartEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ChartRequest>
      const request = customEvent.detail
      if (!request?.symbol || !request?.timeframe) return

      setActiveView('chart')
      setCenterView('chart')
      setChartSymbol(request.symbol)
      setSymbol(request.symbol)
      setChartTimeframe(request.timeframe)

      const levelAnnotations = buildLevelAnnotations(request)
      const gexAnnotations = buildGEXAnnotations(request)
      setChartLevels([...levelAnnotations, ...gexAnnotations])

      fetchChartData(request.symbol, request.timeframe)
    }

    window.addEventListener('ai-coach-show-chart', handleChartEvent)
    return () => window.removeEventListener('ai-coach-show-chart', handleChartEvent)
  }, [buildLevelAnnotations, buildGEXAnnotations, fetchChartData, setCenterView, setSymbol])

  const handleSymbolChange = useCallback((symbol: string) => {
    setChartSymbol(symbol)
    setSymbol(symbol)
    setChartLevels([])
    fetchChartData(symbol, chartTimeframe)
  }, [chartTimeframe, fetchChartData, setSymbol])

  const handleTimeframeChange = useCallback((timeframe: ChartTimeframe) => {
    setChartTimeframe(timeframe)
    fetchChartData(chartSymbol, timeframe)
  }, [chartSymbol, fetchChartData])

  const handleShowChart = useCallback(() => {
    setActiveView('chart')
    setCenterView('chart')
    fetchChartData(chartSymbol, chartTimeframe)
  }, [chartSymbol, chartTimeframe, fetchChartData, setCenterView])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {workflowPath.length > 0 && activeView !== 'onboarding' && (
        <div className="border-b border-white/5 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {workflowPath.map((step, index) => (
            <button
              key={step.id}
              onClick={() => goToWorkflowStep(index)}
              className={cn(
                'text-[10px] px-2 py-1 rounded border whitespace-nowrap transition-colors',
                index === workflowPath.length - 1
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-white/45 hover:text-white/65'
              )}
            >
              {step.label}
            </button>
          ))}
          <button
            onClick={clearWorkflowPath}
            className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-white/35 hover:text-white/60 transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      )}

      {/* Tab bar — shown for non-welcome/non-onboarding views */}
      {activeView !== 'welcome' && activeView !== 'onboarding' && (
        <div className="border-b border-white/5 flex items-center">
          <div className="flex-1 overflow-x-auto scrollbar-hide px-2">
            <div className="flex items-center gap-1 min-w-max">
              {TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.view}
                    onClick={() => {
                      setActiveView(tab.view)
                      setCenterView(tab.view as Parameters<typeof setCenterView>[0])
                      if (tab.view === 'chart') fetchChartData(chartSymbol, chartTimeframe)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap min-h-[44px]',
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
            </div>
          </div>
          <button
            onClick={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            className="text-xs text-white/30 hover:text-white/60 px-3 py-2 transition-colors shrink-0 border-b-2 border-transparent min-h-[44px]"
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
            onShowOptions={() => {
              setActiveView('options')
              setCenterView('options')
            }}
            onShowPosition={() => {
              setActiveView('position')
              setCenterView('position')
            }}
            onShowJournal={() => {
              setActiveView('journal')
              setCenterView('journal')
            }}
            onShowAlerts={() => {
              setActiveView('alerts')
              setCenterView('alerts')
            }}
            onShowBrief={() => {
              setActiveView('brief')
              setCenterView('brief')
            }}
            onShowScanner={() => {
              setActiveView('scanner')
              setCenterView('scanner')
            }}
            onShowTracked={() => {
              setActiveView('tracked')
              setCenterView('tracked')
            }}
            onShowLeaps={() => {
              setActiveView('leaps')
              setCenterView('leaps')
            }}
            onShowEarnings={() => {
              setActiveView('earnings')
              setCenterView('earnings')
            }}
            onShowMacro={() => {
              setActiveView('macro')
              setCenterView('macro')
            }}
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
          <PositionForm onClose={() => {
            setActiveView('welcome')
            setCenterView(null)
          }} />
        )}

        {activeView === 'journal' && (
          <TradeJournal onClose={() => {
            setActiveView('welcome')
            setCenterView(null)
          }} />
        )}

        {activeView === 'alerts' && (
          <AlertsPanel onClose={() => {
            setActiveView('welcome')
            setCenterView(null)
          }} />
        )}

        {activeView === 'brief' && (
          <MorningBriefPanel
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'scanner' && (
          <OpportunityScanner
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'tracked' && (
          <TrackedSetupsPanel
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'screenshot' && (
          <ScreenshotUpload onClose={() => {
            setActiveView('welcome')
            setCenterView(null)
          }} />
        )}

        {activeView === 'leaps' && (
          <LEAPSDashboard
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'earnings' && (
          <EarningsDashboard
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            onSendPrompt={onSendPrompt}
          />
        )}

        {activeView === 'macro' && (
          <MacroContext
            onClose={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
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
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)
  const roundedHoverPrice = useMemo(() => {
    if (hoveredPrice == null || !Number.isFinite(hoveredPrice)) return null
    return Number(hoveredPrice.toFixed(2))
  }, [hoveredPrice])

  const chartContextActions = useMemo<WidgetAction[]>(() => {
    const actions: WidgetAction[] = [
      chartAction(symbol, roundedHoverPrice ?? undefined, timeframe, 'Chart Focus'),
      chatAction(`Analyze ${symbol} ${timeframe} chart and define key levels plus trade scenarios.`),
    ]

    if (roundedHoverPrice != null) {
      actions.splice(1, 0,
        optionsAction(symbol, roundedHoverPrice),
        alertAction(symbol, roundedHoverPrice, 'level_approach', `${symbol} ${timeframe} chart level`),
      )
    }

    return actions
  }, [roundedHoverPrice, symbol, timeframe])

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
          <WidgetContextMenu actions={chartContextActions}>
            <div className="relative h-full">
              <TradingChart
                bars={bars}
                levels={levels}
                symbol={symbol}
                timeframe={timeframe}
                isLoading={isLoading}
                onHoverPrice={setHoveredPrice}
              />
              <div className="pointer-events-none absolute right-3 top-3 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/55 backdrop-blur">
                Right-click chart for actions{roundedHoverPrice != null ? ` @ ${roundedHoverPrice.toFixed(2)}` : ''}
              </div>
            </div>
          </WidgetContextMenu>
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
  onShowBrief,
  onShowScanner,
  onShowTracked,
  onShowLeaps,
  onShowEarnings,
  onShowMacro,
}: {
  onSendPrompt?: (prompt: string) => void
  onShowChart: () => void
  onShowOptions: () => void
  onShowPosition: () => void
  onShowJournal: () => void
  onShowAlerts: () => void
  onShowBrief: () => void
  onShowScanner: () => void
  onShowTracked: () => void
  onShowLeaps: () => void
  onShowEarnings: () => void
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
          <button
            onClick={onShowBrief}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
          >
            <Sunrise className="w-3.5 h-3.5" />
            Brief
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
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
              onClick={onShowBrief}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Sunrise className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Brief</p>
              <p className="text-[10px] text-white/30 mt-0.5">Pre-Market</p>
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
              onClick={onShowTracked}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <ListChecks className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Tracked</p>
              <p className="text-[10px] text-white/30 mt-0.5">Manage Setups</p>
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
              onClick={onShowEarnings}
              className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
            >
              <Calendar className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-white">Earnings</p>
              <p className="text-[10px] text-white/30 mt-0.5">Event Vol</p>
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
