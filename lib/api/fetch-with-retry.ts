export interface FetchRetryConfig {
  maxRetries?: number
  timeoutMs?: number
  backoffMs?: number
}

/**
 * Fetch with timeout and retry protection for transient upstream failures.
 * Retries on network errors and 5xx responses only.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: FetchRetryConfig = {},
): Promise<Response> {
  const {
    maxRetries = 3,
    timeoutMs = 10000,
    backoffMs = 1000,
  } = config

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      // Retry transient upstream/server failures.
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = backoffMs * (2 ** attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries) {
        throw error
      }
      const delay = backoffMs * (2 ** attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch after retries')
}
