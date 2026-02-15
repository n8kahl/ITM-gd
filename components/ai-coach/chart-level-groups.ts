'use client'

export type LevelGroupId =
  | 'fib'
  | 'pivot'
  | 'supportResistance'
  | 'vwap'
  | 'gex'
  | 'openingRange'
  | 'position'
  | 'other'

export type LevelVisibilityConfig = Record<LevelGroupId, boolean>

export interface LevelLike {
  label?: string
  type?: string
  side?: 'resistance' | 'support'
  group?: LevelGroupId
  price?: number
}

export const LEVEL_GROUP_ORDER: LevelGroupId[] = [
  'fib',
  'pivot',
  'supportResistance',
  'vwap',
  'gex',
  'openingRange',
  'position',
  'other',
]

export const LEVEL_GROUP_LABELS: Record<LevelGroupId, string> = {
  fib: 'Fibonacci',
  pivot: 'Pivots',
  supportResistance: 'S/R',
  vwap: 'VWAP',
  gex: 'GEX',
  openingRange: 'OR Levels',
  position: 'Position Plan',
  other: 'Other',
}

export const DEFAULT_LEVEL_VISIBILITY: LevelVisibilityConfig = {
  fib: true,
  pivot: true,
  supportResistance: true,
  vwap: true,
  gex: true,
  openingRange: true,
  position: true,
  other: true,
}

const PIVOT_KEY_REGEX = /\b(PDH|PDL|PDC|PWH|PWL|PWC|PIVOT|PP|R1|R2|R3|S1|S2|S3)\b/
const OPENING_RANGE_KEY_REGEX = /\bOR(H|L)?\b|OPENING RANGE/

export function classifyLevelGroup(level: LevelLike): LevelGroupId {
  if (level.group) return level.group

  const raw = `${level.type || ''} ${level.label || ''}`.trim().toUpperCase()
  if (!raw && level.side) return 'supportResistance'
  if (raw.includes('FIB')) return 'fib'
  if (raw.includes('GEX')) return 'gex'
  if (raw.includes('VWAP')) return 'vwap'
  if (OPENING_RANGE_KEY_REGEX.test(raw)) return 'openingRange'
  if (raw.includes('ENTRY') || raw.includes('STOP') || raw.includes('TARGET')) return 'position'
  if (PIVOT_KEY_REGEX.test(raw)) return 'pivot'
  if (level.side === 'support' || level.side === 'resistance') return 'supportResistance'
  return 'other'
}

export function filterLevelsByVisibility<T extends LevelLike>(
  levels: T[],
  visibility: LevelVisibilityConfig,
): T[] {
  return levels.filter((level) => visibility[classifyLevelGroup(level)])
}

export function countLevelsByGroup(levels: LevelLike[]): Record<LevelGroupId, number> {
  const counts: Record<LevelGroupId, number> = {
    fib: 0,
    pivot: 0,
    supportResistance: 0,
    vwap: 0,
    gex: 0,
    openingRange: 0,
    position: 0,
    other: 0,
  }

  for (const level of levels) {
    counts[classifyLevelGroup(level)] += 1
  }

  return counts
}
