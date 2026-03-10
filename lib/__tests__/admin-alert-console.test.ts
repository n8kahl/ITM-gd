import { describe, expect, it } from 'vitest'
import {
  buildAlertMessage,
  buildSessionRecapMessage,
  ensureSignalAllowedInState,
} from '@/app/api/admin/alerts/_console'

describe('admin alert console helpers', () => {
  it('formats PREP messages with normalized contract fields', () => {
    const result = buildAlertMessage({
      signalType: 'prep',
      fields: {
        symbol: 'spx',
        strike: 5760,
        optionType: 'call',
        expiration: '2026-03-09',
        sizeTag: 'light',
      },
      mentionEveryone: true,
    })

    expect(result.content).toBe('PREP SPX 5760C 03/09 LIGHT @everyone')
    expect(result.signalType).toBe('prep')
    expect(result.fields.symbol).toBe('SPX')
    expect(result.fields.strike).toBe(5760)
    expect(result.fields.optionType).toBe('call')
  })

  it('formats signed update and trim percentages', () => {
    const update = buildAlertMessage({
      signalType: 'update',
      fields: { percent: 68.25 },
      mentionEveryone: true,
    })
    const trim = buildAlertMessage({
      signalType: 'trim',
      fields: { percent: -12.5 },
      mentionEveryone: false,
    })

    expect(update.content).toBe('+68.25% here @everyone')
    expect(trim.content).toBe('-12.5% here trim')
  })

  it('builds recap summary using closed trades in ordinal sequence', () => {
    const recap = buildSessionRecapMessage([
      {
        id: 'trade-1',
        trade_index: 1,
        symbol: 'SPX',
        strike: 5760,
        contract_type: 'call',
        entry_price: 2.7,
        entry_timestamp: '2026-03-09T14:00:00.000Z',
        final_pnl_pct: 42,
        fully_exited: true,
        lifecycle_events: [],
      },
      {
        id: 'trade-2',
        trade_index: 2,
        symbol: 'SPX',
        strike: 5780,
        contract_type: 'call',
        entry_price: 2.1,
        entry_timestamp: '2026-03-09T15:00:00.000Z',
        final_pnl_pct: 138.5,
        fully_exited: true,
        lifecycle_events: [],
      },
    ])

    expect(recap).toBe('1st trade 42% 2nd trade 138.5% Solid day see you tomorrow @everyone')
  })

  it('guards invalid state transitions', () => {
    expect(() => ensureSignalAllowedInState('IDLE', 'trim')).toThrow(
      'Signal trim is not allowed while trade state is IDLE',
    )
    expect(() => ensureSignalAllowedInState('ACTIVE', 'trim')).not.toThrow()
  })
})

