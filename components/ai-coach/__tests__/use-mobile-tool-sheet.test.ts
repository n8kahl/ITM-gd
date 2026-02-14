import { describe, expect, it } from 'vitest'
import { resolveMobileSheetFromWidgetEvent } from '@/hooks/use-mobile-tool-sheet'

describe('resolveMobileSheetFromWidgetEvent', () => {
  it('maps chart events to chart sheet payload', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-chart', {
      symbol: 'SPX',
      level: 6100,
      timeframe: '5m',
    })

    expect(result).toMatchObject({
      view: 'chart',
      symbol: 'SPX',
      params: { level: 6100, timeframe: '5m' },
    })
  })

  it('maps options events to options sheet payload', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-options', {
      symbol: 'AAPL',
      strike: 250,
      expiry: '2026-03-20',
    })

    expect(result).toMatchObject({
      view: 'options',
      symbol: 'AAPL',
      params: { strike: 250, expiry: '2026-03-20' },
    })
  })

  it('maps alert events to alerts sheet payload', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-alert', {
      symbol: 'QQQ',
      alertType: 'price_above',
      price: 530,
    })

    expect(result).toMatchObject({
      view: 'alerts',
      symbol: 'QQQ',
      params: { alertType: 'price_above', price: 530 },
    })
  })

  it('maps analyze events to position sheet payload', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-analyze', {
      setup: { symbol: 'SPX', direction: 'bullish' },
    })

    expect(result).toMatchObject({
      view: 'position',
      symbol: 'SPX',
    })
  })

  it('maps view events and returns null when view is missing', () => {
    const valid = resolveMobileSheetFromWidgetEvent('ai-coach-widget-view', {
      view: 'brief',
      symbol: 'SPX',
    })
    const invalid = resolveMobileSheetFromWidgetEvent('ai-coach-widget-view', { symbol: 'SPX' })

    expect(valid).toMatchObject({ view: 'brief', symbol: 'SPX' })
    expect(invalid).toBeNull()
  })
})
