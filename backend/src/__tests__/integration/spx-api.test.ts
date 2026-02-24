import request from 'supertest';
import express from 'express';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'integration-user-1' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/spx/levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../../services/spx/gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../../services/spx/setupDetector', () => ({
  detectActiveSetups: jest.fn(),
  getLatestSetupEnvironmentState: jest.fn(),
  getSetupById: jest.fn(),
}));

jest.mock('../../services/spx/fibEngine', () => ({
  getFibLevels: jest.fn(),
}));

jest.mock('../../services/spx/flowEngine', () => ({
  getFlowEvents: jest.fn(),
}));

jest.mock('../../services/spx/regimeClassifier', () => ({
  classifyCurrentRegime: jest.fn(),
}));

jest.mock('../../services/spx/aiPredictor', () => ({
  getPredictionState: jest.fn(),
}));

jest.mock('../../services/spx/crossReference', () => ({
  getBasisState: jest.fn(),
}));

jest.mock('../../services/spx/contractSelector', () => ({
  getContractRecommendation: jest.fn(),
}));

jest.mock('../../services/spx/outcomeTracker', () => ({
  getSPXWinRateAnalytics: jest.fn(),
}));

jest.mock('../../services/spx/winRateBacktest', () => ({
  runSPXWinRateBacktest: jest.fn(),
}));

jest.mock('../../services/spx/optimizer', () => ({
  getActiveSPXOptimizationProfile: jest.fn(),
  getSPXOptimizerScorecard: jest.fn(),
  runSPXOptimizerScan: jest.fn(),
}));

jest.mock('../../workers/spxOptimizerWorker', () => ({
  getSPXOptimizerWorkerStatus: jest.fn(),
}));

jest.mock('../../services/spx/aiCoach', () => ({
  getCoachState: jest.fn(),
  generateCoachStream: jest.fn(),
}));

jest.mock('../../services/spx', () => ({
  getSPXSnapshot: jest.fn(),
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

import spxRouter from '../../routes/spx';
import { getMergedLevels } from '../../services/spx/levelEngine';
import { computeUnifiedGEXLandscape } from '../../services/spx/gexEngine';
import { detectActiveSetups, getLatestSetupEnvironmentState, getSetupById } from '../../services/spx/setupDetector';
import { getFibLevels } from '../../services/spx/fibEngine';
import { getFlowEvents } from '../../services/spx/flowEngine';
import { classifyCurrentRegime } from '../../services/spx/regimeClassifier';
import { getPredictionState } from '../../services/spx/aiPredictor';
import { getBasisState } from '../../services/spx/crossReference';
import { getContractRecommendation } from '../../services/spx/contractSelector';
import { getSPXWinRateAnalytics } from '../../services/spx/outcomeTracker';
import { runSPXWinRateBacktest } from '../../services/spx/winRateBacktest';
import {
  getActiveSPXOptimizationProfile,
  getSPXOptimizerScorecard,
} from '../../services/spx/optimizer';
import { getCoachState } from '../../services/spx/aiCoach';
import { getSPXSnapshot } from '../../services/spx';
import { getSPXOptimizerWorkerStatus } from '../../workers/spxOptimizerWorker';

const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockDetectActiveSetups = detectActiveSetups as jest.MockedFunction<typeof detectActiveSetups>;
const mockGetLatestSetupEnvironmentState = getLatestSetupEnvironmentState as jest.MockedFunction<typeof getLatestSetupEnvironmentState>;
const mockGetSetupById = getSetupById as jest.MockedFunction<typeof getSetupById>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;
const mockClassifyCurrentRegime = classifyCurrentRegime as jest.MockedFunction<typeof classifyCurrentRegime>;
const mockGetPredictionState = getPredictionState as jest.MockedFunction<typeof getPredictionState>;
const mockGetBasisState = getBasisState as jest.MockedFunction<typeof getBasisState>;
const mockGetContractRecommendation = getContractRecommendation as jest.MockedFunction<typeof getContractRecommendation>;
const mockGetSPXWinRateAnalytics = getSPXWinRateAnalytics as jest.MockedFunction<typeof getSPXWinRateAnalytics>;
const mockRunSPXWinRateBacktest = runSPXWinRateBacktest as jest.MockedFunction<typeof runSPXWinRateBacktest>;
const mockGetActiveSPXOptimizationProfile = getActiveSPXOptimizationProfile as jest.MockedFunction<typeof getActiveSPXOptimizationProfile>;
const mockGetSPXOptimizerScorecard = getSPXOptimizerScorecard as jest.MockedFunction<typeof getSPXOptimizerScorecard>;
const mockGetCoachState = getCoachState as jest.MockedFunction<typeof getCoachState>;
const mockGetSPXSnapshot = getSPXSnapshot as jest.MockedFunction<typeof getSPXSnapshot>;
const mockGetSPXOptimizerWorkerStatus = getSPXOptimizerWorkerStatus as jest.MockedFunction<typeof getSPXOptimizerWorkerStatus>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);

describe('SPX API integration schema', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetMergedLevels.mockResolvedValue({ levels: [], clusters: [], generatedAt: '2026-02-15T15:00:00.000Z' });
    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6032,
        netGex: 2000,
        flipPoint: 6025,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6025,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 603,
        netGex: 1000,
        flipPoint: 602,
        callWall: 604,
        putWall: 600,
        zeroGamma: 602,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6032,
        netGex: 3000,
        flipPoint: 6024,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6024,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-15T15:00:00.000Z',
      },
    });

    mockGetLatestSetupEnvironmentState.mockResolvedValue({
      asOf: '2026-02-15T15:00:00.000Z',
      macroBias: 'neutral',
      eventRisk: 'low',
      volatilityRegime: 'normal',
      newsSentiment: 'neutral',
      overallBias: 'neutral',
    } as any);

    mockDetectActiveSetups.mockResolvedValue([]);
    mockGetSetupById.mockResolvedValue({
      id: 'setup-1',
      type: 'fade_at_wall',
      direction: 'bullish',
      entryZone: { low: 6010, high: 6012 },
      stop: 6007,
      target1: { price: 6020, label: 'Target 1' },
      target2: { price: 6028, label: 'Target 2' },
      confluenceScore: 4,
      confluenceSources: ['gex_alignment'],
      clusterZone: {
        id: 'cluster-1',
        priceLow: 6010,
        priceHigh: 6012,
        clusterScore: 4,
        type: 'defended',
        sources: [],
        testCount: 1,
        lastTestAt: null,
        held: true,
        holdRate: 60,
      },
      regime: 'ranging',
      status: 'ready',
      probability: 72,
      recommendedContract: null,
      createdAt: '2026-02-15T14:00:00.000Z',
      triggeredAt: null,
    });

    mockGetFibLevels.mockResolvedValue([]);
    mockGetFlowEvents.mockResolvedValue([]);
    mockClassifyCurrentRegime.mockResolvedValue({
      regime: 'ranging',
      direction: 'neutral',
      probability: 60,
      magnitude: 'small',
      confidence: 70,
      timestamp: '2026-02-15T15:00:00.000Z',
    });
    mockGetPredictionState.mockResolvedValue({
      regime: 'ranging',
      direction: { bullish: 34, bearish: 33, neutral: 33 },
      magnitude: { small: 50, medium: 40, large: 10 },
      timingWindow: { description: 'test', actionable: true },
      nextTarget: {
        upside: { price: 6042, zone: 'projected' },
        downside: { price: 6020, zone: 'projected' },
      },
      probabilityCone: [],
      confidence: 70,
    });
    mockGetBasisState.mockResolvedValue({
      current: 1.9,
      trend: 'stable',
      leading: 'neutral',
      ema5: 1.8,
      ema20: 1.7,
      zscore: 0.4,
      spxPrice: 6032,
      spyPrice: 603,
      timestamp: '2026-02-15T15:00:00.000Z',
    });
    mockGetContractRecommendation.mockResolvedValue({
      description: '6030C 2026-03-20',
      strike: 6030,
      expiry: '2026-03-20',
      type: 'call',
      delta: 0.32,
      gamma: 0.02,
      theta: -0.03,
      vega: 0.08,
      bid: 24,
      ask: 24.5,
      riskReward: 2.1,
      expectedPnlAtTarget1: 180,
      expectedPnlAtTarget2: 330,
      maxLoss: 2450,
      reasoning: 'test',
    });
    mockGetSPXWinRateAnalytics.mockResolvedValue({
      dateRange: { from: '2026-02-01', to: '2026-02-15' },
      denominator: 'resolved_triggered',
      triggeredCount: 10,
      resolvedCount: 8,
      pendingCount: 2,
      t1Wins: 5,
      t2Wins: 3,
      stopsBeforeT1: 2,
      invalidatedOther: 1,
      expiredUnresolved: 0,
      t1WinRatePct: 62.5,
      t2WinRatePct: 37.5,
      failureRatePct: 25,
      bySetupType: [],
      byRegime: [],
      byTier: [],
    });
    mockRunSPXWinRateBacktest.mockResolvedValue({
      dateRange: { from: '2026-02-01', to: '2026-02-15' },
      sourceUsed: 'spx_setup_instances',
      setupCount: 8,
      evaluatedSetupCount: 8,
      skippedSetupCount: 0,
      ambiguousBarCount: 1,
      missingTarget2Count: 0,
      missingBarsSessions: [],
      requestedResolution: 'second',
      resolutionUsed: 'second',
      resolutionFallbackSessions: [],
      usedMassiveMinuteBars: false,
      executionModel: {
        enabled: true,
        entrySlipPoints: 0.2,
        targetSlipPoints: 0.25,
        stopSlipPoints: 0.15,
        commissionPerTradeR: 0.04,
        partialAtT1Pct: 0.5,
        moveStopToBreakevenAfterT1: true,
      },
      profitability: {
        triggeredCount: 8,
        resolvedCount: 8,
        withRealizedRCount: 8,
        averageRealizedR: 0.38,
        medianRealizedR: 0.42,
        cumulativeRealizedR: 3.04,
        expectancyR: 0.38,
        positiveRealizedRatePct: 62.5,
        bySetupType: [],
      },
      notes: [],
      analytics: {
        dateRange: { from: '2026-02-01', to: '2026-02-15' },
        denominator: 'resolved_triggered',
        triggeredCount: 8,
        resolvedCount: 8,
        pendingCount: 0,
        t1Wins: 5,
        t2Wins: 3,
        stopsBeforeT1: 3,
        invalidatedOther: 0,
        expiredUnresolved: 0,
        t1WinRatePct: 62.5,
        t2WinRatePct: 37.5,
        failureRatePct: 37.5,
        bySetupType: [],
        byRegime: [],
        byTier: [],
      },
    });
    mockGetActiveSPXOptimizationProfile.mockResolvedValue({
      source: 'default',
      generatedAt: '2026-02-15T15:00:00.000Z',
      qualityGate: {
        minConfluenceScore: 3,
        minPWinCalibrated: 0.62,
        minEvR: 0.2,
        actionableStatuses: ['ready', 'triggered'],
      },
      flowGate: {
        requireFlowConfirmation: false,
        minAlignmentPct: 0,
      },
      indicatorGate: {
        requireEmaAlignment: false,
        requireVolumeRegimeAlignment: false,
      },
      timingGate: {
        enabled: true,
        maxFirstSeenMinuteBySetupType: {},
      },
      regimeGate: {
        minTradesPerCombo: 12,
        minT1WinRatePct: 48,
        pausedCombos: [],
      },
      tradeManagement: {
        partialAtT1Pct: 0.5,
        moveStopToBreakeven: true,
      },
      geometryPolicy: {
        bySetupType: {},
        bySetupRegime: {},
        bySetupRegimeTimeBucket: {},
      },
      walkForward: {
        trainingDays: 20,
        validationDays: 5,
        minTrades: 12,
        objectiveWeights: {
          t1: 0.62,
          t2: 0.38,
          failurePenalty: 0.5,
          expectancyR: 14,
        },
      },
      driftControl: {
        enabled: true,
        shortWindowDays: 5,
        longWindowDays: 20,
        maxDropPct: 12,
        minLongWindowTrades: 20,
        autoQuarantineEnabled: true,
        triggerRateWindowDays: 20,
        minQuarantineOpportunities: 20,
        minTriggerRatePct: 3,
        pausedSetupTypes: [],
      },
    });
    mockGetCoachState.mockResolvedValue({ messages: [], generatedAt: '2026-02-15T15:00:00.000Z' });
    mockGetSPXOptimizerScorecard.mockResolvedValue({
      generatedAt: '2026-02-15T15:00:00.000Z',
      scanRange: { from: '2026-02-01', to: '2026-02-15' },
      trainingRange: { from: '2026-01-20', to: '2026-02-09' },
      validationRange: { from: '2026-02-10', to: '2026-02-15' },
      baseline: {
        tradeCount: 10,
        resolvedCount: 10,
        t1Wins: 6,
        t2Wins: 4,
        stopsBeforeT1: 3,
        t1WinRatePct: 60,
        t2WinRatePct: 40,
        failureRatePct: 30,
        expectancyR: 0.25,
        expectancyLowerBoundR: 0.2,
        positiveRealizedRatePct: 60,
        objectiveScore: 10,
        objectiveScoreConservative: 8,
        t1Confidence95: { sampleSize: 10, pointPct: 60, lowerPct: 35, upperPct: 80 },
        t2Confidence95: { sampleSize: 10, pointPct: 40, lowerPct: 20, upperPct: 65 },
        failureConfidence95: { sampleSize: 10, pointPct: 30, lowerPct: 12, upperPct: 55 },
      },
      optimized: {
        tradeCount: 12,
        resolvedCount: 12,
        t1Wins: 8,
        t2Wins: 5,
        stopsBeforeT1: 2,
        t1WinRatePct: 66.67,
        t2WinRatePct: 41.67,
        failureRatePct: 16.67,
        expectancyR: 0.45,
        expectancyLowerBoundR: 0.35,
        positiveRealizedRatePct: 66.67,
        objectiveScore: 12,
        objectiveScoreConservative: 10,
        t1Confidence95: { sampleSize: 12, pointPct: 66.67, lowerPct: 41, upperPct: 85 },
        t2Confidence95: { sampleSize: 12, pointPct: 41.67, lowerPct: 21, upperPct: 66 },
        failureConfidence95: { sampleSize: 12, pointPct: 16.67, lowerPct: 5, upperPct: 42 },
      },
      improvementPct: {
        t1WinRateDelta: 6.67,
        t2WinRateDelta: 1.67,
        objectiveDelta: 2,
        objectiveConservativeDelta: 2,
        expectancyRDelta: 0.2,
      },
      driftAlerts: [],
      setupTypePerformance: [],
      setupComboPerformance: [],
      setupActions: {
        add: [],
        update: [],
        remove: [],
      },
      optimizationApplied: true,
      notes: ['test'],
    });
    mockGetSPXOptimizerWorkerStatus.mockReturnValue({
      enabled: true,
      isRunning: true,
      mode: 'nightly_auto',
      timezone: 'America/New_York',
      targetMinuteEt: 1150,
      targetTimeEt: '19:10',
      checkIntervalMs: 60000,
      lastRunDateEt: '2026-02-14',
      lastAttemptAt: '2026-02-15T00:15:00.000Z',
      lastAttemptAtEt: '2026-02-14 19:15:00 ET',
      lastSuccessAt: '2026-02-15T00:15:10.000Z',
      lastSuccessAtEt: '2026-02-14 19:15:10 ET',
      lastErrorMessage: null,
      nextEligibleRunDateEt: '2026-02-17',
      nextEligibleRunAtEt: '2026-02-17 19:10 ET',
    });
    mockGetSPXSnapshot.mockResolvedValue({
      levels: [],
      clusters: [],
      fibLevels: [],
      gex: {
        spx: {
          symbol: 'SPX',
          spotPrice: 6032,
          netGex: 2000,
          flipPoint: 6025,
          callWall: 6050,
          putWall: 6000,
          zeroGamma: 6025,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:00:00.000Z',
        },
        spy: {
          symbol: 'SPY',
          spotPrice: 603,
          netGex: 1000,
          flipPoint: 602,
          callWall: 604,
          putWall: 600,
          zeroGamma: 602,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:00:00.000Z',
        },
        combined: {
          symbol: 'COMBINED',
          spotPrice: 6032,
          netGex: 3000,
          flipPoint: 6024,
          callWall: 6050,
          putWall: 6000,
          zeroGamma: 6024,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:00:00.000Z',
        },
      },
      basis: {
        current: 1.9,
        trend: 'stable',
        leading: 'neutral',
        ema5: 1.8,
        ema20: 1.7,
        zscore: 0.4,
        spxPrice: 6032,
        spyPrice: 603,
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      spyImpact: {
        beta: 10.2,
        correlation: 0.95,
        basisUsed: 1.9,
        spot: { spx: 6032, spy: 603 },
        levels: [],
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      setups: [],
      regime: {
        regime: 'ranging',
        direction: 'neutral',
        probability: 60,
        magnitude: 'small',
        confidence: 70,
        timestamp: '2026-02-15T15:00:00.000Z',
      },
      prediction: {
        regime: 'ranging',
        direction: { bullish: 34, bearish: 33, neutral: 33 },
        magnitude: { small: 50, medium: 40, large: 10 },
        timingWindow: { description: 'test', actionable: true },
        nextTarget: {
          upside: { price: 6042, zone: 'projected' },
          downside: { price: 6020, zone: 'projected' },
        },
        probabilityCone: [],
        confidence: 70,
      },
      flow: [],
      coachMessages: [],
      generatedAt: '2026-02-15T15:00:00.000Z',
    });

  });

  it('returns expected schemas for SPX endpoints', async () => {
    const snapshot = await request(app).get('/api/spx/snapshot');
    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toEqual(expect.objectContaining({ levels: expect.any(Array), generatedAt: expect.any(String) }));

    const levels = await request(app).get('/api/spx/levels');
    expect(levels.status).toBe(200);
    expect(levels.body).toEqual(expect.objectContaining({ levels: expect.any(Array), generatedAt: expect.any(String) }));

    const clusters = await request(app).get('/api/spx/clusters');
    expect(clusters.status).toBe(200);
    expect(clusters.body).toEqual(expect.objectContaining({ zones: expect.any(Array), generatedAt: expect.any(String) }));

    const gex = await request(app).get('/api/spx/gex');
    expect(gex.status).toBe(200);
    expect(gex.body).toEqual(expect.objectContaining({ spx: expect.any(Object), spy: expect.any(Object), combined: expect.any(Object) }));

    const setups = await request(app).get('/api/spx/setups');
    expect(setups.status).toBe(200);
    expect(setups.body).toEqual(expect.objectContaining({ setups: expect.any(Array), count: expect.any(Number) }));

    const setup = await request(app).get('/api/spx/setups/setup-1');
    expect(setup.status).toBe(200);
    expect(setup.body).toEqual(expect.objectContaining({ id: 'setup-1', entryZone: expect.any(Object) }));

    const fibonacci = await request(app).get('/api/spx/fibonacci');
    expect(fibonacci.status).toBe(200);
    expect(fibonacci.body).toEqual(expect.objectContaining({ levels: expect.any(Array), count: expect.any(Number) }));

    const flow = await request(app).get('/api/spx/flow');
    expect(flow.status).toBe(200);
    expect(flow.body).toEqual(expect.objectContaining({ events: expect.any(Array), count: expect.any(Number) }));

    const regime = await request(app).get('/api/spx/regime');
    expect(regime.status).toBe(200);
    expect(regime.body).toEqual(expect.objectContaining({ regime: expect.any(String), prediction: expect.any(Object) }));

    const basis = await request(app).get('/api/spx/basis');
    expect(basis.status).toBe(200);
    expect(basis.body).toEqual(expect.objectContaining({ current: expect.any(Number), trend: expect.any(String) }));

    const contract = await request(app).get('/api/spx/contract-select?setupId=setup-1');
    expect(contract.status).toBe(200);
    expect(contract.body).toEqual(expect.objectContaining({ strike: expect.any(Number), expiry: expect.any(String) }));

    const winRate = await request(app).get('/api/spx/analytics/win-rate?from=2026-02-01&to=2026-02-15');
    expect(winRate.status).toBe(200);
    expect(winRate.body).toEqual(expect.objectContaining({
      triggeredCount: expect.any(Number),
      resolvedCount: expect.any(Number),
      t1WinRatePct: expect.any(Number),
      t2WinRatePct: expect.any(Number),
      bySetupType: expect.any(Array),
    }));

    const winRateBacktest = await request(app).get('/api/spx/analytics/win-rate/backtest?from=2026-02-01&to=2026-02-15');
    expect(winRateBacktest.status).toBe(200);
    expect(winRateBacktest.body).toEqual(expect.objectContaining({
      sourceUsed: expect.any(String),
      setupCount: expect.any(Number),
      usedMassiveMinuteBars: expect.any(Boolean),
      analytics: expect.objectContaining({
        t1WinRatePct: expect.any(Number),
        t2WinRatePct: expect.any(Number),
      }),
    }));

    const optimizerSchedule = await request(app).get('/api/spx/analytics/optimizer/schedule');
    expect(optimizerSchedule.status).toBe(200);
    expect(optimizerSchedule.body).toEqual(expect.objectContaining({
      enabled: true,
      mode: 'nightly_auto',
      targetTimeEt: expect.any(String),
      lastOptimizationGeneratedAt: expect.any(String),
      lastOptimizationRange: expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
      lastOptimizationApplied: expect.any(Boolean),
    }));

    const coach = await request(app).get('/api/spx/coach/state');
    expect(coach.status).toBe(200);
    expect(coach.body).toEqual(expect.objectContaining({ messages: expect.any(Array), generatedAt: expect.any(String) }));

  });
});
