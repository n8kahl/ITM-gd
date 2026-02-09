import * as Sentry from '@sentry/node';
import { Application } from 'express';

/**
 * Initialize Sentry for the Express backend.
 * Must be called BEFORE any other middleware or route registration.
 */
export function initSentry(app: Application): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: `titm-backend@${process.env.npm_package_version || '1.0.0'}`,

    // Performance monitoring: sample 20% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Filter out noisy or irrelevant errors
    ignoreErrors: [
      'CORS: Origin',
      'Rate limit exceeded',
      'Request timeout',
    ],

    beforeSend(event: any) {
      // Strip any sensitive headers that might leak into error reports
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  // Instrument Express for automatic request tracing
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Flush pending Sentry events before process exit.
 * Call this during graceful shutdown.
 */
export async function flushSentry(): Promise<void> {
  await Sentry.close(2000);
}

export { Sentry };
