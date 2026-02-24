jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
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

describe('pdtTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports canTrade function', async () => {
    const { canTrade } = await import('../pdtTracker');
    expect(typeof canTrade).toBe('function');
  });

  it('exports publishPDTBlockMessage function', async () => {
    const { publishPDTBlockMessage } = await import('../pdtTracker');
    expect(typeof publishPDTBlockMessage).toBe('function');
  });

  it('exports getPDTTrackingStatus function', async () => {
    const { getPDTTrackingStatus } = await import('../pdtTracker');
    expect(typeof getPDTTrackingStatus).toBe('function');
  });

  it('returns status with correct structure', async () => {
    const { getPDTTrackingStatus } = await import('../pdtTracker');
    const status = getPDTTrackingStatus();
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('limit');
    expect(status).toHaveProperty('equityThreshold');
    expect(status.limit).toBe(3);
    expect(status.equityThreshold).toBe(25_000);
  });

  it('canTrade returns allowed when tracking disabled', async () => {
    const { canTrade } = await import('../pdtTracker');
    const result = await canTrade('user-123');
    expect(result.allowed).toBe(true);
    expect(result.roundTripsToday).toBe(0);
    expect(result.limit).toBe(3);
  });
});
