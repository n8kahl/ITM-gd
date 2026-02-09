const mockFrom = jest.fn() as jest.Mock<any, any>;
const mockSelect = jest.fn() as jest.Mock<any, any>;
const mockEq = jest.fn() as jest.Mock<any, any>;
const mockLimit = jest.fn() as jest.Mock<any, any>;
const mockUpdate = jest.fn() as jest.Mock<any, any>;
const mockGetMarketStatus = jest.fn();
const mockGetMinuteAggregates = jest.fn() as jest.Mock<any, any>;
const mockGetDailyAggregates = jest.fn() as jest.Mock<any, any>;
const mockPublishSetupPushHeartbeat = jest.fn();
const mockPublishSetupStatusUpdate = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../config/massive', () => ({
  getMinuteAggregates: (...args: any[]) => mockGetMinuteAggregates(...args),
  getDailyAggregates: (...args: any[]) => mockGetDailyAggregates(...args),
}));

jest.mock('../../services/marketHours', () => ({
  getMarketStatus: (...args: any[]) => mockGetMarketStatus(...args),
}));

jest.mock('../../services/setupPushChannel', () => ({
  publishSetupPushHeartbeat: (...args: any[]) => mockPublishSetupPushHeartbeat(...args),
  publishSetupStatusUpdate: (...args: any[]) => mockPublishSetupStatusUpdate(...args),
}));

import {
  getSetupPushPollingInterval,
  startSetupPushWorker,
  stopSetupPushWorker,
  evaluateSetupTransition,
  extractSetupTradeLevels,
  SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN,
  SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED,
  SETUP_PUSH_INITIAL_DELAY,
} from '../setupPushWorker';

describe('Setup Push Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockResolvedValue({
      data: [],
      error: null,
    });

    mockGetMinuteAggregates.mockResolvedValue([]);
    mockGetDailyAggregates.mockResolvedValue([]);
    mockGetMarketStatus.mockReturnValue({ status: 'open' });
  });

  afterEach(() => {
    stopSetupPushWorker();
    jest.useRealTimers();
  });

  it('uses market-open polling interval during open sessions', () => {
    mockGetMarketStatus.mockReturnValue({ status: 'open' });
    expect(getSetupPushPollingInterval()).toBe(SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN);
  });

  it('uses slower polling interval when market is closed', () => {
    mockGetMarketStatus.mockReturnValue({ status: 'closed' });
    expect(getSetupPushPollingInterval()).toBe(SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED);
  });

  it('extracts trade levels from opportunity data', () => {
    expect(extractSetupTradeLevels({
      suggestedTrade: {
        entry: 100,
        stopLoss: 95,
        target: 110,
      },
    })).toEqual({
      entry: 100,
      stopLoss: 95,
      target: 110,
    });
  });

  it('evaluates bullish target transition', () => {
    expect(evaluateSetupTransition('bullish', 111, { target: 110, stopLoss: 95 })).toEqual({
      status: 'triggered',
      reason: 'target_reached',
    });
  });

  it('evaluates bearish stop loss transition', () => {
    expect(evaluateSetupTransition('bearish', 106, { target: 95, stopLoss: 105 })).toEqual({
      status: 'invalidated',
      reason: 'stop_loss_hit',
    });
  });

  it('does not evaluate transition for neutral direction', () => {
    expect(evaluateSetupTransition('neutral', 100, { target: 110, stopLoss: 90 })).toBeNull();
  });

  it('schedules only one initial timer when start is called multiple times', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    startSetupPushWorker();
    startSetupPushWorker();

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), SETUP_PUSH_INITIAL_DELAY);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    timeoutSpy.mockRestore();
  });

  it('publishes heartbeat telemetry from active tracked setups', async () => {
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'setup-1',
          user_id: 'user-1',
          symbol: 'SPX',
          setup_type: 'breakout',
          direction: 'bullish',
          tracked_at: '2026-02-09T14:00:00.000Z',
          opportunity_data: {},
        },
        {
          id: 'setup-2',
          user_id: 'user-2',
          symbol: 'QQQ',
          setup_type: 'orb',
          direction: 'bearish',
          tracked_at: '2026-02-09T14:01:00.000Z',
          opportunity_data: {},
        },
      ],
      error: null,
    });

    startSetupPushWorker();
    await jest.advanceTimersByTimeAsync(SETUP_PUSH_INITIAL_DELAY + 5);

    expect(mockFrom).toHaveBeenCalledWith('ai_coach_tracked_setups');
    expect(mockPublishSetupPushHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSetupCount: 2,
        uniqueUsers: 2,
      }),
    );
    expect(mockPublishSetupStatusUpdate).not.toHaveBeenCalled();
  });

  it('persists and publishes setup_update when target is reached', async () => {
    const updateChain: any = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'setup-1' }, error: null }),
    };
    mockUpdate.mockReturnValue(updateChain);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      return { update: mockUpdate };
    });

    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'setup-1',
          user_id: 'user-1',
          symbol: 'SPX',
          setup_type: 'breakout',
          direction: 'bullish',
          tracked_at: '2026-02-09T14:00:00.000Z',
          opportunity_data: {
            suggestedTrade: {
              entry: 100,
              stopLoss: 95,
              target: 105,
            },
          },
        },
      ],
      error: null,
    });

    mockGetMinuteAggregates.mockResolvedValue([
      { c: 106, o: 101, v: 1000 },
    ]);

    startSetupPushWorker();
    await jest.advanceTimersByTimeAsync(SETUP_PUSH_INITIAL_DELAY + 10);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'triggered',
        triggered_at: expect.any(String),
      }),
    );
    expect(mockPublishSetupStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-1',
        userId: 'user-1',
        symbol: 'SPX',
        status: 'triggered',
        reason: 'target_reached',
      }),
    );
  });
});
