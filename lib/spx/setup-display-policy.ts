import type { PredictionState, Regime, Setup } from '@/lib/types/spx-command-center'

export const DEFAULT_PRIMARY_SETUP_LIMIT = 2
export const REGIME_CONFLICT_CONFIDENCE_THRESHOLD = 68
export const FLOW_DIVERGENCE_ALIGNMENT_THRESHOLD = 38

interface BuildSetupDisplayPolicyInput {
  setups: Setup[]
  regime: Regime | null
  prediction: PredictionState | null
  selectedSetup: Setup | null
  primaryLimit?: number
}

interface BuildSetupDisplayPolicyResult {
  actionableAll: Setup[]
  actionablePrimary: Setup[]
  forming: Setup[]
  hiddenOppositeCount: number
  directionalBias: Setup['direction'] | null
  compressionFilterActive: boolean
  actionableVisibleCount: number
}

function postureDirection(prediction: PredictionState | null): Setup['direction'] | null {
  if (!prediction) return null
  const directionalLead = Math.abs(prediction.direction.bullish - prediction.direction.bearish)
  if (directionalLead < FLOW_DIVERGENCE_ALIGNMENT_THRESHOLD) return null
  return prediction.direction.bullish > prediction.direction.bearish ? 'bullish' : 'bearish'
}

function resolveDirectionalBias(input: BuildSetupDisplayPolicyInput): Setup['direction'] | null {
  const selectedDirection = input.selectedSetup?.direction
  if (selectedDirection) return selectedDirection
  return postureDirection(input.prediction)
}

function shouldEnableCompressionFilter(input: BuildSetupDisplayPolicyInput, directionalBias: Setup['direction'] | null): boolean {
  if (!directionalBias) return false
  if (input.regime !== 'compression') return false

  const predictionConfidence = input.prediction?.confidence ?? 0
  if (predictionConfidence >= REGIME_CONFLICT_CONFIDENCE_THRESHOLD) {
    return true
  }

  return Boolean(input.selectedSetup && (input.selectedSetup.status === 'ready' || input.selectedSetup.status === 'triggered'))
}

export function buildSetupDisplayPolicy(input: BuildSetupDisplayPolicyInput): BuildSetupDisplayPolicyResult {
  const primaryLimit = Math.max(1, Math.floor(input.primaryLimit ?? DEFAULT_PRIMARY_SETUP_LIMIT))
  const directionalBias = resolveDirectionalBias(input)
  const compressionFilterActive = shouldEnableCompressionFilter(input, directionalBias)

  const actionableAll = input.setups.filter((setup) => (
    (setup.status === 'ready' || setup.status === 'triggered')
    && setup.tier !== 'hidden'
  ))
  const formingAll = input.setups.filter((setup) => setup.status === 'forming' && setup.tier !== 'hidden')

  const actionableFiltered = compressionFilterActive && directionalBias
    ? actionableAll.filter((setup) => setup.direction === directionalBias)
    : actionableAll

  const formingFiltered = compressionFilterActive && directionalBias
    ? formingAll.filter((setup) => setup.direction === directionalBias)
    : formingAll

  const hiddenOppositeCount = Math.max(actionableAll.length - actionableFiltered.length, 0)
  const sniperRanked = actionableFiltered.filter((setup) => setup.tier === 'sniper_primary' || setup.tier === 'sniper_secondary')
  const fallbackRanked = actionableFiltered.filter((setup) => setup.tier !== 'sniper_primary' && setup.tier !== 'sniper_secondary')
  const actionablePrimary = [...sniperRanked, ...fallbackRanked].slice(0, primaryLimit)

  return {
    actionableAll,
    actionablePrimary,
    forming: formingFiltered,
    hiddenOppositeCount,
    directionalBias,
    compressionFilterActive,
    actionableVisibleCount: actionableFiltered.length,
  }
}
