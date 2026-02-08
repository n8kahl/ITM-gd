import { sendError, AppError, ErrorCode } from '../errors';
import { Response, Request } from 'express';

describe('Error Handling', () => {
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;

  beforeEach(() => {
    mockReq = {};
    (mockReq as any).requestId = 'req-123';

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      req: mockReq as any,
    };
  });

  describe('sendError function', () => {
    it('should set correct status code', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should set different status codes correctly', () => {
      sendError(mockRes as Response, 401, ErrorCode.UNAUTHORIZED, 'Not authorized');
      expect(mockRes.status).toHaveBeenCalledWith(401);

      jest.clearAllMocks();
      mockRes.status = jest.fn().mockReturnThis();

      sendError(mockRes as Response, 403, ErrorCode.FORBIDDEN, 'Forbidden');
      expect(mockRes.status).toHaveBeenCalledWith(403);

      jest.clearAllMocks();
      mockRes.status = jest.fn().mockReturnThis();

      sendError(mockRes as Response, 404, ErrorCode.NOT_FOUND, 'Not found');
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.clearAllMocks();
      mockRes.status = jest.fn().mockReturnThis();

      sendError(mockRes as Response, 429, ErrorCode.RATE_LIMITED, 'Rate limited');
      expect(mockRes.status).toHaveBeenCalledWith(429);

      jest.clearAllMocks();
      mockRes.status = jest.fn().mockReturnThis();

      sendError(mockRes as Response, 500, ErrorCode.INTERNAL_ERROR, 'Server error');
      expect(mockRes.status).toHaveBeenCalledWith(500);

      jest.clearAllMocks();
      mockRes.status = jest.fn().mockReturnThis();

      sendError(mockRes as Response, 503, ErrorCode.EXTERNAL_SERVICE_ERROR, 'Service unavailable');
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('should include error code in response', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR,
        })
      );
    });

    it('should include message in response', () => {
      const message = 'Invalid input provided';
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, message);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
        })
      );
    });

    it('should include details when provided', () => {
      const details = { field: 'email', issue: 'Invalid format' };
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input', details);

      // Details should only be included in non-production
      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg).toHaveProperty('message');
      expect(callArg).toHaveProperty('code');
    });

    it('should omit details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const details = { field: 'email', issue: 'Invalid format' };
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input', details);

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should include details in development/test', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const details = { field: 'email', issue: 'Invalid format' };
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input', details);

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.details).toEqual(details);

      process.env.NODE_ENV = originalEnv;
    });

    it('should include requestId from response object', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.requestId).toBe('req-123');
    });

    it('should include timestamp in response', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include error field matching code', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.error).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should call json with all required fields', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid input');

      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg).toHaveProperty('error');
      expect(callArg).toHaveProperty('code');
      expect(callArg).toHaveProperty('message');
      expect(callArg).toHaveProperty('requestId');
      expect(callArg).toHaveProperty('timestamp');
    });
  });

  describe('AppError class', () => {
    it('should have correct statusCode property', () => {
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should have correct code property', () => {
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should have correct message from Error', () => {
      const message = 'Invalid input';
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, message);
      expect(error.message).toBe(message);
    });

    it('should be an instance of Error', () => {
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input');
      expect(error instanceof Error).toBe(true);
    });

    it('should have Error name set to AppError', () => {
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input');
      expect(error.name).toBe('AppError');
    });

    it('should allow optional details property', () => {
      const details = { field: 'email' };
      const error = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input', details);
      expect(error.details).toEqual(details);
    });

    it('should work with different status codes', () => {
      const error401 = new AppError(401, ErrorCode.UNAUTHORIZED, 'Not authorized');
      const error403 = new AppError(403, ErrorCode.FORBIDDEN, 'Forbidden');
      const error404 = new AppError(404, ErrorCode.NOT_FOUND, 'Not found');
      const error500 = new AppError(500, ErrorCode.INTERNAL_ERROR, 'Internal error');

      expect(error401.statusCode).toBe(401);
      expect(error403.statusCode).toBe(403);
      expect(error404.statusCode).toBe(404);
      expect(error500.statusCode).toBe(500);
    });

    it('should work with different error codes', () => {
      const validationError = new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid');
      const rateLimitError = new AppError(429, ErrorCode.RATE_LIMITED, 'Too many requests');
      const timeoutError = new AppError(504, ErrorCode.TIMEOUT, 'Request timeout');
      const externalError = new AppError(503, ErrorCode.EXTERNAL_SERVICE_ERROR, 'Service down');

      expect(validationError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(rateLimitError.code).toBe(ErrorCode.RATE_LIMITED);
      expect(timeoutError.code).toBe(ErrorCode.TIMEOUT);
      expect(externalError.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    });
  });

  describe('ErrorCode enum', () => {
    it('should have VALIDATION_ERROR defined', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    });

    it('should have UNAUTHORIZED defined', () => {
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    });

    it('should have FORBIDDEN defined', () => {
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    });

    it('should have NOT_FOUND defined', () => {
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    });

    it('should have RATE_LIMITED defined', () => {
      expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    });

    it('should have QUERY_LIMIT_EXCEEDED defined', () => {
      expect(ErrorCode.QUERY_LIMIT_EXCEEDED).toBe('QUERY_LIMIT_EXCEEDED');
    });

    it('should have TIMEOUT defined', () => {
      expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
    });

    it('should have EXTERNAL_SERVICE_ERROR defined', () => {
      expect(ErrorCode.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should have INTERNAL_ERROR defined', () => {
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should have all expected error codes', () => {
      const codes = Object.values(ErrorCode);
      expect(codes).toContain('VALIDATION_ERROR');
      expect(codes).toContain('UNAUTHORIZED');
      expect(codes).toContain('FORBIDDEN');
      expect(codes).toContain('NOT_FOUND');
      expect(codes).toContain('RATE_LIMITED');
      expect(codes).toContain('QUERY_LIMIT_EXCEEDED');
      expect(codes).toContain('TIMEOUT');
      expect(codes).toContain('EXTERNAL_SERVICE_ERROR');
      expect(codes).toContain('INTERNAL_ERROR');
    });
  });

  describe('Integration', () => {
    it('should use AppError with sendError', () => {
      const appError = new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        { field: 'email' }
      );

      sendError(
        mockRes as Response,
        appError.statusCode,
        appError.code,
        appError.message,
        appError.details
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const callArg = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArg.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(callArg.message).toBe('Invalid input');
    });

    it('should properly chain status and json calls', () => {
      sendError(mockRes as Response, 400, ErrorCode.VALIDATION_ERROR, 'Invalid');

      // Verify status was called before json
      const statusCallOrder = (mockRes.status as jest.Mock).mock.invocationCallOrder[0];
      const jsonCallOrder = (mockRes.json as jest.Mock).mock.invocationCallOrder[0];
      expect(statusCallOrder).toBeLessThan(jsonCallOrder);
      expect((mockRes.status as jest.Mock).mock.results[0].value).toBe(mockRes);
    });
  });
});
