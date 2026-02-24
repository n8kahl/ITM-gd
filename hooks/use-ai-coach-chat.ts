'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  sendMessage as apiSendMessage,
  streamMessage as apiStreamMessage,
  getSessions as apiGetSessions,
  getSessionMessages as apiGetSessionMessages,
  deleteSession as apiDeleteSession,
  AICoachAPIError,
  type ChatMessageResponse,
  type ChatSession,
  type ChartTimeframe,
  type StreamDoneData,
} from '@/lib/api/ai-coach'
import type { ChartRequest } from '@/components/ai-coach/center-panel'

export const AI_COACH_CURRENT_SESSION_STORAGE_KEY = 'ai-coach-current-session-id'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  functionCalls?: ChatMessageResponse['functionCalls']
  chartRequest?: ChartRequest | null
  isOptimistic?: boolean
  isStreaming?: boolean
  streamStatus?: string
}

interface AICoachChatState {
  messages: ChatMessage[]
  sessions: ChatSession[]
  currentSessionId: string | null
  isSending: boolean
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  error: string | null
  rateLimitInfo: {
    queryCount?: number
    queryLimit?: number
    resetDate?: string
  } | null
  chartRequest: ChartRequest | null
}

export function useAICoachChat() {
  const { session } = useMemberAuth()

  const [state, setState] = useState<AICoachChatState>({
    messages: [],
    sessions: [],
    currentSessionId: null,
    isSending: false,
    isLoadingSessions: false,
    isLoadingMessages: false,
    error: null,
    rateLimitInfo: null,
    chartRequest: null,
  })

  const sendingRef = useRef(false)

  // Use a ref for the token so callbacks don't depend on the session object
  const tokenRef = useRef<string | null>(session?.access_token || null)
  tokenRef.current = session?.access_token || null

  // AbortController for cancelling in-flight requests on unmount
  const abortControllerRef = useRef<AbortController | null>(null)

  // Stable getter — never recreated
  const getToken = useCallback((): string | null => {
    return tokenRef.current
  }, [])

  const loadSessions = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setState(prev => ({ ...prev, isLoadingSessions: true, error: null }))
    try {
      const result = await apiGetSessions(token, 20)
      setState(prev => ({ ...prev, sessions: result.sessions, isLoadingSessions: false }))
    } catch (error) {
      console.error('[AI Coach] loadSessions error:', error)
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to load sessions'
      setState(prev => ({ ...prev, isLoadingSessions: false, error: message }))
    }
  }, [getToken])

  useEffect(() => {
    if (session?.access_token) { loadSessions() }
  }, [session?.access_token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (state.currentSessionId) {
      window.sessionStorage.setItem(AI_COACH_CURRENT_SESSION_STORAGE_KEY, state.currentSessionId)
    } else {
      window.sessionStorage.removeItem(AI_COACH_CURRENT_SESSION_STORAGE_KEY)
    }
  }, [state.currentSessionId])

  const currentSessionIdRef = useRef<string | null>(state.currentSessionId)
  currentSessionIdRef.current = state.currentSessionId

  // Cleanup: abort in-flight requests on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  const toFiniteNumber = useCallback((value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const normalized = value.replace(/[^0-9.+-]/g, '')
      const parsed = Number.parseFloat(normalized)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
  }, [])

  /**
   * Extract chart request from function calls
   */
  const extractChartRequest = useCallback((functionCalls: ChatMessageResponse['functionCalls']): ChartRequest | null => {
    if (!functionCalls) return null
    const showChartCall = functionCalls.find(fc => fc.function === 'show_chart')
    const gexCall = functionCalls.find(fc => fc.function === 'get_gamma_exposure')
    const spxGamePlanCall = functionCalls.find(fc => fc.function === 'get_spx_game_plan')

    const showChartArgs = showChartCall?.arguments as { symbol?: string; timeframe?: string } | undefined
    const showChartResult = showChartCall?.result as {
      symbol?: string
      timeframe?: string
      levels?: {
        resistance?: Array<{ name: string; price: number; distance?: string }>
        support?: Array<{ name: string; price: number; distance?: string }>
        indicators?: { vwap?: number; atr14?: number }
      }
    } | undefined

    const gexArgs = gexCall?.arguments as { symbol?: string } | undefined
    const gexResult = gexCall?.result as {
      symbol?: string
      spotPrice?: number
      flipPoint?: number | null
      maxGEXStrike?: number | null
      keyLevels?: Array<{ strike: number; gexValue: number; type: 'support' | 'resistance' | 'magnet' }>
    } | undefined
    const spxGamePlanResult = spxGamePlanCall?.result as {
      symbol?: string
      keyLevels?: {
        resistance?: Array<{ name: string; price: number; distance?: string }>
        support?: Array<{ name: string; price: number; distance?: string }>
        indicators?: { vwap?: number; atr14?: number }
      }
      gexProfile?: {
        symbol?: string
        spotPrice?: number
        flipPoint?: number | null
        maxGEXStrike?: number | null
        keyLevels?: Array<{ strike: number; gexValue: number; type: 'support' | 'resistance' | 'magnet' }>
      }
    } | undefined

    // Priority 1: explicit chart directives or SPX game-plan data.
    if (showChartCall || gexCall || spxGamePlanCall) {
      const symbol = showChartArgs?.symbol || showChartResult?.symbol || gexArgs?.symbol || gexResult?.symbol || spxGamePlanResult?.symbol || 'SPX'
      const timeframe = (showChartArgs?.timeframe || showChartResult?.timeframe || '5m') as ChartTimeframe
      const levels = showChartResult?.levels || spxGamePlanResult?.keyLevels
      const gexProfile = gexResult
        ? {
            symbol: gexResult.symbol || symbol,
            spotPrice: gexResult.spotPrice,
            flipPoint: gexResult.flipPoint,
            maxGEXStrike: gexResult.maxGEXStrike,
            keyLevels: gexResult.keyLevels,
          }
        : spxGamePlanResult?.gexProfile
          ? {
              symbol: spxGamePlanResult.gexProfile.symbol || symbol,
              spotPrice: spxGamePlanResult.gexProfile.spotPrice,
              flipPoint: spxGamePlanResult.gexProfile.flipPoint,
              maxGEXStrike: spxGamePlanResult.gexProfile.maxGEXStrike,
              keyLevels: spxGamePlanResult.gexProfile.keyLevels,
            }
          : undefined

      return {
        symbol,
        timeframe,
        levels,
        gexProfile,
      }
    }

    // Priority 2: key-level calls should always drive chart context.
    const keyLevelsCall = functionCalls.find(fc => fc.function === 'get_key_levels')
    if (keyLevelsCall) {
      const args = (keyLevelsCall.arguments || {}) as { symbol?: string }
      const result = (keyLevelsCall.result || {}) as {
        error?: unknown
        symbol?: string
        levels?: {
          resistance?: Array<{ name?: string; type?: string; price: number }>
          support?: Array<{ name?: string; type?: string; price: number }>
          indicators?: { vwap?: number; atr14?: number }
        }
      }
      if (!result.error) {
        return {
          symbol: result.symbol || args.symbol || 'SPX',
          timeframe: '5m',
          levels: result.levels,
        }
      }
    }

    // Priority 3: setup scan results should auto-focus chart with entry/stop/target.
    const scanCall = functionCalls.find(fc => fc.function === 'scan_opportunities')
    if (scanCall) {
      const result = (scanCall.result || {}) as {
        error?: unknown
        opportunities?: Array<{
          symbol?: string
          direction?: string
          currentPrice?: number
          suggestedTrade?: {
            entry?: number | string
            stopLoss?: number | string
            target?: number | string
          }
        }>
      }
      const top = result.opportunities?.[0]
      if (!result.error && top?.symbol) {
        const entry = toFiniteNumber(top.suggestedTrade?.entry)
        const stopLoss = toFiniteNumber(top.suggestedTrade?.stopLoss)
        const target = toFiniteNumber(top.suggestedTrade?.target)
        const spot = toFiniteNumber(top.currentPrice)
        const direction = String(top.direction || '').toLowerCase()

        const resistance: Array<{ name: string; price: number }> = []
        const support: Array<{ name: string; price: number }> = []

        if (entry != null) {
          if (direction === 'bearish') {
            resistance.push({ name: 'Entry', price: entry })
          } else {
            support.push({ name: 'Entry', price: entry })
          }
        }
        if (target != null) {
          if (entry != null && target >= entry) resistance.push({ name: 'Target', price: target })
          else support.push({ name: 'Target', price: target })
        }
        if (stopLoss != null) {
          if (entry != null && stopLoss >= entry) resistance.push({ name: 'Stop', price: stopLoss })
          else support.push({ name: 'Stop', price: stopLoss })
        }
        if (spot != null) {
          support.push({ name: 'Spot', price: spot })
        }

        return {
          symbol: top.symbol,
          timeframe: '15m',
          levels: {
            resistance,
            support,
          },
        }
      }
    }

    // Priority 4: price/options/position tools provide at least a chart focus line.
    const currentPriceCall = functionCalls.find(fc => fc.function === 'get_current_price')
    if (currentPriceCall) {
      const result = (currentPriceCall.result || {}) as {
        error?: unknown
        symbol?: string
        price?: number
        high?: number
        low?: number
      }
      if (!result.error && result.symbol) {
        const price = toFiniteNumber(result.price)
        const high = toFiniteNumber(result.high)
        const low = toFiniteNumber(result.low)
        return {
          symbol: result.symbol,
          timeframe: '5m',
          levels: {
            resistance: high != null ? [{ name: 'High', price: high }] : [],
            support: [
              ...(low != null ? [{ name: 'Low', price: low }] : []),
              ...(price != null ? [{ name: 'Spot', price }] : []),
            ],
          },
        }
      }
    }

    const optionsChainCall = functionCalls.find(fc => fc.function === 'get_options_chain')
    if (optionsChainCall) {
      const result = (optionsChainCall.result || {}) as {
        error?: unknown
        symbol?: string
        currentPrice?: number
      }
      if (!result.error && result.symbol) {
        const currentPrice = toFiniteNumber(result.currentPrice)
        return {
          symbol: result.symbol,
          timeframe: '5m',
          levels: currentPrice != null
            ? {
                support: [{ name: 'Spot', price: currentPrice }],
                resistance: [],
              }
            : undefined,
        }
      }
    }

    const positionCall = functionCalls.find(fc => fc.function === 'analyze_position')
    if (positionCall) {
      const result = (positionCall.result || {}) as {
        error?: unknown
        position?: { symbol?: string; strike?: number }
      }
      if (!result.error && result.position?.symbol) {
        const strike = toFiniteNumber(result.position.strike)
        return {
          symbol: result.position.symbol,
          timeframe: '5m',
          levels: strike != null
            ? {
                support: [{ name: 'Strike', price: strike }],
                resistance: [],
              }
            : undefined,
        }
      }
    }

    const zeroDteCall = functionCalls.find(fc => fc.function === 'get_zero_dte_analysis')
    if (zeroDteCall) {
      const result = (zeroDteCall.result || {}) as {
        error?: unknown
        symbol?: string
        expectedMove?: { currentPrice?: number }
      }
      if (!result.error && result.symbol) {
        const currentPrice = toFiniteNumber(result.expectedMove?.currentPrice)
        return {
          symbol: result.symbol,
          timeframe: '5m',
          levels: currentPrice != null
            ? {
                support: [{ name: 'Spot', price: currentPrice }],
                resistance: [],
              }
            : undefined,
        }
      }
    }

    const ivCall = functionCalls.find(fc => fc.function === 'get_iv_analysis')
    if (ivCall) {
      const result = (ivCall.result || {}) as {
        error?: unknown
        symbol?: string
        currentPrice?: number
      }
      if (!result.error && result.symbol) {
        const currentPrice = toFiniteNumber(result.currentPrice)
        return {
          symbol: result.symbol,
          timeframe: '5m',
          levels: currentPrice != null
            ? {
                support: [{ name: 'Spot', price: currentPrice }],
                resistance: [],
              }
            : undefined,
        }
      }
    }
    return null
  }, [toFiniteNumber])

  /**
   * Send message with streaming (default) or fallback to non-streaming
   */
  const sendMessage = useCallback(async (text: string, imagePayload?: { image: string; imageMimeType: string }) => {
    const token = getToken()
    if (!token || !text.trim() || sendingRef.current) return

    sendingRef.current = true

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const sessionId = currentSessionIdRef.current || crypto.randomUUID()
    const trimmedText = text.trim()

    Sentry.addBreadcrumb({
      category: 'ai-chat',
      message: 'AI chat message sent',
      level: 'info',
      data: {
        sessionId,
        messageLength: trimmedText.length,
      },
    })

    const userMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: trimmedText,
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    }

    // Create a placeholder streaming message
    const streamingMsgId = `streaming-${Date.now()}`
    const streamingMessage: ChatMessage = {
      id: streamingMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      streamStatus: 'Thinking...',
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, streamingMessage],
      currentSessionId: sessionId,
      isSending: true,
      error: null,
    }))

    try {
      let streamContent = ''
      let doneData: StreamDoneData | null = null
      let usedStreaming = false

      try {
        // Try streaming first
        for await (const event of apiStreamMessage(sessionId, trimmedText, token, controller.signal, imagePayload)) {
          usedStreaming = true

          if (event.type === 'status') {
            const status = event.data as { phase: string; function?: string; resetContent?: boolean }
            if (status.resetContent) {
              streamContent = ''
            }
            let statusText = 'Thinking...'
            if (status.phase === 'calling') statusText = `Using ${status.function}...`
            else if (status.phase === 'generating') statusText = 'Writing...'

            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m =>
                m.id === streamingMsgId ? { ...m, streamStatus: statusText } : m
              ),
            }))
          } else if (event.type === 'token') {
            const tokenData = event.data as { content: string }
            streamContent += tokenData.content

            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m =>
                m.id === streamingMsgId
                  ? { ...m, content: streamContent, streamStatus: undefined }
                  : m
              ),
            }))
          } else if (event.type === 'done') {
            doneData = event.data as StreamDoneData
          } else if (event.type === 'error') {
            const errData = event.data as { message: string }
            throw new Error(errData.message)
          }
        }
      } catch (streamError) {
        // If streaming fails and we haven't received any data, fall back to non-streaming
        if (!usedStreaming) {
          const response = await apiSendMessage(sessionId, trimmedText, token, controller.signal, imagePayload)
          streamContent = response.content
          doneData = {
            messageId: response.messageId,
            functionCalls: response.functionCalls,
            tokensUsed: response.tokensUsed,
            responseTime: response.responseTime,
          }
        } else {
          throw streamError
        }
      }

      const confirmedUserMessage: ChatMessage = { ...userMessage, isOptimistic: false }
      const newChartRequest = extractChartRequest(doneData?.functionCalls)

      const assistantMessage: ChatMessage = {
        id: doneData?.messageId || streamingMsgId,
        role: 'assistant',
        content: streamContent,
        timestamp: new Date().toISOString(),
        functionCalls: doneData?.functionCalls,
        chartRequest: newChartRequest,
        isStreaming: false,
      }

      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages.filter(m => m.id !== userMessage.id && m.id !== streamingMsgId),
          confirmedUserMessage,
          assistantMessage,
        ],
        isSending: false,
        ...(newChartRequest ? { chartRequest: newChartRequest } : {}),
      }))

      Sentry.addBreadcrumb({
        category: 'ai-chat',
        message: 'AI chat response received',
        level: 'info',
        data: {
          sessionId,
          tokensUsed: doneData?.tokensUsed,
          functionCalls: doneData?.functionCalls?.length || 0,
        },
      })

      loadSessions()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { return }

      if (error instanceof AICoachAPIError && error.isUnauthorized) {
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: 'Your session has expired. Please sign in again.',
        }))
        return
      }

      console.error('[AI Coach] sendMessage error:', error)
      Sentry.addBreadcrumb({
        category: 'ai-chat',
        message: 'AI chat send failed',
        level: 'error',
        data: {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      if (error instanceof AICoachAPIError && error.isRateLimited) {
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: error.apiError.message,
          rateLimitInfo: { queryCount: error.apiError.queryCount, queryLimit: error.apiError.queryLimit, resetDate: error.apiError.resetDate },
        }))
      } else {
        const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to send message. Please try again.'
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: message,
        }))
      }
    } finally {
      sendingRef.current = false
    }
  }, [getToken, loadSessions, extractChartRequest])

  const newSession = useCallback(() => {
    setState(prev => ({ ...prev, messages: [], currentSessionId: null, error: null, rateLimitInfo: null }))
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionIdRef.current) return
    const token = getToken()
    if (!token) return
    setState(prev => ({ ...prev, currentSessionId: sessionId, messages: [], isLoadingMessages: true, error: null }))
    try {
      const result = await apiGetSessionMessages(sessionId, token)
      const loadedMessages: ChatMessage[] = result.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          functionCalls: msg.functionCalls,
          chartRequest: msg.role === 'assistant'
            ? extractChartRequest(msg.functionCalls as ChatMessageResponse['functionCalls'])
            : null,
        }))
      setState(prev => ({ ...prev, messages: loadedMessages, isLoadingMessages: false }))
    } catch (error) {
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to load messages'
      setState(prev => ({ ...prev, isLoadingMessages: false, error: message }))
    }
  }, [getToken])

  const removeSession = useCallback(async (sessionId: string) => {
    const token = getToken()
    if (!token) return
    try {
      await apiDeleteSession(sessionId, token)
      setState(prev => {
        const updatedSessions = prev.sessions.filter(s => s.id !== sessionId)
        const isCurrentSession = prev.currentSessionId === sessionId
        return { ...prev, sessions: updatedSessions, ...(isCurrentSession ? { currentSessionId: null, messages: [] } : {}) }
      })
    } catch (error) {
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to delete session'
      setState(prev => ({ ...prev, error: message }))
    }
  }, [getToken])

  const clearError = useCallback(() => { setState(prev => ({ ...prev, error: null })) }, [])

  const appendUserMessage = useCallback((content: string) => {
    if (!content.trim()) return
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `local-user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          isOptimistic: false,
        },
      ],
    }))
  }, [])

  const appendAssistantMessage = useCallback((content: string) => {
    if (!content.trim()) return
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `local-assistant-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        },
      ],
    }))
  }, [])

  return useMemo(() => ({
    messages: state.messages, sessions: state.sessions, currentSessionId: state.currentSessionId,
    isSending: state.isSending, isLoadingSessions: state.isLoadingSessions, isLoadingMessages: state.isLoadingMessages,
    error: state.error, rateLimitInfo: state.rateLimitInfo, chartRequest: state.chartRequest,
    sendMessage, newSession, selectSession, deleteSession: removeSession, loadSessions, clearError,
    appendUserMessage, appendAssistantMessage,
  }), [
    state.messages, state.sessions, state.currentSessionId, state.isSending, state.isLoadingSessions,
    state.isLoadingMessages, state.error, state.rateLimitInfo, state.chartRequest,
    sendMessage, newSession, selectSession, removeSession, loadSessions, clearError, appendUserMessage, appendAssistantMessage,
  ])
}
