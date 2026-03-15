/* @vitest-environment jsdom */

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUseMoneyMaker,
  mockUseMemberAuth,
} = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockUseMemberAuth: vi.fn(),
}))

vi.mock('@/components/money-maker/money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('@/contexts/MemberAuthContext', () => ({
  useMemberSession: (...args: unknown[]) => mockUseMemberAuth(...args),
}))

import { useMoneyMakerPolling } from '@/hooks/use-money-maker-polling'

function Harness() {
  useMoneyMakerPolling()
  return null
}

describe('useMoneyMakerPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseMemberAuth.mockReturnValue({
      session: { access_token: 'member-token' },
    })
    mockUseMoneyMaker.mockReturnValue({
      setSymbols: vi.fn(),
      setSignals: vi.fn(),
      setSymbolSnapshots: vi.fn(),
      setIsLoading: vi.fn(),
      setIsRefreshing: vi.fn(),
      setError: vi.fn(),
      setLastUpdated: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not start a second snapshot request while one is already in flight', async () => {
    let resolveSnapshot!: (value: Response) => void
    const snapshotPromise = new Promise<Response>((resolve) => {
      resolveSnapshot = resolve
    })
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/watchlist')) {
        return Promise.resolve(new Response(JSON.stringify({
          watchlists: [{ symbol: 'SPY' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      if (url.includes('/snapshot')) {
        return snapshotPromise
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    await act(async () => {
      await Promise.resolve()
    })

    const snapshotCallsBeforeInterval = fetchMock.mock.calls.filter(([input]) => String(input).includes('/snapshot'))
    expect(snapshotCallsBeforeInterval).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      await Promise.resolve()
    })

    const snapshotCallsAfterInterval = fetchMock.mock.calls.filter(([input]) => String(input).includes('/snapshot'))
    expect(snapshotCallsAfterInterval).toHaveLength(1)

    resolveSnapshot(new Response(JSON.stringify({
      signals: [],
      symbolSnapshots: [],
      timestamp: 1773163800000,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await act(async () => {
      await snapshotPromise
      await Promise.resolve()
    })
  })
})
