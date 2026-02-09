import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean());

/**
 * Environment variable schema and validation.
 * Validates ALL required env vars at startup, failing fast with clear messages.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required').refine(
    (val) => val.startsWith('sk-'),
    'OPENAI_API_KEY must start with "sk-"'
  ),
  CHAT_MODEL: z.string().default('gpt-4o'),
  MAX_TOKENS: z.string().default('1000').transform(Number),
  TEMPERATURE: z.string().default('0.7').transform(Number),
  MAX_TOTAL_TOKENS_PER_REQUEST: z.string().default('4000').transform(Number),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Massive.com
  MASSIVE_API_KEY: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().default(''),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Worker Health Alerting (Discord + Sentry)
  WORKER_ALERTS_ENABLED: booleanFromEnv.default(false),
  WORKER_ALERTS_DISCORD_WEBHOOK_URL: z.string().url().optional(),
  WORKER_ALERTS_POLL_INTERVAL_MS: z.string().default('60000').transform(Number),
  WORKER_ALERTS_STALE_THRESHOLD_MS: z.string().default('1200000').transform(Number),
  WORKER_ALERTS_STARTUP_GRACE_MS: z.string().default('300000').transform(Number),
  WORKER_ALERTS_COOLDOWN_MS: z.string().default('900000').transform(Number),
  WORKER_ALERTS_SENTRY_ENABLED: booleanFromEnv.default(false),

  // Rate Limiting
  RATE_LIMIT_GENERAL: z.string().default('100').transform(Number),
  RATE_LIMIT_CHAT: z.string().default('20').transform(Number),
  RATE_LIMIT_SCREENSHOT: z.string().default('5').transform(Number),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validate and parse environment variables.
 * Call this at server startup. Throws with detailed messages on failure.
 */
export function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );
    console.error('Environment validation failed:');
    console.error(errors.join('\n'));
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

/**
 * Get validated environment (must call validateEnv first)
 */
export function getEnv(): Env {
  if (!_env) {
    return validateEnv();
  }
  return _env;
}
