type AggregateBar = {
  o: number;
  h: number;
  l: number;
  c: number;
  t: number;
  v?: number;
  vw?: number;
};

function buildBars(input: {
  count: number;
  startPrice: number;
  step?: number;
  volume?: number;
  startTimeMs?: number;
}): AggregateBar[] {
  const step = input.step ?? 1;
  const volume = input.volume ?? 1_000;
  const startTimeMs = input.startTimeMs ?? Date.UTC(2026, 1, 20, 14, 30, 0, 0);
  const out: AggregateBar[] = [];

  for (let i = 0; i < input.count; i += 1) {
    const price = input.startPrice + (i * step);
    out.push({
      o: Number((price - 0.5).toFixed(4)),
      h: Number((price + 1.5).toFixed(4)),
      l: Number((price - 1.5).toFixed(4)),
      c: Number(price.toFixed(4)),
      t: startTimeMs + (i * 60_000),
      v: volume,
      vw: Number(price.toFixed(4)),
    });
  }

  return out;
}

async function loadLevelsHarness() {
  vi.resetModules();

  const fetchDailyData = vi.fn();
  const fetchPreMarketData = vi.fn();
  const fetchIntradayData = vi.fn();
  const getCachedLevels = vi.fn().mockResolvedValue(null);
  const cacheLevels = vi.fn().mockResolvedValue(undefined);
  const analyzeLevelTests = vi.fn().mockResolvedValue(new Map());

  vi.doMock('../../../lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  vi.doMock('../../levels/fetcher', () => ({
    fetchDailyData,
    fetchPreMarketData,
    fetchIntradayData,
  }));

  vi.doMock('../../levels/cache', () => ({
    CACHE_TTL: {
      LEVELS: 300,
    },
    getCachedLevels,
    cacheLevels,
    addCacheMetadata: (data: any, cached: boolean) => ({
      ...data,
      cached,
      cacheExpiresAt: cached ? '2099-01-01T00:00:00.000Z' : null,
    }),
  }));

  vi.doMock('../../levels/levelTestTracker', () => ({
    analyzeLevelTests,
  }));

  vi.doMock('../../marketHours', () => ({
    getMarketStatus: vi.fn(() => ({
      status: 'open',
      session: 'regular',
      timeSinceOpen: '2h 00m',
    })),
  }));

  const levelsModule = await import('../../levels');

  return {
    calculateLevels: levelsModule.calculateLevels,
    mocks: {
      fetchDailyData,
      fetchPreMarketData,
      fetchIntradayData,
      getCachedLevels,
      cacheLevels,
      analyzeLevelTests,
    },
  };
}

async function loadLevelEngineHarness() {
  vi.resetModules();

  const calculateLevels = vi.fn();
  const getBasisState = vi.fn();
  const computeUnifiedGEXLandscape = vi.fn();
  const getFibLevels = vi.fn();
  const cacheGet = vi.fn().mockResolvedValue(null);
  const cacheSet = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../../../lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  vi.doMock('../../../config/redis', () => ({
    cacheGet,
    cacheSet,
  }));

  vi.doMock('../../levels', () => ({
    calculateLevels,
  }));

  vi.doMock('../crossReference', () => ({
    getBasisState,
  }));

  vi.doMock('../gexEngine', () => ({
    computeUnifiedGEXLandscape,
  }));

  vi.doMock('../fibEngine', () => ({
    getFibLevels,
  }));

  const levelEngineModule = await import('../levelEngine');

  return {
    getMergedLevels: levelEngineModule.getMergedLevels,
    mocks: {
      calculateLevels,
      getBasisState,
      computeUnifiedGEXLandscape,
      getFibLevels,
      cacheGet,
      cacheSet,
    },
  };
}

async function loadFibHarness() {
  vi.resetModules();
  vi.doUnmock('../fibEngine');

  const getDailyAggregates = vi.fn();
  const getMinuteAggregates = vi.fn();
  const getBasisState = vi.fn();
  const cacheGet = vi.fn().mockResolvedValue(null);
  const cacheSet = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../../../lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  vi.doMock('../../../config/redis', () => ({
    cacheGet,
    cacheSet,
  }));

  vi.doMock('../../../config/massive', () => ({
    getDailyAggregates,
    getMinuteAggregates,
  }));

  vi.doMock('../crossReference', () => ({
    getBasisState,
  }));

  const fibModule = await import('../fibEngine');

  return {
    getFibLevels: fibModule.getFibLevels,
    mocks: {
      getDailyAggregates,
      getMinuteAggregates,
      getBasisState,
      cacheGet,
      cacheSet,
    },
  };
}

async function loadMultiTFHarness() {
  vi.resetModules();
  vi.doUnmock('../../marketHours');

  const getAggregates = vi.fn();
  const cacheGet = vi.fn().mockResolvedValue(null);
  const cacheSet = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../../../lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  vi.doMock('../../../config/redis', () => ({
    cacheGet,
    cacheSet,
  }));

  vi.doMock('../../../config/massive', () => ({
    getAggregates,
  }));

  const multiTFModule = await import('../multiTFConfluence');

  return {
    getMultiTFConfluenceContext: multiTFModule.getMultiTFConfluenceContext,
    scoreMultiTFConfluence: multiTFModule.scoreMultiTFConfluence,
    mocks: {
      getAggregates,
      cacheGet,
      cacheSet,
    },
  };
}

function buildMockLevelsResponse(symbol: 'SPX' | 'SPY') {
  const basePrice = symbol === 'SPX' ? 6030 : 603;
  return {
    symbol,
    timestamp: '2026-02-25T15:30:00.000Z',
    currentPrice: basePrice,
    dataQuality: {
      integrity: 'full',
      warnings: [],
    },
    levels: {
      resistance: [
        {
          type: 'PDH',
          price: basePrice + 8,
          strength: 'strong',
          description: 'Previous Day High',
          testsToday: 1,
          lastTest: '2026-02-25T14:10:00.000Z',
          holdRate: 65,
        },
      ],
      support: [
        {
          type: 'PDL',
          price: basePrice - 8,
          strength: 'strong',
          description: 'Previous Day Low',
          testsToday: 1,
          lastTest: '2026-02-25T14:00:00.000Z',
          holdRate: 62,
        },
      ],
      pivots: {
        standard: {},
        camarilla: {},
        fibonacci: {},
      },
      indicators: {
        vwap: basePrice,
        atr14: 35,
      },
    },
    marketContext: {
      marketStatus: 'open',
      sessionType: 'regular',
    },
    cached: false,
    cacheExpiresAt: null,
  } as any;
}

function buildMockGexLandscape() {
  return {
    spx: {
      symbol: 'SPX',
      spotPrice: 6030,
      netGex: 2000,
      flipPoint: 6028,
      callWall: 6050,
      putWall: 6005,
      zeroGamma: 6028,
      gexByStrike: [],
      keyLevels: [{ strike: 6050, gex: 1900, type: 'call_wall' }],
      expirationBreakdown: {},
      timestamp: '2026-02-25T15:30:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: 603,
      netGex: 900,
      flipPoint: 602.8,
      callWall: 605,
      putWall: 600.5,
      zeroGamma: 602.8,
      gexByStrike: [],
      keyLevels: [{ strike: 605, gex: 820, type: 'call_wall' }],
      expirationBreakdown: {},
      timestamp: '2026-02-25T15:30:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice: 6030,
      netGex: 2900,
      flipPoint: 6027.5,
      callWall: 6050,
      putWall: 6005,
      zeroGamma: 6027.5,
      gexByStrike: [],
      keyLevels: [{ strike: 6050, gex: 2100, type: 'call_wall' }],
      expirationBreakdown: {},
      timestamp: '2026-02-25T15:30:00.000Z',
    },
  };
}

describe('levels pipeline hardening', () => {
  describe('Group 1: silent failure detection', () => {
    it('sets integrity=degraded when pre-market fetch fails', async () => {
      const { calculateLevels, mocks } = await loadLevelsHarness();
      mocks.fetchDailyData.mockResolvedValue(buildBars({ count: 30, startPrice: 6000 }));
      mocks.fetchPreMarketData.mockRejectedValue(new Error('pre-market timeout'));
      mocks.fetchIntradayData.mockResolvedValue(buildBars({ count: 20, startPrice: 6010 }));

      const result = await calculateLevels('SPX', 'intraday');

      expect(result.dataQuality.integrity).toBe('degraded');
      expect(result.dataQuality.warnings).toContain('premarket_data_unavailable');
    });

    it('adds intraday_data_unavailable warning when intraday fetch fails', async () => {
      const { calculateLevels, mocks } = await loadLevelsHarness();
      mocks.fetchDailyData.mockResolvedValue(buildBars({ count: 30, startPrice: 6000 }));
      mocks.fetchPreMarketData.mockResolvedValue(buildBars({ count: 12, startPrice: 6005 }));
      mocks.fetchIntradayData.mockRejectedValue(new Error('intraday timeout'));

      const result = await calculateLevels('SPX', 'intraday');

      expect(result.dataQuality.integrity).toBe('degraded');
      expect(result.dataQuality.warnings).toContain('intraday_data_unavailable');
    });

    it('adds vwap_unavailable warning when VWAP cannot be computed', async () => {
      const { calculateLevels, mocks } = await loadLevelsHarness();
      mocks.fetchDailyData.mockResolvedValue(buildBars({ count: 30, startPrice: 6000 }));
      mocks.fetchPreMarketData.mockResolvedValue(buildBars({ count: 12, startPrice: 6005 }));
      mocks.fetchIntradayData.mockResolvedValue(buildBars({
        count: 20,
        startPrice: 6010,
        volume: 0,
      }));

      const result = await calculateLevels('SPX', 'intraday');

      expect(result.dataQuality.integrity).toBe('full');
      expect(result.dataQuality.warnings).toContain('vwap_unavailable');
    });

    it('adds daily_data_sparse warning when daily bars are under threshold', async () => {
      const { calculateLevels, mocks } = await loadLevelsHarness();
      mocks.fetchDailyData.mockResolvedValue(buildBars({ count: 12, startPrice: 6000 }));
      mocks.fetchPreMarketData.mockResolvedValue(buildBars({ count: 8, startPrice: 6002 }));
      mocks.fetchIntradayData.mockResolvedValue(buildBars({ count: 12, startPrice: 6005 }));

      const result = await calculateLevels('SPX', 'intraday');

      expect(result.dataQuality.warnings).toContain('daily_data_sparse:12_bars');
    });
  });

  describe('Group 2: partial merge resilience', () => {
    it('continues with SPX + SPY legacy levels when GEX fails', async () => {
      const { getMergedLevels, mocks } = await loadLevelEngineHarness();
      mocks.calculateLevels.mockImplementation(async (symbol: string) => buildMockLevelsResponse(symbol as 'SPX' | 'SPY'));
      mocks.getBasisState.mockResolvedValue({ current: 1.8 });
      mocks.getFibLevels.mockResolvedValue([
        {
          ratio: 0.618,
          price: 6020,
          timeframe: 'daily',
          direction: 'retracement',
          swingHigh: 6060,
          swingLow: 5980,
          crossValidated: true,
        },
      ]);
      mocks.computeUnifiedGEXLandscape.mockRejectedValue(new Error('gex unavailable'));

      const result = await getMergedLevels({ forceRefresh: true });

      expect(result.levels.some((level: any) => level.category === 'spy_derived')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'fibonacci')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'options')).toBe(false);
    });

    it('continues with SPX + SPY + GEX when fib computation fails', async () => {
      const { getMergedLevels, mocks } = await loadLevelEngineHarness();
      mocks.calculateLevels.mockImplementation(async (symbol: string) => buildMockLevelsResponse(symbol as 'SPX' | 'SPY'));
      mocks.getBasisState.mockResolvedValue({ current: 1.8 });
      mocks.computeUnifiedGEXLandscape.mockResolvedValue(buildMockGexLandscape());
      mocks.getFibLevels.mockRejectedValue(new Error('fib unavailable'));

      const result = await getMergedLevels({ forceRefresh: true });

      expect(result.levels.some((level: any) => level.category === 'spy_derived')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'options')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'fibonacci')).toBe(false);
    });

    it('skips SPY-derived levels when basis fails but keeps others', async () => {
      const { getMergedLevels, mocks } = await loadLevelEngineHarness();
      mocks.calculateLevels.mockImplementation(async (symbol: string) => buildMockLevelsResponse(symbol as 'SPX' | 'SPY'));
      mocks.getBasisState.mockRejectedValue(new Error('basis unavailable'));
      mocks.computeUnifiedGEXLandscape.mockResolvedValue(buildMockGexLandscape());
      mocks.getFibLevels.mockResolvedValue([
        {
          ratio: 0.5,
          price: 6035,
          timeframe: 'daily',
          direction: 'retracement',
          swingHigh: 6070,
          swingLow: 6000,
          crossValidated: false,
        },
      ]);

      const result = await getMergedLevels({ forceRefresh: true });

      expect(result.levels.some((level: any) => level.symbol === 'SPY' && (level.source === 'PDH' || level.source === 'PDL'))).toBe(false);
      expect(result.levels.some((level: any) => level.category === 'options')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'fibonacci')).toBe(true);
    });

    it('returns only hard-dependency legacy levels when all optional deps fail', async () => {
      const { getMergedLevels, mocks } = await loadLevelEngineHarness();
      mocks.calculateLevels.mockImplementation(async (symbol: string) => buildMockLevelsResponse(symbol as 'SPX' | 'SPY'));
      mocks.getBasisState.mockRejectedValue(new Error('basis unavailable'));
      mocks.computeUnifiedGEXLandscape.mockRejectedValue(new Error('gex unavailable'));
      mocks.getFibLevels.mockRejectedValue(new Error('fib unavailable'));

      const result = await getMergedLevels({ forceRefresh: true });

      expect(result.levels.length).toBeGreaterThan(0);
      expect(result.levels.every((level: any) => level.symbol === 'SPX')).toBe(true);
      expect(result.levels.some((level: any) => level.category === 'options')).toBe(false);
      expect(result.levels.some((level: any) => level.category === 'fibonacci')).toBe(false);
      expect(result.levels.some((level: any) => level.category === 'spy_derived')).toBe(false);
    });
  });

  describe('Group 3: fibonacci validation', () => {
    it('returns empty fib set when daily bars are below validation threshold', async () => {
      const { getFibLevels, mocks } = await loadFibHarness();
      mocks.getDailyAggregates.mockResolvedValue(buildBars({ count: 15, startPrice: 6000 }));
      mocks.getMinuteAggregates.mockResolvedValue(buildBars({ count: 3, startPrice: 6010 }));
      mocks.getBasisState.mockResolvedValue({ current: 0 });

      const levels = await getFibLevels({ forceRefresh: true });

      expect(levels.length).toBe(0);
    });

    it('computes fib levels normally with sufficient daily bars', async () => {
      const { getFibLevels, mocks } = await loadFibHarness();
      mocks.getDailyAggregates.mockResolvedValue(buildBars({ count: 40, startPrice: 6000 }));
      mocks.getMinuteAggregates.mockResolvedValue(buildBars({ count: 30, startPrice: 6010 }));
      mocks.getBasisState.mockResolvedValue({ current: 0 });

      const levels = await getFibLevels({ forceRefresh: true });

      expect(levels.length).toBeGreaterThan(0);
      expect(levels.some((level) => level.timeframe === 'daily')).toBe(true);
    });
  });

  describe('Group 4: multi-timeframe EMA reliability', () => {
    it('marks EMA as unreliable when frame has fewer bars than period', async () => {
      const { getMultiTFConfluenceContext, mocks } = await loadMultiTFHarness();
      mocks.getAggregates.mockResolvedValue({ results: buildBars({ count: 8, startPrice: 6000 }) });

      const context = await getMultiTFConfluenceContext({
        forceRefresh: true,
        evaluationDate: new Date('2026-02-25T15:30:00.000Z'),
      });

      expect(context.tf1m.ema21).toBeGreaterThan(0);
      expect(context.tf1m.emaReliable).toBe(false);
    });

    it('marks EMA as reliable when frame has at least period bars', async () => {
      const { getMultiTFConfluenceContext, mocks } = await loadMultiTFHarness();
      mocks.getAggregates.mockResolvedValue({ results: buildBars({ count: 25, startPrice: 6000 }) });

      const context = await getMultiTFConfluenceContext({
        forceRefresh: true,
        evaluationDate: new Date('2026-02-25T15:30:00.000Z'),
      });

      expect(context.tf1m.emaReliable).toBe(true);
      expect(context.tf5m.emaReliable).toBe(true);
      expect(context.tf15m.emaReliable).toBe(true);
      expect(context.tf1h.emaReliable).toBe(true);
    });

    it('reduces composite by 40% when any frame EMA is unreliable', async () => {
      const { scoreMultiTFConfluence } = await loadMultiTFHarness();
      const baseContext = {
        asOf: '2026-02-25T15:30:00.000Z',
        source: 'computed' as const,
        tf1m: {
          timeframe: '1m' as const,
          ema21: 6010,
          emaReliable: true,
          ema55: 6000,
          slope21: 1,
          latestClose: 6012,
          trend: 'up' as const,
          swingHigh: 6012,
          swingLow: 6006,
          bars: [],
        },
        tf5m: {
          timeframe: '5m' as const,
          ema21: 6011,
          emaReliable: true,
          ema55: 6001,
          slope21: 1,
          latestClose: 6013,
          trend: 'up' as const,
          swingHigh: 6013,
          swingLow: 6005,
          bars: [],
        },
        tf15m: {
          timeframe: '15m' as const,
          ema21: 6012,
          emaReliable: true,
          ema55: 6002,
          slope21: 1,
          latestClose: 6014,
          trend: 'up' as const,
          swingHigh: 6014,
          swingLow: 6004,
          bars: [],
        },
        tf1h: {
          timeframe: '1h' as const,
          ema21: 6013,
          emaReliable: true,
          ema55: 6003,
          slope21: 1,
          latestClose: 6015,
          trend: 'up' as const,
          swingHigh: 6015,
          swingLow: 6003,
          bars: [],
        },
      };

      const baseline = scoreMultiTFConfluence({
        context: baseContext,
        direction: 'bullish',
        currentPrice: 6014,
      });
      const degraded = scoreMultiTFConfluence({
        context: {
          ...baseContext,
          tf15m: {
            ...baseContext.tf15m,
            emaReliable: false,
          },
        },
        direction: 'bullish',
        currentPrice: 6014,
      });

      expect(baseline.composite).toBe(100);
      expect(degraded.composite).toBe(60);
      expect(degraded.composite).toBe(Number((baseline.composite * 0.6).toFixed(2)));
    });
  });

  describe('Group 5: timeframe-aware swing lookback', () => {
    it('uses 4-bar swing lookback for 1h timeframe', async () => {
      const { getMultiTFConfluenceContext, mocks } = await loadMultiTFHarness();

      const oneHourBars = Array.from({ length: 12 }, (_, idx) => ({
        o: 400 + idx,
        h: idx === 0 ? 999 : 400 + idx,
        l: idx === 0 ? 1 : 350 + idx,
        c: 395 + idx,
        t: Date.UTC(2026, 1, 25, 14, 30 + idx),
        v: 1_000,
      }));

      const fiveMinuteBars = Array.from({ length: 12 }, (_, idx) => ({
        o: 500 + idx,
        h: idx === 0 ? 777 : 500 + idx,
        l: idx === 0 ? 111 : 490 + idx,
        c: 498 + idx,
        t: Date.UTC(2026, 1, 25, 14, 30 + idx),
        v: 1_000,
      }));

      const defaultBars = buildBars({ count: 20, startPrice: 6000 });
      mocks.getAggregates.mockImplementation(async (_ticker: string, multiplier: number) => {
        if (multiplier === 60) return { results: oneHourBars };
        if (multiplier === 5) return { results: fiveMinuteBars };
        return { results: defaultBars };
      });

      const context = await getMultiTFConfluenceContext({
        forceRefresh: true,
        evaluationDate: new Date('2026-02-25T15:30:00.000Z'),
      });

      expect(context.tf1h.swingHigh).toBe(411);
      expect(context.tf1h.swingLow).toBe(358);
      expect(context.tf1h.swingHigh).not.toBe(999);
    });

    it('uses 12-bar swing lookback for 5m timeframe', async () => {
      const { getMultiTFConfluenceContext, mocks } = await loadMultiTFHarness();

      const oneHourBars = Array.from({ length: 12 }, (_, idx) => ({
        o: 400 + idx,
        h: idx === 0 ? 999 : 400 + idx,
        l: idx === 0 ? 1 : 350 + idx,
        c: 395 + idx,
        t: Date.UTC(2026, 1, 25, 14, 30 + idx),
        v: 1_000,
      }));

      const fiveMinuteBars = Array.from({ length: 12 }, (_, idx) => ({
        o: 500 + idx,
        h: idx === 0 ? 777 : 500 + idx,
        l: idx === 0 ? 111 : 490 + idx,
        c: 498 + idx,
        t: Date.UTC(2026, 1, 25, 14, 30 + idx),
        v: 1_000,
      }));

      const defaultBars = buildBars({ count: 20, startPrice: 6000 });
      mocks.getAggregates.mockImplementation(async (_ticker: string, multiplier: number) => {
        if (multiplier === 60) return { results: oneHourBars };
        if (multiplier === 5) return { results: fiveMinuteBars };
        return { results: defaultBars };
      });

      const context = await getMultiTFConfluenceContext({
        forceRefresh: true,
        evaluationDate: new Date('2026-02-25T15:30:00.000Z'),
      });

      expect(context.tf5m.swingHigh).toBe(777);
      expect(context.tf5m.swingLow).toBe(111);
    });
  });
});
