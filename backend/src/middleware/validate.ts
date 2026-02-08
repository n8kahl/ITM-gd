import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError, ErrorCode } from '../lib/errors';

/**
 * Middleware factory that validates request body/params/query against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid request body', {
        issues,
      });
      return;
    }
    // Attach validated data to request
    (req as any).validatedBody = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid request parameters', {
        issues,
      });
      return;
    }
    (req as any).validatedParams = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid query parameters', {
        issues,
      });
      return;
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}
