import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/database', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../marketHours', () => ({
  toEasternTime: vi.fn().mockReturnValue({ dateStr: '2026-02-23', hour: 10, minute: 30 }),
}));

vi.mock('../../coachPushChannel', () => ({
  publishCoachMessage: vi.fn(),
}));

describe('pdtTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
