import {
  subscribePositionPushEvents,
  publishPositionAdvice,
  publishPositionLiveUpdate,
  publishPositionPushHeartbeat,
} from '../positionPushChannel';

describe('positionPushChannel', () => {
  it('broadcasts heartbeat events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePositionPushEvents(listener);

    publishPositionPushHeartbeat({
      generatedAt: '2026-02-09T18:00:00.000Z',
      activePositionCount: 4,
      uniqueUsers: 2,
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'heartbeat',
      payload: {
        generatedAt: '2026-02-09T18:00:00.000Z',
        activePositionCount: 4,
        uniqueUsers: 2,
      },
    });

    unsubscribe();
  });

  it('broadcasts position update events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePositionPushEvents(listener);

    publishPositionLiveUpdate({
      userId: 'user-1',
      updatedAt: '2026-02-09T18:00:15.000Z',
      snapshot: {
        id: 'pos-1',
        symbol: 'SPX',
        type: 'call',
        quantity: 1,
        entryPrice: 25,
        entryDate: '2026-02-01',
        currentPrice: 34.2,
        currentValue: 3420,
        costBasis: 2500,
        pnl: 920,
        pnlPct: 36.8,
        daysHeld: 8,
        daysToExpiry: 5,
        updatedAt: '2026-02-09T18:00:15.000Z',
      },
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'position_update',
      payload: {
        userId: 'user-1',
        updatedAt: '2026-02-09T18:00:15.000Z',
        snapshot: expect.objectContaining({
          id: 'pos-1',
          symbol: 'SPX',
          pnl: 920,
        }),
      },
    });

    unsubscribe();
  });

  it('broadcasts position advice events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePositionPushEvents(listener);

    publishPositionAdvice({
      userId: 'user-1',
      generatedAt: '2026-02-09T18:00:30.000Z',
      advice: {
        positionId: 'pos-1',
        type: 'take_profit',
        urgency: 'medium',
        message: 'Take partial profits.',
        suggestedAction: {
          action: 'take_partial_profit',
          closePct: 50,
        },
      },
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'position_advice',
      payload: {
        userId: 'user-1',
        generatedAt: '2026-02-09T18:00:30.000Z',
        advice: expect.objectContaining({
          positionId: 'pos-1',
          type: 'take_profit',
        }),
      },
    });

    unsubscribe();
  });

  it('stops sending events after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePositionPushEvents(listener);
    unsubscribe();

    publishPositionPushHeartbeat({
      generatedAt: '2026-02-09T18:05:00.000Z',
      activePositionCount: 0,
      uniqueUsers: 0,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
