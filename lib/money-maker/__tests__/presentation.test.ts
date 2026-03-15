import { describe, expect, it } from 'vitest'

import {
  describeMoneyMakerTimeWarning,
  describeMoneyMakerZone,
  getMoneyMakerFreshnessStatus,
  normalizeMoneyMakerLevelSource,
} from '../presentation'

describe('money-maker presentation helpers', () => {
  it('normalizes hourly level labels that embed their own price', () => {
    expect(normalizeMoneyMakerLevelSource('Hourly Low 673.34')).toBe('Hourly Low')
    expect(normalizeMoneyMakerLevelSource('Hourly High 406.81')).toBe('Hourly High')
    expect(normalizeMoneyMakerLevelSource('VWAP')).toBe('VWAP')
  })

  it('translates fortress into trader-facing zone language', () => {
    const summary = describeMoneyMakerZone(
      {
        priceLow: 99.8,
        priceHigh: 100.1,
        score: 4.7,
        label: 'fortress',
        levels: [
          { source: 'VWAP', price: 99.9, weight: 1.5 },
          { source: '21 EMA', price: 100.0, weight: 1.0 },
        ],
        isKingQueen: true,
      },
      101.2,
    )

    expect(summary).toEqual(
      expect.objectContaining({
        title: 'Heavy support cluster',
      }),
    )
    expect(summary?.description).toContain('support')
  })

  it('classifies freshness into live, delayed, and stale states', () => {
    const now = Date.UTC(2026, 2, 14, 18, 0, 0)

    expect(getMoneyMakerFreshnessStatus(now - 10_000, now)).toBe('live')
    expect(getMoneyMakerFreshnessStatus(now - 30_000, now)).toBe('delayed')
    expect(getMoneyMakerFreshnessStatus(now - 90_000, now)).toBe('stale')
    expect(getMoneyMakerFreshnessStatus(null, now)).toBe('stale')
  })

  it('translates time warnings into trader-facing copy', () => {
    expect(describeMoneyMakerTimeWarning('late_session')).toContain('Late session')
    expect(describeMoneyMakerTimeWarning('avoid_new_entries')).toContain('Avoid fresh entries')
  })
})
