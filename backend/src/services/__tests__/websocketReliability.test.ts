import { logger } from '../../lib/logger';
import { getMarketStatus } from '../marketHours';
import { isMassiveTickStreamConnected } from '../massiveTickStream';
import { __testables } from '../websocket';
import { ingestTick, resetTickCache } from '../tickCache';
import type { Setup } from '../spx/types';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../massiveTickStream', () => ({
  subscribeMassiveTickUpdates: jest.fn(() => () => {}),
  isMassiveTickStreamConnected: jest.fn(),
}));

jest.mock('../marketHours', () => ({
  getMarketStatus: jest.fn(() => ({
    status: 'open',
    session: 'regular',
    message: 'Market open',
  })),
  toEasternTime: jest.fn((date: Date) => ({
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    dayOfWeek: date.getUTCDay(),
    dateStr: date.toISOString().slice(0, 10),
  })),
}));

const mockTickFeedConnected = isMassiveTickStreamConnected as jest.MockedFunction<typeof isMassiveTickStreamConnected>;
const mockGetMarketStatus = getMarketStatus as jest.MockedFunction<typeof getMarketStatus>;
const mockWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6000, high: 6002 },
    stop: 5995,
    target1: { price: 6005, label: 'T1' },
    target2: { price: 6010, label: 'T2' },
    confluenceScore: 80,
    confluenceSources: ['test'],
    clusterZone: {
      id: 'zone-1',
      priceLow: 5998,
      priceHigh: 6003,
      clusterScore: 1,
      type: 'moderate',
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: null,
      holdRate: null,
    },
    regime: 'ranging',
    status: 'ready',
    probability: 62,
    recommendedContract: null,
    createdAt: '2026-02-01T14:30:00.000Z',
    triggeredAt: null,
    ...overrides,
  } as Setup;
}

describe('websocket reliability hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTickCache();
    __testables.__resetActiveSetupRegistry();
    mockTickFeedConnected.mockReturnValue(false);
    mockGetMarketStatus.mockReturnValue({
      status: 'open',
      session: 'regular',
      message: 'Market open',
    });
  });

  describe('Group 1: Tick throttle bypass', () => {
    it('bypasses throttle for ticks near an active setup entry zone', () => {
      __testables.syncActiveSetupRegistry([makeSetup()]);
      const now = 1_700_000_000_000;
      const shouldThrottle = __testables.shouldThrottleTickBroadcast(
        'SPX',
        6000.2,
        now,
        now - 10,
      );

      expect(shouldThrottle).toBe(false);
    });

    it('throttles ticks far from all setups', () => {
      __testables.syncActiveSetupRegistry([makeSetup()]);
      const now = 1_700_000_000_000;
      const shouldThrottle = __testables.shouldThrottleTickBroadcast(
        'SPX',
        6035,
        now,
        now - 10,
      );

      expect(shouldThrottle).toBe(true);
    });

    it('bypasses throttle for ticks near stop levels', () => {
      __testables.syncActiveSetupRegistry([makeSetup({ stop: 5992 })]);
      const now = 1_700_000_000_000;
      const shouldThrottle = __testables.shouldThrottleTickBroadcast(
        'SPX',
        5992.3,
        now,
        now - 5,
      );

      expect(shouldThrottle).toBe(false);
    });

    it('throttles normally when there are no active setups', () => {
      const now = 1_700_000_000_000;
      const shouldThrottle = __testables.shouldThrottleTickBroadcast(
        'SPX',
        6000,
        now,
        now - 10,
      );

      expect(shouldThrottle).toBe(true);
    });
  });

  describe('Group 2: Feed health messages', () => {
    it('marks tick feed active when stream is connected and ticks are fresh', () => {
      const now = 1_700_000_010_000;
      mockTickFeedConnected.mockReturnValue(true);
      ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000,
        size: 1,
        timestamp: now - 500,
        sequence: 1,
      });
      ingestTick({
        symbol: 'SPY',
        rawSymbol: 'SPY',
        price: 600,
        size: 1,
        timestamp: now - 700,
        sequence: 1,
      });

      const health = __testables.getFeedHealthSnapshot(now);
      expect(health.tickFeedActive).toBe(true);
    });

    it('enters degraded poll mode when last tick is older than five seconds', () => {
      const now = 1_700_000_020_000;
      mockTickFeedConnected.mockReturnValue(true);
      ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000,
        size: 1,
        timestamp: now - 6_100,
        sequence: 2,
      });
      ingestTick({
        symbol: 'SPY',
        rawSymbol: 'SPY',
        price: 600,
        size: 1,
        timestamp: now - 6_200,
        sequence: 2,
      });

      const health = __testables.getFeedHealthSnapshot(now);
      expect(health.pollMode).toBe('degraded_poll');
    });

    it('reports lastTickAgeMs within 100ms of expected age', () => {
      const now = 1_700_000_030_000;
      mockTickFeedConnected.mockReturnValue(true);
      ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000,
        size: 1,
        timestamp: now - 2_450,
        sequence: 3,
      });
      ingestTick({
        symbol: 'SPY',
        rawSymbol: 'SPY',
        price: 600,
        size: 1,
        timestamp: now - 2_410,
        sequence: 3,
      });

      const health = __testables.getFeedHealthSnapshot(now);
      expect(Math.abs(health.lastTickAgeMs - 2_450)).toBeLessThanOrEqual(100);
    });
  });

  describe('Group 3: Sequence gap logging', () => {
    it('does not log warning for sequence regression of one', () => {
      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000,
        size: 1,
        timestamp: 1_700_000_100_000,
        sequence: 10,
      })).toBe(true);

      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 5999.75,
        size: 1,
        timestamp: 1_700_000_100_050,
        sequence: 9,
      })).toBe(false);

      expect(mockWarn).not.toHaveBeenCalledWith(
        'Significant tick sequence regression',
        expect.anything(),
      );
    });

    it('logs warning for significant sequence regression of five', () => {
      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000,
        size: 1,
        timestamp: 1_700_000_110_000,
        sequence: 10,
      })).toBe(true);

      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 5998.5,
        size: 1,
        timestamp: 1_700_000_110_050,
        sequence: 5,
      })).toBe(false);

      expect(mockWarn).toHaveBeenCalledWith(
        'Significant tick sequence regression',
        expect.objectContaining({
          symbol: 'SPX',
          expected: 11,
          received: 5,
          gap: 5,
        }),
      );
    });

    it('continues rejecting out-of-order ticks', () => {
      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000.25,
        size: 2,
        timestamp: 1_700_000_120_000,
        sequence: 21,
      })).toBe(true);

      expect(ingestTick({
        symbol: 'SPX',
        rawSymbol: 'I:SPX',
        price: 6000.2,
        size: 2,
        timestamp: 1_700_000_120_050,
        sequence: 20,
      })).toBe(false);
    });
  });
});
