import { Router, Request, Response } from 'express';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { analyzeScreenshot } from '../services/screenshot/analyzer';

const router = Router();

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * POST /api/screenshot/analyze
 *
 * Analyze a broker screenshot to extract positions
 *
 * Body (JSON):
 * - image: base64 encoded image string
 * - mimeType: image MIME type (default: image/png)
 */
router.post(
  '/analyze',
  authenticateToken,
  checkQueryLimit,
  async (req: Request, res: Response) => {
    try {
      const { image, mimeType = 'image/png' } = req.body;

      // Validate image
      if (!image || typeof image !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Image data is required (base64 encoded)',
        });
      }

      // Check MIME type
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        });
      }

      // Check size (base64 is ~33% larger than binary)
      const estimatedSize = (image.length * 3) / 4;
      if (estimatedSize > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'File too large',
          message: 'Maximum file size is 10MB',
        });
      }

      // Analyze the screenshot
      const analysis = await analyzeScreenshot(image, mimeType);

      return res.json({
        ...analysis,
        positionCount: analysis.positions.length,
      });
    } catch (error: any) {
      console.error('Error in screenshot analysis:', error);

      if (error.message.includes('OpenAI') || error.message.includes('Vision')) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'Screenshot analysis service is temporarily unavailable.',
          retryAfter: 30,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze screenshot. Please try again.',
      });
    }
  }
);

export default router;
