// Mock Supabase
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOrder = jest.fn();
const mockMaybeSingle = jest.fn();

const chainMock = () => ({
  select: jest.fn().mockReturnValue({
    eq: mockEq.mockReturnThis(),
    is: mockIs.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  }),
  upsert: mockUpsert.mockReturnValue({
    select: jest.fn().mockReturnValue({
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

jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn().mockReturnValue(chainMock()),
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('executionStateStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
