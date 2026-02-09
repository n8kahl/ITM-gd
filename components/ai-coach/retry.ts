export interface RetryContext {
  nextAttempt: number
  maxAttempts: number
  delayMs: number
  error: unknown
}

interface RunWithRetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  onRetry?: (context: RetryContext) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function runWithRetry<T>(
  task: () => Promise<T>,
  options: RunWithRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
  const baseDelayMs = Math.max(250, options.baseDelayMs ?? 800)

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break

      const nextAttempt = attempt + 1
      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      options.onRetry?.({ nextAttempt, maxAttempts, delayMs, error })
      await sleep(delayMs)
    }
  }

  throw lastError
}
