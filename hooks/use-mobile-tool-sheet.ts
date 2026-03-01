'use client'

import { useCallback, useEffect, useState } from 'react'

export type MobileToolView =
  | 'chart'
  | 'options'
  | 'journal'

interface MobileToolSheetState {
  activeSheet: MobileToolView | null
  sheetSymbol: string | null
  sheetParams: Record<string, unknown>
}

const SUPPORTED_CHART_TIMEFRAMES = new Set(['1m', '5m', '15m', '1h', '4h', '1D'])
const MOBILE_SHEET_BREAKPOINT_PX = 1024

export interface MobileSheetBridgeResult {
  view: MobileToolView
  symbol: string | null
  params: Record<string, unknown>
}

export const MOBILE_WIDGET_EVENTS = [
  'ai-coach-widget-chart',
  'ai-coach-widget-options',
  'ai-coach-widget-alert',
  'ai-coach-widget-analyze',
  'ai-coach-widget-view',
] as const

type MobileWidgetEvent = (typeof MOBILE_WIDGET_EVENTS)[number]

export function resolveMobileSheetFromWidgetEvent(
  eventName: MobileWidgetEvent,
  detail: Record<string, unknown> | null | undefined,
): MobileSheetBridgeResult | null {
  if (eventName === 'ai-coach-widget-chart') {
    const timeframe = typeof detail?.timeframe === 'string' && SUPPORTED_CHART_TIMEFRAMES.has(detail.timeframe)
      ? detail.timeframe
      : '5m'
    const symbol = typeof detail?.symbol === 'string' ? detail.symbol : null
    const chartRequest = detail?.chartRequest

    return {
      view: 'chart',
      symbol,
      params: {
        level: detail?.level,
        timeframe,
        label: detail?.label,
        ...(chartRequest && typeof chartRequest === 'object'
          ? { chartRequest }
          : symbol
            ? {
                chartRequest: {
                  symbol,
                  timeframe,
                  levels: detail?.levels,
                  gexProfile: detail?.gexProfile,
                  contextNotes: detail?.contextNotes,
                  eventMarkers: detail?.eventMarkers,
                  positionOverlays: detail?.positionOverlays,
                },
              }
            : {}),
      },
    }
  }

  if (eventName === 'ai-coach-widget-options') {
    return {
      view: 'options',
      symbol: typeof detail?.symbol === 'string' ? detail.symbol : null,
      params: {
        strike: detail?.strike,
        expiry: detail?.expiry,
      },
    }
  }

  if (eventName === 'ai-coach-widget-analyze') {
    const setup = detail?.setup as Record<string, unknown> | undefined
    const symbol = typeof setup?.symbol === 'string' ? setup.symbol : null
    return {
      view: 'chart',
      symbol,
      params: symbol
        ? {
            setup,
            chartRequest: {
              symbol,
              timeframe: '15m',
            },
          }
        : { setup },
    }
  }

  if (eventName === 'ai-coach-widget-alert') {
    return null
  }

  const requestedView = typeof detail?.view === 'string' ? detail.view : null
  const symbol = typeof detail?.symbol === 'string' ? detail.symbol : null

  if (requestedView === 'options') {
    return { view: 'options', symbol, params: {} }
  }
  if (requestedView === 'journal') {
    return { view: 'journal', symbol, params: {} }
  }

  return {
    view: 'chart',
    symbol,
    params: symbol
      ? {
          chartRequest: {
            symbol,
            timeframe: '5m',
          },
        }
      : {},
  }
}

export function useMobileToolSheet() {
  const [state, setState] = useState<MobileToolSheetState>({
    activeSheet: null,
    sheetSymbol: null,
    sheetParams: {},
  })

  const openSheet = useCallback((view: MobileToolView, symbol?: string, params?: Record<string, unknown>) => {
    setState({
      activeSheet: view,
      sheetSymbol: symbol ?? null,
      sheetParams: params ?? {},
    })
  }, [])

  const closeSheet = useCallback(() => {
    setState({
      activeSheet: null,
      sheetSymbol: null,
      sheetParams: {},
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isMobile = () => window.innerWidth < MOBILE_SHEET_BREAKPOINT_PX

    const handleChart = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent).detail
      const mapped = resolveMobileSheetFromWidgetEvent('ai-coach-widget-chart', detail)
      if (mapped) openSheet(mapped.view, mapped.symbol ?? undefined, mapped.params)
    }

    const handleOptions = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent).detail
      const mapped = resolveMobileSheetFromWidgetEvent('ai-coach-widget-options', detail)
      if (mapped) openSheet(mapped.view, mapped.symbol ?? undefined, mapped.params)
    }

    const handleAlert = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent).detail
      const mapped = resolveMobileSheetFromWidgetEvent('ai-coach-widget-alert', detail)
      if (mapped) openSheet(mapped.view, mapped.symbol ?? undefined, mapped.params)
    }

    const handleAnalyze = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent).detail
      const mapped = resolveMobileSheetFromWidgetEvent('ai-coach-widget-analyze', detail)
      if (mapped) openSheet(mapped.view, mapped.symbol ?? undefined, mapped.params)
    }

    const handleView = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent).detail
      const mapped = resolveMobileSheetFromWidgetEvent('ai-coach-widget-view', detail)
      if (mapped) openSheet(mapped.view, mapped.symbol ?? undefined, mapped.params)
    }

    const handleShowChart = (event: Event) => {
      if (!isMobile()) return
      const detail = (event as CustomEvent<Record<string, unknown> | null | undefined>).detail
      if (!detail || typeof detail !== 'object') return

      const symbol = typeof detail.symbol === 'string' ? detail.symbol : null
      if (!symbol) return

      const timeframe = typeof detail.timeframe === 'string' && SUPPORTED_CHART_TIMEFRAMES.has(detail.timeframe)
        ? detail.timeframe
        : '5m'

      openSheet('chart', symbol, {
        symbol,
        timeframe,
        chartRequest: {
          symbol,
          timeframe,
          levels: detail.levels,
          gexProfile: detail.gexProfile,
          contextNotes: detail.contextNotes,
          eventMarkers: detail.eventMarkers,
          positionOverlays: detail.positionOverlays,
        },
      })
    }

    window.addEventListener('ai-coach-widget-chart', handleChart)
    window.addEventListener('ai-coach-widget-options', handleOptions)
    window.addEventListener('ai-coach-widget-alert', handleAlert)
    window.addEventListener('ai-coach-widget-analyze', handleAnalyze)
    window.addEventListener('ai-coach-widget-view', handleView)
    window.addEventListener('ai-coach-show-chart', handleShowChart)

    return () => {
      window.removeEventListener('ai-coach-widget-chart', handleChart)
      window.removeEventListener('ai-coach-widget-options', handleOptions)
      window.removeEventListener('ai-coach-widget-alert', handleAlert)
      window.removeEventListener('ai-coach-widget-analyze', handleAnalyze)
      window.removeEventListener('ai-coach-widget-view', handleView)
      window.removeEventListener('ai-coach-show-chart', handleShowChart)
    }
  }, [openSheet])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleViewportChange = () => {
      if (window.innerWidth >= MOBILE_SHEET_BREAKPOINT_PX) {
        closeSheet()
      }
    }

    handleViewportChange()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
    }
  }, [closeSheet])

  return { ...state, openSheet, closeSheet }
}
