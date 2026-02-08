import { Router, Request, Response } from 'express';
import { sendChatMessage, getUserSessions, getSessionMessages, deleteSession } from '../chatkit/chatService';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

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
  async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      const userId = req.user!.id;

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Message is required and must be non-empty'
        });
      }

      if (message.length > 2000) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Message must be less than 2000 characters'
        });
      }

      // Generate session ID if not provided
      const finalSessionId = sessionId || uuidv4();

      // Send message and get response
      const response = await sendChatMessage({
        sessionId: finalSessionId,
        message: message.trim(),
        userId
      });

      return res.json({
        sessionId: finalSessionId,
        ...response
      });
    } catch (error: any) {
      console.error('[chat route] Error in chat message endpoint:', {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type
      });

      // Detect OpenAI API errors (status codes from openai SDK)
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
 * GET /api/chat/sessions
 *
 * Get user's chat sessions
 */
router.get(
  '/sessions',
  authenticateToken,
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
      console.error('Error fetching sessions:', error);
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
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await getSessionMessages(sessionId, userId, limit, offset);

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching session messages:', error);

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Session not found or access denied'
        });
      }

      return res.status(500).json({
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
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.params;

      await deleteSession(sessionId, userId);

      return res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting session:', error);

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Session not found or access denied'
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete session'
      });
    }
  }
);

export default router;
