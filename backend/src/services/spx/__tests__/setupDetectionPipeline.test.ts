import fs from 'node:fs';
import path from 'node:path';

import { __resetSetupDetectorStateForTests, detectActiveSetups } from '../setupDetector';
import { createNeutralFlowWindowAggregation, computeFlowWindowAggregation } from '../flowAggregator';
import { persistSetupInstancesForWinRate } from '../outcomeTracker';
import { getActiveSPXOptimizationProfile } from '../optimizer';
import type {
  ClusterZone,
  RegimeState,
  Setup,
  SetupType,
  SPXEnvironmentGateDecision,
  SPXFlowEvent,
  UnifiedGEXLandscape,
} from '../types';
import { supabase } from '../../../config/database';
import { logger } from '../../../lib/logger';

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../config/redis', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock('../../../config/massive', () => ({
  getMinuteAggregates: vi.fn(),
}));

vi.mock('../../../config/openai', () => ({
  openaiClient: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    models: {
      list: vi.fn(),
    },
  },
}));

vi.mock('../../../config/database', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../optimizer', () => ({
  getActiveSPXOptimizationProfile: vi.fn(),
}));

type DetectOptions = Parameters<typeof detectActiveSetups>[0];
type SetupIndicatorContext = NonNullable<NonNullable<DetectOptions>['indicatorContext']>;

const mockGetActiveSPXOptimizationProfile = getActiveSPXOptimizationProfile as vi.MockedFunction<typeof getActiveSPXOptimizationProfile>;
const mockSupabaseFrom = supabase.from as vi.MockedFunction<typeof supabase.from>;
const mockLoggerInfo = logger.info as vi.MockedFunction<typeof logger.info>;
const originalEnv = { ...process.env };
const BASE_AS_OF = '2026-02-25T15:30:00.000Z';
const setupDetectorSource = fs.readFileSync(path.resolve(__dirname, '../setupDetector.ts'), 'utf8');

function parseNumericConst(name: string): number {
  const match = setupDetectorSource.match(new RegExp(`const\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?);`));
  if (!match) {
    throw new Error(`Unable to locate constant ${name} in setupDetector.ts`);
  }
  return Number(match[1]);
}

function parseNumericRecord(name: string): Record<number, number> {
  const blockMatch = setupDetectorSource.match(new RegExp(`const\\s+${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!blockMatch) {
    throw new Error(`Unable to locate record ${name} in setupDetector.ts`);
  }

  const out: Record<number, number> = {};
  for (const match of blockMatch[1].matchAll(/(\d+)\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
    out[Number(match[1])] = Number(match[2]);
  }
  return out;
}

function parseStringNumberRecord(name: string): Record<string, number> {
  const blockMatch = setupDetectorSource.match(new RegExp(`const\\s+${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!blockMatch) {
    throw new Error(`Unable to locate record ${name} in setupDetector.ts`);
  }

  const out: Record<string, number> = {};
  for (const match of blockMatch[1].matchAll(/([a-z_]+)\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
    out[match[1]] = Number(match[2]);
  }
  return out;
}

function isoOffset(baseIso: string, offsetMs: number): string {
  return new Date(new Date(baseIso).getTime() + offsetMs).toISOString();
}

function buildCluster(input: {
  id?: string;
  low: number;
  high: number;
  score?: number;
  type?: ClusterZone['type'];
  lastTestAt?: string | null;
}): ClusterZone {
  return {
    id: input.id || 'cluster-main',
    priceLow: input.low,
    priceHigh: input.high,
    clusterScore: input.score ?? 4.3,
    type: input.type ?? 'defended',
    sources: [],
    testCount: 2,
    lastTestAt: input.lastTestAt ?? BASE_AS_OF,
    held: true,
    holdRate: 72,
  };
}

function buildGexLandscape(input: {
  currentPrice: number;
  netGex: number;
  flipPoint: number;
  callWall?: number;
  putWall?: number;
  timestamp?: string;
}): UnifiedGEXLandscape {
  const timestamp = input.timestamp || BASE_AS_OF;
  const callWall = input.callWall ?? (input.currentPrice + 40);
  const putWall = input.putWall ?? (input.currentPrice - 40);

  return {
    spx: {
      symbol: 'SPX',
      spotPrice: input.currentPrice,
      netGex: input.netGex,
      flipPoint: input.flipPoint,
      callWall,
      putWall,
      zeroGamma: input.flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp,
    },
    spy: {
      symbol: 'SPY',
      spotPrice: Number((input.currentPrice / 10).toFixed(2)),
      netGex: Math.round(input.netGex * 0.3),
      flipPoint: Number((input.flipPoint / 10).toFixed(2)),
      callWall: Number((callWall / 10).toFixed(2)),
      putWall: Number((putWall / 10).toFixed(2)),
      zeroGamma: Number((input.flipPoint / 10).toFixed(2)),
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp,
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice: input.currentPrice,
      netGex: input.netGex,
      flipPoint: input.flipPoint,
      callWall,
      putWall,
      zeroGamma: input.flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp,
    },
  };
}

function buildIndicatorContext(input: {
  asOf: string;
  currentPrice: number;
  overrides?: Partial<SetupIndicatorContext>;
}): SetupIndicatorContext {
  const sessionOpenTimestamp = isoOffset(input.asOf, -(120 * 60_000));
  const defaults: SetupIndicatorContext = {
    emaFast: input.currentPrice - 1,
    emaSlow: input.currentPrice - 4,
    emaFastSlope: 0.08,
    emaSlowSlope: 0.03,
    atr14: 10.5,
    volumeTrend: 'rising',
    sessionOpenPrice: input.currentPrice - 8,
    orbHigh: input.currentPrice + 10,
    orbLow: input.currentPrice - 10,
    minutesSinceOpen: 120,
    sessionOpenTimestamp,
    asOfTimestamp: input.asOf,
    vwapPrice: null,
    vwapDeviation: null,
    vwapBand1SD: null,
    vwapBand15SD: null,
    vwapBand2SD: null,
    latestBar: null,
    priorBar: null,
    avgRecentVolume: 1_350_000,
  };
  return {
    ...defaults,
    ...(input.overrides || {}),
  };
}

function buildFlowEvent(input: {
  id: string;
  direction: 'bullish' | 'bearish';
  premium: number;
  strike: number;
  timestamp: string;
  type?: 'sweep' | 'block';
}): SPXFlowEvent {
  return {
    id: input.id,
    type: input.type ?? 'sweep',
    symbol: 'SPX',
    strike: input.strike,
    expiry: '2026-03-20',
    size: 150,
    direction: input.direction,
    premium: input.premium,
    timestamp: input.timestamp,
  };
}

function buildBlockedEventRiskGate(reason = 'Event risk blackout active (FOMC)'): SPXEnvironmentGateDecision {
  return {
    passed: false,
    reason,
    reasons: [reason],
    vixRegime: 'elevated',
    dynamicReadyThreshold: 3.4,
    caution: true,
    breakdown: {
      vixRegime: {
        passed: true,
        regime: 'elevated',
        value: 21.7,
      },
      expectedMoveConsumption: {
        passed: true,
        value: 62,
        expectedMovePoints: 14,
      },
      macroCalendar: {
        passed: false,
        caution: true,
        nextEvent: {
          event: 'FOMC Minutes',
          at: isoOffset(BASE_AS_OF, 45 * 60_000),
          minutesUntil: 45,
        },
      },
      sessionTime: {
        passed: true,
        minuteEt: 120,
        minutesUntilClose: 270,
        source: 'local',
      },
      compression: {
        passed: true,
        realizedVolPct: 16,
        impliedVolPct: 20,
        spreadPct: 4,
      },
      eventRisk: {
        passed: false,
        caution: true,
        blackout: true,
        riskScore: 87,
        source: 'combined',
        nextEvent: {
          event: 'FOMC Minutes',
          at: isoOffset(BASE_AS_OF, 45 * 60_000),
          minutesUntil: 45,
        },
        newsSentimentScore: -0.42,
        marketMovingArticleCount: 5,
        recentHighImpactCount: 3,
        latestArticleAt: isoOffset(BASE_AS_OF, -8 * 60_000),
      },
    },
  };
}

function buildOptimizationProfile(overrides?: {
  minConfluenceScore?: number;
  minPWinCalibrated?: number;
  minEvR?: number;
  actionableStatuses?: Array<'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired'>;
  requireFlowConfirmation?: boolean;
  minAlignmentPct?: number;
  requireEmaAlignment?: boolean;
  requireVolumeRegimeAlignment?: boolean;
  pausedSetupTypes?: string[];
  pausedCombos?: string[];
}): Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>> {
  return {
    source: 'default',
    generatedAt: BASE_AS_OF,
    qualityGate: {
      minConfluenceScore: overrides?.minConfluenceScore ?? 0,
      minPWinCalibrated: overrides?.minPWinCalibrated ?? 0,
      minEvR: overrides?.minEvR ?? -10,
      actionableStatuses: overrides?.actionableStatuses || ['ready', 'triggered'],
    },
    flowGate: {
      requireFlowConfirmation: overrides?.requireFlowConfirmation ?? false,
      minAlignmentPct: overrides?.minAlignmentPct ?? 0,
    },
    indicatorGate: {
      requireEmaAlignment: overrides?.requireEmaAlignment ?? false,
      requireVolumeRegimeAlignment: overrides?.requireVolumeRegimeAlignment ?? false,
    },
    timingGate: {
      enabled: false,
      maxFirstSeenMinuteBySetupType: {},
    },
    regimeGate: {
      minTradesPerCombo: 999,
      minT1WinRatePct: 0,
      pausedCombos: overrides?.pausedCombos || [],
    },
    tradeManagement: {
      partialAtT1Pct: 0.5,
      moveStopToBreakeven: true,
    },
    geometryPolicy: {
      bySetupType: {},
      bySetupRegime: {},
      bySetupRegimeTimeBucket: {},
      byTimeBucket: {},
    },
    walkForward: {
      trainingDays: 20,
      validationDays: 5,
      minTrades: 12,
      objectiveWeights: {
        t1: 0.6,
        t2: 0.4,
        failurePenalty: 0.45,
        expectancyR: 0.5,
      },
    },
    driftControl: {
      enabled: false,
      shortWindowDays: 5,
      longWindowDays: 20,
      maxDropPct: 12,
      minLongWindowTrades: 20,
      autoQuarantineEnabled: false,
      triggerRateWindowDays: 10,
      minQuarantineOpportunities: 8,
      minTriggerRatePct: 5,
      pausedSetupTypes: overrides?.pausedSetupTypes || [],
    },
  } as Awaited<ReturnType<typeof getActiveSPXOptimizationProfile>>;
}

function configureOptimizationProfile(overrides?: {
  minConfluenceScore?: number;
  minPWinCalibrated?: number;
  minEvR?: number;
  actionableStatuses?: Array<'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired'>;
  requireFlowConfirmation?: boolean;
  minAlignmentPct?: number;
  requireEmaAlignment?: boolean;
  requireVolumeRegimeAlignment?: boolean;
  pausedSetupTypes?: string[];
  pausedCombos?: string[];
}): void {
  mockGetActiveSPXOptimizationProfile.mockResolvedValue(
    buildOptimizationProfile(overrides) as never,
  );
}

function setupNoopSupabasePersistence() {
  const setupInstancesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  setupInstancesTable.select.mockReturnValue(setupInstancesTable as never);
  setupInstancesTable.update.mockReturnValue(setupInstancesTable as never);

  const levelTouchesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  mockSupabaseFrom.mockImplementation(((table: string) => {
    if (table === 'spx_setup_instances') return setupInstancesTable as never;
    if (table === 'spx_level_touches') return levelTouchesTable as never;
    if (table === 'spx_setup_transitions') {
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      } as never;
    }
    throw new Error(`Unexpected table ${table}`);
  }) as never);

  return {
    setupInstancesTable,
    levelTouchesTable,
  };
}

async function runDetectorScenario(input?: {
  asOf?: string;
  currentPrice?: number;
  cluster?: ClusterZone;
  extraClusters?: ClusterZone[];
  regime?: RegimeState['regime'];
  regimeDirection?: RegimeState['direction'];
  regimeConfidence?: number;
  regimeTimestamp?: string;
  netGex?: number;
  flipPoint?: number;
  callWall?: number;
  putWall?: number;
  gexTimestamp?: string;
  indicatorOverrides?: Partial<SetupIndicatorContext>;
  flowEvents?: SPXFlowEvent[];
  persistForWinRate?: boolean;
  environmentGateOverride?: SPXEnvironmentGateDecision | null;
}): Promise<Setup[]> {
  const asOf = input?.asOf || BASE_AS_OF;
  const currentPrice = input?.currentPrice ?? 5520;
  const cluster = input?.cluster || buildCluster({
    id: 'cluster-main',
    low: currentPrice - 2,
    high: currentPrice,
    lastTestAt: asOf,
  });
  const clusters = [cluster, ...(input?.extraClusters || [])];
  const flowEvents = input?.flowEvents || [];
  const flowAggregation = flowEvents.length > 0
    ? computeFlowWindowAggregation({ flowEvents, asOf: new Date(asOf) })
    : createNeutralFlowWindowAggregation(new Date(asOf));

  return detectActiveSetups({
    forceRefresh: true,
    asOfTimestamp: asOf,
    persistForWinRate: input?.persistForWinRate ?? false,
    levelData: {
      levels: [],
      clusters,
      generatedAt: asOf,
    },
    gexLandscape: buildGexLandscape({
      currentPrice,
      netGex: input?.netGex ?? 1_200_000,
      flipPoint: input?.flipPoint ?? (currentPrice - 10),
      callWall: input?.callWall,
      putWall: input?.putWall,
      timestamp: input?.gexTimestamp || asOf,
    }),
    fibLevels: [],
    regimeState: {
      regime: input?.regime ?? 'ranging',
      direction: input?.regimeDirection ?? 'neutral',
      probability: 66,
      magnitude: 'small',
      confidence: input?.regimeConfidence ?? 74,
      timestamp: input?.regimeTimestamp || asOf,
    },
    flowEvents,
    flowAggregationOverride: flowAggregation,
    indicatorContext: buildIndicatorContext({
      asOf,
      currentPrice,
      overrides: input?.indicatorOverrides,
    }),
    environmentGateOverride: input?.environmentGateOverride,
  });
}

function singleSetup(setups: Setup[]): Setup {
  expect(setups.length).toBeGreaterThan(0);
  return setups[0];
}

function buildPersistedSetup(overrides?: Partial<Setup>): Setup {
  return {
    id: 'setup-persist-1',
    stableIdHash: 'stable-persist-1',
    type: 'mean_reversion',
    direction: 'bullish',
    entryZone: { low: 5510, high: 5512 },
    stop: 5504.5,
    baseStop: 5505.1,
    geometryStopScale: 1.08,
    atr14: 11.7,
    vixRegime: 'elevated',
    netGex: 1_550_000,
    gexNet: 1_550_000,
    gexDistanceBp: 3.1,
    gexCallWall: 5560,
    gexPutWall: 5460,
    gexFlipPoint: 5518,
    target1: { price: 5518.2, label: 'Target 1' },
    target2: { price: 5523.8, label: 'Target 2' },
    confluenceScore: 4,
    confluenceSources: ['ema_alignment', 'regime_alignment'],
    clusterZone: buildCluster({
      id: 'persist-zone',
      low: 5510,
      high: 5512,
      lastTestAt: BASE_AS_OF,
    }),
    regime: 'ranging',
    status: 'triggered',
    score: 79,
    alignmentScore: 61,
    flowConfirmed: true,
    gateStatus: 'eligible',
    gateReasons: [],
    probability: 60,
    pWinCalibrated: 0.61,
    evR: 0.54,
    createdAt: BASE_AS_OF,
    triggeredAt: isoOffset(BASE_AS_OF, 60_000),
    recommendedContract: null,
    ...overrides,
  };
}

async function persistAndCaptureTrackedRow(setup: Setup) {
  const setupInstancesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  setupInstancesTable.select.mockReturnValue(setupInstancesTable as never);
  setupInstancesTable.update.mockReturnValue(setupInstancesTable as never);

  const levelTouchesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  mockSupabaseFrom.mockImplementation(((table: string) => {
    if (table === 'spx_setup_instances') return setupInstancesTable as never;
    if (table === 'spx_level_touches') return levelTouchesTable as never;
    throw new Error(`Unexpected table ${table}`);
  }) as never);

  await persistSetupInstancesForWinRate([setup], {
    observedAt: isoOffset(BASE_AS_OF, 90_000),
  });

  expect(setupInstancesTable.upsert).toHaveBeenCalledTimes(1);
  const [rows] = setupInstancesTable.upsert.mock.calls[0];
  expect(Array.isArray(rows)).toBe(true);
  return rows[0];
}

describe('spx/setupDetectionPipeline - Group 1: WIN_RATE_BY_SCORE integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSetupDetectorStateForTests();
    setupNoopSupabasePersistence();
    configureOptimizationProfile();

    process.env = {
      ...originalEnv,
      SPX_SETUP_SPECIFIC_GATES_ENABLED: 'false',
      SPX_SETUP_SCORE_FLOOR_ENABLED: 'false',
      SPX_SETUP_LATE_SESSION_HARD_GATE_ENABLED: 'false',
      SPX_ENVIRONMENT_GATE_ENABLED: 'false',
      SPX_MEMORY_ENGINE_ENABLED: 'false',
      SPX_WEIGHTED_CONFLUENCE_ENABLED: 'false',
      SPX_MULTI_TF_CONFLUENCE_ENABLED: 'false',
      SPX_ADAPTIVE_EV_ENABLED: 'false',
      SPX_VWAP_GATE_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('maps confluence scores 1-5 to the calibrated baseline table used by setup detection', () => {
    const winRateByScore = parseNumericRecord('WIN_RATE_BY_SCORE');
    expect(winRateByScore).toEqual({
      1: 40,
      2: 50,
      3: 55,
      4: 57,
      5: 60,
    });
  });

  it('applies setup-type baseline offsets so fade_at_wall baseline is higher than trend_pullback at score 3', () => {
    const winRateByScore = parseNumericRecord('WIN_RATE_BY_SCORE');
    const setupTypeAdjustment = parseStringNumberRecord('SETUP_TYPE_WIN_ADJUSTMENT');

    const scoreThreeBase = (winRateByScore[3] || 32) / 100;
    const fadeBaseline = scoreThreeBase + (setupTypeAdjustment.fade_at_wall ?? 0);
    const trendPullbackBaseline = scoreThreeBase + (setupTypeAdjustment.trend_pullback ?? 0);

    expect(fadeBaseline).toBeGreaterThan(trendPullbackBaseline);
  });

  it('clamps pWinCalibrated to 0.95 when raw probability stack would exceed 0.95', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setups = await runDetectorScenario({
      asOf,
      currentPrice: 5510,
      regime: 'ranging',
      netGex: 1_900_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'upper-clamp-zone',
        low: 5508,
        high: 5510,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'flat',
        minutesSinceOpen: 180,
      },
      flowEvents: [
        buildFlowEvent({
          id: 'upper-flow-1',
          direction: 'bullish',
          premium: 260_000,
          strike: 5509,
          timestamp: asOf,
        }),
        buildFlowEvent({
          id: 'upper-flow-2',
          direction: 'bullish',
          premium: 220_000,
          strike: 5510,
          timestamp: asOf,
        }),
      ],
    });

    const setup = singleSetup(setups);
    expect(setup.type).toBe('flip_reclaim');
    expect(setup.pWinCalibrated).toBe(0.95);
  });

  it('clamps pWinCalibrated to 0.05 when raw probability stack would fall below 0.05', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setups = await runDetectorScenario({
      asOf,
      currentPrice: 5500,
      regime: 'ranging',
      regimeDirection: 'bearish',
      regimeConfidence: 88,
      regimeTimestamp: asOf,
      netGex: -900_000,
      flipPoint: 5515,
      cluster: buildCluster({
        id: 'lower-clamp-zone',
        low: 5485,
        high: 5487,
        lastTestAt: isoOffset(asOf, -(2 * 60 * 60 * 1000)),
      }),
      indicatorOverrides: {
        emaFast: 5501,
        emaSlow: 5490,
        emaFastSlope: 0.12,
        volumeTrend: 'rising',
        minutesSinceOpen: 140,
      },
      flowEvents: [
        buildFlowEvent({
          id: 'lower-flow-1',
          direction: 'bearish',
          premium: 360_000,
          strike: 5486,
          timestamp: isoOffset(asOf, -90_000),
        }),
      ],
    });

    const setup = singleSetup(setups);
    expect(setup.confluenceScore).toBeLessThan(2);
    expect(setup.pWinCalibrated).toBe(0.05);
  });

  it('keeps score-5 baseline (no additional adjustments) at or below 0.65 to prevent calibration inflation regressions', () => {
    const winRateByScore = parseNumericRecord('WIN_RATE_BY_SCORE');
    const scoreFiveBaseline = (winRateByScore[5] || 32) / 100;
    expect(scoreFiveBaseline).toBeLessThanOrEqual(0.65);
  });
});

describe('spx/setupDetectionPipeline - Group 2: evaluateOptimizationGate realistic scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSetupDetectorStateForTests();
    setupNoopSupabasePersistence();
    configureOptimizationProfile();

    process.env = {
      ...originalEnv,
      SPX_SETUP_SPECIFIC_GATES_ENABLED: 'false',
      SPX_SETUP_SCORE_FLOOR_ENABLED: 'false',
      SPX_SETUP_LATE_SESSION_HARD_GATE_ENABLED: 'false',
      SPX_ENVIRONMENT_GATE_ENABLED: 'false',
      SPX_MEMORY_ENGINE_ENABLED: 'false',
      SPX_WEIGHTED_CONFLUENCE_ENABLED: 'false',
      SPX_MULTI_TF_CONFLUENCE_ENABLED: 'false',
      SPX_ADAPTIVE_EV_ENABLED: 'false',
      SPX_VWAP_GATE_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('passes the gate for a high-quality setup with score 5, pWin >= 0.60, EV > 0.5, flow confirmation, and no event-risk block', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setup = singleSetup(await runDetectorScenario({
      asOf,
      currentPrice: 5520,
      regime: 'trending',
      regimeDirection: 'bullish',
      netGex: 1_800_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'gate-pass-zone',
        low: 5518,
        high: 5520,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5519,
        emaSlow: 5510,
        emaFastSlope: 0.14,
        emaSlowSlope: 0.08,
        volumeTrend: 'rising',
        minutesSinceOpen: 150,
      },
      flowEvents: [
        buildFlowEvent({
          id: 'gate-pass-flow-1',
          direction: 'bullish',
          premium: 240_000,
          strike: 5519,
          timestamp: asOf,
        }),
        buildFlowEvent({
          id: 'gate-pass-flow-2',
          direction: 'bullish',
          premium: 220_000,
          strike: 5520,
          timestamp: asOf,
        }),
      ],
    }));

    expect(setup.confluenceScore).toBeGreaterThanOrEqual(5);
    expect(setup.pWinCalibrated).toBeGreaterThanOrEqual(0.6);
    expect(setup.evR ?? 0).toBeGreaterThan(0.5);
    expect(setup.flowConfirmed).toBe(true);
    expect(setup.gateReasons).toEqual([]);
  });

  it('blocks low-pWin setups and surfaces a pwin gate reason when calibrated pWin falls near 0.30', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0.3,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setup = singleSetup(await runDetectorScenario({
      asOf,
      currentPrice: 5500,
      regime: 'ranging',
      regimeDirection: 'neutral',
      netGex: -700_000,
      flipPoint: 5515,
      cluster: buildCluster({
        id: 'gate-low-pwin-zone',
        low: 5499,
        high: 5501,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5501,
        emaSlow: 5490,
        emaFastSlope: 0.12,
        volumeTrend: 'rising',
        minutesSinceOpen: 120,
      },
      flowEvents: [
        buildFlowEvent({
          id: 'gate-low-pwin-flow-1',
          direction: 'bearish',
          premium: 320_000,
          strike: 5500,
          timestamp: isoOffset(asOf, -60_000),
        }),
      ],
    }));

    expect(setup.pWinCalibrated ?? 1).toBeLessThanOrEqual(0.3);
    expect(setup.gateReasons?.some((reason) => reason.startsWith('pwin_below_floor:'))).toBe(true);
  });

  it('blocks actionable setups during event-risk conditions with an environment-gate reason', async () => {
    process.env.SPX_ENVIRONMENT_GATE_ENABLED = 'true';
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setup = singleSetup(await runDetectorScenario({
      asOf,
      currentPrice: 5520,
      regime: 'trending',
      regimeDirection: 'bullish',
      netGex: 1_800_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'gate-event-risk-zone',
        low: 5518,
        high: 5520,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5519,
        emaSlow: 5510,
        emaFastSlope: 0.14,
        emaSlowSlope: 0.08,
        volumeTrend: 'rising',
        minutesSinceOpen: 150,
      },
      flowEvents: [
        buildFlowEvent({
          id: 'gate-event-risk-flow-1',
          direction: 'bullish',
          premium: 240_000,
          strike: 5519,
          timestamp: isoOffset(asOf, -60_000),
        }),
        buildFlowEvent({
          id: 'gate-event-risk-flow-2',
          direction: 'bullish',
          premium: 220_000,
          strike: 5520,
          timestamp: isoOffset(asOf, -90_000),
        }),
      ],
      environmentGateOverride: buildBlockedEventRiskGate(),
    }));

    expect(setup.gateStatus).toBe('blocked');
    expect(setup.gateReasons?.some((reason) => reason.startsWith('environment_gate:') && reason.includes('Event risk'))).toBe(true);
  });

  it('blocks low-confluence setups even when EV is high, proving the quality gate is not EV-only', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 3,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setup = singleSetup(await runDetectorScenario({
      asOf,
      currentPrice: 5500,
      regime: 'ranging',
      regimeDirection: 'neutral',
      netGex: -600_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'gate-confluence-floor-zone',
        low: 5499,
        high: 5501,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5480,
        emaSlow: 5490,
        emaFastSlope: 0,
        volumeTrend: 'rising',
        minutesSinceOpen: 180,
      },
      flowEvents: [],
    }));

    expect(setup.confluenceScore).toBe(2);
    expect(setup.evR ?? 0).toBeGreaterThan(0.5);
    expect(setup.gateReasons?.some((reason) => reason.startsWith('confluence_below_floor:'))).toBe(true);
  });

  it('keeps gate reasons arrays free of null/undefined entries', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 3,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const setup = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5500,
      regime: 'ranging',
      netGex: -600_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'gate-reason-sanity-zone',
        low: 5499,
        high: 5501,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5480,
        emaSlow: 5490,
        emaFastSlope: 0,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    expect(Array.isArray(setup.gateReasons)).toBe(true);
    expect((setup.gateReasons || []).every((reason) => typeof reason === 'string' && reason.length > 0)).toBe(true);
  });

  it('treats exact threshold boundaries as pass conditions for pWin and confluence floors', async () => {
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const scenario = {
      asOf: BASE_AS_OF,
      currentPrice: 5500,
      regime: 'ranging' as const,
      netGex: -600_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'gate-boundary-zone',
        low: 5499,
        high: 5501,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5480,
        emaSlow: 5490,
        emaFastSlope: 0,
        volumeTrend: 'rising' as const,
      },
      flowEvents: [] as SPXFlowEvent[],
    };

    const baseline = singleSetup(await runDetectorScenario(scenario));

    configureOptimizationProfile({
      minConfluenceScore: baseline.confluenceScore,
      minPWinCalibrated: baseline.pWinCalibrated ?? 0,
      minEvR: (baseline.evR ?? 0) - 0.01,
    });

    const atBoundary = singleSetup(await runDetectorScenario(scenario));
    expect(atBoundary.gateReasons?.some((reason) => reason.startsWith('confluence_below_floor:'))).toBe(false);

    const pwinReason = atBoundary.gateReasons?.find((reason) => reason.startsWith('pwin_below_floor:')) ?? null;
    if (pwinReason) {
      const effectiveFloor = Number(pwinReason.split('<')[1]);
      expect(Number.isFinite(effectiveFloor)).toBe(true);
      expect(effectiveFloor).toBeGreaterThanOrEqual(baseline.pWinCalibrated ?? 0);
    }
  });
});

describe('spx/setupDetectionPipeline - Group 3: shadow gate threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSetupDetectorStateForTests();
    setupNoopSupabasePersistence();
    configureOptimizationProfile({
      minConfluenceScore: 4,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    process.env = {
      ...originalEnv,
      SPX_SETUP_SPECIFIC_GATES_ENABLED: 'false',
      SPX_SETUP_SCORE_FLOOR_ENABLED: 'false',
      SPX_SETUP_LATE_SESSION_HARD_GATE_ENABLED: 'false',
      SPX_ENVIRONMENT_GATE_ENABLED: 'false',
      SPX_MEMORY_ENGINE_ENABLED: 'false',
      SPX_WEIGHTED_CONFLUENCE_ENABLED: 'false',
      SPX_MULTI_TF_CONFLUENCE_ENABLED: 'false',
      SPX_ADAPTIVE_EV_ENABLED: 'false',
      SPX_VWAP_GATE_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function runShadowThresholdScenario(regimeAgeMs: number, minConfluenceScore = 4) {
    configureOptimizationProfile({
      minConfluenceScore,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    const asOf = BASE_AS_OF;
    const setupInstancesTable = setupNoopSupabasePersistence().setupInstancesTable;
    const setups = await runDetectorScenario({
      asOf,
      currentPrice: 5510,
      regime: 'ranging',
      regimeDirection: 'neutral',
      regimeTimestamp: isoOffset(asOf, -regimeAgeMs),
      netGex: 1_200_000,
      flipPoint: 5500,
      gexTimestamp: asOf,
      cluster: buildCluster({
        id: 'shadow-threshold-zone',
        low: 5508,
        high: 5510,
        lastTestAt: asOf,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'rising',
        minutesSinceOpen: 180,
      },
      flowEvents: [],
      persistForWinRate: true,
    });

    const shadowLogCalls = mockLoggerInfo.mock.calls.filter((call) => call[0] === 'SPX shadow-blocked setup persistence batch');
    const persistedRows = setupInstancesTable.upsert.mock.calls.map((call) => call[0]).flat();
    return {
      setups,
      shadowLogCalls,
      persistedRows,
    };
  }

  it('shadow-logs blocked setups when confluenceScore is exactly 3.0', async () => {
    const { setups, shadowLogCalls, persistedRows } = await runShadowThresholdScenario(0);

    expect(setups.length).toBe(0);
    expect(shadowLogCalls.length).toBeGreaterThan(0);
    expect(persistedRows.length).toBeGreaterThan(0);
    expect(persistedRows[0]?.metadata?.confluenceScore).toBe(3);
  });

  it('does not shadow-log blocked setups when confluenceScore is 2.99', async () => {
    const { setups, shadowLogCalls } = await runShadowThresholdScenario(8704);

    const setup = singleSetup(setups);
    expect(setup.confluenceScore).toBeCloseTo(2.99, 2);
    expect(setup.gateStatus).toBe('blocked');
    expect(shadowLogCalls.length).toBe(0);
  });

  it('shadow-logs blocked setups when confluenceScore is 2.995 (float-safe threshold)', async () => {
    const { setups, shadowLogCalls, persistedRows } = await runShadowThresholdScenario(4335);

    expect(setups.length).toBe(0);
    expect(shadowLogCalls.length).toBeGreaterThan(0);
    expect(persistedRows[0]?.metadata?.confluenceScore).toBeCloseTo(2.995, 3);
  });

  it('never shadow-logs eligible setups even when confluenceScore is high', async () => {
    const { setups, shadowLogCalls } = await runShadowThresholdScenario(0, 2);

    const setup = singleSetup(setups);
    expect(setup.gateStatus).toBe('eligible');
    expect(setup.gateReasons).toEqual([]);
    expect(shadowLogCalls.length).toBe(0);
  });

  it('uses SHADOW_GATE_MIN_CONFLUENCE_SCORE = 2.995', () => {
    const shadowThreshold = parseNumericConst('SHADOW_GATE_MIN_CONFLUENCE_SCORE');
    expect(shadowThreshold).toBe(2.995);
  });
});

describe('spx/setupDetectionPipeline - Group 4: toTrackedRow metadata completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNoopSupabasePersistence();
  });

  it('persists atr14, baseStop, geometryStopScale, vixRegime, gex fields, and stop-engine context metadata', async () => {
    const trackedRow = await persistAndCaptureTrackedRow(buildPersistedSetup());
    expect(trackedRow.metadata).toMatchObject({
      atr14: 11.7,
      baseStop: 5505.1,
      geometryStopScale: 1.08,
      vixRegime: 'elevated',
      netGex: 1_550_000,
      gexNet: 1_550_000,
      stopContext: {
        atr14: 11.7,
        baseStop: 5505.1,
        geometryStopScale: 1.08,
        vixRegime: 'elevated',
        netGex: 1_550_000,
      },
      stopEngine: {
        atr14: 11.7,
        baseStop: 5505.1,
        geometryStopScale: 1.08,
        vixRegime: 'elevated',
        netGex: 1_550_000,
      },
    });
  });

  it('persists atr14 as null (or 0 when provided) instead of silently omitting it', async () => {
    const withoutAtr = await persistAndCaptureTrackedRow(buildPersistedSetup({
      id: 'setup-persist-no-atr',
      atr14: undefined,
    }));
    expect(withoutAtr.metadata).toHaveProperty('atr14');
    expect(withoutAtr.metadata.atr14).toBeNull();

    const zeroAtr = await persistAndCaptureTrackedRow(buildPersistedSetup({
      id: 'setup-persist-zero-atr',
      atr14: 0,
    }));
    expect(zeroAtr.metadata).toHaveProperty('atr14');
    expect(zeroAtr.metadata.atr14).toBe(0);
  });

  it('persists gateStatus values for eligible, blocked, and shadow_blocked setups', async () => {
    const statuses: Array<NonNullable<Setup['gateStatus']>> = ['eligible', 'blocked', 'shadow_blocked'];

    for (const status of statuses) {
      const trackedRow = await persistAndCaptureTrackedRow(buildPersistedSetup({
        id: `setup-persist-gate-${status}`,
        gateStatus: status,
      }));
      expect(trackedRow.metadata.gateStatus).toBe(status);
    }
  });

  it('persists gateReasons into metadata when gate reasons are present', async () => {
    const gateReasons = ['pwin_below_floor:0.298<0.3', 'confluence_below_floor:2<3'];
    const trackedRow = await persistAndCaptureTrackedRow(buildPersistedSetup({
      id: 'setup-persist-gate-reasons',
      gateStatus: 'blocked',
      gateReasons,
    }));
    expect(trackedRow.metadata.gateReasons).toEqual(gateReasons);
  });
});

describe('spx/setupDetectionPipeline - Group 5: pipeline output shape validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSetupDetectorStateForTests();
    setupNoopSupabasePersistence();
    configureOptimizationProfile({
      minConfluenceScore: 0,
      minPWinCalibrated: 0,
      minEvR: -10,
    });

    process.env = {
      ...originalEnv,
      SPX_SETUP_SPECIFIC_GATES_ENABLED: 'false',
      SPX_SETUP_SCORE_FLOOR_ENABLED: 'false',
      SPX_SETUP_LATE_SESSION_HARD_GATE_ENABLED: 'false',
      SPX_ENVIRONMENT_GATE_ENABLED: 'false',
      SPX_MEMORY_ENGINE_ENABLED: 'false',
      SPX_WEIGHTED_CONFLUENCE_ENABLED: 'false',
      SPX_MULTI_TF_CONFLUENCE_ENABLED: 'false',
      SPX_ADAPTIVE_EV_ENABLED: 'false',
      SPX_VWAP_GATE_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('emits required setup fields with correct types and bounded values', async () => {
    const setup = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5520,
      regime: 'ranging',
      netGex: 1_100_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'shape-zone-bull',
        low: 5518,
        high: 5520,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    const validSetupTypes: SetupType[] = [
      'fade_at_wall',
      'breakout_vacuum',
      'mean_reversion',
      'trend_continuation',
      'orb_breakout',
      'trend_pullback',
      'flip_reclaim',
      'vwap_reclaim',
      'vwap_fade_at_band',
    ];

    expect(validSetupTypes).toContain(setup.type);
    expect(['bullish', 'bearish']).toContain(setup.direction);
    expect(Number.isFinite(setup.entryZone.low)).toBe(true);
    expect(Number.isFinite(setup.entryZone.high)).toBe(true);
    expect(setup.entryZone.low).toBeLessThan(setup.entryZone.high);
    expect(Number.isFinite(setup.stop)).toBe(true);
    expect(setup.stop).toBeGreaterThan(0);
    expect(Number.isFinite(setup.target1.price)).toBe(true);
    expect(Number.isFinite(setup.target2.price)).toBe(true);
    expect(setup.target1.price).toBeGreaterThan(0);
    expect(setup.target2.price).toBeGreaterThan(0);
    expect(Number.isInteger(setup.confluenceScore)).toBe(true);
    expect(setup.confluenceScore).toBeGreaterThanOrEqual(1);
    expect(setup.confluenceScore).toBeLessThanOrEqual(5);
    expect(typeof setup.pWinCalibrated).toBe('number');
    expect(setup.pWinCalibrated ?? 0).toBeGreaterThanOrEqual(0.05);
    expect(setup.pWinCalibrated ?? 1).toBeLessThanOrEqual(0.95);
    expect(['trending', 'ranging', 'compression', 'breakout']).toContain(setup.regime);
    expect(['eligible', 'blocked', 'shadow_blocked']).toContain(setup.gateStatus);
  });

  it('keeps bullish setup geometry consistent: stop below entry and target above entry', async () => {
    const setup = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5520,
      regime: 'ranging',
      netGex: 1_100_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'shape-bullish-zone',
        low: 5518,
        high: 5520,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    expect(setup.direction).toBe('bullish');
    expect(setup.stop).toBeLessThan(setup.entryZone.low);
    expect(setup.target1.price).toBeGreaterThan(setup.entryZone.high);
  });

  it('keeps bearish setup geometry consistent: stop above entry and target below entry', async () => {
    const setup = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5480,
      regime: 'ranging',
      netGex: -1_100_000,
      flipPoint: 5490,
      cluster: buildCluster({
        id: 'shape-bearish-zone',
        low: 5482,
        high: 5484,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5495,
        emaSlow: 5500,
        emaFastSlope: -0.12,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    expect(setup.direction).toBe('bearish');
    expect(setup.stop).toBeGreaterThan(setup.entryZone.high);
    expect(setup.target1.price).toBeLessThan(setup.entryZone.low);
  });

  it('keeps target2 farther from entry midpoint than target1 for both directions', async () => {
    const bullish = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5520,
      regime: 'ranging',
      netGex: 1_100_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'shape-distance-bull',
        low: 5518,
        high: 5520,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    const bearish = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5480,
      regime: 'ranging',
      netGex: -1_100_000,
      flipPoint: 5490,
      cluster: buildCluster({
        id: 'shape-distance-bear',
        low: 5482,
        high: 5484,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5495,
        emaSlow: 5500,
        emaFastSlope: -0.12,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    const bullishMid = (bullish.entryZone.low + bullish.entryZone.high) / 2;
    const bearishMid = (bearish.entryZone.low + bearish.entryZone.high) / 2;
    expect(Math.abs(bullish.target2.price - bullishMid)).toBeGreaterThan(Math.abs(bullish.target1.price - bullishMid));
    expect(Math.abs(bearish.target2.price - bearishMid)).toBeGreaterThan(Math.abs(bearish.target1.price - bearishMid));
  });

  it('keeps confluenceScore integer-valued in final setup output (no fractional scores)', async () => {
    const setup = singleSetup(await runDetectorScenario({
      asOf: BASE_AS_OF,
      currentPrice: 5520,
      regime: 'ranging',
      netGex: 1_100_000,
      flipPoint: 5510,
      cluster: buildCluster({
        id: 'shape-integer-confluence-zone',
        low: 5518,
        high: 5520,
        lastTestAt: BASE_AS_OF,
      }),
      indicatorOverrides: {
        emaFast: 5490,
        emaSlow: 5500,
        emaFastSlope: 0,
        volumeTrend: 'rising',
      },
      flowEvents: [],
    }));

    expect(Number.isInteger(setup.confluenceScore)).toBe(true);
  });
});
