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

  it('preserves full chart request payload for chart events', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-chart', {
      symbol: 'TSLA',
      timeframe: '1D',
      chartRequest: {
        symbol: 'TSLA',
        timeframe: '1D',
        levels: {
          resistance: [{ name: 'Fib 100%', price: 452.43 }],
          support: [{ name: 'Fib 38.2%', price: 412.32 }],
        },
      },
    })

    expect(result).toMatchObject({
      view: 'chart',
      symbol: 'TSLA',
      params: {
        timeframe: '1D',
        chartRequest: {
          symbol: 'TSLA',
          timeframe: '1D',
        },
      },
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

  it('ignores alert events (chat-only flow)', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-alert', {
      symbol: 'QQQ',
      alertType: 'price_above',
      price: 530,
    })

    expect(result).toBeNull()
  })

  it('maps analyze events to chart sheet payload', () => {
    const result = resolveMobileSheetFromWidgetEvent('ai-coach-widget-analyze', {
      setup: { symbol: 'SPX', direction: 'bullish' },
    })

    expect(result).toMatchObject({
      view: 'chart',
      symbol: 'SPX',
    })
  })

  it('maps legacy view requests to supported mobile sheets', () => {
    const valid = resolveMobileSheetFromWidgetEvent('ai-coach-widget-view', {
      view: 'brief',
      symbol: 'SPX',
    })
    const invalid = resolveMobileSheetFromWidgetEvent('ai-coach-widget-view', { symbol: 'SPX' })

    expect(valid).toMatchObject({ view: 'chart', symbol: 'SPX' })
    expect(invalid).toMatchObject({ view: 'chart', symbol: 'SPX' })
  })
})
