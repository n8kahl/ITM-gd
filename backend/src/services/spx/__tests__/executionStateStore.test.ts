import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();

const chainMock = () => ({
  select: vi.fn().mockReturnValue({
    eq: mockEq.mockReturnThis(),
    is: mockIs.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  }),
  upsert: mockUpsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
    }),
  }),
  update: mockUpdate.mockReturnValue({
    eq: mockEq.mockReturnValue({
      eq: mockEq.mockReturnValue({
        eq: mockEq.mockResolvedValue({ error: null }),
      }),
    }),
  }),
  eq: mockEq.mockReturnThis(),
  is: mockIs.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  maybeSingle: mockMaybeSingle,
});

vi.mock('../../../config/database', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(chainMock()),
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('executionStateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports upsertExecutionState function', async () => {
    const { upsertExecutionState } = await import('../executionStateStore');
    expect(typeof upsertExecutionState).toBe('function');
  });

  it('exports closeExecutionState function', async () => {
    const { closeExecutionState } = await import('../executionStateStore');
    expect(typeof closeExecutionState).toBe('function');
  });

  it('exports closeAllUserStates function', async () => {
    const { closeAllUserStates } = await import('../executionStateStore');
    expect(typeof closeAllUserStates).toBe('function');
  });

  it('exports loadOpenStates function', async () => {
    const { loadOpenStates } = await import('../executionStateStore');
    expect(typeof loadOpenStates).toBe('function');
  });

  it('exports loadUserOpenStates function', async () => {
    const { loadUserOpenStates } = await import('../executionStateStore');
    expect(typeof loadUserOpenStates).toBe('function');
  });

  it('exports loadOpenStatesWithOrders function', async () => {
    const { loadOpenStatesWithOrders } = await import('../executionStateStore');
    expect(typeof loadOpenStatesWithOrders).toBe('function');
  });

  it('exports markStateFailed function', async () => {
    const { markStateFailed } = await import('../executionStateStore');
    expect(typeof markStateFailed).toBe('function');
  });

  it('exports updateExecutionState function', async () => {
    const { updateExecutionState } = await import('../executionStateStore');
    expect(typeof updateExecutionState).toBe('function');
  });
});
