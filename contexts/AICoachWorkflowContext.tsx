'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import type { AlertType, ChartTimeframe, PositionInput } from '@/lib/api/ai-coach'

export type WorkflowCenterView =
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
  | 'watchlist'
  | 'preferences'

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

export interface WorkflowAlertPrefill {
  symbol: string
  targetValue: number
  alertType: AlertType
  notes?: string
}

export interface WorkflowStep {
  id: string
  label: string
  view?: WorkflowCenterView
  symbol?: string
  strike?: number
  expiry?: string
  timeframe?: ChartTimeframe
  level?: number
}

interface AICoachWorkflowState {
  activeSymbol: string | null
  activeExpiry: string | null
  activeStrike: number | null
  activeSetup: Record<string, unknown> | null
  activeLevels: WorkflowLevel[] | null
  openPositions: PositionInput[] | null
  chartAnnotations: WorkflowChartAnnotation[] | null
  activeCenterView: WorkflowCenterView | null
  pendingAlert: WorkflowAlertPrefill | null
  workflowPath: WorkflowStep[]
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
    options?: { label?: string; timeframe?: ChartTimeframe; noteStep?: boolean }
  ) => void
  viewOptionsNearStrike: (
    symbol: string,
    strike?: number,
    expiry?: string,
    options?: { noteStep?: boolean }
  ) => void
  createAlertAtLevel: (
    symbol: string,
    price: number,
    alertType?: AlertType,
    notes?: string
  ) => void
  sendToChat: (prompt: string) => void
  viewChartForSetup: (setup: Record<string, unknown>) => void
  analyzeSetup: (setup: Record<string, unknown>) => void
  trackPosition: (position: PositionInput) => void
  journalTrade: (trade: Record<string, unknown>) => void

  clearPendingAlert: () => void
  pushWorkflowStep: (step: Omit<WorkflowStep, 'id'>) => void
  goToWorkflowStep: (index: number) => void
  clearWorkflowPath: () => void
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
  const [openPositions, setOpenPositions] = useState<PositionInput[] | null>(null)
  const [chartAnnotations, setChartAnnotationsState] = useState<WorkflowChartAnnotation[] | null>(null)
  const [activeCenterView, setActiveCenterView] = useState<WorkflowCenterView | null>(null)
  const [pendingAlert, setPendingAlert] = useState<WorkflowAlertPrefill | null>(null)
  const [workflowPath, setWorkflowPath] = useState<WorkflowStep[]>([])

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

  const pushWorkflowStep = useCallback((step: Omit<WorkflowStep, 'id'>) => {
    setWorkflowPath((prev) => {
      const last = prev[prev.length - 1]
      if (
        last
        && last.label === step.label
        && last.view === step.view
        && last.symbol === step.symbol
        && last.strike === step.strike
      ) {
        return prev
      }

      const next: WorkflowStep = {
        ...step,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }
      return [...prev, next].slice(-8)
    })
  }, [])

  const clearWorkflowPath = useCallback(() => {
    setWorkflowPath([])
  }, [])

  const viewChartAtLevel = useCallback((
    symbol: string,
    level?: number,
    options?: { label?: string; timeframe?: ChartTimeframe; noteStep?: boolean },
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
    } else {
      setChartAnnotationsState(null)
      dispatchChartEvent({ symbol: normalized, timeframe })
    }

    if (options?.noteStep !== false) {
      pushWorkflowStep({
        label: typeof level === 'number'
          ? `${normalized} ${options?.label || 'level'} ${Math.round(level)}`
          : `${normalized} chart`,
        view: 'chart',
        symbol: normalized,
        level: typeof level === 'number' ? level : undefined,
        timeframe,
      })
    }
  }, [pushWorkflowStep])

  const viewOptionsNearStrike = useCallback((
    symbol: string,
    strike?: number,
    expiry?: string,
    options?: { noteStep?: boolean },
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

    if (options?.noteStep !== false) {
      pushWorkflowStep({
        label: typeof strike === 'number'
          ? `${normalized} options ${Math.round(strike)} strike`
          : `${normalized} options`,
        view: 'options',
        symbol: normalized,
        strike,
        expiry,
      })
    }
  }, [pushWorkflowStep])

  const createAlertAtLevel = useCallback((
    symbol: string,
    price: number,
    alertType: AlertType = 'level_approach',
    notes?: string,
  ) => {
    const normalized = normalizeSymbol(symbol)
    if (!normalized || !Number.isFinite(price)) return

    setPendingAlert({
      symbol: normalized,
      targetValue: price,
      alertType,
      notes,
    })
    setActiveSymbol(normalized)
    setActiveCenterView('alerts')

    pushWorkflowStep({
      label: `${normalized} alert ${Math.round(price)}`,
      view: 'alerts',
      symbol: normalized,
      level: price,
    })
  }, [pushWorkflowStep])

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

  const viewChartForSetup = useCallback((setup: Record<string, unknown>) => {
    const symbol = normalizeSymbol(String(setup.symbol || setup.ticker || 'SPX'))
    if (!symbol) return

    const timeframe = String(setup.timeframe || '15m') as ChartTimeframe
    const entry = Number(setup.entry)

    setActiveSetup(setup)
    setActiveSymbol(symbol)
    setActiveCenterView('chart')

    viewChartAtLevel(symbol, Number.isFinite(entry) ? entry : undefined, {
      label: 'Setup Entry',
      timeframe,
      noteStep: false,
    })

    pushWorkflowStep({
      label: `${symbol} setup chart (${timeframe})`,
      view: 'chart',
      symbol,
      timeframe,
      level: Number.isFinite(entry) ? entry : undefined,
    })
  }, [pushWorkflowStep, viewChartAtLevel])

  const analyzeSetup = useCallback((setup: Record<string, unknown>) => {
    setActiveSetup(setup)

    const symbol = normalizeSymbol(String(setup.symbol || setup.ticker || ''))
    if (symbol) setActiveSymbol(symbol)

    setActiveCenterView('position')
    pushWorkflowStep({
      label: symbol ? `${symbol} analyze setup` : 'Analyze setup',
      view: 'position',
      symbol: symbol || undefined,
    })

    if (symbol) {
      const direction = String(setup.direction || 'setup')
      const entry = setup.entry != null ? ` near ${setup.entry}` : ''
      sendToChat(`Analyze ${symbol} ${direction} setup${entry} and provide risk-managed trade ideas.`)
    }
  }, [pushWorkflowStep, sendToChat])

  const trackPosition = useCallback((position: PositionInput) => {
    setOpenPositions((prev) => {
      const existing = prev || []
      const key = `${position.symbol}-${position.type}-${position.strike || 'na'}-${position.expiry || 'na'}`
      const hasExisting = existing.some((p) => `${p.symbol}-${p.type}-${p.strike || 'na'}-${p.expiry || 'na'}` === key)
      return hasExisting ? existing : [...existing, position]
    })

    setActiveCenterView('tracked')
    pushWorkflowStep({
      label: `${position.symbol} tracked position`,
      view: 'tracked',
      symbol: normalizeSymbol(position.symbol) || undefined,
      strike: position.strike,
      expiry: position.expiry,
    })
  }, [pushWorkflowStep])

  const journalTrade = useCallback((trade: Record<string, unknown>) => {
    const symbol = normalizeSymbol(String(trade.symbol || ''))
    if (symbol) setActiveSymbol(symbol)

    setActiveCenterView('journal')
    pushWorkflowStep({
      label: symbol ? `${symbol} journal` : 'Journal trade',
      view: 'journal',
      symbol: symbol || undefined,
    })
  }, [pushWorkflowStep])

  const clearPendingAlert = useCallback(() => {
    setPendingAlert(null)
  }, [])

  const goToWorkflowStep = useCallback((index: number) => {
    setWorkflowPath((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const step = prev[index]

      if (step.symbol) setActiveSymbol(step.symbol)
      if (typeof step.strike === 'number') setActiveStrike(step.strike)
      if (step.expiry) setActiveExpiry(step.expiry)
      if (step.view) setActiveCenterView(step.view)

      if (step.view === 'chart' && step.symbol) {
        viewChartAtLevel(step.symbol, step.level, {
          label: 'Workflow',
          timeframe: step.timeframe || '5m',
          noteStep: false,
        })
      } else if (step.view === 'options' && step.symbol) {
        viewOptionsNearStrike(step.symbol, step.strike, step.expiry, { noteStep: false })
      }

      return prev.slice(0, index + 1)
    })
  }, [viewChartAtLevel, viewOptionsNearStrike])

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
      const detail = (event as CustomEvent<{ symbol?: string; price?: number; alertType?: AlertType; notes?: string }>).detail
      if (!detail?.symbol || typeof detail.price !== 'number') return
      createAlertAtLevel(detail.symbol, detail.price, detail.alertType, detail.notes)
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
      const detail = (event as CustomEvent<{ view?: WorkflowCenterView; symbol?: string; label?: string }>).detail
      if (!detail?.view) return

      const normalized = normalizeSymbol(detail.symbol)
      if (normalized) {
        setActiveSymbol(normalized)
      }

      setActiveCenterView(detail.view)
      pushWorkflowStep({
        label: detail.label || `Open ${detail.view}`,
        view: detail.view,
        symbol: normalized || undefined,
      })
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
  }, [analyzeSetup, createAlertAtLevel, pushWorkflowStep, sendToChat, viewChartAtLevel, viewOptionsNearStrike])

  const value = useMemo<AICoachWorkflowContextValue>(() => ({
    activeSymbol,
    activeExpiry,
    activeStrike,
    activeSetup,
    activeLevels,
    openPositions,
    chartAnnotations,
    activeCenterView,
    pendingAlert,
    workflowPath,

    setSymbol,
    setExpiry,
    setStrike,
    setCenterView,
    setActiveLevels,
    setChartAnnotations,

    viewChartAtLevel,
    viewOptionsNearStrike,
    createAlertAtLevel,
    sendToChat,
    viewChartForSetup,
    analyzeSetup,
    trackPosition,
    journalTrade,

    clearPendingAlert,
    pushWorkflowStep,
    goToWorkflowStep,
    clearWorkflowPath,
  }), [
    activeSymbol,
    activeExpiry,
    activeStrike,
    activeSetup,
    activeLevels,
    openPositions,
    chartAnnotations,
    activeCenterView,
    pendingAlert,
    workflowPath,
    setSymbol,
    setExpiry,
    setStrike,
    setCenterView,
    setActiveLevels,
    setChartAnnotations,
    viewChartAtLevel,
    viewOptionsNearStrike,
    createAlertAtLevel,
    sendToChat,
    viewChartForSetup,
    analyzeSetup,
    trackPosition,
    journalTrade,
    clearPendingAlert,
    pushWorkflowStep,
    goToWorkflowStep,
    clearWorkflowPath,
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
