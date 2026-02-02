import { Router, Request, Response } from 'express';
import { sendChatMessage, getUserSessions, deleteSession } from '../chatkit/chatService';
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

      res.json({
        sessionId: finalSessionId,
        ...response
      });
    } catch (error: any) {
      console.error('Error in chat message endpoint:', error);

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

      res.json({
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

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete session'
      });
    }
  }
);

export default router;
