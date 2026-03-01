/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplaySessionBrowser } from '@/components/spx-command-center/replay-session-browser'
import { SPXRequestError } from '@/hooks/use-spx-api'
import { publishReplayCursorTime, publishReplayTranscriptJump } from '@/lib/spx/replay-session-sync'

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
  snapshots: Array<Record<string, unknown>>
  trades: Array<{
    id: string | null
    tradeIndex: number
    contract: { symbol: string | null; strike: number | null; type: string | null; expiry: string | null }
    entry: { direction: string | null; price: number | null; timestamp: string | null; sizing: string | null }
    stop?: { initial: number | null }
    targets?: { target1: number | null; target2: number | null }
    outcome: { finalPnlPct: number | null; isWinner: boolean | null; fullyExited: boolean | null; exitTimestamp: string | null }
    entrySnapshotId?: string | null
  }>
  messages?: Array<{
    id: string | null
    authorName: string | null
    authorId: string | null
    content: string | null
    sentAt: string | null
    isSignal: boolean | null
    signalType: string | null
    parsedTradeId: string | null
  }>
  bars?: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
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

describe('spx-command-center/replay-session-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })
    mockPostSPX.mockResolvedValue({
      result: {
        id: 'result-1',
        sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        parsedTradeId: 'trade-a',
        decisionAt: '2026-03-01T14:35:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
        learnerRr: 2,
        learnerPnlPct: 12.5,
        actualPnlPct: 12.5,
        engineDirection: 'bullish',
        directionMatch: true,
        score: 100,
        feedbackSummary: 'Strong replay read.',
        createdAt: '2026-03-01T14:40:00.000Z',
      },
    })
    act(() => {
      publishReplayCursorTime(null)
      publishReplayTranscriptJump(null)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('loads admin replay channel presets and applies them into filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              key: 'trade_day_replay_channel_ids',
              value: '["channel-1","channel-2"]',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
          user: {
            app_metadata: { is_admin: true },
            user_metadata: {},
          },
        },
      },
    })

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({
          data: { count: 0, sessions: [] },
        })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-admin-channels-panel')).toBeInTheDocument()
      expect(screen.getByTestId('spx-replay-admin-channel-chip-channel-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('spx-replay-admin-channels-apply'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('channel ids (comma-separated)')).toHaveValue('channel-1,channel-2')
    })

    fetchMock.mockRestore()
  })

  it('updates detail preview when selecting a different session row', async () => {
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
      snapshots: [
        {
          id: 'snap-a-1',
          captured_at: '2026-03-01T14:40:00.000Z',
          rr_ratio: 1.35,
          ev_r: 0.42,
          mtf_1h_trend: 'up',
          env_gate_passed: true,
        },
      ],
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
      snapshots: [
        {
          id: 'snap-b-1',
          captured_at: '2026-03-01T15:00:00.000Z',
          rr_ratio: 0.85,
          ev_r: -0.2,
          mtf_1h_trend: 'down',
          env_gate_passed: false,
        },
        {
          id: 'snap-b-2',
          captured_at: '2026-03-01T15:12:00.000Z',
          rr_ratio: 2.2,
          ev_r: 0.9,
          mtf_1h_trend: 'up',
          env_gate_passed: true,
        },
      ],
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
      expect(screen.getAllByText('#1 SPX 6000 call').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByTestId(`spx-replay-session-row-${sessionB}`))

    await waitFor(() => {
      expect(screen.getAllByText('#4 SPX 6050 put').length).toBeGreaterThan(0)
    })
  })

  it('uses latest snapshot by default and allows selecting an earlier snapshot in confluence panel', async () => {
    const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.4,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:30:00.000Z',
          sessionSummary: null,
        },
      ],
    }

    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 2, trades: 1, messages: 1 },
      snapshots: [
        {
          id: 'snap-old',
          captured_at: '2026-03-01T14:40:00.000Z',
          rr_ratio: 1.1,
          ev_r: 0.25,
        },
        {
          id: 'snap-latest',
          captured_at: '2026-03-01T15:10:00.000Z',
          rr_ratio: 2.6,
          ev_r: 1.05,
        },
      ],
      trades: [
        {
          id: 'trade-x',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6020, type: 'call', expiry: '2026-03-01' },
          entry: { direction: 'long', price: 1.4, timestamp: '2026-03-01T14:45:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: 6.2, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T15:20:00.000Z' },
        },
      ],
    }

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-confluence-rr-value').textContent).toContain('2.60')
    })

    fireEvent.click(screen.getByTestId('spx-replay-confluence-snapshot-option-0'))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-confluence-rr-value').textContent).toContain('1.10')
    })
  })

  it('synchronizes confluence selection to session detail cursor state when session changes', async () => {
    const sessionA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const sessionB = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const listPayload: ReplaySessionsListResponse = {
      count: 2,
      sessions: [
        {
          sessionId: sessionA,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.3,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:00:00.000Z',
          sessionSummary: null,
        },
        {
          sessionId: sessionB,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-2', name: 'SPX Runner' },
          caller: 'Alex',
          tradeCount: 1,
          netPnlPct: 0.8,
          sessionStart: '2026-03-01T15:05:00.000Z',
          sessionEnd: '2026-03-01T15:40:00.000Z',
          sessionSummary: null,
        },
      ],
    }

    const detailForA: ReplaySessionDetailResponse = {
      sessionId: sessionA,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 2, trades: 1, messages: 0 },
      snapshots: [
        {
          id: 'snap-a-early',
          captured_at: '2026-03-01T14:35:00.000Z',
          rr_ratio: 1.05,
          ev_r: 0.1,
        },
        {
          id: 'snap-a-late',
          captured_at: '2026-03-01T14:55:00.000Z',
          rr_ratio: 2.25,
          ev_r: 0.7,
        },
      ],
      trades: [
        {
          id: 'trade-a',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6025, type: 'call', expiry: '2026-03-01' },
          entry: { direction: 'long', price: 1.1, timestamp: '2026-03-01T14:37:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: 3.4, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T14:58:00.000Z' },
        },
      ],
    }

    const detailForB: ReplaySessionDetailResponse = {
      sessionId: sessionB,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 1, trades: 1, messages: 0 },
      snapshots: [
        {
          id: 'snap-b-late',
          captured_at: '2026-03-01T15:32:00.000Z',
          rr_ratio: 3.4,
          ev_r: 1.2,
        },
      ],
      trades: [
        {
          id: 'trade-b',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6060, type: 'put', expiry: '2026-03-01' },
          entry: { direction: 'short', price: 1.8, timestamp: '2026-03-01T15:10:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: 1.2, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T15:35:00.000Z' },
        },
      ],
    }

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
      expect(screen.getByTestId('spx-replay-confluence-rr-value').textContent).toContain('2.25')
    })

    fireEvent.click(screen.getByTestId('spx-replay-confluence-snapshot-option-0'))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-confluence-rr-value').textContent).toContain('1.05')
    })

    fireEvent.click(screen.getByTestId(`spx-replay-session-row-${sessionB}`))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-confluence-rr-value').textContent).toContain('3.40')
    })
  })

  it('renders deterministic confluence empty and partial-context states', async () => {
    const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-3', name: 'SPX Review' },
          caller: 'Nate',
          tradeCount: 0,
          netPnlPct: null,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T14:30:00.000Z',
          sessionSummary: null,
        },
      ],
    }

    const missingFieldsDetail: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 1, trades: 0, messages: 0 },
      snapshots: [
        {
          id: 'snap-missing',
          captured_at: '2026-03-01T14:35:00.000Z',
          rr_ratio: 1.25,
          ev_r: null,
          mtf_1h_trend: null,
          mtf_15m_trend: null,
          mtf_5m_trend: null,
          mtf_1m_trend: null,
          mtf_aligned: null,
          mtf_composite: null,
        },
      ],
      trades: [],
    }

    const emptySnapshotsDetail: ReplaySessionDetailResponse = {
      ...missingFieldsDetail,
      snapshots: [],
      counts: { snapshots: 0, trades: 0, messages: 0 },
    }

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: missingFieldsDetail })
      }
      return createQueryResult()
    })

    const { rerender } = render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getAllByText(/Not captured for this timestamp/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/Partial context only/i)).toBeInTheDocument()
    })

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: emptySnapshotsDetail })
      }
      return createQueryResult()
    })

    rerender(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-confluence-empty')).toBeInTheDocument()
    })
  })

  it('syncs transcript focus to replay cursor time for the selected session', async () => {
    const sessionId = '11111111-aaaa-4aaa-8aaa-111111111111'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.2,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:15:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 0, trades: 0, messages: 3 },
      snapshots: [],
      trades: [],
      messages: [
        {
          id: 'm1',
          authorName: 'Nate',
          authorId: 'caller-1',
          content: 'Prep 6040C',
          sentAt: '2026-03-01T14:30:00.000Z',
          isSignal: true,
          signalType: 'prep',
          parsedTradeId: null,
        },
        {
          id: 'm2',
          authorName: 'Nate',
          authorId: 'caller-1',
          content: 'Filled AVG 1.20',
          sentAt: '2026-03-01T14:36:00.000Z',
          isSignal: true,
          signalType: 'filled_avg',
          parsedTradeId: 't1',
        },
        {
          id: 'm3',
          authorName: 'Nate',
          authorId: 'caller-1',
          content: 'Trim 25%',
          sentAt: '2026-03-01T14:42:00.000Z',
          isSignal: true,
          signalType: 'trim',
          parsedTradeId: 't1',
        },
      ],
    }

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toBeInTheDocument()
    })

    act(() => {
      publishReplayCursorTime({
        sessionId,
        cursorTimeIso: '2026-03-01T14:37:00.000Z',
        cursorTimeSec: Math.floor(Date.parse('2026-03-01T14:37:00.000Z') / 1000),
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-1')).toHaveAttribute('aria-current', 'true')
    })
  })

  it('jumps transcript focus from lifecycle/chart marker events and ignores stale session events', async () => {
    const sessionA = '22222222-aaaa-4aaa-8aaa-222222222222'
    const sessionB = '33333333-aaaa-4aaa-8aaa-333333333333'
    const listPayload: ReplaySessionsListResponse = {
      count: 2,
      sessions: [
        {
          sessionId: sessionA,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.2,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:15:00.000Z',
          sessionSummary: null,
        },
        {
          sessionId: sessionB,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-2', name: 'SPX Runner' },
          caller: 'Alex',
          tradeCount: 1,
          netPnlPct: -0.4,
          sessionStart: '2026-03-01T15:20:00.000Z',
          sessionEnd: '2026-03-01T15:50:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailForA: ReplaySessionDetailResponse = {
      sessionId: sessionA,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 0, trades: 0, messages: 2 },
      snapshots: [],
      trades: [],
      messages: [
        {
          id: 'a-1',
          authorName: 'Nate',
          authorId: 'caller-1',
          content: 'Prep A',
          sentAt: '2026-03-01T14:31:00.000Z',
          isSignal: true,
          signalType: 'prep',
          parsedTradeId: null,
        },
        {
          id: 'a-2',
          authorName: 'Nate',
          authorId: 'caller-1',
          content: 'Trim A',
          sentAt: '2026-03-01T14:44:00.000Z',
          isSignal: true,
          signalType: 'trim',
          parsedTradeId: 'a-trade',
        },
      ],
    }
    const detailForB: ReplaySessionDetailResponse = {
      sessionId: sessionB,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 0, trades: 0, messages: 2 },
      snapshots: [],
      trades: [],
      messages: [
        {
          id: 'b-1',
          authorName: 'Alex',
          authorId: 'caller-2',
          content: 'Prep B',
          sentAt: '2026-03-01T15:22:00.000Z',
          isSignal: true,
          signalType: 'prep',
          parsedTradeId: null,
        },
        {
          id: 'b-2',
          authorName: 'Alex',
          authorId: 'caller-2',
          content: 'Exit B',
          sentAt: '2026-03-01T15:36:00.000Z',
          isSignal: true,
          signalType: 'exit_above',
          parsedTradeId: 'b-trade',
        },
      ],
    }

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
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toBeInTheDocument()
    })

    act(() => {
      publishReplayTranscriptJump({
        sessionId: sessionA,
        jumpTimeIso: '2026-03-01T14:44:00.000Z',
        source: 'lifecycle_marker',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-1')).toHaveAttribute('aria-current', 'true')
    })

    fireEvent.click(screen.getByTestId(`spx-replay-session-row-${sessionB}`))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveTextContent('Prep B')
    })

    act(() => {
      publishReplayCursorTime({
        sessionId: sessionB,
        cursorTimeIso: '2026-03-01T15:23:00.000Z',
        cursorTimeSec: Math.floor(Date.parse('2026-03-01T15:23:00.000Z') / 1000),
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveAttribute('aria-current', 'true')
    })

    act(() => {
      publishReplayTranscriptJump({
        sessionId: sessionA,
        jumpTimeIso: '2026-03-01T14:44:00.000Z',
        source: 'chart_marker',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveAttribute('aria-current', 'true')
    })
  })

  it('supports drill pause and reveal flow with persisted result submission', async () => {
    const sessionId = '99999999-aaaa-4aaa-8aaa-999999999999'
    const historyMutate = vi.fn().mockResolvedValue(undefined)
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 2.4,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:20:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 1, trades: 1, messages: 0 },
      snapshots: [
        {
          id: 'snap-drill-1',
          captured_at: '2026-03-01T14:34:00.000Z',
          mtf_composite: 0.9,
          mtf_1h_trend: 'up',
        },
      ],
      trades: [
        {
          id: 'trade-a',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6030, type: 'call', expiry: '2026-03-01' },
          entry: { direction: 'long', price: 1.2, timestamp: '2026-03-01T14:35:00.000Z', sizing: 'starter' },
          stop: { initial: 0.9 },
          targets: { target1: 1.8, target2: 2.4 },
          outcome: { finalPnlPct: 12.5, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T14:58:00.000Z' },
          entrySnapshotId: 'snap-drill-1',
        },
      ],
      messages: [],
    }

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      if (endpoint?.startsWith('/api/spx/drill-results/history?')) {
        return createQueryResult({
          data: { count: 0, history: [] },
          mutate: historyMutate,
        })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getAllByText('#1 SPX 6030 call').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByTestId('spx-replay-drill-start'))
    expect(screen.getByTestId('spx-replay-drill-hidden')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('spx-replay-drill-direction-long'))
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-strike'), { target: { value: '6030' } })
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-stop'), { target: { value: '6025' } })
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-target'), { target: { value: '6040' } })
    fireEvent.click(screen.getByTestId('spx-replay-drill-reveal'))

    await waitFor(() => {
      expect(mockPostSPX).toHaveBeenCalledWith(
        '/api/spx/drill-results',
        'test-token',
        expect.objectContaining({
          sessionId,
          parsedTradeId: 'trade-a',
          direction: 'long',
          strike: 6030,
          stopLevel: 6025,
          targetLevel: 6040,
          actualPnlPct: 12.5,
          engineDirection: 'bullish',
        }),
      )
      expect(historyMutate).toHaveBeenCalled()
    })

    expect(await screen.findByTestId('spx-replay-drill-reveal-panel')).toBeInTheDocument()
    expect(screen.getByTestId('spx-replay-drill-score')).toHaveTextContent('100')
  })

  it('wires Save to Journal action to replay journal endpoint and shows deterministic success copy', async () => {
    const sessionId = '12121212-aaaa-4aaa-8aaa-121212121212'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 2.2,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:00:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 1, trades: 1, messages: 0 },
      snapshots: [
        {
          id: 'snap-1',
          captured_at: '2026-03-01T14:34:00.000Z',
          mtf_composite: 0.8,
        },
      ],
      trades: [
        {
          id: 'trade-save',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6030, type: 'call', expiry: '2026-03-01' },
          entry: { direction: 'long', price: 1.2, timestamp: '2026-03-01T14:35:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: 12.5, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T14:58:00.000Z' },
          entrySnapshotId: 'snap-1',
        },
      ],
      messages: [],
    }

    mockPostSPX.mockResolvedValueOnce({
      sessionId,
      parsedTradeId: null,
      symbol: 'SPX',
      count: 1,
      createdCount: 1,
      existingCount: 0,
      results: [],
    })

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      if (endpoint?.startsWith('/api/spx/drill-results/history?')) {
        return createQueryResult({ data: { count: 0, history: [] } })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getAllByText('#1 SPX 6030 call').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByTestId('spx-replay-save-journal-session'))

    await waitFor(() => {
      expect(mockPostSPX).toHaveBeenCalledWith(
        `/api/spx/replay-sessions/${sessionId}/journal`,
        'test-token',
        {},
      )
    })
    expect(await screen.findByTestId('spx-replay-save-journal-status')).toHaveTextContent(
      'Journal save complete: 1 new, 0 already saved.',
    )
  })

  it('guards Save to Journal against duplicate rapid submits', async () => {
    const sessionId = '34343434-aaaa-4aaa-8aaa-343434343434'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.4,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:00:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 0, trades: 1, messages: 0 },
      snapshots: [],
      trades: [
        {
          id: 'trade-lock',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6035, type: 'call', expiry: '2026-03-01' },
          entry: { direction: 'long', price: 1.1, timestamp: '2026-03-01T14:36:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: 7.5, isWinner: true, fullyExited: true, exitTimestamp: '2026-03-01T14:51:00.000Z' },
          entrySnapshotId: null,
        },
      ],
      messages: [],
    }

    let resolvePost: ((value: unknown) => void) | null = null
    mockPostSPX.mockImplementation(() => new Promise((resolve) => {
      resolvePost = resolve
    }))

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      if (endpoint?.startsWith('/api/spx/drill-results/history?')) {
        return createQueryResult({ data: { count: 0, history: [] } })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getAllByText('#1 SPX 6035 call').length).toBeGreaterThan(0)
    })

    const saveButton = screen.getByTestId('spx-replay-save-journal-session')
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPostSPX).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
      'Saving replay session trades to journal...',
    )

    await act(async () => {
      resolvePost?.({
        sessionId,
        parsedTradeId: null,
        symbol: 'SPX',
        count: 1,
        createdCount: 0,
        existingCount: 1,
        results: [],
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
        'Journal save complete: 0 new, 1 already saved.',
      )
    })
  })

  it('shows deterministic error copy when Save to Journal fails', async () => {
    const sessionId = '56565656-aaaa-4aaa-8aaa-565656565656'
    const listPayload: ReplaySessionsListResponse = {
      count: 1,
      sessions: [
        {
          sessionId,
          sessionDate: '2026-03-01',
          channel: { id: 'ch-1', name: 'SPX Premium' },
          caller: 'Nate',
          tradeCount: 1,
          netPnlPct: 1.9,
          sessionStart: '2026-03-01T14:30:00.000Z',
          sessionEnd: '2026-03-01T15:00:00.000Z',
          sessionSummary: null,
        },
      ],
    }
    const detailPayload: ReplaySessionDetailResponse = {
      sessionId,
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      counts: { snapshots: 0, trades: 1, messages: 0 },
      snapshots: [],
      trades: [
        {
          id: 'trade-error',
          tradeIndex: 1,
          contract: { symbol: 'SPX', strike: 6020, type: 'put', expiry: '2026-03-01' },
          entry: { direction: 'short', price: 1.5, timestamp: '2026-03-01T14:40:00.000Z', sizing: 'starter' },
          outcome: { finalPnlPct: -4.2, isWinner: false, fullyExited: true, exitTimestamp: '2026-03-01T14:56:00.000Z' },
          entrySnapshotId: null,
        },
      ],
      messages: [],
    }

    mockPostSPX.mockRejectedValueOnce(new Error('Unable to save replay session to journal.'))

    mockUseSPXQuery.mockImplementation((endpoint: string | null) => {
      if (endpoint === '/api/spx/replay-sessions') {
        return createQueryResult<ReplaySessionsListResponse>({ data: listPayload })
      }
      if (endpoint?.includes(`/api/spx/replay-sessions/${sessionId}`)) {
        return createQueryResult<ReplaySessionDetailResponse>({ data: detailPayload })
      }
      if (endpoint?.startsWith('/api/spx/drill-results/history?')) {
        return createQueryResult({ data: { count: 0, history: [] } })
      }
      return createQueryResult()
    })

    render(createElement(ReplaySessionBrowser))

    await waitFor(() => {
      expect(screen.getAllByText('#1 SPX 6020 put').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByTestId('spx-replay-save-journal-session'))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-save-journal-status')).toHaveTextContent(
        'Unable to save replay session to journal.',
      )
    })
  })
})
