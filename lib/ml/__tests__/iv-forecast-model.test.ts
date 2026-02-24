import {
  __resetIVForecastModelForTest,
  __setIVForecastModelForTest,
  predictIVForecast,
} from '@/lib/ml/iv-forecast-model'

describe('iv forecast model', () => {
  afterEach(() => {
    __resetIVForecastModelForTest()
  })

  it('predicts upward IV when momentum and flow are supportive', () => {
    const prediction = predictIVForecast(22.4, {
      realizedVolTrend: 0.52,
      ivMomentum: 0.44,
      meanReversionPressure: -0.25,
      termStructureSlope: 0.18,
      skewPressure: 0.2,
      volOfVol: 0.22,
      closeToExpiryPressure: 0.08,
    })

    expect(prediction.source).toBe('ml')
    expect(prediction.predictedIV).not.toBeNull()
    expect(prediction.direction).toBe('up')
    expect(prediction.confidence).toBeGreaterThan(0)
  })

  it('predicts downward IV when mean reversion pressure dominates', () => {
    const prediction = predictIVForecast(29.1, {
      realizedVolTrend: -0.28,
      ivMomentum: -0.36,
      meanReversionPressure: 1.35,
      termStructureSlope: -0.2,
      skewPressure: -0.12,
      volOfVol: 0.45,
      closeToExpiryPressure: 0.4,
    })

    expect(prediction.source).toBe('ml')
    expect(prediction.predictedIV).not.toBeNull()
    expect(prediction.direction).toBe('down')
  })

  it('returns unknown prediction when current IV is unavailable', () => {
    const prediction = predictIVForecast(null, {
      realizedVolTrend: 0.1,
      ivMomentum: 0.1,
      meanReversionPressure: 0,
      termStructureSlope: 0.1,
      skewPressure: 0,
      volOfVol: 0.2,
      closeToExpiryPressure: 0.1,
    })

    expect(prediction.predictedIV).toBeNull()
    expect(prediction.currentIV).toBeNull()
    expect(prediction.direction).toBe('unknown')
  })

  it('falls back when model dimensions are invalid', () => {
    __setIVForecastModelForTest({
      version: 'broken',
      inputSize: 7,
      hiddenSize: 4,
      cell: {
        inputGate: [[1], [1], [1], [1]],
        forgetGate: [[1], [1], [1], [1]],
        outputGate: [[1], [1], [1], [1]],
        candidateGate: [[1], [1], [1], [1]],
        biasInput: [0, 0, 0, 0],
        biasForget: [0, 0, 0, 0],
        biasOutput: [0, 0, 0, 0],
        biasCandidate: [0, 0, 0, 0],
      },
      outputDelta: {
        weights: [0.2, 0.2, 0.2, 0.2],
        bias: 0,
      },
      outputConfidence: {
        weights: [0.2, 0.2, 0.2, 0.2],
        bias: 0,
      },
    })

    const prediction = predictIVForecast(20, {
      realizedVolTrend: 0.1,
      ivMomentum: 0.05,
      meanReversionPressure: 0.2,
      termStructureSlope: 0,
      skewPressure: 0.05,
      volOfVol: 0.3,
      closeToExpiryPressure: 0.2,
    })

    expect(prediction.source).toBe('fallback')
    expect(prediction.predictedIV).not.toBeNull()
  })
})
