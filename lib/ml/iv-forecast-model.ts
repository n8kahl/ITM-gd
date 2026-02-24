export interface IVForecastFeatureVector {
  realizedVolTrend: number
  ivMomentum: number
  meanReversionPressure: number
  termStructureSlope: number
  skewPressure: number
  volOfVol: number
  closeToExpiryPressure: number
}

export interface IVForecastInference {
  horizonMinutes: number
  predictedIV: number | null
  currentIV: number | null
  deltaIV: number | null
  direction: 'up' | 'down' | 'flat' | 'unknown'
  confidence: number
  source: 'ml' | 'fallback'
  features: IVForecastFeatureVector
}

interface LSTMCellWeights {
  inputGate: number[][]
  forgetGate: number[][]
  outputGate: number[][]
  candidateGate: number[][]
  biasInput: number[]
  biasForget: number[]
  biasOutput: number[]
  biasCandidate: number[]
}

export interface IVForecastModelWeights {
  version: string
  inputSize: number
  hiddenSize: number
  cell: LSTMCellWeights
  outputDelta: {
    weights: number[]
    bias: number
  }
  outputConfidence: {
    weights: number[]
    bias: number
  }
}

const HORIZON_MINUTES = 60

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function safe(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return value
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value)
    return 1 / (1 + exp)
  }
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function tanh(value: number): number {
  if (Math.abs(value) > 20) return value > 0 ? 1 : -1
  const exp = Math.exp(2 * value)
  return (exp - 1) / (exp + 1)
}

function dot(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let total = 0
  for (let i = 0; i < length; i += 1) {
    total += left[i] * right[i]
  }
  return total
}

function normalizeFeatures(input: IVForecastFeatureVector): IVForecastFeatureVector {
  return {
    realizedVolTrend: clamp(safe(input.realizedVolTrend), -1.5, 1.5),
    ivMomentum: clamp(safe(input.ivMomentum), -1.5, 1.5),
    meanReversionPressure: clamp(safe(input.meanReversionPressure), -2, 2),
    termStructureSlope: clamp(safe(input.termStructureSlope), -1, 1),
    skewPressure: clamp(safe(input.skewPressure), -1.5, 1.5),
    volOfVol: clamp(safe(input.volOfVol), 0, 1.5),
    closeToExpiryPressure: clamp(safe(input.closeToExpiryPressure), 0, 1),
  }
}

function featureVector(features: IVForecastFeatureVector): number[] {
  return [
    features.realizedVolTrend,
    features.ivMomentum,
    features.meanReversionPressure,
    features.termStructureSlope,
    features.skewPressure,
    features.volOfVol,
    features.closeToExpiryPressure,
  ]
}

function modelUsable(model: IVForecastModelWeights): boolean {
  const { inputSize, hiddenSize, cell } = model
  if (!Number.isFinite(inputSize) || inputSize <= 0) return false
  if (!Number.isFinite(hiddenSize) || hiddenSize <= 0) return false

  const expectedRowLength = inputSize + hiddenSize
  const gates = [cell.inputGate, cell.forgetGate, cell.outputGate, cell.candidateGate]
  const biases = [cell.biasInput, cell.biasForget, cell.biasOutput, cell.biasCandidate]

  for (const gate of gates) {
    if (gate.length !== hiddenSize) return false
    if (!gate.every((row) => row.length === expectedRowLength)) return false
  }

  for (const bias of biases) {
    if (bias.length !== hiddenSize) return false
  }

  if (model.outputDelta.weights.length !== hiddenSize) return false
  if (model.outputConfidence.weights.length !== hiddenSize) return false
  return true
}

function lstmStep(input: number[], model: IVForecastModelWeights): { hidden: number[]; cell: number[] } {
  const hiddenPrev = new Array(model.hiddenSize).fill(0)
  const cellPrev = new Array(model.hiddenSize).fill(0)
  const stateVector = [...input, ...hiddenPrev]

  const hidden: number[] = []
  const cell: number[] = []

  for (let i = 0; i < model.hiddenSize; i += 1) {
    const inputGate = sigmoid(dot(model.cell.inputGate[i], stateVector) + model.cell.biasInput[i])
    const forgetGate = sigmoid(dot(model.cell.forgetGate[i], stateVector) + model.cell.biasForget[i])
    const outputGate = sigmoid(dot(model.cell.outputGate[i], stateVector) + model.cell.biasOutput[i])
    const candidate = tanh(dot(model.cell.candidateGate[i], stateVector) + model.cell.biasCandidate[i])

    const nextCell = (forgetGate * cellPrev[i]) + (inputGate * candidate)
    const nextHidden = outputGate * tanh(nextCell)
    cell.push(nextCell)
    hidden.push(nextHidden)
  }

  return { hidden, cell }
}

function fallbackDelta(features: IVForecastFeatureVector): { deltaPct: number; confidence: number } {
  const raw = (
    (features.realizedVolTrend * 0.22)
    + (features.ivMomentum * 0.18)
    - (features.meanReversionPressure * 0.30)
    + (features.termStructureSlope * 0.14)
    + (features.skewPressure * 0.08)
    + (features.volOfVol * 0.12)
    - (features.closeToExpiryPressure * 0.10)
  )
  const bounded = clamp(raw, -0.2, 0.2)
  const confidence = clamp(0.6 - Math.min(Math.abs(features.volOfVol), 0.5), 0.1, 0.85)
  return { deltaPct: bounded, confidence }
}

const DEFAULT_IV_FORECAST_MODEL: IVForecastModelWeights = {
  version: 'iv-lstm-lite-v1',
  inputSize: 7,
  hiddenSize: 4,
  cell: {
    inputGate: [
      [0.48, 0.17, -0.24, 0.06, 0.08, 0.11, -0.22, 0.05, -0.03, 0.07, 0.04],
      [0.28, 0.34, -0.20, 0.04, 0.12, 0.15, -0.14, -0.02, 0.05, 0.06, 0.03],
      [0.32, 0.12, -0.18, 0.09, 0.14, 0.05, -0.20, 0.01, 0.04, 0.02, 0.05],
      [0.22, 0.09, -0.16, 0.05, 0.18, 0.07, -0.12, 0.03, 0.04, 0.01, 0.02],
    ],
    forgetGate: [
      [0.54, 0.14, -0.16, 0.03, 0.05, 0.09, -0.10, 0.02, 0.04, 0.03, 0.01],
      [0.36, 0.26, -0.18, 0.06, 0.08, 0.11, -0.11, 0.02, 0.03, 0.04, 0.02],
      [0.30, 0.10, -0.12, 0.10, 0.08, 0.04, -0.09, 0.01, 0.03, 0.01, 0.03],
      [0.24, 0.08, -0.10, 0.07, 0.12, 0.05, -0.08, 0.01, 0.02, 0.01, 0.02],
    ],
    outputGate: [
      [0.46, 0.18, -0.20, 0.04, 0.10, 0.09, -0.15, 0.02, 0.02, 0.04, 0.02],
      [0.31, 0.29, -0.17, 0.05, 0.09, 0.11, -0.12, 0.03, 0.03, 0.05, 0.03],
      [0.27, 0.11, -0.13, 0.08, 0.10, 0.03, -0.10, 0.01, 0.02, 0.03, 0.02],
      [0.20, 0.06, -0.11, 0.06, 0.11, 0.04, -0.08, 0.01, 0.02, 0.02, 0.01],
    ],
    candidateGate: [
      [0.65, 0.21, -0.42, 0.10, 0.16, 0.12, -0.30, 0.06, -0.04, 0.05, 0.03],
      [0.40, 0.39, -0.36, 0.09, 0.18, 0.18, -0.25, 0.03, 0.06, 0.07, 0.04],
      [0.36, 0.14, -0.30, 0.14, 0.20, 0.08, -0.22, 0.02, 0.05, 0.03, 0.04],
      [0.29, 0.10, -0.24, 0.11, 0.24, 0.09, -0.18, 0.03, 0.04, 0.03, 0.03],
    ],
    biasInput: [0.08, 0.07, 0.06, 0.05],
    biasForget: [0.24, 0.22, 0.20, 0.18],
    biasOutput: [0.05, 0.05, 0.04, 0.04],
    biasCandidate: [0.01, 0.01, 0.01, 0.01],
  },
  outputDelta: {
    weights: [0.46, 0.34, 0.30, 0.26],
    bias: -0.02,
  },
  outputConfidence: {
    weights: [0.35, 0.29, 0.26, 0.24],
    bias: 0.2,
  },
}

let activeModel: IVForecastModelWeights | null = null

function resolveModel(): IVForecastModelWeights {
  return activeModel ?? DEFAULT_IV_FORECAST_MODEL
}

function toDirection(deltaIV: number): IVForecastInference['direction'] {
  if (deltaIV > 0.15) return 'up'
  if (deltaIV < -0.15) return 'down'
  return 'flat'
}

export function predictIVForecast(
  currentIV: number | null,
  rawFeatures: IVForecastFeatureVector,
): IVForecastInference {
  const features = normalizeFeatures(rawFeatures)
  if (currentIV == null || !Number.isFinite(currentIV)) {
    return {
      horizonMinutes: HORIZON_MINUTES,
      predictedIV: null,
      currentIV: null,
      deltaIV: null,
      direction: 'unknown',
      confidence: 0,
      source: 'fallback',
      features,
    }
  }

  const model = resolveModel()
  if (!modelUsable(model)) {
    const fallback = fallbackDelta(features)
    const predictedIV = Math.max(1, currentIV * (1 + fallback.deltaPct))
    const deltaIV = predictedIV - currentIV
    return {
      horizonMinutes: HORIZON_MINUTES,
      predictedIV: round(predictedIV, 3),
      currentIV: round(currentIV, 3),
      deltaIV: round(deltaIV, 3),
      direction: toDirection(deltaIV),
      confidence: round(fallback.confidence, 3),
      source: 'fallback',
      features,
    }
  }

  const input = featureVector(features)
  const recurrent = lstmStep(input, model)
  const deltaPct = tanh(dot(recurrent.hidden, model.outputDelta.weights) + model.outputDelta.bias) * 0.2
  const predictedIV = Math.max(1, currentIV * (1 + deltaPct))
  const deltaIV = predictedIV - currentIV
  const confidenceLogit = dot(recurrent.hidden, model.outputConfidence.weights) + model.outputConfidence.bias
  const confidence = clamp(sigmoid(confidenceLogit), 0.05, 0.95)

  return {
    horizonMinutes: HORIZON_MINUTES,
    predictedIV: round(predictedIV, 3),
    currentIV: round(currentIV, 3),
    deltaIV: round(deltaIV, 3),
    direction: toDirection(deltaIV),
    confidence: round(confidence, 3),
    source: 'ml',
    features,
  }
}

export function __setIVForecastModelForTest(model: IVForecastModelWeights | null): void {
  activeModel = model
}

export function __resetIVForecastModelForTest(): void {
  activeModel = null
}
