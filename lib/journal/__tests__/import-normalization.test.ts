import { describe, expect, it } from 'vitest'
import { normalizeImportedRow } from '@/lib/journal/import-normalization'

describe('normalizeImportedRow', () => {
  it('uses Instrument fallback for symbol discovery', () => {
    const row = normalizeImportedRow(
      {
        Instrument: 'AAPL',
        Date: '2026-02-01',
        quantity: '2',
        entry_price: '180.5',
      },
      'interactive_brokers',
    )

    expect(row.symbol).toBe('AAPL')
  })

  it('infers short direction from negative quantity when side is missing', () => {
    const row = normalizeImportedRow(
      {
        Symbol: 'TSLA',
        Date: '2026-02-01',
        quantity: '-3',
        'Entry Price': '250',
        'Exit Price': '240',
      },
      'schwab',
    )

    expect(row.direction).toBe('short')
    expect(row.positionSize).toBe(3)
  })

  it('does not treat option contract type alone as short direction', () => {
    const row = normalizeImportedRow(
      {
        Symbol: 'SPY',
        Type: 'Put',
        Quantity: '2',
        Date: '2026-02-01',
      },
      'schwab',
    )

    expect(row.contractType).toBe('put')
    expect(row.direction).toBe('long')
    expect(row.positionSize).toBe(2)
  })
})
