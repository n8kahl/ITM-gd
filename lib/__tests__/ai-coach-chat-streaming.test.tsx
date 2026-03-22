// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockStreamMessage,
  mockSendMessage,
  mockGetSessions,
  mockGetSessionMessages,
  mockDeleteSession,
} = vi.hoisted(() => ({
  mockStreamMessage: vi.fn(),
  mockSendMessage: vi.fn(),
  mockGetSessions: vi.fn(),
  mockGetSessionMessages: vi.fn(),
  mockDeleteSession: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
}))

vi.mock('@/contexts/MemberAuthContext', () => ({
  useMemberSession: () => ({
    session: {
      access_token: 'test-token',
    },
  }),
}))

vi.mock('@/lib/ai-coach-chart-context', () => ({
  getActiveChartSymbol: () => 'SPX',
  subscribeActiveChartSymbol: () => () => {},
}))

vi.mock('@/lib/api/ai-coach', () => {
  class MockAICoachAPIError extends Error {
    status: number
    apiError: { message: string; queryCount?: number; queryLimit?: number; resetDate?: string }
    isUnauthorized: boolean
    isRateLimited: boolean

    constructor(status: number, apiError: { message: string; queryCount?: number; queryLimit?: number; resetDate?: string }) {
      super(apiError.message)
      this.status = status
      this.apiError = apiError
      this.isUnauthorized = status === 401
      this.isRateLimited = status === 429
    }
  }

  return {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    streamMessage: (...args: unknown[]) => mockStreamMessage(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getSessionMessages: (...args: unknown[]) => mockGetSessionMessages(...args),
    deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
    AICoachAPIError: MockAICoachAPIError,
  }
})

import { useAICoachChat } from '@/hooks/use-ai-coach-chat'

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useAICoachChat streaming recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('send-1')
        .mockReturnValueOnce('session-1')
        .mockReturnValueOnce('send-2')
        .mockReturnValueOnce('session-2'),
    })
    mockGetSessions.mockResolvedValue({ sessions: [] })
    mockGetSessionMessages.mockResolvedValue({ messages: [], total: 0, hasMore: false })
    mockDeleteSession.mockResolvedValue(undefined)
    mockSendMessage.mockResolvedValue({
      messageId: 'assistant-fallback',
      content: 'Recovered full response',
      functionCalls: [],
      tokensUsed: 42,
      responseTime: 120,
    })
  })

  it('seeds image sends with an analyzing status before the first stream event arrives', async () => {
    const gate = createDeferred()

    mockStreamMessage.mockImplementationOnce(async function* () {
      await gate.promise
      yield { type: 'token', data: { content: 'Image analysis ready.' } }
      yield {
        type: 'done',
        data: {
          messageId: 'assistant-image',
          content: 'Image analysis ready.',
          functionCalls: [],
          tokensUsed: 12,
          responseTime: 40,
        },
      }
    })

    const { result } = renderHook(() => useAICoachChat())

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage(
        'Analyze this screenshot',
        { image: 'base64', imageMimeType: 'image/png' },
        { initialStreamStatus: 'Analyzing screenshot...' },
      )
    })

    await waitFor(() => {
      expect(
        result.current.messages.some(
          (message) => message.isStreaming && message.streamStatus === 'Analyzing screenshot...',
        ),
      ).toBe(true)
    })

    gate.resolve()

    await act(async () => {
      await sendPromise
    })

    expect(result.current.messages.at(-1)?.content).toBe('Image analysis ready.')
  })

  it('preserves partial streamed content when the connection drops mid-answer', async () => {
    mockStreamMessage.mockImplementationOnce(async function* () {
      yield { type: 'token', data: { content: 'Partial answer already on screen.' } }
      throw new Error('socket closed')
    })

    const { result } = renderHook(() => useAICoachChat())

    await act(async () => {
      await result.current.sendMessage('Help me with SPX')
    })

    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Response interrupted after partial output. The partial answer was preserved.')
    expect(result.current.messages.at(-1)?.content).toContain('Partial answer already on screen.')
    expect(result.current.messages.at(-1)?.content).toContain('Partial response recovered after the live stream was interrupted')
  })

  it('falls back to non-streaming when the stream dies before any content is rendered', async () => {
    mockStreamMessage.mockImplementationOnce(async function* () {
      yield { type: 'status', data: { phase: 'generating' } }
      throw new Error('stream disconnected')
    })

    const { result } = renderHook(() => useAICoachChat())

    await act(async () => {
      await result.current.sendMessage('Give me the plan')
    })

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.messages.at(-1)?.content).toBe('Recovered full response')
  })

  it('allows a second question after a recovered stream failure', async () => {
    mockStreamMessage
      .mockImplementationOnce(async function* () {
        yield { type: 'status', data: { phase: 'generating' } }
        throw new Error('stream disconnected')
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'token', data: { content: 'Second answer is complete.' } }
        yield {
          type: 'done',
          data: {
            messageId: 'assistant-second',
            content: 'Second answer is complete.',
            functionCalls: [],
            tokensUsed: 15,
            responseTime: 60,
          },
        }
      })

    const { result } = renderHook(() => useAICoachChat())

    await act(async () => {
      await result.current.sendMessage('First question')
    })

    expect(result.current.isSending).toBe(false)

    await act(async () => {
      await result.current.sendMessage('Second question')
    })

    await waitFor(() => {
      expect(result.current.messages.filter((message) => message.role === 'user').map((message) => message.content)).toEqual([
        'First question',
        'Second question',
      ])
    })

    expect(result.current.isSending).toBe(false)
    expect(result.current.messages.at(-1)?.content).toContain('Second answer is complete.')
  })
})
