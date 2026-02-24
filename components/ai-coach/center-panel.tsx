'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  BarChart3,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Home,
  Grid3X3,
  CandlestickChart,
  TableProperties,
  Calculator,
  BookOpen,
  Bell,
  Search,
  Clock,
  Globe,
  Calendar,
  Sunrise,
  Shield,
  ListChecks,
  Settings,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  List,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useAICoachWorkflow } from '@/contexts/AICoachWorkflowContext'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import type { LevelAnnotation, PositionOverlay } from './trading-chart'
import { usePriceStream } from '@/hooks/use-price-stream'
import { OptionsChain } from './options-chain'
// TradeJournal removed — journal is now accessed via /members/journal or slide-over
import { Onboarding, hasCompletedOnboarding } from './onboarding'
import { WidgetContextMenu } from './widget-context-menu'
import { PreferencesPanel } from './preferences-panel'
import { ViewTransition } from './view-transition'
import { ChartSkeleton } from './skeleton-loaders'
import { DesktopContextStrip } from './desktop-context-strip'
import { clearHoverTarget, emitHoverTarget } from '@/hooks/use-hover-coordination'
import {
  chartAction,
  chatAction,
  optionsAction,
  type WidgetAction,
} from './widget-actions'
import { ChartLevelLabels } from './chart-level-labels'
import {
  countLevelsByGroup,
  filterLevelsByVisibility,
  type LevelVisibilityConfig,
} from './chart-level-groups'

const TradingChart = dynamic(
  () => import('./trading-chart').then(mod => ({ default: mod.TradingChart })),
  { ssr: false }
)
import { ChartToolbar } from './chart-toolbar'
import {
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfig,
} from './chart-indicators'
import {
  DEFAULT_AI_COACH_PREFERENCES,
  loadAICoachPreferences,
  saveAICoachPreferences,
  type AICoachPreferences,
} from './preferences'
import {
  getChartData,
  getKeyLevels,
  AICoachAPIError,
  type ChartTimeframe,
  type ChartBar,
  type KeyLevelsTimeframe,
  type ChartProviderIndicators,
} from '@/lib/api/ai-coach'
import { mergeRealtimePriceIntoBars } from './chart-realtime'
import { InfoTip } from '@/components/ui/info-tip'
import { setActiveChartSymbol } from '@/lib/ai-coach-chart-context'

// ============================================
// TYPES
// ============================================

export interface ChartRequest {
  symbol: string
  timeframe: ChartTimeframe
  levels?: {
    resistance?: Array<{
      name?: string
      type?: string
      price: number
      distance?: string | number
      distancePct?: number
      distanceATR?: number
      displayLabel?: string
      displayContext?: string
      side?: 'resistance' | 'support'
      strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
      testsToday?: number
      lastTest?: string | null
      holdRate?: number | null
    }>
    support?: Array<{
      name?: string
      type?: string
      price: number
      distance?: string | number
      distancePct?: number
      distanceATR?: number
      displayLabel?: string
      displayContext?: string
      side?: 'resistance' | 'support'
      strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
      testsToday?: number
      lastTest?: string | null
      holdRate?: number | null
    }>
    fibonacci?: Array<{
      name: string
      price: number
      isMajor?: boolean
    }>
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
  contextNotes?: string[]
  positionOverlays?: Array<{
    id?: string
    label?: string
    entry: number
    stop?: number
    target?: number
    targets?: number[]
  }>
  eventMarkers?: Array<{
    label: string
    date?: string
    impact?: 'high' | 'medium' | 'low' | 'info'
    source?: string
  }>
}

const SUPPORTED_CHART_TIMEFRAMES = new Set<ChartTimeframe>(['1m', '5m', '15m', '1h', '4h', '1D'])
const MAX_CONTEXT_NOTES = 6
const MAX_EVENT_MARKERS = 6
const MAX_POSITION_OVERLAYS = 4

function normalizeChartEventImpact(value: unknown): 'high' | 'medium' | 'low' | 'info' {
  if (typeof value !== 'string') return 'info'
  const lowered = value.trim().toLowerCase()
  if (lowered === 'high' || lowered === 'medium' || lowered === 'low' || lowered === 'info') return lowered
  if (lowered.includes('high')) return 'high'
  if (lowered.includes('med')) return 'medium'
  if (lowered.includes('low')) return 'low'
  return 'info'
}

function toSheetChartRequest(value: unknown): ChartRequest | null {
  if (!value || typeof value !== 'object') return null
  const maybe = value as Partial<ChartRequest>
  if (typeof maybe.symbol !== 'string') return null
  if (typeof maybe.timeframe !== 'string' || !SUPPORTED_CHART_TIMEFRAMES.has(maybe.timeframe as ChartTimeframe)) {
    return null
  }

  return {
    symbol: maybe.symbol,
    timeframe: maybe.timeframe as ChartTimeframe,
    levels: maybe.levels,
    gexProfile: maybe.gexProfile,
    contextNotes: Array.isArray(maybe.contextNotes)
      ? maybe.contextNotes.filter((note): note is string => typeof note === 'string').slice(0, MAX_CONTEXT_NOTES)
      : undefined,
    positionOverlays: Array.isArray(maybe.positionOverlays)
      ? maybe.positionOverlays
        .filter((overlay): overlay is NonNullable<ChartRequest['positionOverlays']>[number] => (
          Boolean(overlay)
          && typeof overlay === 'object'
          && typeof (overlay as { entry?: unknown }).entry === 'number'
          && Number.isFinite((overlay as { entry?: number }).entry)
        ))
        .map((overlay) => ({
          id: typeof overlay.id === 'string' ? overlay.id : undefined,
          label: typeof overlay.label === 'string' ? overlay.label : undefined,
          entry: Number(overlay.entry),
          stop: typeof overlay.stop === 'number' && Number.isFinite(overlay.stop) ? overlay.stop : undefined,
          target: typeof overlay.target === 'number' && Number.isFinite(overlay.target) ? overlay.target : undefined,
          targets: Array.isArray(overlay.targets)
            ? overlay.targets
              .filter((target): target is number => typeof target === 'number' && Number.isFinite(target))
              .slice(0, 4)
            : undefined,
        }))
        .slice(0, MAX_POSITION_OVERLAYS)
      : undefined,
    eventMarkers: Array.isArray(maybe.eventMarkers)
      ? maybe.eventMarkers
        .filter((marker): marker is NonNullable<ChartRequest['eventMarkers']>[number] => (
          Boolean(marker)
          && typeof marker === 'object'
          && typeof (marker as { label?: unknown }).label === 'string'
        ))
        .map((marker) => ({
          label: marker.label,
          date: typeof marker.date === 'string' ? marker.date : undefined,
          impact: normalizeChartEventImpact(marker.impact),
          source: typeof marker.source === 'string' ? marker.source : undefined,
        }))
        .slice(0, MAX_EVENT_MARKERS)
      : undefined,
  }
}

export type CenterView =
  | 'onboarding'
  | 'welcome'
  | 'chart'
  | 'options'
  | 'preferences'

interface CenterPanelProps {
  onSendPrompt?: (prompt: string) => void
  chartRequest?: ChartRequest | null
  forcedView?: CenterView
  sheetParams?: Record<string, unknown>
  sheetSymbol?: string | null
}

// ============================================
// CONSTANTS
// ============================================

const EXAMPLE_PROMPTS = [
  {
    icon: Target,
    label: 'Start Here (Beginner)',
    prompt: 'I am a newer trader. Show SPY on the chart and explain the most important support/resistance levels in plain language.',
    description: 'Plain-English chart read with key levels and risk context',
  },
  {
    icon: Sunrise,
    label: 'Simple Morning Brief',
    prompt: 'Give me this morning brief in plain language: overnight gaps, key levels, and what to watch first.',
    description: 'Beginner-friendly pre-market overview and catalysts',
  },
  {
    icon: Shield,
    label: 'Risk Checklist',
    prompt: 'Build a beginner risk checklist for today: position size, max daily loss, invalidation, and when to stand down.',
    description: 'Practical guardrails before taking any trade',
  },
  {
    icon: Activity,
    label: 'Advanced SPX Game Plan',
    prompt: 'Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart.',
    description: 'Full institutional-style SPX analysis',
  },
]

const TABS: Array<{
  view: CenterView
  icon: typeof CandlestickChart
  label: string
  group: 'analyze'
}> = [
  { view: 'chart', icon: CandlestickChart, label: 'Chart', group: 'analyze' },
  { view: 'options', icon: TableProperties, label: 'Options', group: 'analyze' },
]

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

const TAB_GROUP_LABELS: Record<'analyze', string> = {
  analyze: 'Analyze',
}

const ROUTABLE_VIEWS = new Set<CenterView>([
  'chart',
  'options',
])

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

const PIVOT_LEVEL_KEY_REGEX = /\b(PDH|PDL|PDC|PWH|PWL|PWC|PIVOT|R1|R2|R3|S1|S2|S3|PP)\b/

function chartTimeframeToLevelsTimeframe(timeframe: ChartTimeframe): KeyLevelsTimeframe {
  if (timeframe === '4h' || timeframe === '1D') return 'daily'
  return 'intraday'
}

function mergeLevelAnnotations(primary: LevelAnnotation[], secondary: LevelAnnotation[]): LevelAnnotation[] {
  const merged: LevelAnnotation[] = []
  const seen = new Set<string>()

  const append = (items: LevelAnnotation[]) => {
    for (const level of items) {
      const price = Number.isFinite(level.price) ? level.price : 0
      const key = `${level.group || 'other'}|${(level.label || '').toLowerCase()}|${price.toFixed(2)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(level)
    }
  }

  append(primary)
  append(secondary)
  return merged
}

function buildFallbackKeyLevelAnnotations(args: {
  resistance: Array<{
    type?: string
    displayLabel?: string
    displayContext?: string
    price: number
    strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
    testsToday?: number
    lastTest?: string | null
    holdRate?: number | null
  }>
  support: Array<{
    type?: string
    displayLabel?: string
    displayContext?: string
    price: number
    strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
    testsToday?: number
    lastTest?: string | null
    holdRate?: number | null
  }>
  indicators?: {
    vwap?: number | null
  }
}): LevelAnnotation[] {
  const annotations: LevelAnnotation[] = []

  for (const level of args.resistance) {
    const label = level.displayLabel || level.type || 'Resistance'
    const levelKey = (level.type || '').toUpperCase()
    const group = PIVOT_LEVEL_KEY_REGEX.test(levelKey) ? 'pivot' : 'supportResistance'
    annotations.push({
      price: level.price,
      label,
      color: LEVEL_COLORS[levelKey] || '#ef4444',
      lineWidth: 1,
      lineStyle: 'dashed',
      type: level.type || 'Resistance',
      side: 'resistance',
      strength: level.strength,
      description: `${level.type || 'Resistance'} level`,
      testsToday: level.testsToday,
      lastTest: level.lastTest,
      holdRate: level.holdRate,
      displayContext: level.displayContext,
      group,
    })
  }

  for (const level of args.support) {
    const label = level.displayLabel || level.type || 'Support'
    const levelKey = (level.type || '').toUpperCase()
    const group = PIVOT_LEVEL_KEY_REGEX.test(levelKey) ? 'pivot' : 'supportResistance'
    annotations.push({
      price: level.price,
      label,
      color: LEVEL_COLORS[levelKey] || '#10B981',
      lineWidth: 1,
      lineStyle: 'dashed',
      type: level.type || 'Support',
      side: 'support',
      strength: level.strength,
      description: `${level.type || 'Support'} level`,
      testsToday: level.testsToday,
      lastTest: level.lastTest,
      holdRate: level.holdRate,
      displayContext: level.displayContext,
      group,
    })
  }

  if (typeof args.indicators?.vwap === 'number' && Number.isFinite(args.indicators.vwap)) {
    annotations.push({
      price: args.indicators.vwap,
      label: 'VWAP',
      color: LEVEL_COLORS.VWAP,
      lineWidth: 2,
      lineStyle: 'solid',
      group: 'vwap',
    })
  }

  return annotations
}

type WelcomeMarketStatus = {
  label: 'Pre-Market' | 'Open' | 'After Hours' | 'Closed'
  toneClass: string
}

function getEasternTimeParts(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  return { hour, minute, weekday }
}

function getWelcomeMarketStatus(now: Date = new Date()): WelcomeMarketStatus {
  const { hour, minute, weekday } = getEasternTimeParts(now)
  const minutes = hour * 60 + minute
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'

  if (isWeekend) {
    return { label: 'Closed', toneClass: 'bg-white/10 text-white/60 border-white/20' }
  }
  if (minutes >= 570 && minutes < 960) {
    return { label: 'Open', toneClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
  }
  if (minutes >= 240 && minutes < 570) {
    return { label: 'Pre-Market', toneClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
  }
  if (minutes >= 960 && minutes < 1200) {
    return { label: 'After Hours', toneClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30' }
  }
  return { label: 'Closed', toneClass: 'bg-white/10 text-white/60 border-white/20' }
}

function getWelcomeGreeting(displayName?: string, now: Date = new Date()): string {
  const { hour } = getEasternTimeParts(now)
  const firstName = displayName?.trim().split(/\s+/)[0]
  const baseGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return firstName ? `${baseGreeting}, ${firstName}` : baseGreeting
}

// ============================================
// COMPONENT
// ============================================

export function CenterPanel({ onSendPrompt, chartRequest, forcedView, sheetParams, sheetSymbol }: CenterPanelProps) {
  const searchParams = useSearchParams()
  const { session } = useMemberAuth()
  const {
    activeCenterView,
    activeSymbol,
    setCenterView,
    setSymbol,
  } = useAICoachWorkflow()
  const accessToken = session?.access_token || null

  const [activeView, setActiveView] = useState<CenterView>('chart')
  const hasAppliedRouteViewRef = useRef(false)
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)
  const [pendingInitialChartLoad, setPendingInitialChartLoad] = useState<{
    symbol: string
    timeframe: ChartTimeframe
  } | null>(null)
  const tabRailRef = useRef<HTMLDivElement | null>(null)
  const [canScrollTabLeft, setCanScrollTabLeft] = useState(false)
  const [canScrollTabRight, setCanScrollTabRight] = useState(false)
  const isSheetMode = Boolean(forcedView)

  useEffect(() => {
    const handleResize = () => setIsDesktopViewport(window.innerWidth >= 1024)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (hasAppliedRouteViewRef.current) return

    const requestedView = searchParams.get('view')?.toLowerCase() ?? null

    const nextView = ROUTABLE_VIEWS.has(requestedView as CenterView)
      ? requestedView as CenterView
      : null

    if (nextView) {
      setActiveView(nextView)
      setCenterView(nextView as Parameters<typeof setCenterView>[0])
    }

    hasAppliedRouteViewRef.current = true
  }, [searchParams, setCenterView])

  // Chart state
  const [chartSymbol, setChartSymbol] = useState('SPX')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5m')
  const [chartBars, setChartBars] = useState<ChartBar[]>([])
  const [chartLevels, setChartLevels] = useState<LevelAnnotation[]>([])
  const [chartContextNotes, setChartContextNotes] = useState<string[]>([])
  const [chartPositionOverlays, setChartPositionOverlays] = useState<PositionOverlay[]>([])
  const [chartEventMarkers, setChartEventMarkers] = useState<Array<{
    label: string
    date?: string
    impact: 'high' | 'medium' | 'low' | 'info'
    source?: string
  }>>([])
  const [chartProviderIndicators, setChartProviderIndicators] = useState<ChartProviderIndicators | null>(null)
  const [chartIndicatorConfig, setChartIndicatorConfig] = useState<IndicatorConfig>(DEFAULT_INDICATOR_CONFIG)
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)
  const [highlightedLevel, setHighlightedLevel] = useState<{ value: string; price?: number } | null>(null)
  const [pendingChartSyncSymbol, setPendingChartSyncSymbol] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<AICoachPreferences>(DEFAULT_AI_COACH_PREFERENCES)
  const chartRealtimeTickKeyRef = useRef<string | null>(null)
  const chartRealtimeEnabled = Boolean(accessToken && activeView === 'chart')
  const chartStream = usePriceStream([chartSymbol], chartRealtimeEnabled, accessToken)
  const chartLivePriceUpdate = useMemo(
    () => chartStream.prices.get(chartSymbol.toUpperCase()) || null,
    [chartStream.prices, chartSymbol],
  )

  useEffect(() => {
    setActiveChartSymbol(chartSymbol)
  }, [chartSymbol])

  useEffect(() => {
    chartRealtimeTickKeyRef.current = null
  }, [chartSymbol, chartTimeframe])

  useEffect(() => {
    if (!chartRealtimeEnabled || !chartLivePriceUpdate) return

    const tickKey = `${chartSymbol}|${chartLivePriceUpdate.timestamp}|${chartLivePriceUpdate.price}`
    if (chartRealtimeTickKeyRef.current === tickKey) return
    chartRealtimeTickKeyRef.current = tickKey

    setChartBars((prev) => {
      const result = mergeRealtimePriceIntoBars(
        prev,
        chartTimeframe,
        chartLivePriceUpdate.price,
        chartLivePriceUpdate.timestamp,
      )
      return result.bars
    })

    // Provider indicators are historical snapshots. Once realtime ticks are applied,
    // switch to locally computed indicators so overlays stay in sync with the live candle.
    if (chartProviderIndicators) {
      setChartProviderIndicators(null)
    }
  }, [
    chartLivePriceUpdate,
    chartProviderIndicators,
    chartRealtimeEnabled,
    chartSymbol,
    chartTimeframe,
  ])

  useEffect(() => {
    if (forcedView) return
    if (activeCenterView === 'preferences') {
      setIsPreferencesOpen(true)
      setCenterView(null)
      return
    }
    if (activeCenterView && activeCenterView !== activeView) {
      setActiveView(activeCenterView as CenterView)
      window.requestAnimationFrame(() => {
        const tabElement = document.getElementById(`ai-coach-tab-${activeCenterView}`)
        tabElement?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      })
    }
  }, [activeCenterView, activeView, forcedView, setCenterView])

  useEffect(() => {
    const loaded = loadAICoachPreferences()
    const defaultWatchSymbol = loaded.defaultWatchlist[0] || 'SPX'
    const restoredSymbol = loaded.lastChartSymbol || defaultWatchSymbol
    const restoredTimeframe = loaded.lastChartTimeframe || loaded.defaultChartTimeframe
    const restoredView = loaded.lastActiveView
    setPreferences(loaded)
    setChartSymbol(restoredSymbol)
    setChartTimeframe(restoredTimeframe)
    setChartIndicatorConfig(loaded.defaultIndicators)

    if (forcedView) {
      setActiveView(forcedView)
      return
    }

    if (!hasCompletedOnboarding()) {
      setActiveView('onboarding')
      return
    }

    if (restoredView && restoredView !== 'welcome') {
      setActiveView(restoredView as CenterView)
      setCenterView(restoredView as Parameters<typeof setCenterView>[0])
    } else {
      setActiveView('chart')
      setCenterView('chart')
    }

    setPendingInitialChartLoad({
      symbol: restoredSymbol,
      timeframe: restoredTimeframe,
    })
  }, [forcedView, searchParams, setCenterView])

  useEffect(() => {
    saveAICoachPreferences(preferences)
  }, [preferences])

  useEffect(() => {
    if (activeSymbol && activeSymbol !== chartSymbol) {
      if (preferences.autoSyncWorkflowSymbol) {
        setChartSymbol(activeSymbol)
        setPendingChartSyncSymbol(null)
      } else {
        setPendingChartSyncSymbol(activeSymbol)
      }
    }
  }, [activeSymbol, chartSymbol, preferences.autoSyncWorkflowSymbol])

  // Fetch chart data
  const fetchChartData = useCallback(async (symbol: string, timeframe: ChartTimeframe, retryAttempt = 0) => {
    const token = accessToken
    if (!token) return

    setIsLoadingChart(true)
    setChartError(null)

    try {
      const [data, keyLevels] = await Promise.all([
        getChartData(symbol, timeframe, token, undefined, {
          includeIndicators: true,
        }),
        getKeyLevels(
          symbol,
          chartTimeframeToLevelsTimeframe(timeframe),
          token,
        ).catch(() => null),
      ])

      setChartBars(data.bars)
      setChartProviderIndicators(data.providerIndicators ?? null)

      if (keyLevels?.levels) {
        const fallbackLevels = buildFallbackKeyLevelAnnotations({
          resistance: keyLevels.levels.resistance || [],
          support: keyLevels.levels.support || [],
          indicators: {
            vwap: keyLevels.levels.indicators?.vwap ?? undefined,
          },
        })

        setChartLevels((prev) => mergeLevelAnnotations(fallbackLevels, prev))
      }
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Chart data is temporarily unavailable.'

      if (retryAttempt < 2) {
        const nextAttempt = retryAttempt + 1
        const retryDelayMs = 3000 * (2 ** retryAttempt)
        setChartError(`${message} Retrying... (${nextAttempt}/3)`)
        window.setTimeout(() => {
          void fetchChartData(symbol, timeframe, nextAttempt)
        }, retryDelayMs)
        return
      }

      setChartError(message)
      setChartBars([])
      setChartProviderIndicators(null)
    } finally {
      setIsLoadingChart(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!pendingInitialChartLoad) return
    if (!accessToken) return
    void fetchChartData(pendingInitialChartLoad.symbol, pendingInitialChartLoad.timeframe)
    setPendingInitialChartLoad(null)
  }, [accessToken, fetchChartData, pendingInitialChartLoad])

  useEffect(() => {
    if (activeView === 'onboarding') return
    setPreferences((prev) => {
      if (
        prev.lastActiveView === activeView
        && prev.lastChartSymbol === chartSymbol
        && prev.lastChartTimeframe === chartTimeframe
      ) {
        return prev
      }
      return {
        ...prev,
        lastActiveView: activeView,
        lastChartSymbol: chartSymbol,
        lastChartTimeframe: chartTimeframe,
      }
    })
  }, [activeView, chartSymbol, chartTimeframe])

  // Build level annotations from chart request
  const buildLevelAnnotations = useCallback((request: ChartRequest): LevelAnnotation[] => {
    const annotations: LevelAnnotation[] = []

    if (request.levels?.resistance) {
      for (const level of request.levels.resistance) {
        const label = level.displayLabel || level.name || level.type || 'Resistance'
        const levelKey = (level.name || level.type || '').toUpperCase()
        const group = PIVOT_LEVEL_KEY_REGEX.test(levelKey) ? 'pivot' : 'supportResistance'
        annotations.push({
          price: level.price,
          label,
          color: LEVEL_COLORS[(level.name || level.type || '').toUpperCase()] || '#ef4444',
          lineWidth: 1,
          lineStyle: 'dashed',
          type: level.type || level.name || 'Resistance',
          side: 'resistance',
          strength: level.strength,
          description: `${level.type || level.name || 'Resistance'} level`,
          testsToday: level.testsToday,
          lastTest: level.lastTest,
          holdRate: level.holdRate,
          displayContext: level.displayContext,
          group,
        })
      }
    }

    if (request.levels?.support) {
      for (const level of request.levels.support) {
        const label = level.displayLabel || level.name || level.type || 'Support'
        const levelKey = (level.name || level.type || '').toUpperCase()
        const group = PIVOT_LEVEL_KEY_REGEX.test(levelKey) ? 'pivot' : 'supportResistance'
        annotations.push({
          price: level.price,
          label,
          color: LEVEL_COLORS[(level.name || level.type || '').toUpperCase()] || '#10B981',
          lineWidth: 1,
          lineStyle: 'dashed',
          type: level.type || level.name || 'Support',
          side: 'support',
          strength: level.strength,
          description: `${level.type || level.name || 'Support'} level`,
          testsToday: level.testsToday,
          lastTest: level.lastTest,
          holdRate: level.holdRate,
          displayContext: level.displayContext,
          group,
        })
      }
    }

    if (request.levels?.fibonacci) {
      for (const fibLevel of request.levels.fibonacci) {
        annotations.push({
          price: fibLevel.price,
          label: `Fib ${fibLevel.name}`,
          color: fibLevel.isMajor ? '#a78bfa' : '#8b5cf6',
          lineWidth: fibLevel.isMajor ? 2 : 1,
          lineStyle: 'solid',
          group: 'fib',
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
        group: 'vwap',
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
        group: 'gex',
      })
    }

    if (request.gexProfile.maxGEXStrike != null) {
      addLine({
        price: request.gexProfile.maxGEXStrike,
        label: 'Max GEX',
        color: LEVEL_COLORS.GEX_MAX,
        lineWidth: 3,
        lineStyle: 'solid',
        group: 'gex',
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
        group: 'gex',
      })
    }

    return annotations
  }, [])

  const buildPositionOverlays = useCallback((request: ChartRequest): PositionOverlay[] => {
    if (!Array.isArray(request.positionOverlays)) return []
    return request.positionOverlays
      .filter((overlay): overlay is NonNullable<ChartRequest['positionOverlays']>[number] => (
        Number.isFinite(overlay.entry)
      ))
      .map((overlay, index) => ({
        id: overlay.id || `${request.symbol}-${index}`,
        label: overlay.label || 'Setup',
        entry: overlay.entry,
        stop: typeof overlay.stop === 'number' && Number.isFinite(overlay.stop) ? overlay.stop : undefined,
        target: typeof overlay.target === 'number' && Number.isFinite(overlay.target) ? overlay.target : undefined,
        targets: Array.isArray(overlay.targets)
          ? overlay.targets
            .filter((target): target is number => typeof target === 'number' && Number.isFinite(target))
            .slice(0, 4)
          : undefined,
      }))
      .slice(0, MAX_POSITION_OVERLAYS)
  }, [])

  const buildEventMarkers = useCallback((request: ChartRequest) => {
    if (!Array.isArray(request.eventMarkers)) return []
    return request.eventMarkers
      .filter((marker): marker is NonNullable<ChartRequest['eventMarkers']>[number] => (
        typeof marker.label === 'string' && marker.label.trim().length > 0
      ))
      .map((marker) => ({
        label: marker.label.trim(),
        date: typeof marker.date === 'string' ? marker.date : undefined,
        impact: normalizeChartEventImpact(marker.impact),
        source: typeof marker.source === 'string' ? marker.source : undefined,
      }))
      .slice(0, MAX_EVENT_MARKERS)
  }, [])

  // Handle chart request from AI
  useEffect(() => {
    if (forcedView) return
    if (!chartRequest) return

    setActiveView('chart')
    setCenterView('chart')
    setChartSymbol(chartRequest.symbol)
    setSymbol(chartRequest.symbol)
    setChartTimeframe(chartRequest.timeframe)

    const levelAnnotations = buildLevelAnnotations(chartRequest)
    const gexAnnotations = buildGEXAnnotations(chartRequest)
    setChartLevels([...levelAnnotations, ...gexAnnotations])
    setChartContextNotes(Array.isArray(chartRequest.contextNotes) ? chartRequest.contextNotes.slice(0, MAX_CONTEXT_NOTES) : [])
    const overlays = buildPositionOverlays(chartRequest)
    setChartPositionOverlays(overlays)
    setChartEventMarkers(buildEventMarkers(chartRequest))

    if (overlays.length > 0) {
      setPreferences((prev) => {
        if (prev.defaultLevelVisibility.position) return prev
        return {
          ...prev,
          defaultLevelVisibility: {
            ...prev.defaultLevelVisibility,
            position: true,
          },
        }
      })
    }

    fetchChartData(chartRequest.symbol, chartRequest.timeframe)
  }, [buildEventMarkers, buildGEXAnnotations, buildLevelAnnotations, buildPositionOverlays, chartRequest, fetchChartData, forcedView, setCenterView, setSymbol])

  useEffect(() => {
    if (!forcedView) return

    if (forcedView !== activeView) {
      setActiveView(forcedView)
      setCenterView(forcedView as Parameters<typeof setCenterView>[0])
    }

    setIsToolsSheetOpen(false)

    if (forcedView !== 'chart') return

    const sheetChartRequest = toSheetChartRequest(sheetParams?.chartRequest)
    const maybeTimeframe = typeof sheetParams?.timeframe === 'string'
      ? sheetParams.timeframe
      : null
    const requestedTimeframe = maybeTimeframe && SUPPORTED_CHART_TIMEFRAMES.has(maybeTimeframe as ChartTimeframe)
      ? (maybeTimeframe as ChartTimeframe)
      : null
    const requestedSymbol = sheetChartRequest?.symbol
      || sheetSymbol
      || (typeof sheetParams?.symbol === 'string' ? sheetParams.symbol : null)

    const nextSymbol = requestedSymbol || chartSymbol
    const nextTimeframe = sheetChartRequest?.timeframe || requestedTimeframe || chartTimeframe
    const symbolChanged = nextSymbol !== chartSymbol
    const timeframeChanged = nextTimeframe !== chartTimeframe
    const viewChanged = forcedView !== activeView

    if (sheetChartRequest) {
      const levelAnnotations = buildLevelAnnotations(sheetChartRequest)
      const gexAnnotations = buildGEXAnnotations(sheetChartRequest)
      setChartLevels([...levelAnnotations, ...gexAnnotations])
      setChartContextNotes(Array.isArray(sheetChartRequest.contextNotes) ? sheetChartRequest.contextNotes.slice(0, MAX_CONTEXT_NOTES) : [])
      setChartPositionOverlays(buildPositionOverlays(sheetChartRequest))
      setChartEventMarkers(buildEventMarkers(sheetChartRequest))
    } else if (symbolChanged || timeframeChanged) {
      setChartLevels([])
      setChartContextNotes([])
      setChartPositionOverlays([])
      setChartEventMarkers([])
    }

    if (symbolChanged) {
      setChartSymbol(nextSymbol)
      setSymbol(nextSymbol)
    }

    if (timeframeChanged) {
      setChartTimeframe(nextTimeframe)
    }

    if (symbolChanged || timeframeChanged || viewChanged || Boolean(sheetChartRequest)) {
      fetchChartData(nextSymbol, nextTimeframe)
    }
  }, [
    activeView,
    buildGEXAnnotations,
    buildLevelAnnotations,
    buildEventMarkers,
    buildPositionOverlays,
    chartSymbol,
    chartTimeframe,
    fetchChartData,
    forcedView,
    setCenterView,
    setSymbol,
    sheetParams,
    sheetSymbol,
  ])

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
      setChartContextNotes(Array.isArray(request.contextNotes) ? request.contextNotes.slice(0, MAX_CONTEXT_NOTES) : [])
      const overlays = buildPositionOverlays(request)
      setChartPositionOverlays(overlays)
      setChartEventMarkers(buildEventMarkers(request))

      if (overlays.length > 0) {
        setPreferences((prev) => {
          if (prev.defaultLevelVisibility.position) return prev
          return {
            ...prev,
            defaultLevelVisibility: {
              ...prev.defaultLevelVisibility,
              position: true,
            },
          }
        })
      }

      fetchChartData(request.symbol, request.timeframe)
    }

    window.addEventListener('ai-coach-show-chart', handleChartEvent)
    return () => window.removeEventListener('ai-coach-show-chart', handleChartEvent)
  }, [buildEventMarkers, buildLevelAnnotations, buildGEXAnnotations, buildPositionOverlays, fetchChartData, setCenterView, setSymbol])

  useEffect(() => {
    const handleCenterViewEvent = (event: Event) => {
      const detail = (event as CustomEvent<{
        view?: string
        symbol?: string
        timeframe?: string
      }>).detail
      if (!detail || typeof detail !== 'object') return

      const requestedView = typeof detail.view === 'string' ? detail.view : null
      const requestedSymbol = typeof detail.symbol === 'string' && /^[A-Z0-9._:-]{1,10}$/.test(detail.symbol)
        ? detail.symbol
        : null
      const requestedTimeframe = typeof detail.timeframe === 'string' && SUPPORTED_CHART_TIMEFRAMES.has(detail.timeframe as ChartTimeframe)
        ? detail.timeframe as ChartTimeframe
        : null

      if (requestedSymbol) {
        setChartSymbol(requestedSymbol)
        setSymbol(requestedSymbol)
      }

      if (requestedView === 'preferences') {
        setIsPreferencesOpen(true)
        return
      }

      if (requestedView === 'options') {
        setActiveView('options')
        setCenterView('options')
        return
      }

      if (requestedView === 'chart') {
        const symbol = requestedSymbol || chartSymbol
        const timeframe = requestedTimeframe || chartTimeframe
        setActiveView('chart')
        setCenterView('chart')
        if (requestedTimeframe) setChartTimeframe(requestedTimeframe)
        fetchChartData(symbol, timeframe)
      }
    }

    window.addEventListener('ai-coach-center-view', handleCenterViewEvent)
    return () => window.removeEventListener('ai-coach-center-view', handleCenterViewEvent)
  }, [chartSymbol, chartTimeframe, fetchChartData, setCenterView, setSymbol])

  useEffect(() => {
    const handleHover = (event: Event) => {
      const detail = (event as CustomEvent<{
        type?: string
        value?: string
        price?: number
        sourcePanel?: 'chat' | 'center'
      }>).detail
      if (detail?.sourcePanel !== 'chat') return
      if (detail?.type !== 'level' || !detail?.value) return
      setHighlightedLevel({
        value: detail.value,
        price: typeof detail.price === 'number' ? detail.price : undefined,
      })
    }

    const handleClear = () => {
      setHighlightedLevel(null)
    }

    window.addEventListener('ai-coach-hover-coordinate', handleHover)
    window.addEventListener('ai-coach-hover-clear', handleClear)

    return () => {
      window.removeEventListener('ai-coach-hover-coordinate', handleHover)
      window.removeEventListener('ai-coach-hover-clear', handleClear)
    }
  }, [])

  const handleSymbolChange = useCallback((symbol: string) => {
    setChartSymbol(symbol)
    setSymbol(symbol)
    setPendingChartSyncSymbol(null)
    setChartLevels([])
    setChartContextNotes([])
    setChartPositionOverlays([])
    setChartEventMarkers([])
    fetchChartData(symbol, chartTimeframe)
  }, [chartTimeframe, fetchChartData, setSymbol])

  const handleSyncChartSymbol = useCallback(() => {
    if (!pendingChartSyncSymbol) return
    setChartSymbol(pendingChartSyncSymbol)
    setPendingChartSyncSymbol(null)
    setChartLevels([])
    setChartContextNotes([])
    setChartPositionOverlays([])
    setChartEventMarkers([])
    fetchChartData(pendingChartSyncSymbol, chartTimeframe)
  }, [pendingChartSyncSymbol, fetchChartData, chartTimeframe])

  const handleTimeframeChange = useCallback((timeframe: ChartTimeframe) => {
    setChartTimeframe(timeframe)
    fetchChartData(chartSymbol, timeframe)
  }, [chartSymbol, fetchChartData])

  const handleShowChart = useCallback(() => {
    setActiveView('chart')
    setCenterView('chart')
    fetchChartData(chartSymbol, chartTimeframe)
  }, [chartSymbol, chartTimeframe, fetchChartData, setCenterView])

  const updateTabRailScrollState = useCallback(() => {
    const rail = tabRailRef.current
    if (!rail) return

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
    setCanScrollTabLeft(rail.scrollLeft > 6)
    setCanScrollTabRight(rail.scrollLeft < maxScrollLeft - 6)
  }, [])

  const scrollTabRailBy = useCallback((direction: 'left' | 'right') => {
    const rail = tabRailRef.current
    if (!rail) return
    rail.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    updateTabRailScrollState()
  }, [activeView, updateTabRailScrollState])

  useEffect(() => {
    const handleResize = () => updateTabRailScrollState()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateTabRailScrollState])

  useEffect(() => {
    if (!isPreferencesOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreferencesOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isPreferencesOpen])

  const activateTabView = useCallback((view: CenterView) => {
    setActiveView(view)
    setCenterView(view as Parameters<typeof setCenterView>[0])
    if (view === 'chart') {
      fetchChartData(chartSymbol, chartTimeframe)
    }
  }, [chartSymbol, chartTimeframe, fetchChartData, setCenterView])

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()

    let nextIndex = index
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1
    }

    const nextTab = TABS[nextIndex]
    activateTabView(nextTab.view)
  }, [activateTabView])

  // ============================================
  // RENDER
  // ============================================

  const shouldRenderChartCanvas = activeView === 'chart' || (!isSheetMode && activeView === 'options')
  const isDesktopOptionsOverlay = !isSheetMode && activeView === 'options'
  const isSheetOptionsView = isSheetMode && activeView === 'options'
  const viewTransitionKey: CenterView = activeView === 'options' ? 'chart' : activeView

  return (
    <div className="h-full flex flex-col relative">
      {!isSheetMode && activeView !== 'onboarding' && (
        <DesktopContextStrip
          accessToken={session?.access_token}
          onSendPrompt={onSendPrompt}
        />
      )}

      {/* Tab bar — shown for non-welcome/non-onboarding views */}
      {activeView !== 'welcome' && activeView !== 'onboarding' && !isSheetMode && (
        <div className="border-b border-white/5 flex items-center">
          <motion.button
            onClick={() => {
              setActiveView('welcome')
              setCenterView(null)
            }}
            className="group/home mx-1 my-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 shrink-0"
            aria-label="Go to home view"
            {...PRESSABLE_PROPS}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only">Home</span>
          </motion.button>
          <div className="relative flex-1 min-w-0">
            <motion.button
              type="button"
              onClick={() => scrollTabRailBy('left')}
              className={cn(
                'hidden lg:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-md border transition-colors',
                canScrollTabLeft
                  ? 'border-white/15 bg-white/8 text-white/65 hover:bg-white/12 hover:text-white'
                  : 'border-white/10 bg-white/5 text-white/25 opacity-50 pointer-events-none'
              )}
              aria-label="Scroll tools left"
              {...PRESSABLE_PROPS}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              type="button"
              onClick={() => scrollTabRailBy('right')}
              className={cn(
                'hidden lg:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-md border transition-colors',
                canScrollTabRight
                  ? 'border-white/15 bg-white/8 text-white/65 hover:bg-white/12 hover:text-white'
                  : 'border-white/10 bg-white/5 text-white/25 opacity-50 pointer-events-none'
              )}
              aria-label="Scroll tools right"
              {...PRESSABLE_PROPS}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0B0D10] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0B0D10] to-transparent z-10" />
            <div
              ref={tabRailRef}
              onScroll={updateTabRailScrollState}
              className="overflow-x-auto scrollbar-hide px-2"
            >
            <div className="flex items-center gap-1 min-w-max pt-3" role="tablist" aria-label="AI Coach tools">
              {TABS.map((tab, index) => {
                const Icon = tab.icon
                const previousGroup = index > 0 ? TABS[index - 1].group : null
                const showDivider = previousGroup !== null && previousGroup !== tab.group
                return (
                  <div key={tab.view} className="group/segment relative flex items-center">
                    {previousGroup === null && (
                      <span className="pointer-events-none absolute -top-2 left-2 text-[9px] uppercase tracking-[0.1em] text-white/30">
                        {TAB_GROUP_LABELS[tab.group]}
                      </span>
                    )}
                    {showDivider && (
                      <>
                        <div className="w-px h-5 bg-white/10 mx-1.5" aria-hidden />
                        <span className="pointer-events-none absolute -top-2 left-4 text-[9px] uppercase tracking-[0.1em] text-white/30">
                          {TAB_GROUP_LABELS[tab.group]}
                        </span>
                      </>
                    )}
                    <motion.button
                      onClick={() => {
                        activateTabView(tab.view)
                      }}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      className={cn(
                        'relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all whitespace-nowrap min-h-[44px]',
                        activeView === tab.view
                          ? 'text-emerald-300'
                          : 'text-white/40 hover:text-white/60'
                      )}
                      role="tab"
                      aria-selected={activeView === tab.view}
                      aria-controls={`ai-coach-panel-${tab.view}`}
                      id={`ai-coach-tab-${tab.view}`}
                      {...PRESSABLE_PROPS}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {activeView === tab.view && (
                        <motion.div
                          layoutId="center-panel-active-tab"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-emerald-400"
                        />
                      )}
                    </motion.button>
                  </div>
                )
              })}
            </div>
          </div>
          </div>
          <motion.button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-emerald-300 px-3 py-2.5 transition-colors shrink-0 border-l border-white/5 min-h-[44px]"
            aria-label="Open workflow settings"
            {...PRESSABLE_PROPS}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </motion.button>
        </div>
      )}

      {/* View content */}
      <div className="flex-1 min-h-0" role="tabpanel" id={`ai-coach-panel-${activeView}`} aria-labelledby={`ai-coach-tab-${activeView}`}>
        <ViewTransition viewKey={viewTransitionKey}>
          {activeView === 'onboarding' && (
            <Onboarding
              onComplete={() => {
                setActiveView('chart')
                setCenterView('chart')
              }}
              onSkip={() => {
                setActiveView('chart')
                setCenterView('chart')
              }}
              onTryFeature={(feature) => {
                const nextView: CenterView = feature === 'options'
                  ? 'options'
                  : 'chart'
                setActiveView(nextView)
                setCenterView(nextView as Parameters<typeof setCenterView>[0])
              }}
            />
          )}

          {activeView === 'welcome' && (
            <WelcomeView
              accessToken={session?.access_token}
              displayName={session?.user?.user_metadata?.full_name || session?.user?.email || undefined}
              onSendPrompt={onSendPrompt}
              onShowChart={handleShowChart}
              onShowOptions={() => {
                setActiveView('options')
                setCenterView('options')
              }}
              onShowJournal={() => {
                // Journal moved to /members/journal — navigate there instead
                window.open('/members/journal', '_self')
              }}
              onShowPreferences={() => setIsPreferencesOpen(true)}
              hideContextData={!isSheetMode && isDesktopViewport}
            />
          )}

          {shouldRenderChartCanvas && (
            <ChartView
              symbol={chartSymbol}
              watchlist={preferences.defaultWatchlist}
              timeframe={chartTimeframe}
              bars={chartBars}
              levels={chartLevels}
              providerIndicators={chartProviderIndicators}
              indicators={chartIndicatorConfig}
              openingRangeMinutes={preferences.orbMinutes}
              contextNotes={chartContextNotes}
              positionOverlays={chartPositionOverlays}
              eventMarkers={chartEventMarkers}
              pendingSyncSymbol={pendingChartSyncSymbol}
              isLoading={isLoadingChart}
              error={chartError}
              isRealtimeEnabled={chartRealtimeEnabled}
              isRealtimeConnected={chartStream.isConnected}
              realtimeError={chartStream.error}
              highlightedLevel={highlightedLevel}
              onSymbolChange={handleSymbolChange}
              onWatchlistChange={(watchlist) => {
                setPreferences((prev) => ({
                  ...prev,
                  defaultWatchlist: watchlist,
                }))
              }}
              onTimeframeChange={handleTimeframeChange}
              onIndicatorsChange={setChartIndicatorConfig}
              levelVisibility={preferences.defaultLevelVisibility}
              onLevelVisibilityChange={(next) => {
                setPreferences((prev) => ({
                  ...prev,
                  defaultLevelVisibility: next,
                }))
              }}
              onRetry={() => fetchChartData(chartSymbol, chartTimeframe)}
              onAcceptSync={handleSyncChartSymbol}
              onDismissSync={() => setPendingChartSyncSymbol(null)}
            />
          )}

          {isSheetOptionsView && (
            <OptionsChain
              initialSymbol={chartSymbol}
              preferences={{
                defaultOptionsStrikeRange: preferences.defaultOptionsStrikeRange,
                defaultShowGex: preferences.defaultShowGex,
                defaultShowVolAnalytics: preferences.defaultShowVolAnalytics,
                autoSyncWorkflowSymbol: preferences.autoSyncWorkflowSymbol,
              }}
            />
          )}

          {/* Journal view removed — accessible at /members/journal */}

        </ViewTransition>

        <AnimatePresence>
          {isDesktopOptionsOverlay && (
            <motion.div
              key="desktop-options-overlay"
              initial={{ x: 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 28, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 z-20 w-full xl:w-[72%] border-l border-white/10 bg-[#0B0D10]"
            >
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <TableProperties className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Options Overlay</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('chart')
                    setCenterView('chart')
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                  aria-label="Close options overlay"
                >
                  <span className="inline-flex items-center gap-1">
                    <X className="h-3.5 w-3.5" />
                    Close
                  </span>
                </button>
              </div>
              <div className="h-[calc(100%-2.5rem)] min-h-0 overflow-hidden">
                <OptionsChain
                  initialSymbol={chartSymbol}
                  preferences={{
                    defaultOptionsStrikeRange: preferences.defaultOptionsStrikeRange,
                    defaultShowGex: preferences.defaultShowGex,
                    defaultShowVolAnalytics: preferences.defaultShowVolAnalytics,
                    autoSyncWorkflowSymbol: preferences.autoSyncWorkflowSymbol,
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Desktop journal overlay removed — accessible at /members/journal */}
        </AnimatePresence>
      </div>

      {!isSheetMode && (
        <motion.button
          onClick={() => setIsToolsSheetOpen(true)}
          className="lg:hidden absolute right-4 bottom-4 z-20 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.25)] hover:bg-emerald-500/30 transition-colors"
          aria-label="Open tools menu"
          {...PRESSABLE_PROPS}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          Tools
        </motion.button>
      )}

      <AnimatePresence>
        {isToolsSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden absolute inset-0 z-30 bg-black/65"
            onClick={() => setIsToolsSheetOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-[#0F1013] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Tools</h3>
                <motion.button
                  onClick={() => setIsToolsSheetOpen(false)}
                  className="text-xs text-white/45 hover:text-white/70 transition-colors"
                  {...PRESSABLE_PROPS}
                >
                  Close
                </motion.button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  onClick={() => {
                    setActiveView('welcome')
                    setCenterView(null)
                    setIsToolsSheetOpen(false)
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-white/75"
                  {...PRESSABLE_PROPS}
                >
                  Home
                </motion.button>
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <motion.button
                      key={`mobile-tools-${tab.view}`}
                      onClick={() => {
                        setActiveView(tab.view)
                        setCenterView(tab.view as Parameters<typeof setCenterView>[0])
                        if (tab.view === 'chart') fetchChartData(chartSymbol, chartTimeframe)
                        setIsToolsSheetOpen(false)
                      }}
                      className={cn(
                        'rounded-lg border py-2 text-xs transition-colors flex items-center justify-center gap-1.5',
                        activeView === tab.view
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      )}
                      {...PRESSABLE_PROPS}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPreferencesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/70 p-3 sm:p-6"
            onClick={() => setIsPreferencesOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="AI Coach workflow settings"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mx-auto h-full w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F13]"
              onClick={(event) => event.stopPropagation()}
            >
              <PreferencesPanel
                value={preferences}
                onChange={setPreferences}
                onReset={() => setPreferences(DEFAULT_AI_COACH_PREFERENCES)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// CHART VIEW
// ============================================

function ChartView({
  symbol,
  watchlist,
  timeframe,
  bars,
  levels,
  providerIndicators,
  indicators,
  openingRangeMinutes,
  contextNotes,
  positionOverlays,
  eventMarkers,
  pendingSyncSymbol,
  isLoading,
  error,
  isRealtimeEnabled,
  isRealtimeConnected,
  realtimeError,
  highlightedLevel,
  onSymbolChange,
  onWatchlistChange,
  onTimeframeChange,
  onIndicatorsChange,
  levelVisibility,
  onLevelVisibilityChange,
  onRetry,
  onAcceptSync,
  onDismissSync,
}: {
  symbol: string
  watchlist: string[]
  timeframe: ChartTimeframe
  bars: ChartBar[]
  levels: LevelAnnotation[]
  providerIndicators: ChartProviderIndicators | null
  indicators: IndicatorConfig
  openingRangeMinutes: 5 | 15 | 30
  contextNotes: string[]
  positionOverlays: PositionOverlay[]
  eventMarkers: Array<{
    label: string
    date?: string
    impact: 'high' | 'medium' | 'low' | 'info'
    source?: string
  }>
  pendingSyncSymbol: string | null
  isLoading: boolean
  error: string | null
  isRealtimeEnabled: boolean
  isRealtimeConnected: boolean
  realtimeError: string | null
  highlightedLevel: { value: string; price?: number } | null
  onSymbolChange: (s: string) => void
  onWatchlistChange: (symbols: string[]) => void
  onTimeframeChange: (t: ChartTimeframe) => void
  onIndicatorsChange: (next: IndicatorConfig) => void
  levelVisibility: LevelVisibilityConfig
  onLevelVisibilityChange: (next: LevelVisibilityConfig) => void
  onRetry: () => void
  onAcceptSync: () => void
  onDismissSync: () => void
}) {
  const formatBarFreshness = useCallback((barsInput: ChartBar[]): string => {
    const latest = barsInput[barsInput.length - 1]
    if (!latest?.time) return '--'
    const ageSec = Math.max(0, Math.floor(Date.now() / 1000 - latest.time))
    if (ageSec < 60) return `${ageSec}s`
    return `${Math.floor(ageSec / 60)}m`
  }, [])

  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)
  const roundedHoverPrice = useMemo(() => {
    if (hoveredPrice == null || !Number.isFinite(hoveredPrice)) return null
    return Number(hoveredPrice.toFixed(2))
  }, [hoveredPrice])

  const emphasizedLevels = useMemo(() => {
    if (!highlightedLevel) return levels
    const highlightText = highlightedLevel.value.trim().toLowerCase()
    return levels.map((level) => {
      const label = String(level.label || '').toLowerCase()
      const priceMatched = typeof highlightedLevel.price === 'number'
        ? Math.abs(level.price - highlightedLevel.price) < 0.15
        : false
      const labelMatched = highlightText.length > 0 && (label.includes(highlightText) || highlightText.includes(label))
      if (!priceMatched && !labelMatched) return level

      return {
        ...level,
        lineWidth: Math.max(level.lineWidth ?? 1, 3),
        color: '#34d399',
      }
    })
  }, [highlightedLevel, levels])

  const filteredLevels = useMemo(
    () => filterLevelsByVisibility(emphasizedLevels, levelVisibility),
    [emphasizedLevels, levelVisibility],
  )

  const levelCounts = useMemo(() => countLevelsByGroup(levels), [levels])
  const chartFreshness = formatBarFreshness(bars)

  const chartContextActions = useMemo<WidgetAction[]>(() => {
    const actions: WidgetAction[] = [
      chartAction(symbol, roundedHoverPrice ?? undefined, timeframe, 'Chart Focus'),
      chatAction(`Analyze ${symbol} ${timeframe} chart and define key levels plus trade scenarios.`),
    ]

    if (roundedHoverPrice != null) {
      actions.splice(1, 0,
        optionsAction(symbol, roundedHoverPrice),
        chatAction(`Alert me when ${symbol} approaches ${roundedHoverPrice.toFixed(2)} and explain the trigger context.`, 'Create Alert Prompt'),
      )
    }

    return actions
  }, [roundedHoverPrice, symbol, timeframe])

  return (
    <div className="h-full flex flex-col">
      {pendingSyncSymbol && pendingSyncSymbol !== symbol && (
        <div className="border-b border-white/5 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <p className="text-white/45">
            Workflow symbol is <span className="text-white/70">{pendingSyncSymbol}</span>. Sync chart?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onAcceptSync}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
            >
              Yes
            </button>
            <button
              onClick={onDismissSync}
              className="px-2 py-1 rounded border border-white/10 bg-white/5 text-white/45 hover:text-white/65"
            >
              No
            </button>
          </div>
        </div>
      )}
      <div className="border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <CandlestickChart className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-medium text-white">{symbol} Chart</h2>
            <InfoTip label="How to read AI Coach chart">
              Focus on nearest support/resistance, active regime, and live tick alignment. Use this panel to validate entries before execution.
            </InfoTip>
            {isRealtimeEnabled && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded border',
                  isRealtimeConnected
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/15 text-amber-200',
                )}
                title={isRealtimeConnected ? 'WebSocket live updates active' : (realtimeError || 'WebSocket reconnecting')}
              >
                {isRealtimeConnected ? 'WS LIVE' : 'WS RETRY'}
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-white/[0.04] text-white/60"
              title="Time since last chart bar update"
            >
              BAR {chartFreshness}
            </span>
            {levels.length > 0 && (
              <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                {filteredLevels.length}/{levels.length} levels
              </span>
            )}
          </div>
        </div>
        <ChartToolbar
          symbol={symbol}
          watchlist={watchlist}
          timeframe={timeframe}
          onSymbolChange={onSymbolChange}
          onWatchlistChange={onWatchlistChange}
          onTimeframeChange={onTimeframeChange}
          indicators={indicators}
          onIndicatorsChange={onIndicatorsChange}
          levelVisibility={levelVisibility}
          onLevelVisibilityChange={onLevelVisibilityChange}
          levelCounts={levelCounts}
          isLoading={isLoading}
        />
        {contextNotes.length > 0 && (
          <div className="border-t border-white/5 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {contextNotes.slice(0, 4).map((note, index) => (
                <span
                  key={`${note}-${index}`}
                  className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200/85"
                >
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}
        {eventMarkers.length > 0 && (
          <div className="border-t border-white/5 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {eventMarkers.slice(0, 4).map((marker, index) => (
                <span
                  key={`${marker.label}-${marker.date || index}`}
                  className={cn(
                    'rounded border px-2 py-0.5 text-[10px]',
                    marker.impact === 'high'
                      ? 'border-red-500/30 bg-red-500/10 text-red-200/85'
                      : marker.impact === 'medium'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200/85'
                        : marker.impact === 'low'
                          ? 'border-sky-500/30 bg-sky-500/10 text-sky-200/85'
                          : 'border-white/15 bg-white/5 text-white/70',
                  )}
                  title={marker.source ? `${marker.label} • ${marker.source}` : marker.label}
                >
                  {marker.label}{marker.date ? ` (${marker.date})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
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
        ) : isLoading && bars.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <WidgetContextMenu actions={chartContextActions}>
            <div className="relative h-full">
              <TradingChart
                bars={bars}
                levels={filteredLevels}
                providerIndicators={providerIndicators || undefined}
                indicators={indicators}
                openingRangeMinutes={openingRangeMinutes}
                positionOverlays={positionOverlays}
                eventMarkers={eventMarkers}
                symbol={symbol}
                timeframe={timeframe}
                isLoading={isLoading}
                onHoverPrice={setHoveredPrice}
              />
              <ChartLevelLabels
                levels={filteredLevels}
                currentPrice={roundedHoverPrice ?? bars[bars.length - 1]?.close ?? 0}
                onLevelHover={(level) => {
                  emitHoverTarget({
                    type: 'level',
                    value: level.displayLabel || level.label || level.name || level.type || 'Level',
                    price: level.price,
                    sourcePanel: 'center',
                  })
                }}
                onLevelHoverEnd={clearHoverTarget}
              />
              <div className="pointer-events-none absolute right-3 top-3 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/55 backdrop-blur">
                Right-click chart for actions{roundedHoverPrice != null ? ` @ ${roundedHoverPrice.toFixed(2)}` : ''}
                {filteredLevels.length !== levels.length ? ` • ${levels.length - filteredLevels.length} hidden by filters` : ''}
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
  accessToken,
  displayName,
  onSendPrompt,
  onShowChart,
  onShowOptions,
  onShowJournal,
  onShowPreferences,
  hideContextData = false,
}: {
  accessToken?: string
  displayName?: string
  onSendPrompt?: (prompt: string) => void
  onShowChart: () => void
  onShowOptions: () => void
  onShowJournal: () => void
  onShowPreferences: () => void
  hideContextData?: boolean
}) {
  const [, setClockTick] = useState(0)
  const [spxTicker, setSpxTicker] = useState<{
    price: number | null
    change: number | null
    changePct: number | null
    asOf: string | null
    isLoading: boolean
    error: string | null
  }>({
    price: null,
    change: null,
    changePct: null,
    asOf: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    const interval = setInterval(() => setClockTick((value) => value + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const marketStatus = getWelcomeMarketStatus()
  const greeting = getWelcomeGreeting(displayName)
  const sessionDescriptor = useMemo(() => {
    if (marketStatus.label === 'Pre-Market') return 'Pre-Market Prep'
    if (marketStatus.label === 'Open') return 'Live Session'
    if (marketStatus.label === 'After Hours') return 'After-Hours Review'
    return 'Market Closed'
  }, [marketStatus.label])

  const loadSPXTicker = useCallback(async () => {
    if (!accessToken) return

    setSpxTicker((prev) => ({
      ...prev,
      isLoading: prev.price === null,
      error: null,
    }))

    try {
      let chartData = await getChartData('SPX', '1m', accessToken)
      if (chartData.bars.length === 0) {
        chartData = await getChartData('SPX', '1D', accessToken)
      }

      if (chartData.bars.length === 0) {
        throw new Error('No bars returned')
      }

      const last = chartData.bars[chartData.bars.length - 1]
      const previous = chartData.bars.length > 1 ? chartData.bars[chartData.bars.length - 2] : null
      const change = previous ? last.close - previous.close : 0
      const changePct = previous && previous.close !== 0 ? (change / previous.close) * 100 : null
      const timestampMs = last.time > 1_000_000_000_000 ? last.time : last.time * 1000

      setSpxTicker({
        price: Number(last.close.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePct: changePct !== null ? Number(changePct.toFixed(2)) : null,
        asOf: new Date(timestampMs).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/New_York',
        }),
        isLoading: false,
        error: null,
      })
    } catch {
      setSpxTicker((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Live SPX feed unavailable',
      }))
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken || hideContextData) return
    void loadSPXTicker()
    const interval = setInterval(() => {
      void loadSPXTicker()
    }, 60_000)

    return () => clearInterval(interval)
  }, [accessToken, hideContextData, loadSPXTicker])

  const quickAccessCards: Array<{
    label: string
    subtitle: string
    icon: typeof CandlestickChart
    onClick: () => void
  }> = [
    { label: 'Live Chart', subtitle: 'SPX & NDX', icon: CandlestickChart, onClick: onShowChart },
    { label: 'Options', subtitle: 'Greeks & IV', icon: TableProperties, onClick: onShowOptions },
    { label: 'Journal', subtitle: 'Trade Log', icon: BookOpen, onClick: onShowJournal },
  ]

  const containerMotion = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  }
  const itemMotion = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.24 } },
  }

  const tickerPositive = (spxTicker.change ?? 0) >= 0

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-white/5 px-4 py-3 lg:px-5 lg:py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-emerald-400/80 uppercase tracking-[0.14em]">Coach Workspace</p>
            <h2 className="mt-1 text-lg font-semibold text-white lg:text-xl">{greeting}</h2>
            <p className="mt-1 text-xs text-white/45 lg:text-sm">{sessionDescriptor} across chart, options, and journal context.</p>
          </div>
          <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md border shrink-0', marketStatus.toneClass)}>
            {marketStatus.label}
          </span>
        </div>

        {!hideContextData && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-emerald-300/75 uppercase tracking-[0.12em]">SPX Live</p>
                {spxTicker.isLoading && spxTicker.price === null ? (
                  <p className="mt-1 text-sm text-white/45">Loading live index quote...</p>
                ) : spxTicker.error ? (
                  <p className="mt-1 text-sm text-red-300/80">{spxTicker.error}</p>
                ) : (
                  <p className="mt-0.5 text-lg font-semibold text-white lg:text-xl">${spxTicker.price?.toLocaleString()}</p>
                )}
              </div>
              {spxTicker.price !== null && spxTicker.change !== null && (
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    tickerPositive ? 'text-emerald-300' : 'text-red-300'
                  )}
                >
                  {tickerPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span>
                    {tickerPositive ? '+' : ''}{spxTicker.change.toFixed(2)}
                    {spxTicker.changePct !== null ? ` (${tickerPositive ? '+' : ''}${spxTicker.changePct.toFixed(2)}%)` : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              {spxTicker.asOf ? (
                <p className="text-[10px] text-white/35">As of {spxTicker.asOf} ET</p>
              ) : <span className="text-[10px] text-white/35">&nbsp;</span>}
              <motion.button
                type="button"
                onClick={() => {
                  void loadSPXTicker()
                }}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white/75 disabled:opacity-50"
                disabled={spxTicker.isLoading}
                aria-label="Refresh SPX context"
                {...PRESSABLE_PROPS}
              >
                <RefreshCw className={cn('h-3 w-3', spxTicker.isLoading && 'animate-spin')} />
                Refresh
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            variants={containerMotion}
            initial="hidden"
            animate="show"
            className="text-center mb-8"
          >
            <motion.div variants={itemMotion} className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-emerald-500" />
            </motion.div>
            <motion.h3 variants={itemMotion} className="text-lg font-semibold text-white mb-2">
              Ask for a complete trade thesis
            </motion.h3>
            <motion.p variants={itemMotion} className="text-sm text-white/50 leading-relaxed">
              Start with one high-impact prompt below, then project levels and context directly onto the chart.
            </motion.p>
          </motion.div>

          <motion.div
            variants={containerMotion}
            initial="hidden"
            animate="show"
            className="grid gap-3"
          >
            {EXAMPLE_PROMPTS.map((item) => {
              const Icon = item.icon
              return (
                <motion.button
                  variants={itemMotion}
                  key={item.label}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    onSendPrompt?.(item.prompt)
                  }}
                  className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{item.label}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-white/40 mb-1.5">{item.description}</p>
                      <p className="text-xs text-emerald-500/70 italic">&ldquo;{item.prompt}&rdquo;</p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>

          <motion.div
            variants={containerMotion}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4"
          >
            {quickAccessCards.map((card) => {
              const Icon = card.icon
              return (
                <motion.button
                  variants={itemMotion}
                  key={card.label}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={card.onClick}
                  className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5"
                >
                  <Icon className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-white">{card.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{card.subtitle}</p>
                </motion.button>
              )
            })}
          </motion.div>

          <motion.button
            variants={itemMotion}
            type="button"
            onClick={onShowPreferences}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 hover:text-white/80 hover:bg-white/10 transition-colors"
            {...PRESSABLE_PROPS}
          >
            <Settings className="h-3.5 w-3.5" />
            Open Settings
          </motion.button>
        </div>
      </div>
    </div>
  )
}
