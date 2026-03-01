const mockUpdateExecutionState = jest.fn();
const mockMarkStateFailed = jest.fn();
const mockRecordExecutionFill = jest.fn();

jest.mock('../../../spx/executionStateStore', () => ({
  updateExecutionState: (...args: unknown[]) => mockUpdateExecutionState(...args),
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
});
