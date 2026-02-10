import { describe, expect, it, vi } from 'vitest'

const mockToastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

import {
  createAppError,
  createAppErrorFromResponse,
  notifyAppError,
  withExponentialBackoff,
} from '@/lib/error-handler'

describe('createAppErrorFromResponse', () => {
  it('categorizes 429 responses and preserves retry-after', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '7',
        },
      },
    )

    const appError = await createAppErrorFromResponse(response)
    expect(appError.category).toBe('rate_limit')
    expect(appError.retryAfterSeconds).toBe(7)
    expect(appError.message).toBe('Too many requests')
  })

  it('categorizes 500 responses as server errors', async () => {
    const response = new Response(JSON.stringify({ message: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })

    const appError = await createAppErrorFromResponse(response)
    expect(appError.category).toBe('server')
    expect(appError.status).toBe(500)
  })

  it('categorizes 400 responses as validation errors', async () => {
    const response = new Response(JSON.stringify({ message: 'Invalid payload' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })

    const appError = await createAppErrorFromResponse(response)
    expect(appError.category).toBe('validation')
  })

  it('categorizes 401 responses as permission errors', async () => {
    const response = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })

    const appError = await createAppErrorFromResponse(response)
    expect(appError.category).toBe('permission')
  })
})

describe('createAppError', () => {
  it('categorizes network fetch failures', () => {
    const appError = createAppError(new Error('Failed to fetch upstream'))
    expect(appError.category).toBe('network')
  })

  it('defaults unknown values to unknown category', () => {
    const appError = createAppError({ foo: 'bar' })
    expect(appError.category).toBe('unknown')
  })

  it('maps string errors to unknown category', () => {
    const appError = createAppError('raw failure')
    expect(appError.category).toBe('unknown')
    expect(appError.message).toBe('raw failure')
  })
})

describe('notifyAppError', () => {
  it('emits a toast with retry context for rate limit errors', () => {
    notifyAppError({
      category: 'rate_limit',
      message: 'Too many requests',
      retryAfterSeconds: 12,
    })

    expect(mockToastError).toHaveBeenCalled()
  })
})

describe('withExponentialBackoff', () => {
  it('retries and eventually succeeds', async () => {
    const operation = vi.fn()
    operation.mockRejectedValueOnce(new Error('temporary'))
    operation.mockResolvedValueOnce('ok')

    const result = await withExponentialBackoff(operation, { retries: 2, baseDelayMs: 0 })

    expect(result).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries are exhausted', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('still failing'))

    await expect(
      withExponentialBackoff(operation, { retries: 1, baseDelayMs: 0 }),
    ).rejects.toThrow('still failing')
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
