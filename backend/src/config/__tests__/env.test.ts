// Tests dynamically import the module to test fresh env state

// Save original env
const originalEnv = { ...process.env };

describe('Environment Validation', () => {
  beforeEach(() => {
    // Reset environment and module cache
    jest.resetModules();
    process.env = { ...originalEnv };
    // Mock process.exit to prevent test suite from exiting
    jest.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('process.exit called');
    }) as any);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('validateEnv function', () => {
    it('should validate successfully with valid environment variables', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3001';
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env).toBeDefined();
      expect(env.OPENAI_API_KEY).toBe('sk-proj-abcdefghijklmnopqrstuvwxyz');
      expect(env.PORT).toBe(3001);
    });

    it('should throw on missing OPENAI_API_KEY', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate } = require('../env');

      expect(() => validate()).toThrow('process.exit called');
    });

    it('should throw on invalid OPENAI_API_KEY format (not starting with sk-)', () => {
      process.env.OPENAI_API_KEY = 'invalid-key-format';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate } = require('../env');

      expect(() => validate()).toThrow('process.exit called');
    });

    it('should coerce PORT to number or use valid number', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.PORT = '8080';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(typeof env.PORT).toBe('number');
      expect(env.PORT).toBe(8080);
    });

    it('should throw on invalid SUPABASE_URL (not a URL)', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'not-a-valid-url';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate } = require('../env');

      expect(() => validate()).toThrow('process.exit called');
    });

    it('should throw on missing SUPABASE_SERVICE_ROLE_KEY', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { validateEnv: validate } = require('../env');

      expect(() => validate()).toThrow('process.exit called');
    });

    it('should use default values when optional vars are not set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.REDIS_URL;
      delete process.env.LOG_LEVEL;

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.PORT).toBe(3001);
      expect(env.NODE_ENV).toBe('development');
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
      expect(env.LOG_LEVEL).toBe('info');
    });

    it('should validate LOG_LEVEL enum', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.LOG_LEVEL = 'debug';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.LOG_LEVEL).toBe('debug');
    });

    it('should reject invalid LOG_LEVEL', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.LOG_LEVEL = 'invalid-level';

      const { validateEnv: validate } = require('../env');

      expect(() => validate()).toThrow('process.exit called');
    });

    it('should validate TEMPERATURE range (0-2)', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.TEMPERATURE = '1.5';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.TEMPERATURE).toBe(1.5);
    });

    it('should accept TEMPERATURE value at min bound (0)', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.TEMPERATURE = '0';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.TEMPERATURE).toBe(0);
    });

    it('should accept TEMPERATURE value at max bound (2)', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.TEMPERATURE = '2';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.TEMPERATURE).toBe(2);
    });

    it('should use default TEMPERATURE if not set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.TEMPERATURE;

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.TEMPERATURE).toBe(0.7);
    });

    it('should validate MAX_TOKENS range', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.MAX_TOKENS = '2000';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.MAX_TOKENS).toBe(2000);
    });

    it('should use default MAX_TOKENS if not set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.MAX_TOKENS;

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.MAX_TOKENS).toBe(1000);
    });

    it('should validate NODE_ENV enum', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const validEnvs = ['development', 'production', 'test'];
      for (const env of validEnvs) {
        jest.resetModules();
        process.env.NODE_ENV = env;
        process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

        const { validateEnv: validate } = require('../env');
        const result = validate();
        expect(result.NODE_ENV).toBe(env);
      }
    });

    it('should allow optional MASSIVE_API_KEY', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.MASSIVE_API_KEY;

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env).toBeDefined();
    });

    it('should set MASSIVE_API_KEY when provided', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.MASSIVE_API_KEY = 'massive-test-key';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.MASSIVE_API_KEY).toBe('massive-test-key');
    });

    it('should allow optional ALPHA_VANTAGE_API_KEY', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.ALPHA_VANTAGE_API_KEY;

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env).toBeDefined();
    });

    it('should set ALPHA_VANTAGE_API_KEY when provided', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.ALPHA_VANTAGE_API_KEY = 'alpha-test-key';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.ALPHA_VANTAGE_API_KEY).toBe('alpha-test-key');
    });

    it('should reject invalid ALPHA_VANTAGE_BASE_URL when provided', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.ALPHA_VANTAGE_BASE_URL = 'not-a-url';

      const { validateEnv: validate } = require('../env');
      expect(() => validate()).toThrow('process.exit called');
    });
  });

  describe('getEnv function', () => {
    it('should return cached environment variables', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate, getEnv: get } = require('../env');
      const env1 = validate();
      const env2 = get();

      expect(env1).toBe(env2);
    });

    it('should call validateEnv if not already called', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { getEnv: get } = require('../env');
      const env = get();

      expect(env).toBeDefined();
      expect(env.OPENAI_API_KEY).toBe('sk-proj-abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('Env type', () => {
    it('should have all expected properties on Env type', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      const requiredProps = [
        'NODE_ENV',
        'PORT',
        'OPENAI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'REDIS_URL',
        'LOG_LEVEL',
        'CHAT_MODEL',
        'MAX_TOKENS',
        'TEMPERATURE',
        'MAX_TOTAL_TOKENS_PER_REQUEST',
        'ALLOWED_ORIGINS',
        'RATE_LIMIT_GENERAL',
        'RATE_LIMIT_CHAT',
        'RATE_LIMIT_SCREENSHOT',
      ];

      for (const prop of requiredProps) {
        expect(env).toHaveProperty(prop);
      }
    });
  });

  describe('Default values', () => {
    it('should apply all defaults correctly', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      // Clear optional env vars
      const optionalVars = [
        'PORT',
        'NODE_ENV',
        'CHAT_MODEL',
        'MAX_TOKENS',
        'TEMPERATURE',
        'MAX_TOTAL_TOKENS_PER_REQUEST',
        'REDIS_URL',
        'ALLOWED_ORIGINS',
        'LOG_LEVEL',
        'RATE_LIMIT_GENERAL',
        'RATE_LIMIT_CHAT',
        'RATE_LIMIT_SCREENSHOT',
      ];

      for (const varName of optionalVars) {
        delete process.env[varName];
      }

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(env.PORT).toBe(3001);
      expect(env.NODE_ENV).toBe('development');
      expect(env.CHAT_MODEL).toBe('gpt-4o');
      expect(env.MAX_TOKENS).toBe(1000);
      expect(env.TEMPERATURE).toBe(0.7);
      expect(env.MAX_TOTAL_TOKENS_PER_REQUEST).toBe(4000);
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
      expect(env.ALLOWED_ORIGINS).toBe('');
      expect(env.LOG_LEVEL).toBe('info');
      expect(env.RATE_LIMIT_GENERAL).toBe(100);
      expect(env.RATE_LIMIT_CHAT).toBe(20);
      expect(env.RATE_LIMIT_SCREENSHOT).toBe(5);
    });
  });

  describe('Type coercion', () => {
    it('should coerce PORT to number', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.PORT = '8080';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(typeof env.PORT).toBe('number');
      expect(env.PORT).toBe(8080);
    });

    it('should coerce MAX_TOKENS to number', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.MAX_TOKENS = '2048';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(typeof env.MAX_TOKENS).toBe('number');
      expect(env.MAX_TOKENS).toBe(2048);
    });

    it('should coerce TEMPERATURE to number', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.TEMPERATURE = '1.5';

      const { validateEnv: validate } = require('../env');
      const env = validate();

      expect(typeof env.TEMPERATURE).toBe('number');
      expect(env.TEMPERATURE).toBe(1.5);
    });
  });
});
