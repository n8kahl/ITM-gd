import {
  subscribeSetupPushEvents,
  publishSetupDetected,
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

  it('broadcasts setup_detected events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSetupPushEvents(listener);

    publishSetupDetected({
      trackedSetupId: 'tracked-1',
      detectedSetupId: 'det-1',
      userId: 'user-1',
      symbol: 'SPX',
      setupType: 'orb_breakout',
      direction: 'bullish',
      confidence: 84,
      currentPrice: 6011.75,
      detectedAt: '2026-02-09T15:15:00.000Z',
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'setup_detected',
      payload: {
        trackedSetupId: 'tracked-1',
        detectedSetupId: 'det-1',
        userId: 'user-1',
        symbol: 'SPX',
        setupType: 'orb_breakout',
        direction: 'bullish',
        confidence: 84,
        currentPrice: 6011.75,
        detectedAt: '2026-02-09T15:15:00.000Z',
      },
    });

    unsubscribe();
  });

  it('does not crash when a listener subscribes during broadcast', () => {
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const lateListener = jest.fn();
    let unsubscribeLate: (() => void) | undefined;

    const unsubscribeFirst = subscribeSetupPushEvents(() => {
      firstListener();
      if (!unsubscribeLate) {
        unsubscribeLate = subscribeSetupPushEvents(lateListener);
      }
    });
    const unsubscribeSecond = subscribeSetupPushEvents(secondListener);

    publishSetupPushHeartbeat({
      generatedAt: '2026-02-09T15:20:00.000Z',
      activeSetupCount: 2,
      uniqueUsers: 1,
    });

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(lateListener).toHaveBeenCalledTimes(0);

    publishSetupPushHeartbeat({
      generatedAt: '2026-02-09T15:21:00.000Z',
      activeSetupCount: 2,
      uniqueUsers: 1,
    });

    expect(lateListener).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeSecond();
    if (unsubscribeLate) {
      unsubscribeLate();
    }
  });

  it('does not skip listeners when one unsubscribes another during broadcast', () => {
    const callOrder: string[] = [];
    const listenerB = jest.fn(() => {
      callOrder.push('B');
    });
    const listenerC = jest.fn(() => {
      callOrder.push('C');
    });

    let unsubscribeB: () => void = () => {};
    const unsubscribeA = subscribeSetupPushEvents(() => {
      callOrder.push('A');
      unsubscribeB();
    });
    unsubscribeB = subscribeSetupPushEvents(listenerB);
    const unsubscribeC = subscribeSetupPushEvents(listenerC);

    publishSetupStatusUpdate({
      setupId: 'setup-2',
      userId: 'user-2',
      symbol: 'SPX',
      setupType: 'fade_at_wall',
      previousStatus: 'active',
      status: 'invalidated',
      currentPrice: 5998.25,
      reason: 'stop_loss_hit',
      evaluatedAt: '2026-02-09T15:25:00.000Z',
    });

    expect(callOrder).toEqual(['A', 'B', 'C']);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerC).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
    unsubscribeC();
  });

  it('continues broadcasting when one listener throws', () => {
    const throwingListener = jest.fn(() => {
      throw new Error('listener-failure');
    });
    const healthyListener = jest.fn();

    const unsubscribeThrowing = subscribeSetupPushEvents(throwingListener);
    const unsubscribeHealthy = subscribeSetupPushEvents(healthyListener);

    expect(() =>
      publishSetupDetected({
        trackedSetupId: 'tracked-2',
        detectedSetupId: 'det-2',
        userId: 'user-2',
        symbol: 'SPX',
        setupType: 'trend_pullback',
        direction: 'bullish',
        confidence: 71,
        currentPrice: 6012.5,
        detectedAt: '2026-02-09T15:30:00.000Z',
      }),
    ).not.toThrow();
    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(1);

    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});
