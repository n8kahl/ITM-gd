import { describe, expect, it } from 'vitest'
import {
  createWidgetEventDeduper,
  createWidgetEventId,
  readWidgetEventId,
} from '@/lib/ai-coach/widget-event-dedupe'

describe('widget event dedupe utilities', () => {
  it('creates deterministic ids when random UUID provider is injected', () => {
    expect(createWidgetEventId(() => 'event-123')).toBe('event-123')
  })

  it('reads normalized eventId from detail payloads', () => {
    expect(readWidgetEventId({ eventId: '  abc-1  ' })).toBe('abc-1')
    expect(readWidgetEventId({ eventId: '' })).toBeNull()
    expect(readWidgetEventId(null)).toBeNull()
    expect(readWidgetEventId('invalid')).toBeNull()
  })

  it('suppresses duplicate processing for same eventName + eventId', () => {
    const shouldHandle = createWidgetEventDeduper(60_000)
    const detail = { eventId: 'shared-id-1' }

    expect(shouldHandle('ai-coach-widget-chat', detail)).toBe(true)
    expect(shouldHandle('ai-coach-widget-chat', detail)).toBe(false)
  })

  it('allows the same eventId across different event channels', () => {
    const shouldHandle = createWidgetEventDeduper(60_000)
    const detail = { eventId: 'shared-id-2' }

    expect(shouldHandle('ai-coach-widget-chart', detail)).toBe(true)
    expect(shouldHandle('ai-coach-widget-options', detail)).toBe(true)
  })

  it('does not block events without ids', () => {
    const shouldHandle = createWidgetEventDeduper(60_000)

    expect(shouldHandle('ai-coach-widget-chat', { prompt: 'one' })).toBe(true)
    expect(shouldHandle('ai-coach-widget-chat', { prompt: 'one' })).toBe(true)
  })
})

