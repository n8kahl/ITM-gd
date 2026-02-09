import { toast } from 'sonner'

export type AppErrorCategory =
  | 'network'
  | 'server'
  | 'permission'
  | 'rate_limit'
  | 'validation'
  | 'unknown'

export interface AppError {
  category: AppErrorCategory
  message: string
  status?: number
  retryAfterSeconds?: number
  raw?: unknown
}

interface ErrorResponseShape {
  error?: string
  message?: string
  retryAfterSeconds?: number
  retry_after_seconds?: number
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const maybeBody = body as ErrorResponseShape
  const value = maybeBody.error || maybeBody.message
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function extractRetryAfterSeconds(response: Response, body: unknown): number | undefined {
  const headerValue = response.headers.get('retry-after')
  const fromHeader = headerValue ? Number(headerValue) : NaN
  if (Number.isFinite(fromHeader) && fromHeader > 0) {
    return Math.ceil(fromHeader)
  }

  if (body && typeof body === 'object') {
    const payload = body as ErrorResponseShape
    if (Number.isFinite(payload.retryAfterSeconds) && (payload.retryAfterSeconds as number) > 0) {
      return Math.ceil(payload.retryAfterSeconds as number)
    }
    if (Number.isFinite(payload.retry_after_seconds) && (payload.retry_after_seconds as number) > 0) {
      return Math.ceil(payload.retry_after_seconds as number)
    }
  }

  return undefined
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    try {
      return await response.clone().text()
    } catch {
      return null
    }
  }
}

export async function createAppErrorFromResponse(response: Response): Promise<AppError> {
  const body = await readErrorBody(response)
  const fallbackMessage = `Request failed (${response.status})`
  const message = extractMessage(body) || fallbackMessage
  const retryAfterSeconds = extractRetryAfterSeconds(response, body)

  if (response.status === 400) {
    return { category: 'validation', message, status: response.status, raw: body }
  }
  if (response.status === 401 || response.status === 403) {
    return { category: 'permission', message, status: response.status, raw: body }
  }
  if (response.status === 429) {
    return {
      category: 'rate_limit',
      message,
      status: response.status,
      retryAfterSeconds,
      raw: body,
    }
  }
  if (response.status >= 500) {
    return { category: 'server', message, status: response.status, raw: body }
  }
  return { category: 'unknown', message, status: response.status, raw: body }
}

export function createAppError(error: unknown): AppError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()

    if (
      msg.includes('network')
      || msg.includes('failed to fetch')
      || msg.includes('load failed')
      || msg.includes('timed out')
    ) {
      return { category: 'network', message: error.message, raw: error }
    }
    return { category: 'unknown', message: error.message, raw: error }
  }

  if (typeof error === 'string') {
    return { category: 'unknown', message: error, raw: error }
  }

  return { category: 'unknown', message: 'An unexpected error occurred.', raw: error }
}

function titleForCategory(category: AppErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Network error'
    case 'server':
      return 'Server error'
    case 'permission':
      return 'Permission error'
    case 'rate_limit':
      return 'Rate limit reached'
    case 'validation':
      return 'Validation error'
    default:
      return 'Something went wrong'
  }
}

function descriptionForError(appError: AppError): string {
  if (appError.category === 'rate_limit' && appError.retryAfterSeconds) {
    return `${appError.message} Try again in ${appError.retryAfterSeconds}s.`
  }
  return appError.message
}

interface NotifyAppErrorOptions {
  onRetry?: () => void
  retryLabel?: string
}

export function notifyAppError(error: AppError, options?: NotifyAppErrorOptions) {
  toast.error(titleForCategory(error.category), {
    description: descriptionForError(error),
    action: options?.onRetry
      ? {
          label: options.retryLabel || 'Retry',
          onClick: options.onRetry,
        }
      : undefined,
  })
}

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const retries = options?.retries ?? 2
  const baseDelayMs = options?.baseDelayMs ?? 400

  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= retries) {
        throw error
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempt += 1
    }
  }
}
