const mockFrom = jest.fn() as jest.Mock<any, any>;
const mockGenerateBrief = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../services/morningBrief', () => ({
  morningBriefService: {
    generateBrief: (...args: any[]) => mockGenerateBrief(...args),
  },
}));

import {
  shouldGenerateMorningBriefs,
  generateMorningBriefsForMarketDate,
  startMorningBriefWorker,
  stopMorningBriefWorker,
} from '../morningBriefWorker';

describe('Morning Brief Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopMorningBriefWorker();
    jest.useRealTimers();
  });

  it('runs at/after 7:00 AM ET on trading days', () => {
    const atSevenET = new Date('2026-02-09T12:00:00.000Z'); // 7:00 AM ET (EST)
    const result = shouldGenerateMorningBriefs(atSevenET, null);

    expect(result.shouldRun).toBe(true);
    expect(result.marketDate).toBe('2026-02-09');
  });

  it('does not run before 7:00 AM ET', () => {
    const beforeSevenET = new Date('2026-02-09T11:59:00.000Z'); // 6:59 AM ET (EST)
    const result = shouldGenerateMorningBriefs(beforeSevenET, null);

    expect(result.shouldRun).toBe(false);
  });

  it('does not run twice for the same market date', () => {
    const atSevenET = new Date('2026-02-09T12:05:00.000Z');
    const result = shouldGenerateMorningBriefs(atSevenET, '2026-02-09');

    expect(result.shouldRun).toBe(false);
  });

  it('generates missing briefs and skips existing users', async () => {
    const usersSelect = jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue({
        data: [{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }],
        error: null,
      }),
    });

    const briefsSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [{ user_id: 'user-2' }],
        error: null,
      }),
    });

    const briefsInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ai_coach_users') return { select: usersSelect };
      if (table === 'ai_coach_morning_briefs') return { select: briefsSelect, insert: briefsInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    mockGenerateBrief.mockResolvedValue({ generatedAt: '2026-02-09T12:00:00.000Z' });

    const result = await generateMorningBriefsForMarketDate('2026-02-09');

    expect(result).toEqual({
      candidates: 3,
      generated: 2,
      skippedExisting: 1,
      failed: 0,
    });
    expect(mockGenerateBrief).toHaveBeenCalledTimes(2);
    expect(mockGenerateBrief).toHaveBeenCalledWith('user-1');
    expect(mockGenerateBrief).toHaveBeenCalledWith('user-3');
    expect(briefsInsert).toHaveBeenCalledTimes(2);
  });

  it('treats duplicate insert as skipped', async () => {
    const usersSelect = jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue({
        data: [{ user_id: 'user-1' }],
        error: null,
      }),
    });

    const briefsSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const briefsInsert = jest.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ai_coach_users') return { select: usersSelect };
      if (table === 'ai_coach_morning_briefs') return { select: briefsSelect, insert: briefsInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    mockGenerateBrief.mockResolvedValue({ generatedAt: '2026-02-09T12:00:00.000Z' });

    const result = await generateMorningBriefsForMarketDate('2026-02-09');

    expect(result).toEqual({
      candidates: 1,
      generated: 0,
      skippedExisting: 1,
      failed: 0,
    });
  });

  it('schedules only one worker timer when start is called repeatedly', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    startMorningBriefWorker();
    startMorningBriefWorker();

    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    timeoutSpy.mockRestore();
  });
});
