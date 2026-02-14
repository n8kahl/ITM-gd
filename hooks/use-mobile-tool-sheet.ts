'use client'

import { useCallback, useEffect, useState } from 'react'

export type MobileToolView =
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

interface MobileToolSheetState {
  activeSheet: MobileToolView | null
  sheetSymbol: string | null
  sheetParams: Record<string, unknown>
}

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
    return {
      view: 'chart',
      symbol: typeof detail?.symbol === 'string' ? detail.symbol : null,
      params: {
        level: detail?.level,
        timeframe: detail?.timeframe,
        label: detail?.label,
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

  if (eventName === 'ai-coach-widget-alert') {
    return {
      view: 'alerts',
      symbol: typeof detail?.symbol === 'string' ? detail.symbol : null,
      params: {
        price: detail?.price,
        alertType: detail?.alertType,
        notes: detail?.notes,
      },
    }
  }

  if (eventName === 'ai-coach-widget-analyze') {
    const setup = detail?.setup as Record<string, unknown> | undefined
    return {
      view: 'position',
      symbol: typeof setup?.symbol === 'string' ? setup.symbol : null,
      params: { setup },
    }
  }

  const view = detail?.view
  if (typeof view !== 'string') return null

  return {
    view: view as MobileToolView,
    symbol: typeof detail?.symbol === 'string' ? detail.symbol : null,
    params: {},
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

    const isMobile = () => window.innerWidth < 1024

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

    window.addEventListener('ai-coach-widget-chart', handleChart)
    window.addEventListener('ai-coach-widget-options', handleOptions)
    window.addEventListener('ai-coach-widget-alert', handleAlert)
    window.addEventListener('ai-coach-widget-analyze', handleAnalyze)
    window.addEventListener('ai-coach-widget-view', handleView)

    return () => {
      window.removeEventListener('ai-coach-widget-chart', handleChart)
      window.removeEventListener('ai-coach-widget-options', handleOptions)
      window.removeEventListener('ai-coach-widget-alert', handleAlert)
      window.removeEventListener('ai-coach-widget-analyze', handleAnalyze)
      window.removeEventListener('ai-coach-widget-view', handleView)
    }
  }, [openSheet])

  return { ...state, openSheet, closeSheet }
}
