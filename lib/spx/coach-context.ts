import type { Setup } from '@/lib/types/spx-command-center'

export interface DirectionalFlowEvent {
  direction: 'bullish' | 'bearish'
  premium: number
}

export interface FlowAlignmentSummary {
  alignmentPct: number
  bullishPremium: number
  bearishPremium: number
}

export function summarizeFlowAlignment(
  flowEvents: DirectionalFlowEvent[],
  setupDirection: Setup['direction'],
): FlowAlignmentSummary | null {
  if (!Array.isArray(flowEvents) || flowEvents.length === 0) return null
  const bullishPremium = flowEvents
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearishPremium = flowEvents
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)
  const gross = bullishPremium + bearishPremium
  if (gross <= 0) return null

  const directionalPremium = setupDirection === 'bullish' ? bullishPremium : bearishPremium
  const alignmentPct = Math.round((directionalPremium / gross) * 100)

  return {
    alignmentPct,
    bullishPremium,
    bearishPremium,
  }
}

export function isFlowDivergence(alignmentPct: number, threshold = 42): boolean {
  return alignmentPct < threshold
}

export function distanceToStopPoints(spxPrice: number, setup: Pick<Setup, 'direction' | 'stop'>): number | null {
  if (!Number.isFinite(spxPrice) || spxPrice <= 0) return null
  if (!Number.isFinite(setup.stop) || setup.stop <= 0) return null

  if (setup.direction === 'bullish') {
    return spxPrice - setup.stop
  }
  return setup.stop - spxPrice
}
