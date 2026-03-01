const mockUpdateExecutionState = jest.fn();
const mockCloseExecutionState = jest.fn();
const mockMarkStateFailed = jest.fn();
const mockRecordExecutionFill = jest.fn();

jest.mock('../../../spx/executionStateStore', () => ({
  updateExecutionState: (...args: unknown[]) => mockUpdateExecutionState(...args),
  closeExecutionState: (...args: unknown[]) => mockCloseExecutionState(...args),
  markStateFailed: (...args: unknown[]) => mockMarkStateFailed(...args),
}));

jest.mock('../../../spx/executionReconciliation', () => ({
  recordExecutionFill: (...args: unknown[]) => mockRecordExecutionFill(...args),
}));

jest.mock('../../../coachPushChannel', () => ({
  publishCoachMessage: jest.fn(),
}));

jest.mock('../../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  enqueueOrderForPolling,
  getOrderPollQueueSize,
  pollOrderLifecycleQueueOnceForTests,
  resetOrderPollerState,
} from '../orderLifecycleManager';

describe('tradier/orderLifecycleManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOrderPollerState();
  });

  afterAll(() => {
    resetOrderPollerState();
  });

  it('records incremental entry fill deltas from broker status polling', async () => {
    const getOrderStatus = jest.fn()
      .mockResolvedValueOnce({
        id: 'entry-001',
        status: 'partially_filled',
        filledQuantity: 2,
        avgFillPrice: 4.5,
        remainingQuantity: 2,
        raw: {},
      })
      .mockResolvedValueOnce({
        id: 'entry-001',
        status: 'filled',
        filledQuantity: 4,
        avgFillPrice: 4.6,
        remainingQuantity: 0,
        raw: {},
      });

    enqueueOrderForPolling({
      orderId: 'entry-001',
      userId: 'user-1',
      setupId: 'setup-1',
      sessionDate: '2026-03-01',
      phase: 'entry',
      tradier: { getOrderStatus } as any,
      totalQuantity: 4,
      transitionEventId: 'evt-triggered-1',
      direction: 'bullish',
      referencePrice: 5870,
    });

    await pollOrderLifecycleQueueOnceForTests();
    await pollOrderLifecycleQueueOnceForTests();

    expect(mockUpdateExecutionState).toHaveBeenCalledWith(
      'user-1',
      'setup-1',
      '2026-03-01',
      expect.objectContaining({
        actualFillQty: 2,
        avgFillPrice: 4.5,
        status: 'partial_fill',
        remainingQuantity: 2,
      }),
    );
    expect(mockUpdateExecutionState).toHaveBeenCalledWith(
      'user-1',
      'setup-1',
      '2026-03-01',
      expect.objectContaining({
        actualFillQty: 4,
        avgFillPrice: 4.6,
        status: 'filled',
        remainingQuantity: 4,
      }),
    );
    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-1',
        side: 'entry',
        phase: 'triggered',
        fillPrice: 4.5,
        fillQuantity: 2,
        brokerOrderId: 'entry-001',
      }),
    );
    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-1',
        side: 'entry',
        phase: 'triggered',
        fillPrice: 4.6,
        fillQuantity: 2,
        brokerOrderId: 'entry-001',
      }),
    );
    expect(getOrderPollQueueSize()).toBe(0);
  });

  it('falls back to reference price when broker fill price is unavailable', async () => {
    const getOrderStatus = jest.fn().mockResolvedValueOnce({
      id: 'entry-002',
      status: 'filled',
      filledQuantity: 1,
      avgFillPrice: 0,
      remainingQuantity: 0,
      raw: {},
    });

    enqueueOrderForPolling({
      orderId: 'entry-002',
      userId: 'user-2',
      setupId: 'setup-2',
      sessionDate: '2026-03-01',
      phase: 'entry',
      tradier: { getOrderStatus } as any,
      totalQuantity: 1,
      transitionEventId: 'evt-triggered-2',
      direction: 'bearish',
      referencePrice: 5862.5,
    });

    await pollOrderLifecycleQueueOnceForTests();

    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-2',
        fillPrice: 5862.5,
        fillQuantity: 1,
        side: 'entry',
      }),
    );
    expect(getOrderPollQueueSize()).toBe(0);
  });

  it('records non-entry phases when fill side/phase metadata is provided', async () => {
    const getOrderStatus = jest.fn()
      .mockResolvedValueOnce({
        id: 't1-001',
        status: 'filled',
        filledQuantity: 2,
        avgFillPrice: 6.1,
        remainingQuantity: 0,
        raw: {},
      })
      .mockResolvedValueOnce({
        id: 'terminal-001',
        status: 'filled',
        filledQuantity: 1,
        avgFillPrice: 2.4,
        remainingQuantity: 0,
        raw: {},
      });

    enqueueOrderForPolling({
      orderId: 't1-001',
      userId: 'user-3',
      setupId: 'setup-3',
      sessionDate: '2026-03-01',
      phase: 't1',
      tradier: { getOrderStatus } as any,
      totalQuantity: 2,
      fillSide: 'partial',
      fillPhase: 'target1_hit',
    });
    enqueueOrderForPolling({
      orderId: 'terminal-001',
      userId: 'user-3',
      setupId: 'setup-3',
      sessionDate: '2026-03-01',
      phase: 'terminal',
      tradier: { getOrderStatus } as any,
      totalQuantity: 1,
      fillSide: 'exit',
      fillPhase: 'invalidated',
    });

    await pollOrderLifecycleQueueOnceForTests();

    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-3',
        side: 'partial',
        phase: 'target1_hit',
        fillPrice: 6.1,
        fillQuantity: 2,
      }),
    );
    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-3',
        side: 'exit',
        phase: 'invalidated',
        fillPrice: 2.4,
        fillQuantity: 1,
      }),
    );
  });

  it('treats runner_stop fills as exit invalidations and closes state', async () => {
    const getOrderStatus = jest.fn().mockResolvedValueOnce({
      id: 'runner-stop-001',
      status: 'filled',
      filledQuantity: 2,
      avgFillPrice: 1.85,
      remainingQuantity: 0,
      raw: {},
    });

    enqueueOrderForPolling({
      orderId: 'runner-stop-001',
      userId: 'user-5',
      setupId: 'setup-5',
      sessionDate: '2026-03-01',
      phase: 'runner_stop',
      tradier: { getOrderStatus } as any,
      totalQuantity: 2,
      referencePrice: 1.8,
      symbol: 'SPXW260301C05870000',
    });

    await pollOrderLifecycleQueueOnceForTests();

    expect(mockRecordExecutionFill).toHaveBeenCalledWith(
      expect.objectContaining({
        setupId: 'setup-5',
        side: 'exit',
        phase: 'invalidated',
        fillPrice: 1.85,
        fillQuantity: 2,
      }),
    );
    expect(mockCloseExecutionState).toHaveBeenCalledWith(
      'user-5',
      'setup-5',
      '2026-03-01',
      'stop',
    );
    expect(getOrderPollQueueSize()).toBe(0);
  });

  it('attaches and resizes entry protective stop as cumulative fills increase', async () => {
    const getOrderStatus = jest.fn()
      .mockResolvedValueOnce({
        id: 'entry-003',
        status: 'partially_filled',
        filledQuantity: 1,
        avgFillPrice: 3.5,
        remainingQuantity: 2,
        raw: {},
      })
      .mockResolvedValueOnce({
        id: 'entry-003',
        status: 'partially_filled',
        filledQuantity: 3,
        avgFillPrice: 3.55,
        remainingQuantity: 0,
        raw: {},
      });
    const placeOrder = jest.fn()
      .mockResolvedValueOnce({ id: 'stop-order-1', status: 'pending', raw: {} })
      .mockResolvedValueOnce({ id: 'stop-order-2', status: 'pending', raw: {} });
    const cancelOrder = jest.fn().mockResolvedValue(true);

    enqueueOrderForPolling({
      orderId: 'entry-003',
      userId: 'user-4',
      setupId: 'setup-4',
      sessionDate: '2026-03-01',
      phase: 'entry',
      tradier: { getOrderStatus, placeOrder, cancelOrder } as any,
      totalQuantity: 3,
      transitionEventId: 'evt-triggered-4',
      direction: 'bullish',
      symbol: 'SPXW260301C05870000',
      protectiveStopPrice: 2.1,
    });

    await pollOrderLifecycleQueueOnceForTests();
    await pollOrderLifecycleQueueOnceForTests();

    expect(placeOrder).toHaveBeenCalledTimes(2);
    expect(placeOrder.mock.calls[0][0]).toMatchObject({
      side: 'sell_to_close',
      type: 'stop',
      quantity: 1,
      stop: 2.1,
      option_symbol: 'SPXW260301C05870000',
    });
    expect(cancelOrder).toHaveBeenCalledWith('stop-order-1');
    expect(placeOrder.mock.calls[1][0]).toMatchObject({
      side: 'sell_to_close',
      type: 'stop',
      quantity: 3,
      stop: 2.1,
      option_symbol: 'SPXW260301C05870000',
    });
    expect(mockUpdateExecutionState).toHaveBeenCalledWith(
      'user-4',
      'setup-4',
      '2026-03-01',
      expect.objectContaining({ runnerStopOrderId: 'stop-order-2' }),
    );
  });
});
