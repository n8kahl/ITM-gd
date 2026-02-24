import type { Setup } from '@/lib/types/spx-command-center'

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/**
 * Guards against stale pre-trigger setups that have already progressed
 * through the first target before a valid trigger was confirmed.
 */
export function hasSetupPriceProgressionConflict(setup: Setup, currentPrice: number): boolean {
  if (!isFinitePositive(currentPrice)) return false
  if (setup.status === 'triggered' || setup.status === 'invalidated' || setup.status === 'expired') {
    return false
  }

  const target1 = setup.target1.price
  if (!Number.isFinite(target1)) return false

  if (setup.direction === 'bullish') {
    return currentPrice >= target1
  }
  return currentPrice <= target1
}
