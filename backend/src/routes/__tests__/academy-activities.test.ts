/**
 * Integration tests for academy-activities routes.
 * Supabase client, auth middleware, and scoring/XP services are fully mocked.
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
    req.user = { id: 'user-test-abc', email: 'test@example.com' };
    next();
  },
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../services/academy-scoring', () => ({
  scoreActivity: jest.fn(),
}));

jest.mock('../../services/academy-xp', () => ({
  awardXp: jest.fn(),
  XP_REWARDS: {
    BLOCK_COMPLETION: 10,
    LESSON_COMPLETION: 50,
    ASSESSMENT_PASSED: 100,
    ACTIVITY_PERFECT_SCORE: 25,
    STREAK_7_DAY: 100,
    STREAK_30_DAY: 500,
    STREAK_100_DAY: 2000,
  },
}));

import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';
import { supabase } from '../../config/database';
import { scoreActivity } from '../../services/academy-scoring';
import { awardXp } from '../../services/academy-xp';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockScoreActivity = scoreActivity as jest.MockedFunction<typeof scoreActivity>;
const mockAwardXp = awardXp as jest.MockedFunction<typeof awardXp>;

import activitiesRouter from '../academy-activities';

const app = express();
app.use(express.json());
app.use('/api/academy/activities', activitiesRouter);

// ---------------------------------------------------------------------------
// Test data fixtures
// ---------------------------------------------------------------------------

const VALID_BLOCK_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VALID_USER_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockBlock = {
  id: VALID_BLOCK_UUID,
  lesson_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  block_type: 'options_chain_simulator',
  content_json: {
    prompt: 'Select the correct options',
    options: ['AAPL_CALL', 'AAPL_PUT'],
    answer_key: ['AAPL_CALL'],
  },
  position: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper: mock supabase.from for lesson block fetches
// ---------------------------------------------------------------------------

function mockBlockFetch(block: object | null, fetchError: object | null = null) {
  const maybeSingleFn = jest.fn().mockResolvedValue({ data: block, error: fetchError });
  const eqFn = jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
  return { select: selectFn };
}

function mockLearningEventInsert(insertError: object | null = null) {
  const insertFn = jest.fn().mockResolvedValue({ data: null, error: insertError });
  return { insert: insertFn };
}

// ---------------------------------------------------------------------------
// GET /:blockId/content
// ---------------------------------------------------------------------------

describeWithSockets('GET /api/academy/activities/:blockId/content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns block content with answer_key stripped', async () => {
    mockSupabase.from = jest.fn().mockReturnValue(mockBlockFetch(mockBlock));

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/content`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(VALID_BLOCK_UUID);
    expect(res.body.blockType).toBe('options_chain_simulator');
    expect(res.body.lessonId).toBe(mockBlock.lesson_id);
    expect(res.body.position).toBe(1);
    // answer_key must NOT be present in the content
    expect(res.body.content).not.toHaveProperty('answer_key');
    // other content fields should be preserved
    expect(res.body.content).toHaveProperty('prompt');
    expect(res.body.content).toHaveProperty('options');
  });

  it('returns 404 when block does not exist', async () => {
    mockSupabase.from = jest.fn().mockReturnValue(mockBlockFetch(null));

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/content`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid block UUID in params', async () => {
    const res = await request(app)
      .get('/api/academy/activities/not-a-valid-uuid/content')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when DB fetch throws', async () => {
    mockSupabase.from = jest.fn().mockReturnValue(
      mockBlockFetch(null, { message: 'DB error' })
    );

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/content`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('handles block with no answer_key in content_json gracefully', async () => {
    const blockNoKey = {
      ...mockBlock,
      block_type: 'greeks_dashboard',
      content_json: { description: 'Explore the greeks dashboard', delta: 0.5 },
    };
    mockSupabase.from = jest.fn().mockReturnValue(mockBlockFetch(blockNoKey));

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/content`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.content).toHaveProperty('description');
    expect(res.body.content).not.toHaveProperty('answer_key');
  });
});

// ---------------------------------------------------------------------------
// POST /:blockId/submit
// ---------------------------------------------------------------------------

describeWithSockets('POST /api/academy/activities/:blockId/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scores a perfect answer and awards XP (BLOCK_COMPLETION + ACTIVITY_PERFECT_SCORE)', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(mockBlock);
      }
      return mockLearningEventInsert();
    });

    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 1,
      feedback: 'Perfect selection.',
      isCorrect: true,
    });

    mockAwardXp.mockResolvedValue({ totalXp: 385, currentLevel: 1, leveledUp: false });

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: VALID_USER_UUID,
        answer: ['AAPL_CALL'],
        timeSpentMs: 12000,
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.maxScore).toBe(1);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.feedback).toBe('Perfect selection.');
    // Perfect score: BLOCK_COMPLETION (10) + ACTIVITY_PERFECT_SCORE (25) = 35
    expect(res.body.xpEarned).toBe(35);
    expect(res.body.xp).toMatchObject({ totalXp: 385, currentLevel: 1, leveledUp: false });
    expect(mockScoreActivity).toHaveBeenCalledWith(
      'options_chain_simulator',
      ['AAPL_CALL'],
      ['AAPL_CALL'],
    );
  });

  it('scores a partial answer and awards base XP only (score ratio >= 0.5)', async () => {
    const blockWith2Options = {
      ...mockBlock,
      content_json: {
        answer_key: ['OPT_A', 'OPT_B'],
      },
    };

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(blockWith2Options);
      }
      return mockLearningEventInsert();
    });

    // score 1/2 → ratio 0.5 → base XP only
    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 2,
      feedback: '1 of 2 correct.',
      isCorrect: false,
    });

    mockAwardXp.mockResolvedValue({ totalXp: 110, currentLevel: 1, leveledUp: false });

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: VALID_USER_UUID,
        answer: ['OPT_A'],
        timeSpentMs: 8000,
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.xpEarned).toBe(10); // only BLOCK_COMPLETION
  });

  it('awards no XP when score ratio is below 0.5', async () => {
    const blockWith4Options = {
      ...mockBlock,
      content_json: { answer_key: ['A', 'B', 'C', 'D'] },
    };

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(blockWith4Options);
      }
      return mockLearningEventInsert();
    });

    // score 1/4 → ratio 0.25 → no XP
    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 4,
      feedback: '1 of 4 correct.',
      isCorrect: false,
    });

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: VALID_USER_UUID,
        answer: ['A'],
        timeSpentMs: 5000,
      });

    expect(res.status).toBe(200);
    expect(res.body.xpEarned).toBe(0);
    expect(res.body.xp).toBeNull();
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it('awards no XP for exploration block (maxScore = 0)', async () => {
    const explorationBlock = {
      ...mockBlock,
      block_type: 'greeks_dashboard',
      content_json: { description: 'Explore greeks' },
    };

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(explorationBlock);
      }
      return mockLearningEventInsert();
    });

    mockScoreActivity.mockReturnValue({
      score: 0,
      maxScore: 0,
      feedback: 'Exploration activity — no scoring.',
      isCorrect: true,
    });

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: VALID_USER_UUID,
        answer: { delta: 0.5 },
        timeSpentMs: 30000,
      });

    expect(res.status).toBe(200);
    expect(res.body.xpEarned).toBe(0);
    expect(res.body.xp).toBeNull();
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it('returns 404 when block does not exist', async () => {
    mockSupabase.from = jest.fn().mockReturnValue(mockBlockFetch(null));

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['X'], timeSpentMs: 1000 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid block UUID in params', async () => {
    const res = await request(app)
      .post('/api/academy/activities/bad-id/submit')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['X'], timeSpentMs: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when userId is missing from body', async () => {
    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ answer: ['X'], timeSpentMs: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when userId is not a valid UUID', async () => {
    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: 'not-uuid', answer: ['X'], timeSpentMs: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when timeSpentMs is negative', async () => {
    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['X'], timeSpentMs: -100 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when DB block fetch throws', async () => {
    mockSupabase.from = jest.fn().mockReturnValue(
      mockBlockFetch(null, { message: 'DB fetch error' })
    );

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['X'], timeSpentMs: 1000 });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('still returns scoring result even when learning event insert fails (non-fatal)', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(mockBlock);
      }
      // learning event insert fails — non-fatal
      return mockLearningEventInsert({ message: 'Insert failed' });
    });

    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 1,
      feedback: 'Correct.',
      isCorrect: true,
    });

    mockAwardXp.mockResolvedValue({ totalXp: 50, currentLevel: 1, leveledUp: false });

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['AAPL_CALL'], timeSpentMs: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.isCorrect).toBe(true);
  });

  it('still returns result when awardXp throws (non-fatal warning path)', async () => {
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(mockBlock);
      }
      return mockLearningEventInsert();
    });

    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 1,
      feedback: 'Correct.',
      isCorrect: true,
    });

    mockAwardXp.mockRejectedValue(new Error('XP service unavailable'));

    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: ['AAPL_CALL'], timeSpentMs: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    // xpEarned is 35 (calculated before awardXp is called) but xp object will be null
    expect(res.body.xpEarned).toBe(35);
    expect(res.body.xp).toBeNull();
  });

  it('correctly dispatches different block types to scoreActivity', async () => {
    const journalBlock = {
      ...mockBlock,
      block_type: 'journal_prompt',
      content_json: { answer_key: { minLength: 50 } },
    };

    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'academy_lesson_blocks') {
        return mockBlockFetch(journalBlock);
      }
      return mockLearningEventInsert();
    });

    mockScoreActivity.mockReturnValue({
      score: 1,
      maxScore: 1,
      feedback: 'Reflection recorded.',
      isCorrect: true,
    });

    mockAwardXp.mockResolvedValue({ totalXp: 100, currentLevel: 1, leveledUp: false });

    const longText = 'a'.repeat(60);
    const res = await request(app)
      .post(`/api/academy/activities/${VALID_BLOCK_UUID}/submit`)
      .set('Authorization', 'Bearer test-token')
      .send({ userId: VALID_USER_UUID, answer: longText, timeSpentMs: 45000 });

    expect(res.status).toBe(200);
    expect(mockScoreActivity).toHaveBeenCalledWith(
      'journal_prompt',
      longText,
      { minLength: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// GET /:blockId/results
// ---------------------------------------------------------------------------

/**
 * Build a fluent mock for chained Supabase queries that end in .limit()
 * The results route uses: .select().eq().eq().eq().eq().order().limit()
 * This helper creates a chainable object that returns `finalResult` from .limit().
 */
function makeResultsChainMock(finalResult: object) {
  // Build from the terminal call backwards
  const limitFn = jest.fn().mockResolvedValue(finalResult);
  const orderFn = jest.fn().mockReturnValue({ limit: limitFn });

  // Each eq call must return an object that supports both .eq() and .order()
  const chain: { eq: jest.Mock; order: jest.Mock } = {
    eq: jest.fn(),
    order: orderFn,
  };
  chain.eq.mockReturnValue(chain); // each .eq() returns the same chain object

  const selectFn = jest.fn().mockReturnValue(chain);
  return jest.fn().mockReturnValue({ select: selectFn });
}

describeWithSockets('GET /api/academy/activities/:blockId/results', () => {
  const mockResults = [
    {
      id: 'evt-1',
      xp_earned: 35,
      metadata: {
        blockType: 'options_chain_simulator',
        score: 1,
        maxScore: 1,
        timeSpentMs: 12000,
        isCorrect: true,
      },
      created_at: '2026-02-24T10:00:00Z',
    },
    {
      id: 'evt-2',
      xp_earned: 0,
      metadata: {
        blockType: 'options_chain_simulator',
        score: 0,
        maxScore: 1,
        timeSpentMs: 8000,
        isCorrect: false,
      },
      created_at: '2026-02-23T15:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the latest activity results for the authenticated user', async () => {
    mockSupabase.from = makeResultsChainMock({ data: mockResults, error: null });

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/results`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].xp_earned).toBe(35);
    expect(res.body.results[0].metadata.isCorrect).toBe(true);
    expect(res.body.results[1].metadata.isCorrect).toBe(false);
  });

  it('returns empty array when no submission history exists', async () => {
    mockSupabase.from = makeResultsChainMock({ data: [], error: null });

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/results`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('returns 400 for invalid block UUID in params', async () => {
    const res = await request(app)
      .get('/api/academy/activities/invalid-uuid/results')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns results for a valid user with a zero-UUID block', async () => {
    mockSupabase.from = makeResultsChainMock({ data: [], error: null });

    const response = await request(app)
      .get('/api/academy/activities/00000000-0000-0000-0000-000000000000/results')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
  });

  it('returns 500 when DB query fails', async () => {
    mockSupabase.from = makeResultsChainMock({ data: null, error: { message: 'DB error' } });

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/results`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('returns empty array when data is null and no error', async () => {
    mockSupabase.from = makeResultsChainMock({ data: null, error: null });

    const res = await request(app)
      .get(`/api/academy/activities/${VALID_BLOCK_UUID}/results`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
