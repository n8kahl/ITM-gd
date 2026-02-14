import type { Application } from 'express';

interface SentryUser {
  id?: string;
}

interface SentryScope {
  setTag(key: string, value: string): void;
  setUser(user: SentryUser | null): void;
  setLevel(level: 'info' | 'warning' | 'error'): void;
  setExtra(key: string, value: unknown): void;
}

interface SentryLike {
  init(options: unknown): void;
  setupExpressErrorHandler(app: Application): void;
  close(timeoutMs: number): Promise<boolean>;
  captureException(error: unknown): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;
  withScope(callback: (scope: SentryScope) => void): void;
  setTag(key: string, value: string): void;
  setUser(user: SentryUser | null): void;
}

const noopScope: SentryScope = {
  setTag: () => undefined,
  setUser: () => undefined,
  setLevel: () => undefined,
  setExtra: () => undefined,
};

const noopSentry: SentryLike = {
  init: () => undefined,
  setupExpressErrorHandler: () => undefined,
  close: async () => true,
  captureException: () => undefined,
  captureMessage: () => undefined,
  withScope: (callback: (scope: SentryScope) => void) => callback(noopScope),
  setTag: () => undefined,
  setUser: () => undefined,
};

let resolvedSentry: SentryLike | null = null;
let sentryInitialized = false;

function resolveSentryModule(): SentryLike {
  if (resolvedSentry) return resolvedSentry;

  try {
    // Optional dependency: if unavailable, fall back to no-op.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@sentry/node') as Partial<SentryLike>;
    if (mod && typeof mod.captureException === 'function') {
      resolvedSentry = {
        init: (options) => mod.init?.(options),
        setupExpressErrorHandler: (app) => mod.setupExpressErrorHandler?.(app as any),
        close: async (timeoutMs) => (await mod.close?.(timeoutMs)) ?? true,
        captureException: (error) => mod.captureException?.(error),
        captureMessage: (message, level) => mod.captureMessage?.(message, level),
        withScope: (callback) => {
          if (typeof mod.withScope === 'function') {
            mod.withScope((scope: any) => callback(scope as SentryScope));
            return;
          }
          callback(noopScope);
        },
        setTag: (key, value) => mod.setTag?.(key, value),
        setUser: (user) => mod.setUser?.(user),
      };
      return resolvedSentry;
    }
  } catch {
    // Intentionally silent: Sentry is optional.
  }

  resolvedSentry = noopSentry;
  return resolvedSentry;
}

/**
 * Initialize Sentry for the Express backend when DSN + package are available.
 * Safe no-op when Sentry is not installed or DSN is not configured.
 */
export function initSentry(app: Application): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const sentry = resolveSentryModule();
  if (!sentryInitialized) {
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: `titm-backend@${process.env.npm_package_version || '1.0.0'}`,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      ignoreErrors: [
        'CORS: Origin',
        'Rate limit exceeded',
        'Request timeout',
      ],
      beforeSend(event: any) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
    sentryInitialized = true;
  }

  sentry.setupExpressErrorHandler(app);
}

/**
 * Initialize Sentry without binding Express middleware.
 * Use this during process bootstrap before importing express modules.
 */
export function initSentryBootstrap(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || sentryInitialized) return;

  resolveSentryModule().init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: `titm-backend@${process.env.npm_package_version || '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    ignoreErrors: [
      'CORS: Origin',
      'Rate limit exceeded',
      'Request timeout',
    ],
    beforeSend(event: any) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
  sentryInitialized = true;
}

/**
 * Flush pending Sentry events before process exit.
 * Safe no-op when Sentry is disabled or unavailable.
 */
export async function flushSentry(): Promise<void> {
  const sentry = resolveSentryModule();
  await sentry.close(2000);
}

export const Sentry = {
  captureException(error: unknown): void {
    resolveSentryModule().captureException(error);
  },
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void {
    resolveSentryModule().captureMessage(message, level);
  },
  withScope(callback: (scope: SentryScope) => void): void {
    resolveSentryModule().withScope(callback);
  },
  setTag(key: string, value: string): void {
    resolveSentryModule().setTag(key, value);
  },
  setUser(user: SentryUser | null): void {
    resolveSentryModule().setUser(user);
  },
};
