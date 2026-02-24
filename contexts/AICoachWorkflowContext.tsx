'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ChartTimeframe } from '@/lib/api/ai-coach'

export type WorkflowCenterView = 'chart' | 'options' | 'journal' | 'preferences'

export interface WorkflowLevel {
  label?: string
  price: number
}

export interface WorkflowChartAnnotation {
  price: number
  label: string
  color?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

interface AICoachWorkflowState {
  activeSymbol: string | null
  activeExpiry: string | null
  activeStrike: number | null
  activeSetup: Record<string, unknown> | null
  activeLevels: WorkflowLevel[] | null
  chartAnnotations: WorkflowChartAnnotation[] | null
  activeCenterView: WorkflowCenterView | null
}

interface AICoachWorkflowContextValue extends AICoachWorkflowState {
  setSymbol: (symbol: string | null) => void
  setExpiry: (expiry: string | null) => void
  setStrike: (strike: number | null) => void
  setCenterView: (view: WorkflowCenterView | null) => void
  setActiveLevels: (levels: WorkflowLevel[] | null) => void
  setChartAnnotations: (annotations: WorkflowChartAnnotation[] | null) => void

  viewChartAtLevel: (
    symbol: string,
    level?: number,
    options?: { label?: string; timeframe?: ChartTimeframe },
  ) => void
  viewOptionsNearStrike: (
    symbol: string,
    strike?: number,
    expiry?: string,
  ) => void
  sendToChat: (prompt: string) => void
  analyzeSetup: (setup: Record<string, unknown>) => void
  journalTrade: (trade: Record<string, unknown>) => void
}

const AICoachWorkflowContext = createContext<AICoachWorkflowContextValue | null>(null)

function normalizeSymbol(symbol: string | null | undefined): string | null {
  if (!symbol || typeof symbol !== 'string') return null
  const cleaned = symbol.trim().toUpperCase()
  return cleaned.length > 0 ? cleaned : null
}

function dispatchChartEvent(detail: {
  symbol: string
  timeframe: ChartTimeframe
  levels?: {
    resistance?: Array<{ name: string; price: number }>
    support?: Array<{ name: string; price: number }>
  }
}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ai-coach-show-chart', { detail }))
}

function mapLegacyViewToCenterView(view: string | null | undefined): WorkflowCenterView {
  if (!view) return 'chart'
  if (view === 'options') return 'options'
  if (view === 'journal') return 'journal'
  if (view === 'preferences') return 'preferences'
  return 'chart'
}

interface AICoachWorkflowProviderProps {
  children: ReactNode
  onSendPrompt?: (prompt: string) => void
}

export function AICoachWorkflowProvider({
  children,
  onSendPrompt,
}: AICoachWorkflowProviderProps) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>('SPX')
  const [activeExpiry, setActiveExpiry] = useState<string | null>(null)
  const [activeStrike, setActiveStrike] = useState<number | null>(null)
  const [activeSetup, setActiveSetup] = useState<Record<string, unknown> | null>(null)
  const [activeLevels, setActiveLevelsState] = useState<WorkflowLevel[] | null>(null)
  const [chartAnnotations, setChartAnnotationsState] = useState<WorkflowChartAnnotation[] | null>(null)
  const [activeCenterView, setActiveCenterView] = useState<WorkflowCenterView | null>(null)

  const setSymbol = useCallback((symbol: string | null) => {
    setActiveSymbol(normalizeSymbol(symbol))
  }, [])

  const setExpiry = useCallback((expiry: string | null) => {
    setActiveExpiry(expiry || null)
  }, [])

  const setStrike = useCallback((strike: number | null) => {
    setActiveStrike(typeof strike === 'number' && Number.isFinite(strike) ? strike : null)
  }, [])

  const setCenterView = useCallback((view: WorkflowCenterView | null) => {
    setActiveCenterView(view)
  }, [])

  const setActiveLevels = useCallback((levels: WorkflowLevel[] | null) => {
    setActiveLevelsState(levels)
  }, [])

  const setChartAnnotations = useCallback((annotations: WorkflowChartAnnotation[] | null) => {
    setChartAnnotationsState(annotations)
  }, [])

  const sendToChat = useCallback((prompt: string) => {
    if (!prompt?.trim()) return

    if (onSendPrompt) {
      onSendPrompt(prompt.trim())
      return
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-coach-send-prompt', {
        detail: { prompt: prompt.trim() },
      }))
    }
  }, [onSendPrompt])

  const viewChartAtLevel = useCallback((
    symbol: string,
    level?: number,
    options?: { label?: string; timeframe?: ChartTimeframe },
  ) => {
    const normalized = normalizeSymbol(symbol)
    if (!normalized) return

    const timeframe = options?.timeframe || '5m'
    setActiveSymbol(normalized)
    setActiveCenterView('chart')

    if (typeof level === 'number' && Number.isFinite(level)) {
      setActiveStrike(level)
      setChartAnnotationsState([
        {
          price: level,
          label: options?.label || 'Focus',
          color: '#FACC15',
          lineWidth: 2,
          lineStyle: 'dashed',
        },
      ])

      dispatchChartEvent({
        symbol: normalized,
        timeframe,
        levels: {
          support: [{ name: options?.label || 'Focus', price: level }],
        },
      })
      return
    }

    setChartAnnotationsState(null)
    dispatchChartEvent({ symbol: normalized, timeframe })
  }, [])

  const viewOptionsNearStrike = useCallback((
    symbol: string,
    strike?: number,
    expiry?: string,
  ) => {
    const normalized = normalizeSymbol(symbol)
    if (!normalized) return

    setActiveSymbol(normalized)
    setActiveCenterView('options')

    if (typeof strike === 'number' && Number.isFinite(strike)) {
      setActiveStrike(strike)
    }

    if (expiry) {
      setActiveExpiry(expiry)
    }
  }, [])

  const analyzeSetup = useCallback((setup: Record<string, unknown>) => {
    setActiveSetup(setup)

    const symbol = normalizeSymbol(String(setup.symbol || setup.ticker || ''))
    if (symbol) {
      setActiveSymbol(symbol)
      const timeframe = String(setup.timeframe || '15m') as ChartTimeframe
      const entry = Number(setup.entry)
      viewChartAtLevel(symbol, Number.isFinite(entry) ? entry : undefined, {
        label: 'Setup Entry',
        timeframe,
      })

      const direction = String(setup.direction || 'setup')
      const entryHint = setup.entry != null ? ` near ${setup.entry}` : ''
      sendToChat(`Analyze ${symbol} ${direction} setup${entryHint} and provide risk-managed trade ideas.`)
      return
    }

    setActiveCenterView('chart')
    sendToChat('Analyze this setup and provide a risk-managed trade plan with entry, stop, target, and invalidation.')
  }, [sendToChat, viewChartAtLevel])

  const journalTrade = useCallback((trade: Record<string, unknown>) => {
    const symbol = normalizeSymbol(String(trade.symbol || ''))
    if (symbol) setActiveSymbol(symbol)
    setActiveCenterView('journal')
  }, [])

  useEffect(() => {
    const onChart = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; level?: number; timeframe?: ChartTimeframe; label?: string }>).detail
      if (!detail?.symbol) return
      viewChartAtLevel(detail.symbol, detail.level, {
        timeframe: detail.timeframe || '5m',
        label: detail.label,
      })
    }

    const onOptions = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; strike?: number; expiry?: string }>).detail
      if (!detail?.symbol) return
      viewOptionsNearStrike(detail.symbol, detail.strike, detail.expiry)
    }

    const onAlert = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; price?: number; alertType?: string }>).detail
      if (!detail?.symbol || typeof detail.price !== 'number') return
      const type = detail.alertType || 'level_approach'
      sendToChat(`Set a ${type} alert for ${detail.symbol} at ${detail.price}.`)
    }

    const onAnalyze = (event: Event) => {
      const detail = (event as CustomEvent<{ setup?: Record<string, unknown> }>).detail
      if (!detail?.setup) return
      analyzeSetup(detail.setup)
    }

    const onChat = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail
      if (!detail?.prompt) return
      sendToChat(detail.prompt)
    }

    const onView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string; symbol?: string }>).detail
      const nextView = mapLegacyViewToCenterView(detail?.view)
      const normalized = normalizeSymbol(detail?.symbol)

      if (normalized) {
        setActiveSymbol(normalized)
      }

      setActiveCenterView(nextView)
    }

    window.addEventListener('ai-coach-widget-chart', onChart)
    window.addEventListener('ai-coach-widget-options', onOptions)
    window.addEventListener('ai-coach-widget-alert', onAlert)
    window.addEventListener('ai-coach-widget-analyze', onAnalyze)
    window.addEventListener('ai-coach-widget-chat', onChat)
    window.addEventListener('ai-coach-widget-view', onView)

    return () => {
      window.removeEventListener('ai-coach-widget-chart', onChart)
      window.removeEventListener('ai-coach-widget-options', onOptions)
      window.removeEventListener('ai-coach-widget-alert', onAlert)
      window.removeEventListener('ai-coach-widget-analyze', onAnalyze)
      window.removeEventListener('ai-coach-widget-chat', onChat)
      window.removeEventListener('ai-coach-widget-view', onView)
    }
  }, [analyzeSetup, sendToChat, viewChartAtLevel, viewOptionsNearStrike])

  const value = useMemo<AICoachWorkflowContextValue>(() => ({
    activeSymbol,
    activeExpiry,
    activeStrike,
    activeSetup,
    activeLevels,
    chartAnnotations,
    activeCenterView,

    setSymbol,
    setExpiry,
    setStrike,
    setCenterView,
    setActiveLevels,
    setChartAnnotations,

    viewChartAtLevel,
    viewOptionsNearStrike,
    sendToChat,
    analyzeSetup,
    journalTrade,
  }), [
    activeSymbol,
    activeExpiry,
    activeStrike,
    activeSetup,
    activeLevels,
    chartAnnotations,
    activeCenterView,
    setSymbol,
    setExpiry,
    setStrike,
    setCenterView,
    setActiveLevels,
    setChartAnnotations,
    viewChartAtLevel,
    viewOptionsNearStrike,
    sendToChat,
    analyzeSetup,
    journalTrade,
  ])

  return (
    <AICoachWorkflowContext.Provider value={value}>
      {children}
    </AICoachWorkflowContext.Provider>
  )
}

export function useAICoachWorkflow(): AICoachWorkflowContextValue {
  const context = useContext(AICoachWorkflowContext)
  if (!context) {
    throw new Error('useAICoachWorkflow must be used within AICoachWorkflowProvider')
  }
  return context
}
