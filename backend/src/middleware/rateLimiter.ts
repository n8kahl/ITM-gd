import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware for API endpoints
 * Different limits for different endpoint categories
 */

// General API rate limit: 100 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again in a minute.',
  },
});

// Chat endpoint: 20 messages per minute per IP (AI calls are expensive)
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Chat rate limit exceeded. Please wait before sending more messages.',
  },
});

// Screenshot analysis: 5 per minute per IP (Vision API calls are expensive)
export const screenshotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Screenshot analysis rate limit exceeded. Please wait before uploading more.',
  },
});

// Auth-related endpoints: 10 per minute per IP (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Too many authentication attempts. Please try again later.',
  },
});
