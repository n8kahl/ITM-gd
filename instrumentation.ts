export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = (...args: unknown[]) => {
  // Dynamic import to avoid bundling issues
  import('@sentry/nextjs').then((Sentry) => {
    // @ts-expect-error Sentry's captureRequestError accepts spread args
    Sentry.captureRequestError(...args);
  });
};
