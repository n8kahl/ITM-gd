import type { ConfidenceModelWeights, SetupFeatureVector } from '@/lib/ml/types'
import {
  getCachedConfidenceModelWeights,
  loadConfidenceModelWeights,
  resetConfidenceModelCacheForTest,
  setCachedConfidenceModelWeightsForTest,
} from '@/lib/ml/model-loader'

const DEFAULT_ML_CONFIDENCE_ROLLOUT_PCT = 50
let warmupPromise: Promise<ConfidenceModelWeights | null> | null = null

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveGlobalMLEnabled(): boolean {
  return parseBooleanFlag(process.env.SPX_ML_CONFIDENCE_ENABLED) ?? true
}

function resolveRolloutPercent(): number {
  const parsed = Number.parseInt(process.env.SPX_ML_CONFIDENCE_AB_PERCENT ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_ML_CONFIDENCE_ROLLOUT_PCT
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

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value)
    return 1 / (1 + exp)
  }
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function scoreFeatureVector(featureVector: SetupFeatureVector, weights: ConfidenceModelWeights): number {
  let total = weights.intercept

  for (const [feature, weight] of Object.entries(weights.features)) {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue
    const featureValue = featureVector[feature as keyof SetupFeatureVector]
    if (typeof featureValue !== 'number' || !Number.isFinite(featureValue)) continue
    total += featureValue * weight
  }

  return total
}

export function isMLConfidenceEnabledForUser(
  userId: string | null | undefined,
  enabledOverride?: boolean,
): boolean {
  if (typeof enabledOverride === 'boolean') return enabledOverride
  if (!resolveGlobalMLEnabled()) return false

  const rollout = resolveRolloutPercent()
  if (rollout <= 0) return false
  if (rollout >= 100) return true
  if (!userId) return false

  const bucket = hashString(userId) % 100
  return bucket < rollout
}

export function predictConfidence(
  featureVector: SetupFeatureVector,
  options: { userId?: string | null; enabledOverride?: boolean } = {},
): number | null {
  if (!isMLConfidenceEnabledForUser(options.userId, options.enabledOverride)) {
    return null
  }

  const model = getCachedConfidenceModelWeights()
  if (!model) return null

  const rawScore = scoreFeatureVector(featureVector, model)
  const probability = sigmoid(rawScore)
  return round(clamp(probability * 100, 0, 100), 2)
}

export async function primeConfidenceModel(forceRefresh = false): Promise<ConfidenceModelWeights | null> {
  if (forceRefresh) {
    return loadConfidenceModelWeights({ forceRefresh: true })
  }

  const cached = getCachedConfidenceModelWeights()
  if (cached) return cached

  if (!warmupPromise) {
    warmupPromise = loadConfidenceModelWeights().finally(() => {
      warmupPromise = null
    })
  }

  return warmupPromise
}

export function __setConfidenceModelForTest(model: ConfidenceModelWeights | null): void {
  setCachedConfidenceModelWeightsForTest(model)
}

export function __resetConfidenceModelForTest(): void {
  resetConfidenceModelCacheForTest()
}
