import { Response } from 'express';

/**
 * Standard error codes used across all API responses
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  QUERY_LIMIT_EXCEEDED = 'QUERY_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

interface ErrorResponseBody {
  error: string;
  code: ErrorCode;
  message: string;
  requestId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Send a standardized error response.
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): void {
  const requestId = (res.req as any)?.requestId;

  const body: ErrorResponseBody = {
    error: code,
    code,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  res.status(statusCode).json(body);
}

/**
 * Application error class with structured error code
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}
