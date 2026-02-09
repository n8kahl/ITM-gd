'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from 'recharts'
import { Loader2, RefreshCw, LayoutGrid, SlidersHorizontal } from 'lucide-react'
import type { LayoutItem } from 'react-grid-layout'
import type { AdvancedAnalyticsResponse } from '@/lib/types/journal'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'
import {
  CustomizableDashboard,
  type DashboardLayouts,
  type DashboardWidget,
} from '@/components/dashboard/customizable-dashboard'

type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y'
type DashboardPreset = 'overview' | 'risk-focus' | 'options-trader'
type WidgetId =
  | 'kpi-overview'
  | 'equity-curve'
  | 'mfe-mae'
  | 'r-multiple'
  | 'dte-performance'
  | 'time-of-day'
  | 'day-of-week'
  | 'symbol-performance'
  | 'direction-win-rate'

interface DashboardLayoutPreference {
  version: 1
  preset: DashboardPreset
  visibleWidgetIds: WidgetId[]
  layouts: DashboardLayouts
}

const WIDGET_IDS: WidgetId[] = [
  'kpi-overview',
  'equity-curve',
  'mfe-mae',
  'r-multiple',
  'dte-performance',
  'time-of-day',
  'day-of-week',
  'symbol-performance',
  'direction-win-rate',
]

const DASHBOARD_PRESETS: Record<DashboardPreset, { label: string; widgets: WidgetId[]; layouts: DashboardLayouts }> = {
  overview: {
    label: 'Overview',
    widgets: [...WIDGET_IDS],
    layouts: {
      lg: [
        { i: 'kpi-overview', x: 0, y: 0, w: 12, h: 8 },
        { i: 'equity-curve', x: 0, y: 8, w: 6, h: 11 },
        { i: 'mfe-mae', x: 6, y: 8, w: 6, h: 11 },
        { i: 'r-multiple', x: 0, y: 19, w: 6, h: 11 },
        { i: 'dte-performance', x: 6, y: 19, w: 6, h: 11 },
        { i: 'time-of-day', x: 0, y: 30, w: 6, h: 11 },
        { i: 'day-of-week', x: 6, y: 30, w: 6, h: 11 },
        { i: 'symbol-performance', x: 0, y: 41, w: 6, h: 11 },
        { i: 'direction-win-rate', x: 6, y: 41, w: 6, h: 11 },
      ],
    },
  },
  'risk-focus': {
    label: 'Risk Focus',
    widgets: [
      'kpi-overview',
      'r-multiple',
      'mfe-mae',
      'equity-curve',
      'dte-performance',
      'direction-win-rate',
      'time-of-day',
    ],
    layouts: {
      lg: [
        { i: 'kpi-overview', x: 0, y: 0, w: 12, h: 8 },
        { i: 'r-multiple', x: 0, y: 8, w: 7, h: 13 },
        { i: 'mfe-mae', x: 7, y: 8, w: 5, h: 13 },
        { i: 'equity-curve', x: 0, y: 21, w: 7, h: 13 },
        { i: 'dte-performance', x: 7, y: 21, w: 5, h: 13 },
        { i: 'direction-win-rate', x: 0, y: 34, w: 6, h: 11 },
        { i: 'time-of-day', x: 6, y: 34, w: 6, h: 11 },
      ],
    },
  },
  'options-trader': {
    label: 'Options Trader',
    widgets: [
      'kpi-overview',
      'dte-performance',
      'mfe-mae',
      'equity-curve',
      'symbol-performance',
      'time-of-day',
      'day-of-week',
      'direction-win-rate',
    ],
    layouts: {
      lg: [
        { i: 'kpi-overview', x: 0, y: 0, w: 12, h: 8 },
        { i: 'dte-performance', x: 0, y: 8, w: 6, h: 13 },
        { i: 'mfe-mae', x: 6, y: 8, w: 6, h: 13 },
        { i: 'equity-curve', x: 0, y: 21, w: 6, h: 11 },
        { i: 'symbol-performance', x: 6, y: 21, w: 6, h: 11 },
        { i: 'time-of-day', x: 0, y: 32, w: 4, h: 11 },
        { i: 'day-of-week', x: 4, y: 32, w: 4, h: 11 },
        { i: 'direction-win-rate', x: 8, y: 32, w: 4, h: 11 },
      ],
    },
  },
}

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['7d', '30d', '90d', '1y']
const DASHBOARD_BREAKPOINTS = ['lg', 'md', 'sm', 'xs', 'xxs'] as const

function isWidgetId(value: string): value is WidgetId {
  return WIDGET_IDS.includes(value as WidgetId)
}

function isPreset(value: string): value is DashboardPreset {
  return value in DASHBOARD_PRESETS
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}$${Math.abs(value).toFixed(2)}`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

function dayLabel(day: number): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return labels[day] || String(day)
}

function toRoundedNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function filterLayoutsByVisibleIds(layouts: DashboardLayouts, visibleWidgetIds: WidgetId[]): DashboardLayouts {
  const visible = new Set(visibleWidgetIds)
  const next: DashboardLayouts = {}

  for (const breakpoint of DASHBOARD_BREAKPOINTS) {
    const rawLayouts = layouts[breakpoint]
    if (!Array.isArray(rawLayouts)) continue
    next[breakpoint] = rawLayouts
      .filter((layout) => visible.has(layout.i as WidgetId))
      .map((layout) => ({
        ...layout,
        i: layout.i,
        x: toRoundedNumber(layout.x, 0),
        y: toRoundedNumber(layout.y, 0),
        w: Math.max(1, toRoundedNumber(layout.w, 4)),
        h: Math.max(4, toRoundedNumber(layout.h, 8)),
      }))
  }

  return next
}

function createPresetLayoutPreference(preset: DashboardPreset): DashboardLayoutPreference {
  const presetConfig = DASHBOARD_PRESETS[preset]
  return {
    version: 1,
    preset,
    visibleWidgetIds: [...presetConfig.widgets],
    layouts: filterLayoutsByVisibleIds(presetConfig.layouts, presetConfig.widgets),
  }
}

function parseLayoutItem(raw: unknown): LayoutItem | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.i === 'string' ? raw.i : null
  if (!id || !isWidgetId(id)) return null

  return {
    i: id,
    x: Math.max(0, toRoundedNumber(raw.x, 0)),
    y: Math.max(0, toRoundedNumber(raw.y, 0)),
    w: Math.max(1, toRoundedNumber(raw.w, 4)),
    h: Math.max(4, toRoundedNumber(raw.h, 8)),
    minW: Math.max(1, toRoundedNumber(raw.minW, 1)),
    minH: Math.max(1, toRoundedNumber(raw.minH, 4)),
  }
}

function parseStoredLayoutPreference(raw: unknown): DashboardLayoutPreference | null {
  if (!isRecord(raw)) return null

  const presetValue = typeof raw.preset === 'string' && isPreset(raw.preset) ? raw.preset : 'overview'
  const rawVisible = Array.isArray(raw.visibleWidgetIds) ? raw.visibleWidgetIds : []
  const visibleWidgetIds = rawVisible
    .filter((id): id is string => typeof id === 'string')
    .filter((id): id is WidgetId => isWidgetId(id))

  const effectiveVisible = visibleWidgetIds.length > 0
    ? Array.from(new Set(visibleWidgetIds))
    : [...DASHBOARD_PRESETS[presetValue].widgets]

  const parsedLayouts: DashboardLayouts = {}
  if (isRecord(raw.layouts)) {
    const rawLayouts = raw.layouts as Record<string, unknown>
    for (const breakpoint of DASHBOARD_BREAKPOINTS) {
      const value = rawLayouts[breakpoint]
      if (!Array.isArray(value)) continue
      parsedLayouts[breakpoint] = value
        .map(parseLayoutItem)
        .filter((layout): layout is LayoutItem => Boolean(layout))
    }
  }

  return {
    version: 1,
    preset: presetValue,
    visibleWidgetIds: effectiveVisible,
    layouts: filterLayoutsByVisibleIds(parsedLayouts, effectiveVisible),
  }
}

interface StatCardProps {
  title: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}

function StatCard({ title, value, tone = 'neutral' }: StatCardProps) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-400'
    : tone === 'negative'
      ? 'text-red-400'
      : 'text-ivory'

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className={`font-mono text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AdvancedAnalyticsResponse | null>(null)
  const [layoutState, setLayoutState] = useState<DashboardLayoutPreference>(
    createPresetLayoutPreference('overview'),
  )
  const [layoutLoading, setLayoutLoading] = useState(true)
  const [layoutSaving, setLayoutSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutReadyRef = useRef(false)

  const loadAnalytics = useCallback(async (selectedPeriod: AnalyticsPeriod) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/members/journal/analytics?period=${selectedPeriod}`)
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }
      const result = await response.json()
      if (!result.success || !result.data) {
        throw createAppError('Analytics payload was empty.')
      }
      setData(result.data)
    } catch (error) {
      notifyAppError(createAppError(error), {
        onRetry: () => {
          void loadAnalytics(selectedPeriod)
        },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDashboardLayout = useCallback(async () => {
    setLayoutLoading(true)
    layoutReadyRef.current = false

    try {
      const response = await fetch('/api/members/dashboard/layout', { cache: 'no-store' })
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }

      const result = await response.json()
      if (!result.success) {
        throw createAppError(result.error || 'Unable to load dashboard layout')
      }

      const parsed = parseStoredLayoutPreference(result.data)
      setLayoutState(parsed || createPresetLayoutPreference('overview'))
    } catch (error) {
      setLayoutState(createPresetLayoutPreference('overview'))
      notifyAppError(createAppError(error))
    } finally {
      setLayoutLoading(false)
      layoutReadyRef.current = true
    }
  }, [])

  const persistLayout = useCallback(async (nextState: DashboardLayoutPreference) => {
    setLayoutSaving(true)
    try {
      const response = await fetch('/api/members/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: nextState }),
      })
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }
      const result = await response.json()
      if (!result.success) {
        throw createAppError(result.error || 'Unable to persist dashboard layout')
      }
    } catch (error) {
      notifyAppError(createAppError(error), {
        retryLabel: 'Retry Save',
        onRetry: () => {
          void persistLayout(nextState)
        },
      })
    } finally {
      setLayoutSaving(false)
    }
  }, [])

  const queueLayoutSave = useCallback((nextState: DashboardLayoutPreference) => {
    if (!layoutReadyRef.current) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      void persistLayout(nextState)
    }, 650)
  }, [persistLayout])

  const updateLayoutState = useCallback((
    updater: (prev: DashboardLayoutPreference) => DashboardLayoutPreference,
  ) => {
    setLayoutState((prev) => {
      const next = updater(prev)
      queueLayoutSave(next)
      return next
    })
  }, [queueLayoutSave])

  useEffect(() => {
    void loadAnalytics(period)
  }, [loadAnalytics, period])

  useEffect(() => {
    void loadDashboardLayout()
  }, [loadDashboardLayout])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const equityData = useMemo(() => data?.equity_curve || [], [data])
  const mfeMaeData = useMemo(() => data?.mfe_mae_scatter || [], [data])

  const allWidgets = useMemo<DashboardWidget[]>(() => {
    if (!data) return []

    return [
      {
        id: 'kpi-overview',
        title: 'KPI Overview',
        description: 'Core performance metrics',
        defaultW: 12,
        defaultH: 8,
        minH: 7,
        content: (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard title="Win Rate" value={formatPercent(data.win_rate)} tone={data.win_rate >= 50 ? 'positive' : 'negative'} />
            <StatCard title="Expectancy" value={formatCurrency(data.expectancy)} tone={data.expectancy >= 0 ? 'positive' : 'negative'} />
            <StatCard title="Profit Factor" value={data.profit_factor == null ? '—' : formatNumber(data.profit_factor)} tone={(data.profit_factor || 0) >= 1 ? 'positive' : 'negative'} />
            <StatCard title="Sharpe Ratio" value={formatNumber(data.sharpe_ratio)} tone={data.sharpe_ratio >= 0 ? 'positive' : 'negative'} />
            <StatCard title="Max Drawdown" value={formatCurrency(data.max_drawdown)} tone={data.max_drawdown >= 0 ? 'positive' : 'negative'} />
            <StatCard title="Avg R-Multiple" value={formatNumber(data.avg_r_multiple)} tone={data.avg_r_multiple >= 0 ? 'positive' : 'negative'} />
          </div>
        ),
      },
      {
        id: 'equity-curve',
        title: 'Equity Curve',
        description: 'Equity progression across closed trades',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="trade_date" hide />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="equity" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'mfe-mae',
        title: 'MFE vs MAE',
        description: 'Execution efficiency scatter',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="mae" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis dataKey="mfe" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                <Scatter data={mfeMaeData} fill="#10B981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'r-multiple',
        title: 'R-Multiple Distribution',
        description: 'Risk-reward consistency',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.r_multiple_distribution || []}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'dte-performance',
        title: 'DTE Bucket Performance',
        description: 'Win rate by option DTE',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dte_buckets}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number, key: string) => key === 'win_rate' ? `${Number(value).toFixed(1)}%` : Number(value).toFixed(2)} />
                <Bar dataKey="win_rate" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'time-of-day',
        title: 'Time of Day P&L',
        description: 'Intraday performance buckets',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly_pnl}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour_of_day" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'day-of-week',
        title: 'Day of Week P&L',
        description: 'Day-level execution consistency',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.day_of_week_pnl.map((item) => ({ ...item, label: dayLabel(item.day_of_week) }))}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'symbol-performance',
        title: 'Symbol Performance',
        description: 'Top symbols by realized P&L',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.symbol_stats.slice(0, 10)}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="symbol" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number, key: string) => key === 'win_rate' ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
      {
        id: 'direction-win-rate',
        title: 'Direction Win Rate',
        description: 'Long vs short outcomes',
        defaultW: 6,
        defaultH: 11,
        content: (
          <div className="h-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.direction_stats}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="direction" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="win_rate" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      },
    ]
  }, [data, equityData, mfeMaeData])

  const widgetMap = useMemo(
    () => new Map(allWidgets.map((widget) => [widget.id, widget])),
    [allWidgets],
  )

  const visibleWidgets = useMemo(
    () => layoutState.visibleWidgetIds
      .map((widgetId) => widgetMap.get(widgetId))
      .filter((widget): widget is DashboardWidget => Boolean(widget)),
    [layoutState.visibleWidgetIds, widgetMap],
  )

  const handleToggleWidget = useCallback((widgetId: WidgetId) => {
    updateLayoutState((prev) => {
      const currentlyVisible = prev.visibleWidgetIds.includes(widgetId)
      if (currentlyVisible && prev.visibleWidgetIds.length === 1) {
        return prev
      }

      const nextVisible = currentlyVisible
        ? prev.visibleWidgetIds.filter((id) => id !== widgetId)
        : [...prev.visibleWidgetIds, widgetId]

      return {
        ...prev,
        visibleWidgetIds: nextVisible,
        layouts: filterLayoutsByVisibleIds(prev.layouts, nextVisible),
      }
    })
  }, [updateLayoutState])

  const handlePresetChange = useCallback((preset: DashboardPreset) => {
    updateLayoutState(() => createPresetLayoutPreference(preset))
  }, [updateLayoutState])

  const handleResetLayout = useCallback(() => {
    updateLayoutState((prev) => createPresetLayoutPreference(prev.preset))
  }, [updateLayoutState])

  if (loading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
        Unable to load analytics right now.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-serif text-ivory">Custom Analytics Dashboard</h2>
            <button
              type="button"
              onClick={() => {
                void loadAnalytics(period)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.04] hover:text-ivory"
              aria-label="Refresh analytics"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {layoutSaving && (
              <span className="text-[11px] text-emerald-300">Saving layout...</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  period === option
                    ? 'bg-emerald-900/30 text-emerald-300'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-ivory'
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(DASHBOARD_PRESETS).map(([presetKey, preset]) => {
            const isActive = layoutState.preset === presetKey
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => handlePresetChange(presetKey as DashboardPreset)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-900/25 text-emerald-300'
                    : 'border-white/[0.1] text-muted-foreground hover:text-ivory'
                }`}
              >
                {preset.label}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              editMode
                ? 'border-champagne/40 bg-champagne/10 text-champagne'
                : 'border-white/[0.1] text-muted-foreground hover:text-ivory'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {editMode ? 'Done Editing' : 'Edit Layout'}
          </button>

          <button
            type="button"
            onClick={handleResetLayout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-muted-foreground hover:text-ivory"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {editMode && (
        <div className="glass-card rounded-xl border border-white/[0.06] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Widget Visibility
          </div>
          <div className="flex flex-wrap gap-2">
            {allWidgets.map((widget) => {
              const isVisible = layoutState.visibleWidgetIds.includes(widget.id as WidgetId)
              const disableHide = isVisible && layoutState.visibleWidgetIds.length === 1
              return (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => handleToggleWidget(widget.id as WidgetId)}
                  disabled={disableHide}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    isVisible
                      ? 'border-emerald-500/40 bg-emerald-900/25 text-emerald-300'
                      : 'border-white/[0.08] text-muted-foreground hover:text-ivory'
                  } ${disableHide ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {widget.title}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {layoutLoading ? (
        <div className="glass-card rounded-xl p-5 text-sm text-muted-foreground">
          Loading saved layout...
        </div>
      ) : (
        <CustomizableDashboard
          widgets={visibleWidgets}
          layouts={layoutState.layouts}
          editable={editMode}
          onLayoutsChange={(nextLayouts) => {
            updateLayoutState((prev) => ({
              ...prev,
              layouts: filterLayoutsByVisibleIds(nextLayouts, prev.visibleWidgetIds),
            }))
          }}
        />
      )}
    </div>
  )
}
