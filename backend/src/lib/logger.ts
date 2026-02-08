/**
 * Structured Logger
 * Production-grade JSON logging with request correlation IDs.
 * Replaces all console.log/error calls throughout the backend.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

// Sensitive patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g,          // OpenAI API keys
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g, // JWT tokens
  /Bearer\s+[a-zA-Z0-9._-]+/gi,      // Bearer tokens
  /password['":\s]*['"][^'"]+['"]/gi,  // Password fields
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
];

function redactSensitiveData(value: string): string {
  let redacted = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

function safeStringify(obj: unknown): string {
  try {
    const str = JSON.stringify(obj);
    return redactSensitiveData(str);
  } catch {
    return '[unserializable]';
  }
}

class Logger {
  private minLevel: LogLevel;
  private static LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVELS[level] >= Logger.LEVELS[this.minLevel];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message: redactSensitiveData(message),
      timestamp: new Date().toISOString(),
      ...meta,
    };

    // Redact any sensitive values in metadata
    const output = safeStringify(entry);

    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Create a child logger with bound context (e.g., requestId, userId)
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(private parent: Logger, private context: Record<string, unknown>) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...meta });
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...meta });
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...meta });
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.context, ...meta });
  }
}

// Singleton logger instance
export const logger = new Logger();
