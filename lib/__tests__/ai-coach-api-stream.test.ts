import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/browser-auth', () => ({
  refreshBrowserAccessToken: vi.fn().mockResolvedValue(null),
}))

import { streamMessage } from '@/lib/api/ai-coach'

describe('AI Coach stream client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('times out when the SSE stream stalls between events', async () => {
    const encoder = new TextEncoder()
    const releaseLock = vi.fn()
    const read = vi.fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('event: status\ndata: {"phase":"generating"}\n\n'),
      })
      .mockImplementationOnce(() => new Promise(() => {}))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read,
          releaseLock,
        }),
      },
    }))

    const iterator = streamMessage('session-1', 'Analyze SPX', 'token-1')

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: {
        type: 'status',
        data: { phase: 'generating' },
      },
    })

    const nextEventPromise = iterator.next()
    void nextEventPromise.catch(() => undefined)
    await vi.advanceTimersByTimeAsync(20_001)

    await expect(nextEventPromise).rejects.toThrow('AI Coach stream timed out while waiting for the next event.')
    expect(releaseLock).toHaveBeenCalled()
  })
})
