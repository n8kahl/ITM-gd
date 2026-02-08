import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for debugging production errors
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Only send errors in production, or when DSN is explicitly set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV || 'development',

  // Filter noisy client-side errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Load failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
  ],

  integrations: [
    Sentry.replayIntegration(),
  ],
});
