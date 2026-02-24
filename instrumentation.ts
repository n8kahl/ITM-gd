import * as Sentry from '@sentry/nextjs'
import { validateEnv } from '@/lib/env-validation'

let sentryInitialized = false

function initializeSentry(): void {
  if (sentryInitialized) return

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  })

  sentryInitialized = true
}

export async function register() {
  validateEnv()
  initializeSentry()
}

export const onRequestError = (...args: unknown[]) => {
  const [error] = args
  if (error instanceof Error) {
    Sentry.captureException(error)
    console.error('Request error captured by instrumentation', error.message)
  }
}
