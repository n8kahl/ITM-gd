import type { Setup } from '@/lib/types/spx-command-center'

export type SPXScenarioLaneType = 'base' | 'adverse' | 'acceleration'

export interface SPXScenarioLane {
  id: string
  type: SPXScenarioLaneType
  label: string
  price: number
  direction: Setup['direction']
  confidence: number
  description: string
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function buildSPXScenarioLanes(setup: Setup | null, referencePrice: number | null): SPXScenarioLane[] {
  if (!setup) return []
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2
  const basePrice = referencePrice != null && Number.isFinite(referencePrice) ? referencePrice : entryMid
  const setupConfidence = clamp(
    Math.round(((setup.probability * 0.7) + (setup.confluenceScore * 6))),
    35,
    95,
  )

  const base: SPXScenarioLane = {
    id: `${setup.id}:base`,
    type: 'base',
    label: 'Base lane',
    price: round(basePrice),
    direction: setup.direction,
    confidence: setupConfidence,
    description: 'Expected path if current regime and flow remain stable.',
  }

  const adverseTarget = setup.direction === 'bullish'
    ? Math.min(setup.stop, setup.entryZone.low)
    : Math.max(setup.stop, setup.entryZone.high)
  const accelerationTarget = setup.direction === 'bullish'
    ? Math.max(setup.target1.price, setup.target2.price)
    : Math.min(setup.target1.price, setup.target2.price)

  const adverse: SPXScenarioLane = {
    id: `${setup.id}:adverse`,
    type: 'adverse',
    label: 'Adverse lane',
    price: round(adverseTarget),
    direction: setup.direction,
    confidence: clamp(setupConfidence - 18, 20, 90),
    description: 'Risk path if invalidation pressure increases.',
  }

  const acceleration: SPXScenarioLane = {
    id: `${setup.id}:acceleration`,
    type: 'acceleration',
    label: 'Acceleration lane',
    price: round(accelerationTarget),
    direction: setup.direction,
    confidence: clamp(setupConfidence - 8, 25, 92),
    description: 'Momentum path if breakout confirmation expands.',
  }

  return [base, adverse, acceleration]
}
