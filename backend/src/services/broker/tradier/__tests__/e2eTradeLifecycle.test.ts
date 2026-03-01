/**
 * E2E Trade Lifecycle Test
 *
 * Exercises the full SPX trading flow through the actual execution engine:
 *   Setup trigger → Contract selection → Entry order → T1 scale-out → T2/Stop exit
 *
 * External dependencies (Tradier API, Supabase) mocked at module boundaries.
 * Order router and OCC formatter are NOT mocked — tested through the flow.
 */

// --- Environment (must precede module-scoped evaluation in executionEngine) ---
process.env.TRADIER_EXECUTION_ENABLED = 'true';
process.env.TRADIER_EXECUTION_REQUIRE_AUTO_EXECUTE_METADATA = 'false';
process.env.TRADIER_EXECUTION_SANDBOX = 'true';
process.env.TRADIER_EXECUTION_ENTRY_LIMIT_OFFSET = '0.2';
process.env.TRADIER_EXECUTION_T1_SCALE_PCT = '0.65';
process.env.TRADIER_EXECUTION_RISK_PCT = '0.02';
process.env.TRADIER_EXECUTION_DTBP_UTILIZATION = '0.90';

// --- Mock: Supabase (chainable query builder) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = jest.fn<any, [string]>();

jest.mock('../../../../config/database', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// --- Mock: Contract selector ---
const mockGetContractRecommendation = jest.fn();
jest.mock('../../../spx/contractSelector', () => ({
  getContractRecommendation: (...args: unknown[]) => mockGetContractRecommendation(...args),
}));

// --- Mock: Execution state store ---
const mockUpsertExecutionState = jest.fn();
const mockUpdateExecutionState = jest.fn();
const mockCloseExecutionState = jest.fn();
const mockLoadOpenStates = jest.fn();
jest.mock('../../../spx/executionStateStore', () => ({
  upsertExecutionState: (...args: unknown[]) => mockUpsertExecutionState(...args),
  updateExecutionState: (...args: unknown[]) => mockUpdateExecutionState(...args),
  closeExecutionState: (...args: unknown[]) => mockCloseExecutionState(...args),
  loadOpenStates: () => mockLoadOpenStates(),
}));

// --- Mock: Execution reconciliation ---
const mockRecordExecutionFill = jest.fn();
jest.mock('../../../spx/executionReconciliation', () => ({
  recordExecutionFill: (...args: unknown[]) => mockRecordExecutionFill(...args),
}));

// --- Mock: Coach push channel ---
jest.mock('../../../coachPushChannel', () => ({
  publishCoachMessage: jest.fn(),
}));

// --- Mock: Credentials ---
jest.mock('../credentials', () => ({
  decryptTradierAccessToken: () => 'test-sandbox-token',
  isTradierProductionRuntimeEnabled: () => ({ enabled: true, reason: null }),
}));

// --- Mock: TradierClient ---
const mockPlaceOrder = jest.fn();
const mockCancelOrder = jest.fn();
const mockGetOrderStatus = jest.fn();

jest.mock('../client', () => ({
  TradierClient: jest.fn().mockImplementation(() => ({
    placeOrder: mockPlaceOrder,
    cancelOrder: mockCancelOrder,
    getOrderStatus: mockGetOrderStatus,
  })),
}));

// --- Imports (after all mocks are declared) ---
import {
  processTradierExecutionTransitions,
  __resetExecutionEngineStateForTests,
} from '../executionEngine';
import { TradierClient } from '../client';
import type { SetupTransitionEvent } from '../../../spx/tickEvaluator';
import type { Setup, ContractRecommendation, ClusterZone } from '../../../spx/types';

// --- Fixtures ---
const MOCK_CLUSTER_ZONE: ClusterZone = {
  id: 'cz-1',
  priceLow: 5863,
  priceHigh: 5872,
  clusterScore: 7,
  type: 'fortress',
  sources: [],
  testCount: 3,
  lastTestAt: null,
  held: true,
  holdRate: 0.85,
};

const MOCK_SETUP: Setup = {
  id: 'setup-e2e-001',
  type: 'fade_at_wall',
  direction: 'bullish',
  entryZone: { low: 5865, high: 5870 },
  stop: 5855,
  target1: { price: 5885, label: 'T1 +15pts' },
  target2: { price: 5900, label: 'T2 +30pts' },
  confluenceScore: 5,
  confluenceSources: ['put_wall', 'fib_618', 'vwap'],
  regime: 'ranging',
  status: 'triggered',
  probability: 0.68,
  recommendedContract: null,
  createdAt: '2026-02-23T14:30:00Z',
  triggeredAt: '2026-02-23T14:45:00Z',
  clusterZone: MOCK_CLUSTER_ZONE,
};

const MOCK_RECOMMENDATION: ContractRecommendation = {
  description: 'SPXW 5870C 0DTE',
  strike: 5870,
  expiry: '2026-02-23',
  type: 'call',
  delta: 0.32,
  gamma: 0.008,
  theta: -1.85,
  vega: 0.12,
  bid: 3.80,
  ask: 4.20,
  riskReward: 2.8,
  expectedPnlAtTarget1: 180,
  expectedPnlAtTarget2: 360,
  maxLoss: -420,
  reasoning: 'ATM call aligned with bullish fade',
};

const MOCK_CREDENTIAL = {
  user_id: 'user-e2e-001',
  account_id: 'acct-sandbox-001',
  access_token_ciphertext: 'encrypted-test-token',
  metadata: { spx_auto_execute: true, tradier_sandbox: true },
};

function buildTriggeredEvent(setup: Setup = MOCK_SETUP): SetupTransitionEvent {
  return {
    id: 'evt-trigger-001',
    setupId: setup.id,
    symbol: 'SPX',
    direction: setup.direction,
    fromPhase: 'ready',
    toPhase: 'triggered',
    price: 5868,
    timestamp: '2026-02-23T14:45:00Z',
    reason: 'entry',
    setup,
  };
}

function buildT1Event(setup: Setup = MOCK_SETUP): SetupTransitionEvent {
  return {
    id: 'evt-t1-001',
    setupId: setup.id,
    symbol: 'SPX',
    direction: setup.direction,
    fromPhase: 'triggered',
    toPhase: 'target1_hit',
    price: 5885,
    timestamp: '2026-02-23T15:10:00Z',
    reason: 'target1',
    setup: { ...setup, recommendedContract: MOCK_RECOMMENDATION },
  };
}

function buildT2Event(setup: Setup = MOCK_SETUP): SetupTransitionEvent {
  return {
    id: 'evt-t2-001',
    setupId: setup.id,
    symbol: 'SPX',
    direction: setup.direction,
    fromPhase: 'target1_hit',
    toPhase: 'target2_hit',
    price: 5900,
    timestamp: '2026-02-23T15:30:00Z',
    reason: 'target2',
    setup,
  };
}

function buildStopEvent(setup: Setup = MOCK_SETUP): SetupTransitionEvent {
  return {
    id: 'evt-stop-001',
    setupId: setup.id,
    symbol: 'SPX',
    direction: setup.direction,
    fromPhase: 'target1_hit',
    toPhase: 'invalidated',
    price: 5855,
    timestamp: '2026-02-23T15:30:00Z',
    reason: 'stop',
    setup,
  };
}

/**
 * Configure supabase mock to respond correctly for a given table query.
 * The execution engine queries broker_credentials (list) and portfolio_snapshots (single).
 */
function setupSupabaseMocks(options: {
  credentials?: Record<string, unknown>[];
  portfolio?: { total_equity: number; day_trade_buying_power: number } | null;
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'broker_credentials') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: options.credentials ?? [], error: null }),
                maybeSingle: () => Promise.resolve({
                  data: options.credentials?.[0] ?? null,
                  error: null,
                }),
              }),
              limit: () => Promise.resolve({ data: options.credentials ?? [], error: null }),
              maybeSingle: () => Promise.resolve({
                data: options.credentials?.[0] ?? null,
                error: null,
              }),
            }),
            limit: () => Promise.resolve({ data: options.credentials ?? [], error: null }),
          }),
        }),
      };
    }
    if (table === 'portfolio_snapshots') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: options.portfolio ?? null, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    // Default: no data
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    };
  });
}

// ========================================================================
// Tests
// ========================================================================

describe('SPX E2E: Setup → Contract → Entry → T1 → Exit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOpenStates.mockResolvedValue([]);
    mockRecordExecutionFill.mockResolvedValue(undefined);
    mockUpdateExecutionState.mockResolvedValue(undefined);
    mockCloseExecutionState.mockResolvedValue(undefined);
  });

  // ------------------------------------------------------------------
  // Happy path: full lifecycle with a 4-contract position
  // ------------------------------------------------------------------
  describe('happy path lifecycle (4-contract position)', () => {
    const LARGE_PORTFOLIO = { total_equity: 100_000, day_trade_buying_power: 200_000 };
    // Per-contract debit = ask * 100 = 4.20 * 100 = $420
    // Max risk = $100,000 * 0.02 = $2,000  →  contractsByRisk = floor(2000/420) = 4
    // Buying power = $200,000 * 0.90 / 420 = floor(428.57) = 428  →  contractsByBP = 428
    // quantity = min(4, 428) = 4
    const EXPECTED_QTY = 4;
    const ENTRY_LIMIT = 4.40; // ask (4.20) + offset (0.20)
    let entryOrderSymbol: string;

    beforeAll(() => {
      __resetExecutionEngineStateForTests();
    });

    it('triggered → places entry limit order for 4 contracts', async () => {
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        portfolio: LARGE_PORTFOLIO,
      });
      mockPlaceOrder.mockResolvedValue({ id: 'entry-order-001', status: 'pending', raw: {} });
      mockUpsertExecutionState.mockImplementation((input: Record<string, unknown>) => {
        return Promise.resolve({
          inserted: true,
          state: {
            id: 'state-001',
            userId: input.userId,
            setupId: input.setupId,
            sessionDate: input.sessionDate,
            symbol: input.symbol,
            quantity: input.quantity,
            remainingQuantity: input.remainingQuantity,
            entryOrderId: input.entryOrderId,
            runnerStopOrderId: null,
            entryLimitPrice: input.entryLimitPrice,
            actualFillQty: null,
            avgFillPrice: null,
            status: 'active',
            closeReason: null,
            closedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      });

      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      // Contract recommendation was requested
      expect(mockGetContractRecommendation).toHaveBeenCalledTimes(1);
      expect(mockGetContractRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({ setup: MOCK_SETUP, forceRefresh: true }),
      );

      // TradierClient was constructed with sandbox mode
      expect(TradierClient).toHaveBeenCalledWith(
        expect.objectContaining({ sandbox: true }),
      );

      // Entry order placed
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
      const orderPayload = mockPlaceOrder.mock.calls[0][0];
      expect(orderPayload.side).toBe('buy_to_open');
      expect(orderPayload.type).toBe('limit');
      expect(orderPayload.price).toBe(ENTRY_LIMIT);
      expect(orderPayload.quantity).toBe(EXPECTED_QTY);
      expect(orderPayload.class).toBe('option');
      expect(orderPayload.option_symbol).toMatch(/^SPXW\d{6}C\d{8}$/);
      entryOrderSymbol = orderPayload.option_symbol;

      // State persisted
      expect(mockUpsertExecutionState).toHaveBeenCalledTimes(1);
      expect(mockUpsertExecutionState).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: MOCK_CREDENTIAL.user_id,
          setupId: MOCK_SETUP.id,
          quantity: EXPECTED_QTY,
          remainingQuantity: EXPECTED_QTY,
          entryLimitPrice: ENTRY_LIMIT,
        }),
      );

      // Entry fill is now reconciled from broker order lifecycle polling.
      expect(mockRecordExecutionFill).not.toHaveBeenCalledWith(
        expect.objectContaining({ side: 'entry', phase: 'triggered' }),
      );
    });

    it('target1_hit → scales out 2 contracts + places runner stop for 2', async () => {
      setupSupabaseMocks({
        credentials: [{
          account_id: MOCK_CREDENTIAL.account_id,
          access_token_ciphertext: MOCK_CREDENTIAL.access_token_ciphertext,
          metadata: MOCK_CREDENTIAL.metadata,
        }],
      });
      mockPlaceOrder
        .mockResolvedValueOnce({ id: 'scale-order-001', status: 'pending', raw: {} })
        .mockResolvedValueOnce({ id: 'runner-stop-001', status: 'pending', raw: {} });

      await processTradierExecutionTransitions([buildT1Event()]);

      // Two orders: scale partial + runner stop
      expect(mockPlaceOrder).toHaveBeenCalledTimes(2);

      // Scale order: sell_to_close, limit, qty = floor(4 * 0.65) = 2
      const scalePayload = mockPlaceOrder.mock.calls[0][0];
      expect(scalePayload.side).toBe('sell_to_close');
      expect(scalePayload.type).toBe('limit');
      expect(scalePayload.quantity).toBe(2); // floor(4 * 0.65)
      expect(scalePayload.option_symbol).toBe(entryOrderSymbol);

      // Runner stop order: sell_to_close, stop, qty = 4 - 2 = 2
      const stopPayload = mockPlaceOrder.mock.calls[1][0];
      expect(stopPayload.side).toBe('sell_to_close');
      expect(stopPayload.type).toBe('stop');
      expect(stopPayload.quantity).toBe(2);
      // Stop price = entryLimit * 1.015 = 4.40 * 1.015 = 4.466 → rounded to 4.47
      expect(stopPayload.stop).toBeCloseTo(4.47, 2);

      // State updated with reduced remaining and runner order ID
      expect(mockUpdateExecutionState).toHaveBeenCalledWith(
        MOCK_CREDENTIAL.user_id,
        MOCK_SETUP.id,
        expect.any(String),
        expect.objectContaining({
          remainingQuantity: 2,
          runnerStopOrderId: 'runner-stop-001',
        }),
      );

      // T1 fill is reconciled from broker order lifecycle polling.
      expect(mockRecordExecutionFill).not.toHaveBeenCalledWith(
        expect.objectContaining({ side: 'partial', phase: 'target1_hit' }),
      );
    });

    it('target2_hit → cancels runner stop + market exits 2 remaining', async () => {
      setupSupabaseMocks({
        credentials: [{
          account_id: MOCK_CREDENTIAL.account_id,
          access_token_ciphertext: MOCK_CREDENTIAL.access_token_ciphertext,
          metadata: MOCK_CREDENTIAL.metadata,
        }],
      });
      mockCancelOrder.mockResolvedValue(true);
      mockPlaceOrder.mockResolvedValue({ id: 'exit-order-001', status: 'pending', raw: {} });

      await processTradierExecutionTransitions([buildT2Event()]);

      // Runner stop cancelled
      expect(mockCancelOrder).toHaveBeenCalledWith('runner-stop-001');

      // Market exit for remaining 2 contracts
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
      const exitPayload = mockPlaceOrder.mock.calls[0][0];
      expect(exitPayload.side).toBe('sell_to_close');
      expect(exitPayload.type).toBe('market');
      expect(exitPayload.quantity).toBe(2);

      // State closed
      expect(mockCloseExecutionState).toHaveBeenCalledWith(
        MOCK_CREDENTIAL.user_id,
        MOCK_SETUP.id,
        expect.any(String),
        'target2_hit',
      );
    });
  });

  // ------------------------------------------------------------------
  // Stop loss exit path (separate lifecycle)
  // ------------------------------------------------------------------
  describe('stop loss exit path', () => {
    const LARGE_PORTFOLIO = { total_equity: 100_000, day_trade_buying_power: 200_000 };

    beforeEach(() => {
      __resetExecutionEngineStateForTests();
    });

    it('stop breach → cancels runner stop + market exits remaining', async () => {
      // Phase 1: Entry
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({ credentials: [MOCK_CREDENTIAL], portfolio: LARGE_PORTFOLIO });
      mockPlaceOrder.mockResolvedValue({ id: 'entry-order-002', status: 'pending', raw: {} });
      mockUpsertExecutionState.mockImplementation((input: Record<string, unknown>) =>
        Promise.resolve({
          inserted: true,
          state: {
            id: 'state-002',
            userId: input.userId,
            setupId: input.setupId,
            sessionDate: input.sessionDate,
            symbol: input.symbol,
            quantity: input.quantity,
            remainingQuantity: input.remainingQuantity,
            entryOrderId: input.entryOrderId,
            runnerStopOrderId: null,
            entryLimitPrice: input.entryLimitPrice,
            actualFillQty: null,
            avgFillPrice: null,
            status: 'active',
            closeReason: null,
            closedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );
      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      // Phase 2: T1 scale-out
      jest.clearAllMocks();
      setupSupabaseMocks({
        credentials: [{
          account_id: MOCK_CREDENTIAL.account_id,
          access_token_ciphertext: MOCK_CREDENTIAL.access_token_ciphertext,
          metadata: MOCK_CREDENTIAL.metadata,
        }],
      });
      mockPlaceOrder
        .mockResolvedValueOnce({ id: 'scale-order-002', status: 'pending', raw: {} })
        .mockResolvedValueOnce({ id: 'runner-stop-002', status: 'pending', raw: {} });
      mockUpdateExecutionState.mockResolvedValue(undefined);
      mockRecordExecutionFill.mockResolvedValue(undefined);
      await processTradierExecutionTransitions([buildT1Event()]);

      // Phase 3: Stop breach
      jest.clearAllMocks();
      setupSupabaseMocks({
        credentials: [{
          account_id: MOCK_CREDENTIAL.account_id,
          access_token_ciphertext: MOCK_CREDENTIAL.access_token_ciphertext,
          metadata: MOCK_CREDENTIAL.metadata,
        }],
      });
      mockCancelOrder.mockResolvedValue(true);
      mockPlaceOrder.mockResolvedValue({ id: 'stop-exit-001', status: 'pending', raw: {} });
      mockCloseExecutionState.mockResolvedValue(undefined);
      mockRecordExecutionFill.mockResolvedValue(undefined);

      await processTradierExecutionTransitions([buildStopEvent()]);

      // Runner stop cancelled
      expect(mockCancelOrder).toHaveBeenCalledWith('runner-stop-002');

      // Market exit for remaining
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
      const exitPayload = mockPlaceOrder.mock.calls[0][0];
      expect(exitPayload.side).toBe('sell_to_close');
      expect(exitPayload.type).toBe('market');
      expect(exitPayload.quantity).toBe(2);

      // State closed with 'stop' reason
      expect(mockCloseExecutionState).toHaveBeenCalledWith(
        MOCK_CREDENTIAL.user_id,
        MOCK_SETUP.id,
        expect.any(String),
        'stop',
      );
    });
  });

  // ------------------------------------------------------------------
  // Edge cases
  // ------------------------------------------------------------------
  describe('edge cases', () => {
    beforeEach(() => {
      __resetExecutionEngineStateForTests();
    });

    it('duplicate entry is detected and cancelled', async () => {
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        portfolio: { total_equity: 25_000, day_trade_buying_power: 50_000 },
      });
      mockPlaceOrder.mockResolvedValue({ id: 'dup-order-001', status: 'pending', raw: {} });
      // Simulate DB duplicate detection
      mockUpsertExecutionState.mockResolvedValue({ inserted: false, state: null });
      mockCancelOrder.mockResolvedValue(true);

      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      // Order was placed first (before DB check)
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);

      // Then cancelled after duplicate detected
      expect(mockCancelOrder).toHaveBeenCalledWith('dup-order-001');
    });

    it('insufficient margin blocks entry — no order placed', async () => {
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        // $500 equity → max risk = $10 → contractsByRisk = floor(10/420) = 0
        portfolio: { total_equity: 500, day_trade_buying_power: 1000 },
      });

      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      // No order placed
      expect(mockPlaceOrder).not.toHaveBeenCalled();
    });

    it('no credentials → no orders placed', async () => {
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({ credentials: [], portfolio: null });

      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      expect(mockPlaceOrder).not.toHaveBeenCalled();
      expect(mockGetContractRecommendation).not.toHaveBeenCalled();
    });

    it('non-SPX event is ignored', async () => {
      const event = { ...buildTriggeredEvent(), symbol: 'AAPL' };

      await processTradierExecutionTransitions([event]);

      expect(mockGetContractRecommendation).not.toHaveBeenCalled();
      expect(mockPlaceOrder).not.toHaveBeenCalled();
    });

    it('null contract recommendation → no order placed', async () => {
      mockGetContractRecommendation.mockResolvedValue(null);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        portfolio: { total_equity: 100_000, day_trade_buying_power: 200_000 },
      });

      await processTradierExecutionTransitions([buildTriggeredEvent()]);

      expect(mockGetContractRecommendation).toHaveBeenCalledTimes(1);
      expect(mockPlaceOrder).not.toHaveBeenCalled();
    });

    it('blocked gate setup never routes broker orders', async () => {
      const blockedSetup: Setup = {
        ...MOCK_SETUP,
        gateStatus: 'blocked',
        gateReasons: ['drift_control_paused:fade_at_wall|ranging'],
      };
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        portfolio: { total_equity: 100_000, day_trade_buying_power: 200_000 },
      });

      await processTradierExecutionTransitions([buildTriggeredEvent(blockedSetup)]);

      expect(mockGetContractRecommendation).not.toHaveBeenCalled();
      expect(mockPlaceOrder).not.toHaveBeenCalled();
      expect(mockUpsertExecutionState).not.toHaveBeenCalled();
    });

    it('single-contract position exits fully at T1 with no runner stop', async () => {
      // Setup entry with small portfolio → 1 contract
      mockGetContractRecommendation.mockResolvedValue(MOCK_RECOMMENDATION);
      setupSupabaseMocks({
        credentials: [MOCK_CREDENTIAL],
        portfolio: { total_equity: 25_000, day_trade_buying_power: 50_000 },
      });
      mockPlaceOrder.mockResolvedValue({ id: 'entry-single-001', status: 'pending', raw: {} });
      mockUpsertExecutionState.mockImplementation((input: Record<string, unknown>) =>
        Promise.resolve({
          inserted: true,
          state: {
            id: 'state-single',
            userId: input.userId,
            setupId: input.setupId,
            sessionDate: input.sessionDate,
            symbol: input.symbol,
            quantity: input.quantity,
            remainingQuantity: input.remainingQuantity,
            entryOrderId: input.entryOrderId,
            runnerStopOrderId: null,
            entryLimitPrice: input.entryLimitPrice,
            actualFillQty: null,
            avgFillPrice: null,
            status: 'active',
            closeReason: null,
            closedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );
      await processTradierExecutionTransitions([buildTriggeredEvent()]);
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
      expect(mockPlaceOrder.mock.calls[0][0].quantity).toBe(1);

      // T1 with 1 contract: partialQty = max(1, floor(1*0.65)) = 1
      // remainingQty = 1 - 1 = 0 → NO runner stop
      jest.clearAllMocks();
      setupSupabaseMocks({
        credentials: [{
          account_id: MOCK_CREDENTIAL.account_id,
          access_token_ciphertext: MOCK_CREDENTIAL.access_token_ciphertext,
          metadata: MOCK_CREDENTIAL.metadata,
        }],
      });
      mockPlaceOrder.mockResolvedValue({ id: 'scale-single-001', status: 'pending', raw: {} });
      mockUpdateExecutionState.mockResolvedValue(undefined);
      mockRecordExecutionFill.mockResolvedValue(undefined);

      await processTradierExecutionTransitions([buildT1Event()]);

      // Only 1 order (scale), no runner stop
      expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
      const scalePayload = mockPlaceOrder.mock.calls[0][0];
      expect(scalePayload.side).toBe('sell_to_close');
      expect(scalePayload.quantity).toBe(1);

      // State updated with remaining = 0, no runner stop order
      expect(mockUpdateExecutionState).toHaveBeenCalledWith(
        MOCK_CREDENTIAL.user_id,
        MOCK_SETUP.id,
        expect.any(String),
        expect.objectContaining({
          remainingQuantity: 0,
        }),
      );
    });
  });
});
