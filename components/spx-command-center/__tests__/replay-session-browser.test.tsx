/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplaySessionBrowser } from '@/components/spx-command-center/replay-session-browser'
import { SPXRequestError } from '@/hooks/use-spx-api'

type QueryResult<T> = {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
  hasSession: boolean
}

type ReplaySessionsListResponse = {
  count: number
  sessions: Array<{
    sessionId: string
    sessionDate: string | null
    channel: { id: string | null; name: string | null }
    caller: string | null
    tradeCount: number
    netPnlPct: number | null
    sessionStart: string | null
    sessionEnd: string | null
    sessionSummary: string | null
  }>
}

type ReplaySessionDetailResponse = {
  sessionId: string
  sessionDate: string | null
  symbol: string | null
  counts: {
    snapshots: number
    trades: number
    messages: number
  }
  trades: Array<{
    id: string | null
    tradeIndex: number
    contract: { symbol: string | null; strike: number | null; type: string | null; expiry: string | null }
    entry: { direction: string | null; price: number | null; timestamp: string | null; sizing: string | null }
    outcome: { finalPnlPct: number | null; isWinner: boolean | null; fullyExited: boolean | null; exitTimestamp: string | null }
  }>
}

const { mockUseSPXQuery, mockPostSPX, mockGetSession } = vi.hoisted(() => ({
  mockUseSPXQuery: vi.fn(),
  mockPostSPX: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('@/hooks/use-spx-api', () => {
  class MockSPXRequestError extends Error {
    readonly status: number
    readonly endpoint: string

    constructor(message: string, status: number, endpoint: string) {
      super(message)
      this.name = 'SPXRequestError'
      this.status = status
      this.endpoint = endpoint
    }
  }

  return {
    SPXRequestError: MockSPXRequestError,
    useSPXQuery: (...args: unknown[]) => mockUseSPXQuery(...args),
    postSPX: (...args: unknown[]) => mockPostSPX(...args),
  }
})

vi.mock('@/lib/supabase-browser', () => ({
  createBrowserSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  }),
}))

function createQueryResult<T>(overrides: Partial<QueryResult<T>> = {}): QueryResult<T> {
  return {
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: async () => undefined,
    hasSession: true,
    ...overrides,
  }
}

function buildSessionFixtures() {
  const sessionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const sessionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  const listPayload: ReplaySessionsListResponse = {
    count: 2,
    sessions: [
      {
        sessionId: sessionA,
        sessionDate: '2026-03-01',
        channel: { id: 'ch-1', name: 'SPX Premium' },
        caller: 'Nate',
        tradeCount: 1,
        netPnlPct: 1.1,
        sessionStart: '2026-03-01T14:30:00.000Z',
        sessionEnd: '2026-03-01T15:00:00.000Z',
        sessionSummary: null,
      },
      {
        sessionId: sessionB,
        sessionDate: '2026-03-01',
        channel: { id: 'ch-2', name: 'SPX Runner' },
        caller: 'Alex',
        tradeCount: 2,
        netPnlPct: 2.2,
        sessionStart: '2026-03-01T14:30:00.000Z',
        sessionEnd: '2026-03-01T16:00:00.000Z',
        sessionSummary: null,
      },
    ],
  }

  const detailForA: ReplaySessionDetailResponse = {
    sessionId: sessionA,
    sessionDate: '2026-03-01',
    symbol: 'SPX',
    counts: { snapshots: 1, trades: 1, messages: 1 },
    trades: [
      {
        id: 'trade-a',
        tradeIndex: 1,
        contract: { symbol: 'SPX', strike: 6000, type: 'call', expiry: '2026-03-01' },
        entry: { direction: 'long', price: 1.2, timestamp: '2026-03-01T14:35:00.000Z', sizing: 'starter' },
        outcome: { finalPnlPct: 5.5, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T14:50:00.000Z' },
      },
    ],
  }

  const detailForB: ReplaySessionDetailResponse = {
    sessionId: sessionB,
    sessionDate: '2026-03-01',
    symbol: 'SPX',
    counts: { snapshots: 2, trades: 2, messages: 3 },
    trades: [
      {
        id: 'trade-b',
        tradeIndex: 4,
        contract: { symbol: 'SPX', strike: 6050, type: 'put', expiry: '2026-03-01' },
        entry: { direction: 'short', price: 2.4, timestamp: '2026-03-01T15:05:00.000Z', sizing: 'add' },
        outcome: { finalPnlPct: -8.4, isWinner: false, fullyExited: true, exitTimestamp: '2026-03-01T15:20:00.000Z' },
      },
    ],
  }

  return { sessionA, sessionB, listPayload, detailForA, detailForB }
}

describe('spx-command-center/replay-session-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })
    mockPostSPX.mockResolvedValue({
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      parsedTradeId: null,
      symbol: 'SPX',
      count: 1,
      createdCount: 1,
      existingCount: 0,
      results: [],
    })
  })

  it('shows admin-only copy on 403 list response', async () => {
    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (typeof endpoint === 'string' && endpoint.startsWith('/api/spx/replay-sessions')) {
        return createQueryResult<ReplaySessionsListResponse>({
          error: new SPXRequestError('Forbidden', 403, endpoint),
        })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    expect(await screen.findByText(/available to backend admins only/i)).toBeInTheDocument()
  })

  it('updates detail preview when selecting a different session row', async () => {
    const { sessionA, sessionB, listPayload, detailForA, detailForB } = buildSessionFixtures()

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionA}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailForA })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionB}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailForB })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByText('#1 SPX 6000 call')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(`spx-replay-session-row-${sessionB}`))

    await waitFor(() => {
      expect(screen.getByText('#4 SPX 6050 put')).toBeInTheDocument()
    })
  })

  it('wires session save-to-journal action with deterministic success copy', async () => {
    const { sessionA, listPayload, detailForA } = buildSessionFixtures()

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionA}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailForA })
      }
      return createQueryResult()
    })

    mockPostSPX.mockResolvedValueOnce({
      sessionId: sessionA,
      parsedTradeId: null,
      symbol: 'SPX',
      count: 1,
      createdCount: 1,
      existingCount: 0,
      results: [],
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByText('#1 SPX 6000 call')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('spx-replay-save-journal-session'))

    await waitFor(() => {
      expect(mockPostSPX).toHaveBeenCalledWith(
        `/api/spx/replay-sessions/${sessionA}/journal`,
        'test-token',
        {},
      )
      expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
        'Journal save complete: 1 new, 0 already saved.',
      )
    })
  })

  it('guards against duplicate rapid journal submits', async () => {
    const { sessionA, listPayload, detailForA } = buildSessionFixtures()

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionA}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailForA })
      }
      return createQueryResult()
    })

    let resolvePost: ((value: unknown) => void) | null = null
    mockPostSPX.mockReturnValueOnce(new Promise((resolve) => {
      resolvePost = resolve
    }))

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-session')).toBeInTheDocument()
    })

    const button = screen.getByTestId('spx-replay-save-journal-session')
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockPostSPX).toHaveBeenCalledTimes(1)
    })

    resolvePost?.({
      sessionId: sessionA,
      parsedTradeId: null,
      symbol: 'SPX',
      count: 1,
      createdCount: 0,
      existingCount: 1,
      results: [],
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
        'Journal save complete: 0 new, 1 already saved.',
      )
    })
  })

  it('surfaces deterministic replay journal error copy', async () => {
    const { sessionA, listPayload, detailForA } = buildSessionFixtures()

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionA}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailForA })
      }
      return createQueryResult()
    })

    mockPostSPX.mockRejectedValueOnce(new Error('Unable to save replay journal entries.'))

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-session')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('spx-replay-save-journal-session'))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
        'Unable to save replay journal entries.',
      )
    })
  })
})
