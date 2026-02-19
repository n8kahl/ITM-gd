import { describe, expect, it } from 'vitest'

import { arraysEqual, stabilizeLevelKeys } from '@/lib/spx/level-stability'

describe('level stability', () => {
  it('returns top candidates when no prior state exists', () => {
    const next = stabilizeLevelKeys({
      previousStableKeys: [],
      previousStreakByKey: {},
      candidateKeys: ['a', 'b', 'c', 'd'],
      targetCount: 3,
      minPromoteStreak: 2,
    })

    expect(next.stableKeys).toEqual(['a', 'b', 'c'])
    expect(next.streakByKey).toEqual({ a: 1, b: 1, c: 1, d: 1 })
  })

  it('keeps stable keys when still candidate and avoids churn', () => {
    const next = stabilizeLevelKeys({
      previousStableKeys: ['a', 'b', 'c'],
      previousStreakByKey: { a: 4, b: 4, c: 4, d: 1 },
      candidateKeys: ['a', 'd', 'b', 'c'],
      targetCount: 3,
      minPromoteStreak: 2,
    })

    expect(next.stableKeys).toEqual(['a', 'b', 'c'])
    expect(next.streakByKey.d).toBe(2)
  })

  it('promotes replacements when prior keys drop out', () => {
    const next = stabilizeLevelKeys({
      previousStableKeys: ['a', 'b', 'c'],
      previousStreakByKey: { a: 3, b: 3, c: 3, d: 1 },
      candidateKeys: ['a', 'd', 'e'],
      targetCount: 3,
      minPromoteStreak: 2,
    })

    expect(next.stableKeys).toEqual(['a', 'd', 'e'])
  })

  it('handles equality checks for stable key arrays', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(arraysEqual(['a', 'b'], ['a', 'c'])).toBe(false)
    expect(arraysEqual(['a'], ['a', 'b'])).toBe(false)
  })
})
