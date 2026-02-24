const ACTIVE_CHART_SYMBOL_REGEX = /^[A-Z0-9._:-]{1,10}$/

export const AI_COACH_ACTIVE_CHART_SYMBOL_EVENT = 'ai-coach-active-chart-symbol'

declare global {
  interface Window {
    __ITM_AI_COACH_ACTIVE_SYMBOL__?: string
  }
}

function normalizeChartSymbol(symbol: string | null | undefined): string | null {
  if (typeof symbol !== 'string') return null
  const normalized = symbol.trim().toUpperCase()
  if (!ACTIVE_CHART_SYMBOL_REGEX.test(normalized)) return null
  return normalized
}

export function getActiveChartSymbol(fallback: string = 'SPX'): string {
  if (typeof window === 'undefined') {
    return normalizeChartSymbol(fallback) || 'SPX'
  }

  const active = normalizeChartSymbol(window.__ITM_AI_COACH_ACTIVE_SYMBOL__)
  if (active) return active

  return normalizeChartSymbol(fallback) || 'SPX'
}

export function setActiveChartSymbol(symbol: string | null | undefined): void {
  if (typeof window === 'undefined') return

  const normalized = normalizeChartSymbol(symbol)
  if (!normalized) return

  window.__ITM_AI_COACH_ACTIVE_SYMBOL__ = normalized
  window.dispatchEvent(new CustomEvent(AI_COACH_ACTIVE_CHART_SYMBOL_EVENT, {
    detail: { symbol: normalized },
  }))
}

export function subscribeActiveChartSymbol(handler: (symbol: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ symbol?: string }>).detail
    const symbol = normalizeChartSymbol(detail?.symbol)
    if (!symbol) return
    handler(symbol)
  }

  window.addEventListener(AI_COACH_ACTIVE_CHART_SYMBOL_EVENT, listener)
  return () => {
    window.removeEventListener(AI_COACH_ACTIVE_CHART_SYMBOL_EVENT, listener)
  }
}
