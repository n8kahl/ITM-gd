import { describe, expect, it } from 'vitest'
import type { TrackedSetup } from '@/lib/api/ai-coach'
import {
  DEFAULT_TRACKED_SETUPS_PREFERENCES,
  filterTrackedSetups,
  getSetupDistanceToTrigger,
  normalizeTrackedSetupsPreferences,
  sortTrackedSetups,
} from '@/lib/ai-coach/tracked-setups'

function createSetup(overrides: Partial<TrackedSetup>): TrackedSetup {
  const base: TrackedSetup = {
    id: 'setup-1',
    user_id: 'user-1',
    source_opportunity_id: null,
    symbol: 'SPX',
    setup_type: 'breakout',
    direction: 'bullish',
    status: 'active',
    opportunity_data: {},
    notes: null,
    tracked_at: '2026-02-11T14:00:00.000Z',
    triggered_at: null,
    invalidated_at: null,
    created_at: '2026-02-11T14:00:00.000Z',
    updated_at: '2026-02-11T14:00:00.000Z',
  }

  return {
    ...base,
    ...overrides,
  }
}

describe('filterTrackedSetups', () => {
  const setups: TrackedSetup[] = [
    createSetup({ id: 'a', status: 'active' }),
    createSetup({ id: 'b', status: 'triggered' }),
    createSetup({ id: 'c', status: 'invalidated' }),
    createSetup({ id: 'd', status: 'archived' }),
  ]

  it('returns only active + triggered for active view all filter', () => {
    const filtered = filterTrackedSetups(setups, 'active', 'all', 'all')
    expect(filtered.map((setup) => setup.id)).toEqual(['a', 'b'])
  })

  it('returns only invalidated + archived for history view all filter', () => {
    const filtered = filterTrackedSetups(setups, 'history', 'all', 'all')
    expect(filtered.map((setup) => setup.id)).toEqual(['c', 'd'])
  })

  it('applies history invalidated-only filter', () => {
    const filtered = filterTrackedSetups(setups, 'history', 'all', 'invalidated')
    expect(filtered.map((setup) => setup.id)).toEqual(['c'])
  })
})

describe('sortTrackedSetups', () => {
  const setups: TrackedSetup[] = [
    createSetup({
      id: 'near',
      tracked_at: '2026-02-11T14:00:00.000Z',
      opportunity_data: {
        score: 50,
        currentPrice: 100,
        suggestedTrade: { entry: 100.2 },
      },
    }),
    createSetup({
      id: 'far',
      tracked_at: '2026-02-11T13:00:00.000Z',
      opportunity_data: {
        score: 99,
        currentPrice: 100,
        suggestedTrade: { entry: 110 },
      },
    }),
    createSetup({
      id: 'no-price',
      tracked_at: '2026-02-11T15:00:00.000Z',
      opportunity_data: {
        score: 70,
      },
    }),
  ]

  it('sorts by highest score descending', () => {
    const sorted = sortTrackedSetups(setups, 'highest_score')
    expect(sorted.map((setup) => setup.id)).toEqual(['far', 'no-price', 'near'])
  })

  it('sorts by closest to trigger ascending and deprioritizes unknown distance', () => {
    const sorted = sortTrackedSetups(setups, 'closest_to_trigger')
    expect(sorted.map((setup) => setup.id)).toEqual(['near', 'far', 'no-price'])
  })

  it('computes infinite distance when current price or entry is unavailable', () => {
    expect(getSetupDistanceToTrigger(setups[2])).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('normalizeTrackedSetupsPreferences', () => {
  it('falls back to defaults for invalid payloads', () => {
    expect(normalizeTrackedSetupsPreferences(null)).toEqual(DEFAULT_TRACKED_SETUPS_PREFERENCES)
    expect(normalizeTrackedSetupsPreferences({ view: 'bad', sortMode: 'bad' })).toEqual(DEFAULT_TRACKED_SETUPS_PREFERENCES)
  })

  it('accepts valid values', () => {
    const normalized = normalizeTrackedSetupsPreferences({
      view: 'history',
      activeStatusFilter: 'triggered',
      historyStatusFilter: 'invalidated',
      sortMode: 'closest_to_trigger',
    })

    expect(normalized).toEqual({
      view: 'history',
      activeStatusFilter: 'triggered',
      historyStatusFilter: 'invalidated',
      sortMode: 'closest_to_trigger',
    })
  })
})
