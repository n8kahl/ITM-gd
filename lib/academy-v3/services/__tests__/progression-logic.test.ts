import { describe, expect, it } from 'vitest'

import {
  computeProgressPercent,
  getCompletedBlockIds,
  getNextIncompleteBlockId,
} from '@/lib/academy-v3/services/progression-logic'

describe('academy-v3 progression logic', () => {
  it('extracts completed block ids from metadata', () => {
    expect(getCompletedBlockIds({ completedBlockIds: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(getCompletedBlockIds({ completedBlockIds: [1, 'b'] })).toEqual(['b'])
    expect(getCompletedBlockIds({})).toEqual([])
  })

  it('computes bounded progress percent', () => {
    expect(computeProgressPercent(0, 4)).toBe(0)
    expect(computeProgressPercent(1, 4)).toBe(25)
    expect(computeProgressPercent(5, 4)).toBe(100)
    expect(computeProgressPercent(1, 0)).toBe(0)
  })

  it('returns next incomplete block id', () => {
    expect(getNextIncompleteBlockId(['b1', 'b2', 'b3'], ['b1'])).toBe('b2')
    expect(getNextIncompleteBlockId(['b1', 'b2'], ['b1', 'b2'])).toBeNull()
  })
})
