import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { sendChatMessage, getUserSessions, getSessionMessages, deleteSession } from '../chatkit/chatService';
import { streamChatMessage } from '../chatkit/streamService';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { sendMessageSchema, getSessionMessagesSchema, deleteSessionSchema, getSessionsQuerySchema } from '../schemas/chatValidation';

const router = Router();

function isMobileRequest(req: Request): boolean {
  const userAgent = req.headers['user-agent'];
  if (!userAgent) return false;
  return /(iphone|ipad|ipod|android|mobile|blackberry|iemobile|opera mini)/i.test(userAgent);
}

/**
 * POST /api/chat/message
 *
 * Send a chat message and get AI response
 */
router.post(
  '/message',
  authenticateToken,
  checkQueryLimit,
  validateBody(sendMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = (req as any).validatedBody;
      const userId = req.user!.id;

      const finalSessionId = sessionId || uuidv4();

      const response = await sendChatMessage({
        sessionId: finalSessionId,
        message: message.trim(),
        userId,
        context: {
          isMobile: isMobileRequest(req),
        },
      });

      return res.json({
        sessionId: finalSessionId,
        ...response
      });
    } catch (error: any) {
      logger.error('Error in chat message endpoint', {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type
      });

      const isOpenAIError = error?.status === 401 || error?.status === 429 ||
        error?.status === 403 || error?.name === 'APIError' ||
        error?.message?.includes('OpenAI') || error?.message?.includes('openai') ||
        error?.message?.includes('API key') || error?.message?.includes('rate limit');

      if (isOpenAIError) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'The AI service is temporarily unavailable. Please try again in a moment.',
          details: process.env.NODE_ENV !== 'production' ? error?.message : undefined,
          retryAfter: 30
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process chat message. Please try again.',
        details: error?.message || 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/chat/stream
 *
 * Streaming chat endpoint using Server-Sent Events.
 * Returns tokens as they are generated for real-time UI updates.
 */
router.post(
  '/stream',
  authenticateToken,
  checkQueryLimit,
  validateBody(sendMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, message } = (req as any).validatedBody;
      const userId = req.user!.id;
      const finalSessionId = sessionId || uuidv4();

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      // Send session ID as first event
      res.write(`event: session\ndata: ${JSON.stringify({ sessionId: finalSessionId })}\n\n`);

      await streamChatMessage({
        sessionId: finalSessionId,
        message: message.trim(),
        userId,
        context: {
          isMobile: isMobileRequest(req),
        },
      }, res);

      res.end();
    } catch (error: any) {
      logger.error('Error in chat stream endpoint', { error: error?.message || String(error) });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to start streaming. Please try again.',
        });
        return;
      }
      // If headers already sent, send error event and close
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
);

router.get(
  '/sessions',
  authenticateToken,
  validateQuery(getSessionsQuerySchema as any),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const sessions = await getUserSessions(userId, limit);
      res.json({ sessions, count: sessions.length });
    } catch (error: any) {
      logger.error('Error fetching sessions', { error: error?.message || String(error) });
      res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch sessions' });
    }
  }
);

router.get(
  '/sessions/:sessionId/messages',
  authenticateToken,
  validateParams(getSessionMessagesSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = (req as any).validatedParams;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await getSessionMessages(sessionId, userId, limit, offset);
      return res.json(result);
    } catch (error: any) {
      logger.error('Error fetching session messages', { error: error?.message || String(error) });
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: 'Not found', message: 'Session not found or access denied' });
      }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch messages' });
    }
  }
);

router.delete(
  '/sessions/:sessionId',
  authenticateToken,
  validateParams(deleteSessionSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = (req as any).validatedParams;
      await deleteSession(sessionId, userId);
      return res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error: any) {
      logger.error('Error deleting session', { error: error?.message || String(error) });
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: 'Not found', message: 'Session not found or access denied' });
      }
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete session' });
    }
  }
);

export default router;
