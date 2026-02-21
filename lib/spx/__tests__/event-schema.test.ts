import { describe, expect, it } from 'vitest'

import { normalizeSPXRealtimeEvent } from '@/lib/spx/event-schema'

describe('event schema', () => {
  it('normalizes realtime price events with sequence metadata', () => {
    const event = normalizeSPXRealtimeEvent({
      type: 'price',
      symbol: 'spx',
      channel: 'PRICE:SPX',
      timestamp: '2026-02-21T14:30:00.000Z',
      source: 'tick',
      feedAgeMs: 125,
      seq: 41,
    }, 1_700_000_000_000)

    expect(event.kind).toBe('price')
    expect(event.symbol).toBe('SPX')
    expect(event.channel).toBe('price:spx')
    expect(event.sequence).toBe(41)
    expect(event.feedAgeMs).toBe(125)
    expect(event.source).toBe('tick')
    expect(event.receivedAtMs).toBe(1_700_000_000_000)
  })

  it('falls back unknown fields safely', () => {
    const event = normalizeSPXRealtimeEvent({
      type: 'unexpected_type',
      channel: null,
      sequence: 'not-a-number',
      timestamp: 'not-a-date',
    })

    expect(event.kind).toBe('unknown')
    expect(event.channel).toBeNull()
    expect(event.sequence).toBeNull()
    expect(event.timestamp).toBeNull()
  })
})
