import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { authenticateToken, checkQueryLimit } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { analyzeScreenshot } from '../services/screenshot/analyzer';
import { analyzeScreenshotSchema } from '../schemas/screenshotValidation';
import { validateImagePayload } from '../lib/sanitize-input';

const router = Router();

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  validateBody(analyzeScreenshotSchema),
  async (req: Request, res: Response) => {
    try {
      const { image, mimeType = 'image/png' } = req.body;
      const imagePayload = `data:${mimeType};base64,${image}`;

      // Check size (base64 is ~33% larger than binary)
      const estimatedSize = (image.length * 3) / 4;
      if (estimatedSize > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'File too large',
          message: 'Maximum file size is 10MB',
        });
      }

      if (!validateImagePayload(imagePayload)) {
        return res.status(400).json({
          error: 'Invalid image payload',
          message: 'Image must be valid base64 and use PNG, JPEG, WebP, or GIF format.',
        });
      }

      // Analyze the screenshot
      const analysis = await analyzeScreenshot(image, mimeType);

      return res.json({
        ...analysis,
        positionCount: analysis.positions.length,
      });
    } catch (error: any) {
      logger.error('Error in screenshot analysis', { error: error?.message || String(error) });

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
