import { describe, expect, it } from 'vitest'
import {
  classifyLevelGroup,
  countLevelsByGroup,
  DEFAULT_LEVEL_VISIBILITY,
  filterLevelsByVisibility,
} from '../chart-level-groups'

describe('chart-level-groups', () => {
  it('classifies key level types into expected groups', () => {
    expect(classifyLevelGroup({ label: 'Fib 61.8%' })).toBe('fib')
    expect(classifyLevelGroup({ label: 'PDH', type: 'PDH' })).toBe('pivot')
    expect(classifyLevelGroup({ label: 'PP', type: 'PP' })).toBe('pivot')
    expect(classifyLevelGroup({ label: 'VWAP' })).toBe('vwap')
    expect(classifyLevelGroup({ label: 'GEX Flip' })).toBe('gex')
    expect(classifyLevelGroup({ label: 'ORH' })).toBe('openingRange')
    expect(classifyLevelGroup({ label: 'OR High' })).toBe('openingRange')
    expect(classifyLevelGroup({ label: 'Scalp Entry' })).toBe('position')
    expect(classifyLevelGroup({ side: 'support' })).toBe('supportResistance')
    expect(classifyLevelGroup({ label: 'Unmapped Level' })).toBe('other')
  })

  it('filters levels by visibility map', () => {
    const levels = [
      { label: 'Fib 38.2%', price: 100 },
      { label: 'PDL', price: 95, type: 'PDL' },
      { label: 'VWAP', price: 98 },
    ]

    const visible = filterLevelsByVisibility(levels, {
      ...DEFAULT_LEVEL_VISIBILITY,
      fib: false,
      vwap: false,
    })

    expect(visible).toHaveLength(1)
    expect(visible[0].label).toBe('PDL')
  })

  it('counts levels by group', () => {
    const counts = countLevelsByGroup([
      { label: 'Fib 23.6%', price: 100 },
      { label: 'Fib 50%', price: 102 },
      { label: 'PDH', type: 'PDH', price: 110 },
      { label: 'GEX Flip', price: 111 },
      { label: 'VWAP', price: 99 },
    ])

    expect(counts.fib).toBe(2)
    expect(counts.pivot).toBe(1)
    expect(counts.gex).toBe(1)
    expect(counts.vwap).toBe(1)
  })
})
