import {
  __resetFlowAnomalyModelForTest,
  __setFlowAnomalyModelForTest,
  FLOW_ANOMALY_DECISION_THRESHOLD,
  inferFlowAnomaly,
  isFlowAnomaly,
} from '@/lib/ml/flow-anomaly-detector'

describe('flow anomaly detector', () => {
  afterEach(() => {
    __resetFlowAnomalyModelForTest()
  })

  it('flags known anomalous flow patterns above threshold', () => {
    const result = inferFlowAnomaly({
      volumeOiZScore: 4.6,
      premiumMomentum: 1.4,
      spreadTighteningRatio: 0.96,
      sweepIntensity: 1.1,
      timeOfDayNormalizedVolume: 1.8,
    })

    expect(result.source).toBe('ml')
    expect(result.anomalyScore).toBeGreaterThanOrEqual(FLOW_ANOMALY_DECISION_THRESHOLD)
    expect(isFlowAnomaly({
      volumeOiZScore: 4.6,
      premiumMomentum: 1.4,
      spreadTighteningRatio: 0.96,
      sweepIntensity: 1.1,
      timeOfDayNormalizedVolume: 1.8,
    })).toBe(true)
  })

  it('keeps baseline flow below threshold', () => {
    const result = inferFlowAnomaly({
      volumeOiZScore: 0.35,
      premiumMomentum: 0.08,
      spreadTighteningRatio: 0.71,
      sweepIntensity: 0.21,
      timeOfDayNormalizedVolume: 0.83,
    })

    expect(result.source).toBe('ml')
    expect(result.anomalyScore).toBeLessThan(FLOW_ANOMALY_DECISION_THRESHOLD)
  })

  it('falls back when model is malformed', () => {
    __setFlowAnomalyModelForTest({
      version: 'broken',
      sampleSize: 2,
      trees: [],
    })

    const result = inferFlowAnomaly({
      volumeOiZScore: 1.2,
      premiumMomentum: 0.4,
      spreadTighteningRatio: 0.78,
      sweepIntensity: 0.5,
      timeOfDayNormalizedVolume: 1.1,
    })

    expect(result.source).toBe('fallback')
    expect(result.anomalyScore).toBeGreaterThanOrEqual(0)
    expect(result.anomalyScore).toBeLessThanOrEqual(1)
  })
})
