import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';
import type { Response } from 'express';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../chatkit/chatService', () => ({
  sendChatMessage: jest.fn(),
  getUserSessions: jest.fn(),
  getSessionMessages: jest.fn(),
  deleteSession: jest.fn(),
}));

jest.mock('../../chatkit/streamService', () => ({
  streamChatMessage: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

import chatRouter from '../chat';
import {
  sendChatMessage,
  getUserSessions,
  getSessionMessages,
  deleteSession,
} from '../../chatkit/chatService';
import { streamChatMessage } from '../../chatkit/streamService';

const mockSendChatMessage = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const mockGetUserSessions = getUserSessions as jest.MockedFunction<typeof getUserSessions>;
const mockGetSessionMessages = getSessionMessages as jest.MockedFunction<typeof getSessionMessages>;
const mockDeleteSession = deleteSession as jest.MockedFunction<typeof deleteSession>;
const mockStreamChatMessage = streamChatMessage as jest.MockedFunction<typeof streamChatMessage>;

const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

describeWithSockets('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendChatMessage.mockResolvedValue({
      messageId: 'msg-1',
      role: 'assistant',
      content: 'response',
      functionCalls: [],
      tokensUsed: 123,
      responseTime: 250,
    } as any);
    mockStreamChatMessage.mockResolvedValue(undefined);
    mockGetUserSessions.mockResolvedValue([]);
    mockGetSessionMessages.mockResolvedValue({
      messages: [],
      total: 0,
      hasMore: false,
    });
    mockDeleteSession.mockResolvedValue({ success: true } as any);
  });

  describe('POST /api/chat/message', () => {
    it('generates sessionId when omitted and passes trimmed message + mobile context', async () => {
      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', 'Bearer test-token')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
        .send({ message: '   Explain SPX setup   ' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe('11111111-1111-4111-8111-111111111111');
      expect(res.body.messageId).toBe('msg-1');
      expect(mockSendChatMessage).toHaveBeenCalledWith({
        sessionId: '11111111-1111-4111-8111-111111111111',
        message: 'Explain SPX setup',
        userId: 'user-123',
        context: {
          isMobile: true,
        },
      });
    });

    it('uses provided sessionId and desktop context', async () => {
      const sessionId = '22222222-2222-4222-8222-222222222222';
      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', 'Bearer test-token')
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
        .send({ sessionId, message: 'What are key levels?' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe(sessionId);
      expect(mockSendChatMessage).toHaveBeenCalledWith({
        sessionId,
        message: 'What are key levels?',
        userId: 'user-123',
        context: {
          isMobile: false,
        },
      });
    });

    it('passes active chart symbol context when provided', async () => {
      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', 'Bearer test-token')
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
        .send({
          message: 'Find a setup from my chart context',
          context: {
            activeChartSymbol: 'AAPL',
          },
        });

      expect(res.status).toBe(200);
      expect(mockSendChatMessage).toHaveBeenCalledWith({
        sessionId: '11111111-1111-4111-8111-111111111111',
        message: 'Find a setup from my chart context',
        userId: 'user-123',
        context: {
          isMobile: false,
          activeChartSymbol: 'AAPL',
        },
      });
    });

    it('maps OpenAI-style upstream errors to 503', async () => {
      mockSendChatMessage.mockRejectedValue({
        status: 429,
        message: 'Rate limit reached for requests',
      });

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'hello' });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('AI service unavailable');
      expect(res.body.retryAfter).toBe(30);
    });
  });

  describe('POST /api/chat/stream', () => {
    it('writes SSE session event and delegates to stream service', async () => {
      mockStreamChatMessage.mockImplementation(async (_args, res: Response) => {
        res.write('event: token\ndata: {"text":"hello"}\n\n');
      });

      const res = await request(app)
        .post('/api/chat/stream')
        .set('Authorization', 'Bearer test-token')
        .send({ message: '  stream this  ' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: session');
      expect(res.text).toContain('event: token');
      expect(mockStreamChatMessage).toHaveBeenCalledWith({
        sessionId: '11111111-1111-4111-8111-111111111111',
        message: 'stream this',
        userId: 'user-123',
        context: {
          isMobile: false,
        },
      }, expect.any(Object));
    });

    it('emits SSE error event when streaming fails after headers are sent', async () => {
      mockStreamChatMessage.mockRejectedValue(new Error('stream failed'));

      const res = await request(app)
        .post('/api/chat/stream')
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'trigger stream failure' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Stream interrupted');
    });
  });

  describe('GET /api/chat/sessions', () => {
    it('returns user sessions with validated limit', async () => {
      mockGetUserSessions.mockResolvedValue([
        {
          id: 'session-1',
          title: 'SPX plan',
          message_count: 4,
          created_at: '2026-02-10T00:00:00.000Z',
          updated_at: '2026-02-10T00:05:00.000Z',
        },
      ] as any);

      const res = await request(app)
        .get('/api/chat/sessions?limit=5')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(mockGetUserSessions).toHaveBeenCalledWith('user-123', 5);
    });
  });

  describe('GET /api/chat/sessions/:sessionId/messages', () => {
    it('returns 404 for access-denied style service errors', async () => {
      mockGetSessionMessages.mockRejectedValue(new Error('session not found or access denied'));

      const sessionId = '33333333-3333-4333-8333-333333333333';
      const res = await request(app)
        .get(`/api/chat/sessions/${sessionId}/messages`)
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  describe('DELETE /api/chat/sessions/:sessionId', () => {
    it('deletes a session for the authenticated user', async () => {
      const sessionId = '44444444-4444-4444-8444-444444444444';
      const res = await request(app)
        .delete(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDeleteSession).toHaveBeenCalledWith(sessionId, 'user-123');
    });
  });
});
