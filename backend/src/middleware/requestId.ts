import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware to attach a unique request ID to every request.
 * Uses X-Request-ID from client if provided, otherwise generates one.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request for downstream use
  (req as any).requestId = requestId;

  // Include in response headers for client correlation
  res.setHeader('X-Request-ID', requestId);

  next();
}
