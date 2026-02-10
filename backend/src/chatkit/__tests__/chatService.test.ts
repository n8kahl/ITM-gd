import {
  getSessionMessages,
  getUserSessions,
  deleteSession,
  updateSessionTitle,
} from '../chatService';

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase
const mockFrom = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../config/openai', () => ({
  openaiClient: {},
  CHAT_MODEL: 'gpt-4o',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
}));

jest.mock('../systemPrompt', () => ({
  getSystemPrompt: () => 'You are a test assistant.',
}));

jest.mock('../functions', () => ({
  AI_FUNCTIONS: [],
}));

jest.mock('../functionHandlers', () => ({
  executeFunctionCall: jest.fn(),
}));


describe('Chat Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSessions', () => {
    it('should return sessions for a user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          title: 'Test Session',
          message_count: 5,
          created_at: '2026-02-03T12:00:00Z',
          updated_at: '2026-02-03T12:30:00Z',
          expires_at: '2026-05-04T12:00:00Z',
        },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockSessions, error: null }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectFn });

      const result = await getUserSessions('user-1', 10);

      expect(result).toEqual(mockSessions);
      expect(mockFrom).toHaveBeenCalledWith('ai_coach_sessions');
    });

    it('should throw on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      const selectFn = jest.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectFn });

      await expect(getUserSessions('user-1')).rejects.toThrow('Failed to fetch sessions');
    });
  });

  describe('getSessionMessages', () => {
    it('should return messages for a valid session', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: "Where's PDH?",
          function_call: null,
          tokens_used: null,
          created_at: '2026-02-03T12:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'PDH is at $5,930.',
          function_call: [{ function: 'get_key_levels', arguments: { symbol: 'SPX' } }],
          tokens_used: 350,
          created_at: '2026-02-03T12:00:02Z',
        },
      ];

      // First call: verify session exists
      const sessionChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null }),
      };
      const sessionSelect = jest.fn().mockReturnValue(sessionChain);

      // Second call: fetch messages
      const msgChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockMessages, error: null, count: 2 }),
      };
      const msgSelect = jest.fn().mockReturnValue(msgChain);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: sessionSelect };
        }
        return { select: msgSelect };
      });

      const result = await getSessionMessages('session-1', 'user-1', 50, 0);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe("Where's PDH?");
      expect(result.messages[1].functionCalls).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should throw when session not found', async () => {
      const sessionChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      const sessionSelect = jest.fn().mockReturnValue(sessionChain);
      mockFrom.mockReturnValue({ select: sessionSelect });

      await expect(getSessionMessages('bad-id', 'user-1')).rejects.toThrow(
        'Session not found or access denied'
      );
    });

    it('should calculate hasMore correctly', async () => {
      const mockMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        function_call: null,
        tokens_used: null,
        created_at: new Date().toISOString(),
      }));

      const sessionChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null }),
      };
      const sessionSelect = jest.fn().mockReturnValue(sessionChain);

      const msgChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockMessages, error: null, count: 75 }),
      };
      const msgSelect = jest.fn().mockReturnValue(msgChain);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: sessionSelect };
        return { select: msgSelect };
      });

      const result = await getSessionMessages('session-1', 'user-1', 50, 0);

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(75);
    });
  });

  describe('updateSessionTitle', () => {
    it('should update title from first message', async () => {
      const chain: any = {
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const updateFn = jest.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ update: updateFn });

      await updateSessionTitle('session-1', "Where's PDH for SPX?");

      expect(mockFrom).toHaveBeenCalledWith('ai_coach_sessions');
      expect(updateFn).toHaveBeenCalledWith({ title: "Where's PDH for SPX?" });
    });

    it('should truncate long messages', async () => {
      const chain: any = {
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const updateFn = jest.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ update: updateFn });

      const longMessage = 'A'.repeat(100);
      await updateSessionTitle('session-1', longMessage);

      expect(updateFn).toHaveBeenCalledWith({
        title: 'A'.repeat(57) + '...',
      });
    });

    it('should not throw on error (logs instead)', async () => {
      const { logger } = require('../../lib/logger');
      const chain: any = {
        eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      };
      const updateFn = jest.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ update: updateFn });

      // Should not throw
      await updateSessionTitle('session-1', 'Test title');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('should archive session for the requesting user', async () => {
      const archiveChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'session-1' },
          error: null,
        }),
      };
      const updateFn = jest.fn().mockReturnValue(archiveChain);
      mockFrom.mockReturnValue({ update: updateFn });

      const result = await deleteSession('session-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(updateFn).toHaveBeenCalled();
    });

    it('should throw when session not found', async () => {
      const archiveChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      const updateFn = jest.fn().mockReturnValue(archiveChain);
      mockFrom.mockReturnValue({ update: updateFn });

      await expect(deleteSession('bad-id', 'user-1')).rejects.toThrow(
        'Session not found or access denied'
      );
    });

    it('should throw when archive update fails', async () => {
      const archiveChain: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      };
      const updateFn = jest.fn().mockReturnValue(archiveChain);
      mockFrom.mockReturnValue({ update: updateFn });

      await expect(deleteSession('session-1', 'user-1')).rejects.toThrow(
        'Failed to delete session: DB error'
      );
    });
  });
});
