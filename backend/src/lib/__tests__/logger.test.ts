import { logger } from '../logger';

describe('Logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('Log output format', () => {
    it('should output JSON-formatted log entries', () => {
      logger.info('Test message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('message');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should include timestamp in log entries', () => {
      logger.info('Test message');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include log level in output', () => {
      logger.info('Test message');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
    });

    it('should include message in output', () => {
      logger.info('Test message');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toBe('Test message');
    });
  });

  describe('Log level filtering', () => {
    it('should respect log level filtering (debug not shown at info level)', () => {
      // Default log level is 'info'
      logger.debug('Debug message');

      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should output info level at info level', () => {
      logger.info('Info message');

      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should output warn level at info level', () => {
      logger.warn('Warn message');

      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should output error level at info level', () => {
      logger.error('Error message');

      expect(stderrSpy).toHaveBeenCalled();
    });
  });

  describe('Sensitive data redaction', () => {
    it('should redact OpenAI API keys (sk-...)', () => {
      logger.info('API key: sk-abcdefghijklmnopqrst1234567890');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('sk-abcdefghijklmnopqrst1234567890');
    });

    it('should redact JWT tokens', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      logger.info(`Token: ${jwtToken}`);

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain(jwtToken);
    });

    it('should redact Bearer tokens', () => {
      logger.info('Authorization: Bearer mySecretBearerToken123');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('Bearer mySecretBearerToken123');
    });

    it('should redact credit card numbers', () => {
      logger.info('Card: 4532-1234-5678-9010');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('4532-1234-5678-9010');
    });

    it('should redact credit card numbers with spaces', () => {
      logger.info('Card: 4532 1234 5678 9010');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('4532 1234 5678 9010');
    });

    it('should redact password fields', () => {
      logger.info('password: "mySecurePassword123"');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('mySecurePassword123');
    });

    it('should redact metadata containing sensitive data', () => {
      logger.info('User login', {
        password: 'secret123',
        apiKey: 'sk-abcdefghijklmnopqrst1234567890',
      });

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret123');
      expect(output).not.toContain('sk-abcdefghijklmnopqrst1234567890');
    });
  });

  describe('Output streams', () => {
    it('should write error level to stderr', () => {
      logger.error('Error message');

      expect(stderrSpy).toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should write info to stdout', () => {
      logger.info('Info message');

      expect(stdoutSpy).toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('should write debug to stdout', () => {
      // Set LOG_LEVEL to debug to enable debug logs
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      // Create a new logger instance to pick up the new env var
      jest.resetModules();
      const { logger: newLogger } = require('../logger');

      newLogger.debug('Debug message');

      expect(stdoutSpy).toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();

      // Restore
      process.env.LOG_LEVEL = originalLogLevel;
    });

    it('should write warn to stdout', () => {
      logger.warn('Warn message');

      expect(stdoutSpy).toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metadata handling', () => {
    it('should include metadata in output', () => {
      logger.info('Message with context', {
        userId: 'user-123',
        requestId: 'req-456',
      });

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.userId).toBe('user-123');
      expect(parsed.requestId).toBe('req-456');
    });

    it('should redact sensitive values in metadata', () => {
      logger.info('Message', {
        apiKey: 'sk-abcdefghijklmnopqrst1234567890',
        userId: 'user-123',
      });

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('sk-abcdefghijklmnopqrst1234567890');
    });
  });

  describe('Child logger', () => {
    it('should create child logger with bound context', () => {
      const childLogger = logger.child({ requestId: 'req-123' });

      childLogger.info('Message from child');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.requestId).toBe('req-123');
    });

    it('should include parent context in child logger output', () => {
      const childLogger = logger.child({ requestId: 'req-123', userId: 'user-456' });

      childLogger.info('Message from child');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.requestId).toBe('req-123');
      expect(parsed.userId).toBe('user-456');
    });

    it('child logger should merge parent and call-time metadata', () => {
      const childLogger = logger.child({ requestId: 'req-123' });

      childLogger.info('Message', { action: 'login' });

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.requestId).toBe('req-123');
      expect(parsed.action).toBe('login');
    });

    it('should allow all log methods on child logger', () => {
      const childLogger = logger.child({ requestId: 'req-123' });

      childLogger.debug('Debug');
      childLogger.info('Info');
      childLogger.warn('Warn');
      childLogger.error('Error');

      // debug is not logged at default info level, so 3 calls
      expect(stdoutSpy).toHaveBeenCalledTimes(2); // info, warn
      expect(stderrSpy).toHaveBeenCalledTimes(1); // error
    });

    it('child logger should redact sensitive data in parent context', () => {
      const childLogger = logger.child({
        apiKey: 'sk-abcdefghijklmnopqrst1234567890',
      });

      childLogger.info('Message');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('sk-abcdefghijklmnopqrst1234567890');
    });
  });

  describe('Unserializable objects', () => {
    it('should handle unserializable objects gracefully', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      logger.info('Message', { obj: circularObj });

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[unserializable]');
    });

    it('should not crash when logging unserializable values', () => {
      const unserializable = { fn: () => console.log('test') };

      expect(() => {
        logger.info('Message', { value: unserializable });
      }).not.toThrow();

      expect(stdoutSpy).toHaveBeenCalled();
    });
  });

  describe('Message sanitization', () => {
    it('should redact API keys in message text', () => {
      logger.info('Using API key sk-abc123def456ghi789jkl');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('sk-abc123def456ghi789jkl');
    });

    it('should preserve non-sensitive message content', () => {
      logger.info('Processing user data for user-123');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toBe('Processing user data for user-123');
    });
  });

  describe('Log line endings', () => {
    it('should end log output with newline', () => {
      logger.info('Message');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
    });
  });
});
