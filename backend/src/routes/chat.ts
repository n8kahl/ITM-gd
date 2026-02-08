import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { sendChatMessage, getUserSessions, getSessionMessages, deleteSession } from '../chatkit/chatService';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { sendMessageSchema, getSessionMessagesSchema, deleteSessionSchema, getSessionsQuerySchema } from '../schemas/chatValidation';
// sendError / ErrorCode available if needed for structured error responses

const router = Router();

/**
 * POST /api/chat/message
 *
 * Send a chat message and get AI response
 *
 * Body:
 * - sessionId (optional): Session ID (will create new if not provided)
 * - message (required): User message content
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

      // Generate session ID if not provided
      const finalSessionId = sessionId || uuidv4();

      // Send message and get response
      const response = await sendChatMessage({
        sessionId: finalSessionId,
        message: message.trim(),
        userId
      });

      res.json({
        sessionId: finalSessionId,
        ...response
      });
    } catch (error: any) {
      logger.error('Error in chat message endpoint', { error: error?.message || String(error) });

      if (error.message.includes('OpenAI')) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'The AI service is temporarily unavailable. Please try again in a moment.',
          retryAfter: 30
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process chat message. Please try again.'
      });
    }
  }
);

/**
 * GET /api/chat/sessions
 *
 * Get user's chat sessions
 */
router.get(
  '/sessions',
  authenticateToken,
  validateQuery(getSessionsQuerySchema as any),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;

      const sessions = await getUserSessions(userId, limit);

      res.json({
        sessions,
        count: sessions.length
      });
    } catch (error: any) {
      logger.error('Error fetching sessions', { error: error?.message || String(error) });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch sessions'
      });
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId/messages
 *
 * Get messages for a specific session
 *
 * Query params:
 * - limit: Max messages to return (default: 50)
 * - offset: Offset for pagination (default: 0)
 */
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

      res.json(result);
    } catch (error: any) {
      logger.error('Error fetching session messages', { error: error?.message || String(error) });

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Session not found or access denied'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch messages'
      });
    }
  }
);

/**
 * DELETE /api/chat/sessions/:sessionId
 *
 * Delete a chat session
 */
router.delete(
  '/sessions/:sessionId',
  authenticateToken,
  validateParams(deleteSessionSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = (req as any).validatedParams;

      await deleteSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error deleting session', { error: error?.message || String(error) });

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Session not found or access denied'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete session'
      });
    }
  }
);

export default router;
