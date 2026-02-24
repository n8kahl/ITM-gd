/**
 * Integration tests for academy-gamification routes.
 * Supabase client and auth middleware are fully mocked.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-test-123', email: 'test@example.com' };
    next();
  },
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../services/academy-xp', () => ({
  awardXp: jest.fn(),
}));

import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';
import { supabase } from '../../config/database';
import { awardXp } from '../../services/academy-xp';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockAwardXp = awardXp as jest.MockedFunction<typeof awardXp>;

import gamificationRouter from '../academy-gamification';

const app = express();
app.use(express.json());
app.use('/api/academy/gamification', gamificationRouter);

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// POST /xp — Award XP
// ---------------------------------------------------------------------------

describeWithSockets('POST /api/academy/gamification/xp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('awards XP and returns updated totals', async () => {
    mockAwardXp.mockResolvedValue({
      totalXp: 150,
      currentLevel: 1,
      leveledUp: false,
    });

    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 50, source: 'block_completion' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalXp).toBe(150);
    expect(res.body.currentLevel).toBe(1);
    expect(res.body.leveledUp).toBe(false);
    expect(mockAwardXp).toHaveBeenCalledWith(VALID_UUID, 50, 'block_completion', undefined);
  });

  it('reports leveledUp true when a level transition occurs', async () => {
    mockAwardXp.mockResolvedValue({
      totalXp: 510,
      currentLevel: 2,
      leveledUp: true,
    });

    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 100, source: 'assessment_passed' });

    expect(res.status).toBe(200);
    expect(res.body.leveledUp).toBe(true);
    expect(res.body.currentLevel).toBe(2);
  });

  it('passes optional metadata to awardXp', async () => {
    mockAwardXp.mockResolvedValue({ totalXp: 60, currentLevel: 1, leveledUp: false });

    const metadata = { blockId: 'some-block', blockType: 'flashcard_deck' };

    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 10, source: 'block_completion', metadata });

    expect(res.status).toBe(200);
    expect(mockAwardXp).toHaveBeenCalledWith(VALID_UUID, 10, 'block_completion', metadata);
  });

  it('returns 400 for missing userId', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ amount: 10, source: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for non-positive amount', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 0, source: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for negative amount', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: -5, source: 'test' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID userId', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: 'not-a-uuid', amount: 10, source: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty source string', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 10, source: '' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when awardXp service throws', async () => {
    mockAwardXp.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/academy/gamification/xp')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID, amount: 10, source: 'test' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /user/:userId/stats — Gamification stats
// ---------------------------------------------------------------------------

describeWithSockets('GET /api/academy/gamification/user/:userId/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns combined XP and streak stats for a user', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_user_xp') {
        const maybeSingleFn = jest.fn().mockResolvedValue({
          data: { total_xp: 1200, current_level: 3 },
          error: null,
        });
        const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
        const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
        return { select: selectFn };
      }
      if (table === 'academy_user_streaks') {
        const maybeSingleFn = jest.fn().mockResolvedValue({
          data: {
            current_streak_days: 5,
            longest_streak_days: 14,
            last_activity_date: '2026-02-23',
            streak_freeze_available: true,
          },
          error: null,
        });
        const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
        const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
        return { select: selectFn };
      }
      return {};
    });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/stats`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(1200);
    expect(res.body.currentLevel).toBe(3);
    expect(res.body.currentStreak).toBe(5);
    expect(res.body.longestStreak).toBe(14);
    expect(res.body.lastActivityDate).toBe('2026-02-23');
    expect(res.body.streakFreezeAvailable).toBe(true);
  });

  it('returns default zeros when user has no XP or streak records', async () => {
    mockSupabase.from = jest.fn().mockImplementation(() => {
      const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
      return { select: selectFn };
    });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/stats`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(0);
    expect(res.body.currentLevel).toBe(1);
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.longestStreak).toBe(0);
    expect(res.body.lastActivityDate).toBeNull();
    expect(res.body.streakFreezeAvailable).toBe(false);
  });

  it('returns 400 for invalid userId UUID in params', async () => {
    const res = await request(app)
      .get('/api/academy/gamification/user/not-a-uuid/stats')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when XP query fails', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_user_xp') {
        const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'XP DB error' } });
        const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
        const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
        return { select: selectFn };
      }
      const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
      return { select: selectFn };
    });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/stats`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when streak query fails', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_user_xp') {
        const maybeSingleFn = jest.fn().mockResolvedValue({ data: { total_xp: 100, current_level: 1 }, error: null });
        const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
        const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
        return { select: selectFn };
      }
      // streak table
      const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Streak DB error' } });
      const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
      return { select: selectFn };
    });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/stats`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /streak-freeze — Consume streak freeze
// ---------------------------------------------------------------------------

describeWithSockets('POST /api/academy/gamification/streak-freeze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('consumes the streak freeze and returns success', async () => {
    const eqForUpdateFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = jest.fn().mockReturnValue({ eq: eqForUpdateFn });
    const maybeSingleFn = jest.fn().mockResolvedValue({
      data: { streak_freeze_available: true },
      error: null,
    });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn, update: updateFn });

    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('protected');
  });

  it('returns success false when no streak freeze is available', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({
      data: { streak_freeze_available: false },
      error: null,
    });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No streak freeze');
  });

  it('returns 404 when no streak record exists for user', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 400 for missing userId', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid UUID in body', async () => {
    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: 'bad-id' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when fetch query fails', async () => {
    const maybeSingleFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Fetch error' } });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when update query fails after freeze found', async () => {
    const eqForUpdateFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Update error' } });
    const updateFn = jest.fn().mockReturnValue({ eq: eqForUpdateFn });
    const maybeSingleFn = jest.fn().mockResolvedValue({
      data: { streak_freeze_available: true },
      error: null,
    });
    const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn, update: updateFn });

    const res = await request(app)
      .post('/api/academy/gamification/streak-freeze')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_UUID });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /achievements — List all active achievements
// ---------------------------------------------------------------------------

describeWithSockets('GET /api/academy/gamification/achievements', () => {
  const mockAchievements = [
    {
      id: 'ach-1',
      key: 'first_lesson',
      title: 'First Steps',
      description: 'Complete your first lesson',
      icon_url: null,
      category: 'learning',
      unlock_criteria: {},
      xp_reward: 50,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'ach-2',
      key: 'week_streak',
      title: '7-Day Streak',
      description: 'Maintain a 7-day streak',
      icon_url: null,
      category: 'streak',
      unlock_criteria: { streak_days: 7 },
      xp_reward: 100,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns list of active achievements', async () => {
    const orderFn2 = jest.fn().mockResolvedValue({ data: mockAchievements, error: null });
    const orderFn = jest.fn().mockReturnValue({ order: orderFn2 });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get('/api/academy/gamification/achievements')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.achievements).toHaveLength(2);
    expect(res.body.achievements[0].key).toBe('first_lesson');
    expect(res.body.achievements[1].key).toBe('week_streak');
  });

  it('returns empty array when no achievements exist', async () => {
    const orderFn2 = jest.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = jest.fn().mockReturnValue({ order: orderFn2 });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get('/api/academy/gamification/achievements')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.achievements).toHaveLength(0);
  });

  it('returns empty array when data is null', async () => {
    const orderFn2 = jest.fn().mockResolvedValue({ data: null, error: null });
    const orderFn = jest.fn().mockReturnValue({ order: orderFn2 });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get('/api/academy/gamification/achievements')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.achievements).toEqual([]);
  });

  it('returns 500 when DB query fails', async () => {
    const orderFn2 = jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } });
    const orderFn = jest.fn().mockReturnValue({ order: orderFn2 });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get('/api/academy/gamification/achievements')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /user/:userId/achievements — User's unlocked achievements
// ---------------------------------------------------------------------------

describeWithSockets('GET /api/academy/gamification/user/:userId/achievements', () => {
  const mockUserAchievements = [
    {
      id: 'ua-1',
      unlocked_at: '2026-02-10T10:00:00Z',
      academy_achievements: {
        id: 'ach-1',
        key: 'first_lesson',
        title: 'First Steps',
        description: 'Complete your first lesson',
        icon_url: null,
        category: 'learning',
        xp_reward: 50,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns user unlocked achievements in descending order', async () => {
    const orderFn = jest.fn().mockResolvedValue({ data: mockUserAchievements, error: null });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/achievements`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.achievements).toHaveLength(1);
    expect(res.body.achievements[0].unlocked_at).toBe('2026-02-10T10:00:00Z');
    expect(res.body.achievements[0].academy_achievements.key).toBe('first_lesson');
  });

  it('returns empty array when user has no achievements', async () => {
    const orderFn = jest.fn().mockResolvedValue({ data: [], error: null });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/achievements`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.achievements).toEqual([]);
  });

  it('returns 400 for invalid UUID in params', async () => {
    const res = await request(app)
      .get('/api/academy/gamification/user/not-a-uuid/achievements')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when DB query fails', async () => {
    const orderFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Query error' } });
    const eqFn = jest.fn().mockReturnValue({ order: orderFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

    mockSupabase.from = jest.fn().mockReturnValue({ select: selectFn });

    const res = await request(app)
      .get(`/api/academy/gamification/user/${VALID_UUID}/achievements`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
