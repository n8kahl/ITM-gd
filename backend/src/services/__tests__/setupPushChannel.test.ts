import {
  subscribeSetupPushEvents,
  publishSetupPushHeartbeat,
  publishSetupStatusUpdate,
} from '../setupPushChannel';

describe('setupPushChannel', () => {
  it('broadcasts heartbeat events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSetupPushEvents(listener);

    publishSetupPushHeartbeat({
      generatedAt: '2026-02-09T15:00:00.000Z',
      activeSetupCount: 3,
      uniqueUsers: 2,
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'heartbeat',
      payload: {
        generatedAt: '2026-02-09T15:00:00.000Z',
        activeSetupCount: 3,
        uniqueUsers: 2,
      },
    });

    unsubscribe();
  });

  it('broadcasts setup_update events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSetupPushEvents(listener);

    publishSetupStatusUpdate({
      setupId: 'setup-1',
      userId: 'user-1',
      symbol: 'SPX',
      setupType: 'breakout',
      previousStatus: 'active',
      status: 'triggered',
      currentPrice: 6010.25,
      reason: 'target_reached',
      evaluatedAt: '2026-02-09T15:05:00.000Z',
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'setup_update',
      payload: {
        setupId: 'setup-1',
        userId: 'user-1',
        symbol: 'SPX',
        setupType: 'breakout',
        previousStatus: 'active',
        status: 'triggered',
        currentPrice: 6010.25,
        reason: 'target_reached',
        evaluatedAt: '2026-02-09T15:05:00.000Z',
      },
    });

    unsubscribe();
  });

  it('stops sending events after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSetupPushEvents(listener);
    unsubscribe();

    publishSetupPushHeartbeat({
      generatedAt: '2026-02-09T15:10:00.000Z',
      activeSetupCount: 1,
      uniqueUsers: 1,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
