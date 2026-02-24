import type { Setup, SetupTier } from '@/lib/types/spx-command-center'
import type { FeatureExtractionContext, MLSetupTier, SetupFeatureVector, TierModelWeights, TierThresholds } from '@/lib/ml/types'

const DEFAULT_TIER_ROLLOUT_PCT = 35

const DEFAULT_THRESHOLD: TierThresholds = {
  sniperPrimary: 0.74,
  sniperSecondary: 0.62,
  watchlist: 0.5,
}

const THRESHOLD_BY_SETUP_TYPE: Record<Setup['type'], TierThresholds> = {
  fade_at_wall: {
    sniperPrimary: 0.8,
    sniperSecondary: 0.69,
    watchlist: 0.56,
  },
  breakout_vacuum: {
    sniperPrimary: 0.73,
    sniperSecondary: 0.6,
    watchlist: 0.48,
  },
  mean_reversion: {
    sniperPrimary: 0.75,
    sniperSecondary: 0.64,
    watchlist: 0.5,
  },
  trend_continuation: {
    sniperPrimary: 0.74,
    sniperSecondary: 0.62,
    watchlist: 0.49,
  },
  orb_breakout: {
    sniperPrimary: 0.72,
    sniperSecondary: 0.6,
    watchlist: 0.47,
  },
  trend_pullback: {
    sniperPrimary: 0.76,
    sniperSecondary: 0.64,
    watchlist: 0.51,
  },
  flip_reclaim: {
    sniperPrimary: 0.75,
    sniperSecondary: 0.63,
    watchlist: 0.5,
  },
  vwap_reclaim: {
    sniperPrimary: 0.73,
    sniperSecondary: 0.61,
    watchlist: 0.48,
  },
  vwap_fade_at_band: {
    sniperPrimary: 0.78,
    sniperSecondary: 0.66,
    watchlist: 0.53,
  },
}

const DEFAULT_TIER_MODEL: TierModelWeights = {
  version: 'tier-default-v1',
  interceptByTier: {
    sniper_primary: -0.4,
    sniper_secondary: -0.2,
    watchlist: 0.05,
    skip: 0,
  },
  featureWeightsByTier: {
    sniper_primary: {
      confluenceScore: 0.45,
      regimeCompatibility: 0.3,
      flowBias: 0.22,
      historicalWinRate: 0.28,
      confluenceEmaAlignment: 0.12,
    },
    sniper_secondary: {
      confluenceScore: 0.34,
      regimeCompatibility: 0.2,
      flowBias: 0.16,
      historicalWinRate: 0.16,
      confluenceEmaAlignment: 0.08,
    },
    watchlist: {
      confluenceScore: 0.22,
      regimeCompatibility: 0.12,
      flowBias: 0.08,
      historicalWinRate: 0.1,
    },
    skip: {
      confluenceScore: -0.2,
      regimeCompatibility: -0.16,
      flowBias: -0.08,
      historicalWinRate: -0.1,
      distanceToVWAP: 0.08,
    },
  },
}

let activeTierModel: TierModelWeights | null = null

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveTierFeatureEnabled(): boolean {
  return parseBooleanFlag(process.env.SPX_ML_TIER_ENABLED) ?? false
}

function resolveRolloutPercent(): number {
  const parsed = Number.parseInt(process.env.SPX_ML_TIER_AB_PERCENT ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_TIER_ROLLOUT_PCT
  if (parsed < 0) return 0
  if (parsed > 100) return 100
  return parsed
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeFeature(key: keyof SetupFeatureVector, value: number): number {
  switch (key) {
    case 'confluenceScore':
      return clamp(value / 5, 0, 1)
    case 'regimeCompatibility':
      return clamp(value, 0, 1)
    case 'flowBias':
      return clamp((value + 1) / 2, 0, 1)
    case 'historicalWinRate':
      return clamp(value, 0, 1)
    case 'confluenceEmaAlignment':
      return clamp(value, 0, 1)
    case 'distanceToVWAP':
      return clamp(value / 10, 0, 1)
    default:
      return clamp(value, -1, 1)
  }
}

function scoreTier(
  tier: MLSetupTier,
  featureVector: SetupFeatureVector,
  model: TierModelWeights,
): number {
  let score = model.interceptByTier[tier]
  const weights = model.featureWeightsByTier[tier]

  for (const [featureName, rawWeight] of Object.entries(weights)) {
    const key = featureName as keyof SetupFeatureVector
    const weight = typeof rawWeight === 'number' ? rawWeight : 0
    if (!Number.isFinite(weight)) continue
    const normalizedValue = normalizeFeature(key, featureVector[key])
    score += normalizedValue * weight
  }

  return score
}

function softmax(scores: Record<MLSetupTier, number>): Record<MLSetupTier, number> {
  const values = Object.values(scores)
  const max = Math.max(...values)
  const exps = {
    sniper_primary: Math.exp(scores.sniper_primary - max),
    sniper_secondary: Math.exp(scores.sniper_secondary - max),
    watchlist: Math.exp(scores.watchlist - max),
    skip: Math.exp(scores.skip - max),
  }
  const denom = exps.sniper_primary + exps.sniper_secondary + exps.watchlist + exps.skip
  if (denom <= 0) {
    return {
      sniper_primary: 0,
      sniper_secondary: 0,
      watchlist: 0,
      skip: 1,
    }
  }

  return {
    sniper_primary: exps.sniper_primary / denom,
    sniper_secondary: exps.sniper_secondary / denom,
    watchlist: exps.watchlist / denom,
    skip: exps.skip / denom,
  }
}

function resolveThresholds(setupType: Setup['type']): TierThresholds {
  const model = activeTierModel
  const modelThresholds = model?.thresholdsBySetupType?.[setupType]
  if (modelThresholds) return modelThresholds
  return THRESHOLD_BY_SETUP_TYPE[setupType] ?? DEFAULT_THRESHOLD
}

function bestTier(probabilities: Record<MLSetupTier, number>): { tier: MLSetupTier; probability: number } {
  const ordered = (Object.entries(probabilities) as Array<[MLSetupTier, number]>)
    .sort((a, b) => b[1] - a[1])
  return {
    tier: ordered[0][0],
    probability: ordered[0][1],
  }
}

function mapSetupTierToML(tier: SetupTier | undefined): MLSetupTier | null {
  if (!tier || tier === 'hidden') return null
  return tier
}

export function mapMLTierToSetupTier(tier: MLSetupTier): SetupTier {
  return tier === 'skip' ? 'hidden' : tier
}

export function isMLTierEnabledForUser(
  userId: string | null | undefined,
  enabledOverride?: boolean,
): boolean {
  if (typeof enabledOverride === 'boolean') return enabledOverride
  if (!resolveTierFeatureEnabled()) return false

  const rollout = resolveRolloutPercent()
  if (rollout <= 0) return false
  if (rollout >= 100) return true
  if (!userId) return false

  return (hashString(userId) % 100) < rollout
}

export function calculateRuleBasedTier(setup: Setup, confidence: number): MLSetupTier {
  const mappedExisting = mapSetupTierToML(setup.tier)
  if (mappedExisting) return mappedExisting

  if (confidence >= 78 && setup.confluenceScore >= 4) return 'sniper_primary'
  if (confidence >= 72 && setup.confluenceScore >= 3.5) return 'sniper_secondary'
  if (confidence >= 60 && setup.confluenceScore >= 3) return 'watchlist'
  return 'skip'
}

function resolveTierModel(): TierModelWeights {
  if (activeTierModel) return activeTierModel

  const fromEnv = process.env.SPX_ML_TIER_MODEL_JSON
  if (!fromEnv) {
    activeTierModel = DEFAULT_TIER_MODEL
    return activeTierModel
  }

  try {
    const parsed = JSON.parse(fromEnv) as TierModelWeights
    if (!parsed || typeof parsed !== 'object') {
      activeTierModel = DEFAULT_TIER_MODEL
      return activeTierModel
    }
    if (!parsed.interceptByTier || !parsed.featureWeightsByTier) {
      activeTierModel = DEFAULT_TIER_MODEL
      return activeTierModel
    }
    activeTierModel = parsed
    return activeTierModel
  } catch {
    activeTierModel = DEFAULT_TIER_MODEL
    return activeTierModel
  }
}

export function predictSetupTier(
  featureVector: SetupFeatureVector,
  setup: Setup,
  context: Pick<FeatureExtractionContext, 'userId' | 'mlTierEnabled'>,
): MLSetupTier | null {
  if (!isMLTierEnabledForUser(context.userId, context.mlTierEnabled)) return null

  const model = resolveTierModel()
  const scores: Record<MLSetupTier, number> = {
    sniper_primary: scoreTier('sniper_primary', featureVector, model),
    sniper_secondary: scoreTier('sniper_secondary', featureVector, model),
    watchlist: scoreTier('watchlist', featureVector, model),
    skip: scoreTier('skip', featureVector, model),
  }

  const probabilities = softmax(scores)
  const winner = bestTier(probabilities)
  const thresholds = resolveThresholds(setup.type)

  if (winner.probability < thresholds.watchlist) return 'skip'

  if (winner.tier === 'sniper_primary' && winner.probability < thresholds.sniperPrimary) {
    return winner.probability >= thresholds.sniperSecondary ? 'sniper_secondary' : 'watchlist'
  }

  if (winner.tier === 'sniper_secondary' && winner.probability < thresholds.sniperSecondary) {
    return 'watchlist'
  }

  if (winner.tier === 'watchlist' && winner.probability < thresholds.watchlist) {
    return 'skip'
  }

  return winner.tier
}

export function __setTierModelForTest(model: TierModelWeights | null): void {
  activeTierModel = model
}

export function __resetTierModelForTest(): void {
  activeTierModel = null
}
