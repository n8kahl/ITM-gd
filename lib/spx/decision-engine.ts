import { predictConfidence, primeConfidenceModel } from '@/lib/ml/confidence-model'
import { extractFeatures } from '@/lib/ml/feature-extractor'
import {
  calculateRuleBasedTier,
  mapMLTierToSetupTier,
  predictSetupTier,
} from '@/lib/ml/tier-classifier'
import type { FeatureExtractionContext } from '@/lib/ml/types'
import type {
  BasisState,
  FlowEvent,
  GEXProfile,
  PredictionState,
  Regime,
  Setup,
} from '@/lib/types/spx-command-center'

export type SPXConfidenceTrend = 'up' | 'flat' | 'down'

export interface SPXDecisionEngineContext extends FeatureExtractionContext {}

export interface SPXDecisionEngineEvaluation {
  alignmentByTimeframe: Record<'1m' | '5m' | '15m' | '1h', number>
  alignmentScore: number
  confidence: number
  confidenceSource: 'ml' | 'rule_based'
  confidenceTrend: SPXConfidenceTrend
  expectedValueR: number
  drivers: string[]
  risks: string[]
  freshnessMs: number
}

export const FLOW_BIAS_EWMA_DECAY = 0.85

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function regimeCompatibility(setupRegime: Regime, activeRegime: Regime | null): number {
  if (!activeRegime) return 0.5
  if (setupRegime === activeRegime) return 1
  if (
    (setupRegime === 'trending' && activeRegime === 'breakout')
    || (setupRegime === 'breakout' && activeRegime === 'trending')
    || (setupRegime === 'compression' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'compression')
  ) {
    return 0.65
  }
  if (
    (setupRegime === 'trending' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'trending')
    || (setupRegime === 'breakout' && activeRegime === 'compression')
    || (setupRegime === 'compression' && activeRegime === 'breakout')
  ) {
    return 0.15
  }
  return 0.3
}

function regimePenaltyFromScore(regimeScore: number): number {
  if (regimeScore < 0.3) return 18
  if (regimeScore < 0.45) return 12
  return 0
}

export function calculateRuleBasedConfidence(input: {
  alignmentScore: number
  confluenceScore: number
  probability: number
  flowBias: number
  regimeScore: number
}): number {
  const confluenceComponent = (input.confluenceScore / 5) * 22
  const probabilityComponent = clamp(input.probability, 0, 100) * 0.2
  const flowComponent = input.flowBias * 8
  const regimePenalty = regimePenaltyFromScore(input.regimeScore)

  return round(clamp(
    20
    + (input.alignmentScore * 0.55)
    + confluenceComponent
    + probabilityComponent
    + flowComponent
    - regimePenalty,
    5,
    95,
  ), 2)
}

function directionalPredictionScore(
  direction: Setup['direction'],
  prediction: PredictionState | null,
): number {
  if (!prediction) return 0.5
  const bullishPct = prediction.direction.bullish / 100
  const bearishPct = prediction.direction.bearish / 100
  return clamp(direction === 'bullish' ? bullishPct : bearishPct, 0, 1)
}

export function flowAlignmentBias(
  direction: Setup['direction'],
  flowEvents: FlowEvent[],
): number {
  const scoped = flowEvents.slice(0, 24)
  if (scoped.length === 0) return 0

  let weightedAligned = 0
  let weightedOpposing = 0
  let totalWeight = 0

  for (let i = 0; i < scoped.length; i += 1) {
    const weight = FLOW_BIAS_EWMA_DECAY ** i
    totalWeight += weight
    if (scoped[i].direction === direction) weightedAligned += weight
    else weightedOpposing += weight
  }

  if (totalWeight <= 0) return 0
  return clamp((weightedAligned - weightedOpposing) / totalWeight, -1, 1)
}

function gexDirectionalSupport(direction: Setup['direction'], gex: GEXProfile | null): number {
  if (!gex || !Number.isFinite(gex.netGex)) return 0.5
  if (direction === 'bullish') {
    if (gex.netGex >= 0) return 0.75
    return 0.35
  }
  if (gex.netGex <= 0) return 0.75
  return 0.35
}

function basisDirectionalSupport(direction: Setup['direction'], basis: BasisState | null): number {
  if (!basis) return 0.5
  if (basis.leading === 'neutral') return 0.52
  if (direction === 'bullish') {
    return basis.leading === 'SPX' ? 0.72 : 0.38
  }
  return basis.leading === 'SPY' ? 0.72 : 0.38
}

function expectedValueR(setup: Setup, confidence: number): number {
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2
  const risk = Math.abs(entryMid - setup.stop)
  const reward = Math.abs(setup.target1.price - entryMid)
  if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(reward) || reward <= 0) return 0

  const rr = reward / risk
  const pWin = clamp(confidence / 100, 0, 1)
  return round((pWin * rr) - (1 - pWin), 2)
}

function confidenceTrendFromBaseline(
  confidence: number,
  baselineProbability: number,
): SPXConfidenceTrend {
  const delta = confidence - baselineProbability
  if (delta >= 5) return 'up'
  if (delta <= -5) return 'down'
  return 'flat'
}

function buildDrivers(
  setup: Setup,
  alignmentScore: number,
  flowBias: number,
  regimeScore: number,
  predictionScore: number,
  gexScore: number,
): string[] {
  const drivers: string[] = []

  if (alignmentScore >= 62) {
    drivers.push(`Alignment ${Math.round(alignmentScore)}% across 1m/5m/15m/1h`)
  }
  if (flowBias >= 0.15) {
    drivers.push(`Flow confirms ${setup.direction} pressure`)
  }
  if (regimeScore >= 0.8) {
    drivers.push(`Regime alignment supports ${setup.regime}`)
  }
  if (predictionScore >= 0.58) {
    drivers.push(`Prediction favors ${setup.direction} continuation`)
  }
  if (gexScore >= 0.7) {
    drivers.push('Gamma structure supports directional follow-through')
  }

  if (drivers.length === 0) {
    drivers.push('Confluence base remains valid but confirmation is mixed')
  }

  return drivers.slice(0, 3)
}

function buildRisks(
  setup: Setup,
  flowBias: number,
  regimeScore: number,
  predictionScore: number,
  confidenceTrend: SPXConfidenceTrend,
): string[] {
  const risks: string[] = []

  if (regimeScore < 0.45) {
    risks.push(`Regime mismatch risk vs ${setup.regime} profile`)
  }
  if (flowBias <= -0.15) {
    risks.push('Recent flow is diverging from setup direction')
  }
  if (predictionScore < 0.45) {
    risks.push('Directional prediction confidence is soft')
  }
  if (confidenceTrend === 'down') {
    risks.push('Confidence trend is decelerating')
  }

  if (risks.length === 0) {
    risks.push('No elevated structural risk beyond baseline stop discipline')
  }

  return risks.slice(0, 3)
}

export function evaluateSPXSetupDecision(
  setup: Setup,
  context: SPXDecisionEngineContext,
): SPXDecisionEngineEvaluation {
  const regimeScore = regimeCompatibility(setup.regime, context.regime)
  const predictionScore = directionalPredictionScore(setup.direction, context.prediction)
  const flowBias = flowAlignmentBias(setup.direction, context.flowEvents)
  const flowScore = (flowBias + 1) / 2
  const gexScore = gexDirectionalSupport(setup.direction, context.gex)
  const basisScore = basisDirectionalSupport(setup.direction, context.basis)

  const alignmentByTimeframe = {
    '1m': round(clamp(
      (predictionScore * 0.25)
      + (flowScore * 0.45)
      + (gexScore * 0.15)
      + (basisScore * 0.15),
      0,
      1,
    ), 4),
    '5m': round(clamp(
      (regimeScore * 0.35)
      + (predictionScore * 0.25)
      + (flowScore * 0.2)
      + (gexScore * 0.1)
      + (basisScore * 0.1),
      0,
      1,
    ), 4),
    '15m': round(clamp(
      (regimeScore * 0.5)
      + (predictionScore * 0.2)
      + (flowScore * 0.15)
      + (basisScore * 0.15),
      0,
      1,
    ), 4),
    '1h': round(clamp(
      (regimeScore * 0.6)
      + (predictionScore * 0.15)
      + (flowScore * 0.1)
      + (gexScore * 0.15),
      0,
      1,
    ), 4),
  }

  const alignmentScore = round(
    (
      (alignmentByTimeframe['1m'] * 0.2)
      + (alignmentByTimeframe['5m'] * 0.35)
      + (alignmentByTimeframe['15m'] * 0.25)
      + (alignmentByTimeframe['1h'] * 0.2)
    ) * 100,
    2,
  )

  const ruleBasedConfidence = calculateRuleBasedConfidence({
    alignmentScore,
    confluenceScore: setup.confluenceScore,
    probability: setup.probability,
    flowBias,
    regimeScore,
  })
  const featureVector = extractFeatures(setup, context)
  void primeConfidenceModel()
  const mlConfidence = predictConfidence(featureVector, {
    userId: context.userId,
    enabledOverride: context.mlConfidenceEnabled,
  })
  const confidence = mlConfidence == null
    ? ruleBasedConfidence
    : round(clamp(mlConfidence, 5, 95), 2)
  const confidenceSource: SPXDecisionEngineEvaluation['confidenceSource'] = mlConfidence == null
    ? 'rule_based'
    : 'ml'

  const confidenceTrend = confidenceTrendFromBaseline(confidence, setup.probability)
  const drivers = buildDrivers(setup, alignmentScore, flowBias, regimeScore, predictionScore, gexScore)
  const risks = buildRisks(setup, flowBias, regimeScore, predictionScore, confidenceTrend)
  const valueR = expectedValueR(setup, confidence)

  const referenceTs = setup.statusUpdatedAt || setup.triggeredAt || setup.createdAt
  const referenceEpoch = toEpoch(referenceTs)
  const nowMs = context.nowMs ?? Date.now()
  const freshnessMs = referenceEpoch > 0 ? Math.max(nowMs - referenceEpoch, 0) : 0

  return {
    alignmentByTimeframe,
    alignmentScore,
    confidence,
    confidenceSource,
    confidenceTrend,
    expectedValueR: valueR,
    drivers,
    risks,
    freshnessMs,
  }
}

export function enrichSPXSetupWithDecisionEngine(
  setup: Setup,
  context: SPXDecisionEngineContext,
): Setup {
  const evaluation = evaluateSPXSetupDecision(setup, context)
  const score = round((evaluation.alignmentScore * 0.45) + (evaluation.confidence * 0.55), 0)
  const featureVector = extractFeatures(setup, context)
  const predictedTier = predictSetupTier(featureVector, setup, {
    userId: context.userId,
    mlTierEnabled: context.mlTierEnabled,
  })
  const resolvedTier = predictedTier == null
    ? calculateRuleBasedTier(setup, evaluation.confidence)
    : predictedTier

  return {
    ...setup,
    score,
    tier: mapMLTierToSetupTier(resolvedTier),
    pWinCalibrated: round(evaluation.confidence / 100, 4),
    evR: evaluation.expectedValueR,
    alignmentScore: round(evaluation.alignmentScore, 0),
    confidenceTrend: evaluation.confidenceTrend,
    decisionDrivers: evaluation.drivers,
    decisionRisks: evaluation.risks,
  }
}
