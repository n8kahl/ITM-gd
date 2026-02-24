/**
 * Unit tests for academy-xp service.
 * Tests calculateLevelFromXp, nextLevelThreshold, XP_REWARDS constants,
 * and the awardXp / updateStreak async functions (with Supabase mocked).
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that touch them
// ---------------------------------------------------------------------------

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { supabase } from '../../config/database';
import {
  XP_REWARDS,
  calculateLevelFromXp,
  nextLevelThreshold,
  awardXp,
  updateStreak,
} from '../academy-xp';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// ---------------------------------------------------------------------------
// Pure function tests — no mocking required
// ---------------------------------------------------------------------------

describe('calculateLevelFromXp', () => {
  it('returns level 1 for 0 XP', () => {
    expect(calculateLevelFromXp(0)).toBe(1);
  });

  it('returns level 1 for XP below first threshold (499)', () => {
    expect(calculateLevelFromXp(499)).toBe(1);
  });

  it('returns level 2 at exactly 500 XP', () => {
    expect(calculateLevelFromXp(500)).toBe(2);
  });

  it('returns level 2 for XP in range 500–999', () => {
    expect(calculateLevelFromXp(750)).toBe(2);
  });

  it('returns level 3 at exactly 1000 XP', () => {
    expect(calculateLevelFromXp(1000)).toBe(3);
  });

  it('returns level 5 at exactly 2000 XP', () => {
    expect(calculateLevelFromXp(2000)).toBe(5);
  });

  it('returns level 11 at exactly 5000 XP', () => {
    expect(calculateLevelFromXp(5000)).toBe(11);
  });

  it('never returns less than level 1 (negative input)', () => {
    expect(calculateLevelFromXp(-100)).toBe(1);
  });

  it('handles very large XP correctly', () => {
    // 100000 XP → floor(100000/500) + 1 = 200 + 1 = 201
    expect(calculateLevelFromXp(100000)).toBe(201);
  });

  it('returns level 1 for XP = 1', () => {
    expect(calculateLevelFromXp(1)).toBe(1);
  });
});

describe('nextLevelThreshold', () => {
  it('returns 500 for level 1', () => {
    expect(nextLevelThreshold(1)).toBe(500);
  });

  it('returns 1000 for level 2', () => {
    expect(nextLevelThreshold(2)).toBe(1000);
  });

  it('returns 2500 for level 5', () => {
    expect(nextLevelThreshold(5)).toBe(2500);
  });

  it('returns 10000 for level 20', () => {
    expect(nextLevelThreshold(20)).toBe(10000);
  });
});

describe('XP_REWARDS constants', () => {
  it('BLOCK_COMPLETION is 10', () => {
    expect(XP_REWARDS.BLOCK_COMPLETION).toBe(10);
  });

  it('LESSON_COMPLETION is 50', () => {
    expect(XP_REWARDS.LESSON_COMPLETION).toBe(50);
  });

  it('ASSESSMENT_PASSED is 100', () => {
    expect(XP_REWARDS.ASSESSMENT_PASSED).toBe(100);
  });

  it('ACTIVITY_PERFECT_SCORE is 25', () => {
    expect(XP_REWARDS.ACTIVITY_PERFECT_SCORE).toBe(25);
  });

  it('STREAK_7_DAY is 100', () => {
    expect(XP_REWARDS.STREAK_7_DAY).toBe(100);
  });

  it('STREAK_30_DAY is 500', () => {
    expect(XP_REWARDS.STREAK_30_DAY).toBe(500);
  });

  it('STREAK_100_DAY is 2000', () => {
    expect(XP_REWARDS.STREAK_100_DAY).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// awardXp — async function with Supabase mocked
// ---------------------------------------------------------------------------

// Helper to build a fluent Supabase chain mock returning a given result
function makeFromMock(selectResult: object, upsertResult: object, insertResult: object) {
  const maybeSingleFn = jest.fn().mockResolvedValue(selectResult);
  const eqForSelectFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const selectFn = jest.fn().mockReturnValue({ eq: eqForSelectFn });

  const upsertFn = jest.fn().mockResolvedValue(upsertResult);
  const insertFn = jest.fn().mockResolvedValue(insertResult);

  return jest.fn().mockImplementation((table: string) => {
    if (table === 'academy_user_xp') {
      return { select: selectFn, upsert: upsertFn };
    }
    if (table === 'academy_learning_events') {
      return { insert: insertFn };
    }
    return { select: selectFn, upsert: upsertFn, insert: insertFn };
  });
}

describe('awardXp', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new XP record for a first-time user (no existing record)', async () => {
    mockSupabase.from = makeFromMock(
      { data: null, error: null },       // select maybeSingle → no existing record
      { data: null, error: null },        // upsert success
      { data: null, error: null },        // insert learning event success
    );

    const result = await awardXp(userId, 100, 'test_source');

    expect(result.totalXp).toBe(100);
    expect(result.currentLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it('adds XP to existing record and detects level-up', async () => {
    // Existing: 490 XP level 1 → adding 20 → 510 XP → level 2 → leveledUp true
    mockSupabase.from = makeFromMock(
      { data: { total_xp: 490, current_level: 1 }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    const result = await awardXp(userId, 20, 'lesson_completion');

    expect(result.totalXp).toBe(510);
    expect(result.currentLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it('does not report level-up when still in same level bracket', async () => {
    // Existing: 100 XP level 1 → adding 50 → 150 XP → still level 1
    mockSupabase.from = makeFromMock(
      { data: { total_xp: 100, current_level: 1 }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    const result = await awardXp(userId, 50, 'block_completion');

    expect(result.totalXp).toBe(150);
    expect(result.currentLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it('throws when the XP fetch query fails', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB fetch error' } });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    await expect(awardXp(userId, 10, 'test')).rejects.toThrow('DB fetch error');
  });

  it('throws when the XP upsert fails', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: { total_xp: 100, current_level: 1 }, error: null });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
    const upsertFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Upsert failed' } });
    const insertFn = jest.fn().mockResolvedValue({ data: null, error: null });

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_user_xp') {
        return { select: selectFn, upsert: upsertFn };
      }
      return { insert: insertFn };
    });

    await expect(awardXp(userId, 10, 'test')).rejects.toThrow('Upsert failed');
  });

  it('does not throw when the learning event insert fails (non-fatal)', async () => {
    mockSupabase.from = makeFromMock(
      { data: { total_xp: 200, current_level: 1 }, error: null },
      { data: null, error: null },
      { data: null, error: { message: 'Event insert failed' } }, // non-fatal
    );

    const result = await awardXp(userId, 50, 'block_completion');

    // Should still return successful result despite event insert failure
    expect(result.totalXp).toBe(250);
    expect(result.currentLevel).toBe(1);
  });

  it('passes optional metadata through to the insert call', async () => {
    let capturedInsertData: unknown = null;

    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
    const upsertFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const insertFn = jest.fn().mockImplementation((data: unknown) => {
      capturedInsertData = data;
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_user_xp') {
        return { select: selectFn, upsert: upsertFn };
      }
      return { insert: insertFn };
    });

    await awardXp(userId, 10, 'block_completion', { blockId: 'xyz', extra: true });

    expect(capturedInsertData).toMatchObject({
      metadata: { blockId: 'xyz', extra: true },
      event_type: 'block_completion',
      xp_earned: 10,
    });
  });
});

// ---------------------------------------------------------------------------
// updateStreak — async function with Supabase mocked
// ---------------------------------------------------------------------------

// Build a streak-specific from mock
function makeStreakFromMock(options: {
  fetchResult: object;
  insertResult?: object;
  updateResult?: object;
  xpFetchResult?: object;
  xpUpsertResult?: object;
  xpInsertResult?: object;
}) {
  const {
    fetchResult,
    insertResult = { data: null, error: null },
    updateResult = { data: null, error: null },
    xpFetchResult = { data: null, error: null },
    xpUpsertResult = { data: null, error: null },
    xpInsertResult = { data: null, error: null },
  } = options;

  // Streak select chain
  const maybeSingleFn = jest.fn().mockResolvedValue(fetchResult);
  const eqForStreakFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const selectStreakFn = jest.fn().mockReturnValue({ eq: eqForStreakFn });
  const insertStreakFn = jest.fn().mockResolvedValue(insertResult);
  const eqForUpdateFn = jest.fn().mockResolvedValue(updateResult);
  const updateFn = jest.fn().mockReturnValue({ eq: eqForUpdateFn });

  // XP chains (used by milestone awards)
  const xpMaybeSingleFn = jest.fn().mockResolvedValue(xpFetchResult);
  const xpEqFn = jest.fn().mockReturnValue({ maybeSingle: xpMaybeSingleFn });
  const xpSelectFn = jest.fn().mockReturnValue({ eq: xpEqFn });
  const xpUpsertFn = jest.fn().mockResolvedValue(xpUpsertResult);
  const xpInsertFn = jest.fn().mockResolvedValue(xpInsertResult);

  return jest.fn().mockImplementation((table: string) => {
    if (table === 'academy_user_streaks') {
      return {
        select: selectStreakFn,
        insert: insertStreakFn,
        update: updateFn,
      };
    }
    if (table === 'academy_user_xp') {
      return { select: xpSelectFn, upsert: xpUpsertFn };
    }
    if (table === 'academy_learning_events') {
      return { insert: xpInsertFn };
    }
    return {};
  });
}

describe('updateStreak', () => {
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgoStr = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const threeDaysAgoStr = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new streak record for a first-time user', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: { data: null, error: null },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.milestoneReached).toBeNull();
  });

  it('returns same streak when already active today', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 5,
          longest_streak_days: 10,
          last_activity_date: todayStr,
          streak_freeze_available: false,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
    expect(result.milestoneReached).toBeNull();
  });

  it('increments streak for consecutive day activity', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 3,
          longest_streak_days: 5,
          last_activity_date: yesterdayStr,
          streak_freeze_available: false,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5); // hasn't beaten longest yet
    expect(result.milestoneReached).toBeNull();
  });

  it('updates longestStreak when currentStreak exceeds it', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 5,
          longest_streak_days: 5,
          last_activity_date: yesterdayStr,
          streak_freeze_available: false,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });

  it('resets streak to 1 when gap > 1 day and no freeze available', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 10,
          longest_streak_days: 10,
          last_activity_date: twoDaysAgoStr,
          streak_freeze_available: false,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10); // preserved
  });

  it('consumes streak freeze when exactly one day is missed', async () => {
    // twoDaysAgo means today - 2 days → daysDiff === 2 → freeze can bridge it
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 6,
          longest_streak_days: 6,
          last_activity_date: twoDaysAgoStr,
          streak_freeze_available: true,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(7);
    expect(result.milestoneReached).toBe(7); // 7-day milestone
  });

  it('resets streak even with freeze when gap is larger than 2 days', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 15,
          longest_streak_days: 15,
          last_activity_date: threeDaysAgoStr,
          streak_freeze_available: true,
        },
        error: null,
      },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(1);
  });

  it('detects 7-day milestone and returns milestoneReached = 7', async () => {
    mockSupabase.from = makeStreakFromMock({
      fetchResult: {
        data: {
          current_streak_days: 6,
          longest_streak_days: 6,
          last_activity_date: yesterdayStr,
          streak_freeze_available: false,
        },
        error: null,
      },
      xpFetchResult: { data: null, error: null },
      xpUpsertResult: { data: null, error: null },
      xpInsertResult: { data: null, error: null },
    });

    const result = await updateStreak(userId);

    expect(result.currentStreak).toBe(7);
    expect(result.milestoneReached).toBe(7);
  });

  it('throws when streak fetch query fails', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Streak fetch error' } });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    await expect(updateStreak(userId)).rejects.toThrow('Streak fetch error');
  });

  it('throws when creating first-time streak record fails', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
    const insertFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    mockSupabase.from = jest.fn().mockReturnValue({
      select: selectFn,
      insert: insertFn,
    });

    await expect(updateStreak(userId)).rejects.toThrow('Insert failed');
  });

  it('throws when streak update fails', async () => {
    const eqForUpdateFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
    const updateFn = jest.fn().mockReturnValue({ eq: eqForUpdateFn });
    const maybeSingleFn = jest.fn().mockResolvedValue({
      data: {
        current_streak_days: 3,
        longest_streak_days: 5,
        last_activity_date: yesterdayStr,
        streak_freeze_available: false,
      },
      error: null,
    });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({
      select: selectFn,
      update: updateFn,
    });

    await expect(updateStreak(userId)).rejects.toThrow('Update failed');
  });
});
