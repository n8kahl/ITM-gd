import type { MTFConfluenceWeights } from '@/lib/ml/types'

export type TimeframeKey = '1m' | '5m' | '15m' | '1h'

export interface MTFConfluenceInput {
  alignmentByTimeframe: Record<TimeframeKey, number>
  regimeCompatibility: number
  flowBias: number
  confluenceScore: number
}

export interface MTFConfluencePrediction {
  weights: Record<TimeframeKey, number>
  source: 'ml' | 'rule_based'
}

const DEFAULT_ROLLOUT_PCT = 20

export const DEFAULT_MTF_TIMEFRAME_WEIGHTS: Record<TimeframeKey, number> = {
  '1m': 0.2,
  '5m': 0.35,
  '15m': 0.25,
  '1h': 0.2,
}

const DEFAULT_MTF_MODEL: MTFConfluenceWeights = {
  version: 'mtf-default-v1',
  hiddenLayer: {
    // Input: [1m, 5m, 15m, 1h, regimeCompat, flowBiasNorm, confluenceNorm]
    weights: [
      [0.6, 0.2, -0.1, -0.3, 0.25, 0.2, 0.15],
      [-0.2, 0.55, 0.25, -0.1, 0.15, 0.08, 0.2],
      [-0.25, 0.15, 0.55, 0.1, 0.22, 0.1, 0.12],
      [-0.3, -0.1, 0.2, 0.6, 0.18, 0.06, 0.1],
    ],
    bias: [0.05, 0.04, 0.04, 0.03],
  },
  outputLayer: {
    // hiddenSize x outputSize(4)
    weights: [
      [0.9, 0.2, 0.1, -0.1],
      [0.15, 0.95, 0.25, 0.1],
      [0.05, 0.2, 0.9, 0.2],
      [-0.05, 0.1, 0.3, 0.95],
    ],
    bias: [0.02, 0.04, 0.03, 0.03],
  },
}

let activeMTFModel: MTFConfluenceWeights | null = null

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveFeatureEnabled(): boolean {
  return parseBooleanFlag(process.env.SPX_ML_MTF_CONFLUENCE_ENABLED) ?? false
}

function resolveRolloutPercent(): number {
  const parsed = Number.parseInt(process.env.SPX_ML_MTF_CONFLUENCE_AB_PERCENT ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_ROLLOUT_PCT
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

function relu(value: number): number {
  return value > 0 ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function softmax(logits: number[]): number[] {
  if (logits.length === 0) return []
  const max = Math.max(...logits)
  const exps = logits.map((value) => Math.exp(value - max))
  const denominator = exps.reduce((sum, value) => sum + value, 0)
  if (denominator <= 0) {
    return new Array(logits.length).fill(1 / logits.length)
  }
  return exps.map((value) => value / denominator)
}

function buildInputVector(input: MTFConfluenceInput): number[] {
  return [
    clamp(input.alignmentByTimeframe['1m'], 0, 1),
    clamp(input.alignmentByTimeframe['5m'], 0, 1),
    clamp(input.alignmentByTimeframe['15m'], 0, 1),
    clamp(input.alignmentByTimeframe['1h'], 0, 1),
    clamp(input.regimeCompatibility, 0, 1),
    clamp((input.flowBias + 1) / 2, 0, 1),
    clamp(input.confluenceScore / 5, 0, 1),
  ]
}

function isModelUsable(model: MTFConfluenceWeights): boolean {
  const hiddenSize = model.hiddenLayer.weights.length
  if (hiddenSize === 0) return false
  if (model.hiddenLayer.bias.length !== hiddenSize) return false
  if (model.outputLayer.weights.length !== hiddenSize) return false
  if (model.outputLayer.bias.length !== 4) return false

  for (const row of model.outputLayer.weights) {
    if (row.length !== 4) return false
  }

  return true
}

function resolveModel(): MTFConfluenceWeights {
  if (activeMTFModel && isModelUsable(activeMTFModel)) return activeMTFModel

  const fromEnv = process.env.SPX_ML_MTF_CONFLUENCE_MODEL_JSON
  if (!fromEnv) {
    activeMTFModel = DEFAULT_MTF_MODEL
    return activeMTFModel
  }

  try {
    const parsed = JSON.parse(fromEnv) as MTFConfluenceWeights
    if (isModelUsable(parsed)) {
      activeMTFModel = parsed
      return activeMTFModel
    }
  } catch {
    // no-op; fallback to default model
  }

  activeMTFModel = DEFAULT_MTF_MODEL
  return activeMTFModel
}

function inferWeightsWithModel(input: MTFConfluenceInput, model: MTFConfluenceWeights): Record<TimeframeKey, number> {
  const x = buildInputVector(input)

  const hidden = model.hiddenLayer.weights.map((row, rowIndex) => {
    const linear = row.reduce((sum, weight, colIndex) => sum + (weight * (x[colIndex] ?? 0)), 0)
      + (model.hiddenLayer.bias[rowIndex] ?? 0)
    return relu(linear)
  })

  const logits = [0, 0, 0, 0].map((_, outputIndex) => {
    const linear = hidden.reduce((sum, hiddenValue, hiddenIndex) => {
      const weight = model.outputLayer.weights[hiddenIndex]?.[outputIndex] ?? 0
      return sum + (hiddenValue * weight)
    }, 0)
    return linear + (model.outputLayer.bias[outputIndex] ?? 0)
  })

  const probs = softmax(logits)

  return {
    '1m': probs[0],
    '5m': probs[1],
    '15m': probs[2],
    '1h': probs[3],
  }
}

function normalizeWeights(weights: Record<TimeframeKey, number>): Record<TimeframeKey, number> {
  const total = Math.max(
    1e-9,
    weights['1m'] + weights['5m'] + weights['15m'] + weights['1h'],
  )

  return {
    '1m': weights['1m'] / total,
    '5m': weights['5m'] / total,
    '15m': weights['15m'] / total,
    '1h': weights['1h'] / total,
  }
}

export function isMLMTFConfluenceEnabledForUser(
  userId: string | null | undefined,
  enabledOverride?: boolean,
): boolean {
  if (typeof enabledOverride === 'boolean') return enabledOverride
  if (!resolveFeatureEnabled()) return false

  const rollout = resolveRolloutPercent()
  if (rollout <= 0) return false
  if (rollout >= 100) return true
  if (!userId) return false

  return (hashString(userId) % 100) < rollout
}

export function predictMTFConfluenceWeights(
  input: MTFConfluenceInput,
  options: { userId?: string | null; enabledOverride?: boolean } = {},
): MTFConfluencePrediction {
  if (!isMLMTFConfluenceEnabledForUser(options.userId, options.enabledOverride)) {
    return {
      weights: DEFAULT_MTF_TIMEFRAME_WEIGHTS,
      source: 'rule_based',
    }
  }

  const model = resolveModel()
  if (!isModelUsable(model)) {
    return {
      weights: DEFAULT_MTF_TIMEFRAME_WEIGHTS,
      source: 'rule_based',
    }
  }

  const inferred = inferWeightsWithModel(input, model)
  return {
    weights: normalizeWeights(inferred),
    source: 'ml',
  }
}

export function __setMTFConfluenceModelForTest(model: MTFConfluenceWeights | null): void {
  activeMTFModel = model
}

export function __resetMTFConfluenceModelForTest(): void {
  activeMTFModel = null
}
