const mockFrom = jest.fn() as jest.Mock<any, any>;
const mockSelect = jest.fn() as jest.Mock<any, any>;
const mockEq = jest.fn() as jest.Mock<any, any>;
const mockLimit = jest.fn() as jest.Mock<any, any>;
const mockGetMarketStatus = jest.fn();
const mockPublishSetupPushHeartbeat = jest.fn();

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

jest.mock('../../services/marketHours', () => ({
  getMarketStatus: (...args: any[]) => mockGetMarketStatus(...args),
}));

jest.mock('../../services/setupPushChannel', () => ({
  publishSetupPushHeartbeat: (...args: any[]) => mockPublishSetupPushHeartbeat(...args),
}));

import {
  getSetupPushPollingInterval,
  startSetupPushWorker,
  stopSetupPushWorker,
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
          tracked_at: '2026-02-09T14:00:00.000Z',
        },
        {
          id: 'setup-2',
          user_id: 'user-2',
          symbol: 'QQQ',
          setup_type: 'orb',
          tracked_at: '2026-02-09T14:01:00.000Z',
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
  });
});
