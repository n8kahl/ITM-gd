const mockFrom = jest.fn();

jest.mock('../../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../marketHours', () => ({
  toEasternTime: jest.fn().mockReturnValue({ dateStr: '2026-02-23', hour: 10, minute: 30 }),
}));

jest.mock('../../coachPushChannel', () => ({
  publishCoachMessage: jest.fn(),
}));

interface FillQueryScenario {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}

interface PortfolioQueryScenario {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}

function createFillQueryBuilder(scenario: FillQueryScenario) {
  const lt = jest.fn().mockResolvedValue(scenario);
  const gte = jest.fn().mockReturnValue({ lt });
  const eqSide = jest.fn().mockReturnValue({ gte });
  const eqUser = jest.fn().mockReturnValue({ eq: eqSide });
  const select = jest.fn().mockReturnValue({ eq: eqUser });

  return {
    builder: { select },
    spies: { select, eqUser, eqSide, gte, lt },
  };
}

function createPortfolioQueryBuilder(scenario: PortfolioQueryScenario) {
  const maybeSingle = jest.fn().mockResolvedValue(scenario);
  const limit = jest.fn().mockReturnValue({ maybeSingle });
  const order = jest.fn().mockReturnValue({ limit });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });

  return {
    builder: { select },
    spies: { select, eq, order, limit, maybeSingle },
  };
}

async function importTrackerWithEnabledFlag(enabled: boolean) {
  process.env.SPX_PDT_TRACKING_ENABLED = enabled ? 'true' : 'false';
  jest.resetModules();
  return import('../pdtTracker');
}

describe('pdtTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SPX_PDT_TRACKING_ENABLED;
    mockFrom.mockReset();
  });

  afterAll(() => {
    delete process.env.SPX_PDT_TRACKING_ENABLED;
  });

  it('exports core functions', async () => {
    const tracker = await importTrackerWithEnabledFlag(false);
    expect(typeof tracker.canTrade).toBe('function');
    expect(typeof tracker.publishPDTBlockMessage).toBe('function');
    expect(typeof tracker.getPDTTrackingStatus).toBe('function');
  });

  it('returns allowed when PDT tracking is disabled', async () => {
    const { canTrade } = await importTrackerWithEnabledFlag(false);
    const result = await canTrade('user-123');

    expect(result.allowed).toBe(true);
    expect(result.roundTripsToday).toBe(0);
    expect(result.limit).toBe(3);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries fills by reported_by_user_id when tracking is enabled', async () => {
    const fillQuery = createFillQueryBuilder({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'spx_setup_execution_fills') return fillQuery.builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { canTrade } = await importTrackerWithEnabledFlag(true);
    const result = await canTrade('user-abc');

    expect(result.allowed).toBe(true);
    expect(fillQuery.spies.eqUser).toHaveBeenCalledWith('reported_by_user_id', 'user-abc');
    expect(fillQuery.spies.eqSide).toHaveBeenCalledWith('side', 'entry');
  });

  it('blocks trades when fill tracking query fails and equity is below threshold', async () => {
    const fillQuery = createFillQueryBuilder({
      data: null,
      error: { message: 'column does not exist' },
    });
    const portfolioQuery = createPortfolioQueryBuilder({
      data: { total_equity: 20_000 },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'spx_setup_execution_fills') return fillQuery.builder;
      if (table === 'portfolio_snapshots') return portfolioQuery.builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { canTrade } = await importTrackerWithEnabledFlag(true);
    const result = await canTrade('user-risk');

    expect(result.allowed).toBe(false);
    expect(result.totalEquity).toBe(20_000);
    expect(result.reason).toContain('unable to validate');
  });

  it('allows trades on fill-query error when equity is above threshold', async () => {
    const fillQuery = createFillQueryBuilder({
      data: null,
      error: { message: 'temporary supabase error' },
    });
    const portfolioQuery = createPortfolioQueryBuilder({
      data: { total_equity: 30_000 },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'spx_setup_execution_fills') return fillQuery.builder;
      if (table === 'portfolio_snapshots') return portfolioQuery.builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { canTrade } = await importTrackerWithEnabledFlag(true);
    const result = await canTrade('user-safe');

    expect(result.allowed).toBe(true);
    expect(result.totalEquity).toBe(30_000);
  });
});
