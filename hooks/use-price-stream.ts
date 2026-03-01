'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

export interface PriceUpdate {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number
  timestamp: string
  source?: 'tick' | 'poll' | 'snapshot'
  feedAgeMs?: number
}

export interface MarketStatusUpdate {
  status: 'open' | 'pre-market' | 'after-hours' | 'closed'
  session: string
  message: string
}

export type PriceStreamConnectionStatus = 'connected' | 'reconnecting' | 'degraded' | 'disconnected'
export type PriceStreamFeedHealthStatus = 'connected' | 'degraded' | 'disconnected'

export interface PriceStreamFeedHealth {
  status: PriceStreamFeedHealthStatus
  source: 'tick' | 'poll' | 'snapshot' | null
  staleMs: number | null
  message: string | null
  lastTickTimestamp: string | null
  updatedAt: string
}

interface PriceStreamState {
  prices: Map<string, PriceUpdate>
  marketStatus: MarketStatusUpdate | null
  isConnected: boolean
  connectionStatus: PriceStreamConnectionStatus
  feedHealth: PriceStreamFeedHealth | null
  error: string | null
}

export interface RealtimeSocketMessage {
  type?: string
  channel?: string
  [key: string]: unknown
}

interface UsePriceStreamOptions {
  channels?: string[]
  onMessage?: (message: RealtimeSocketMessage) => void
}

interface StreamConsumer {
  enabled: boolean
  token: string | null
  symbols: Set<string>
  channels: Set<string>
  onMessage?: (message: RealtimeSocketMessage) => void
  listener: (state: PriceStreamState) => void
}

const MARKET_STATUS_VALUES: MarketStatusUpdate['status'][] = ['open', 'pre-market', 'after-hours', 'closed']
const PRICE_STREAM_DEBUG_STORAGE_KEY = 'titm:debug:price-stream'

function normalizeMarketStatus(value: unknown): MarketStatusUpdate['status'] {
  if (typeof value !== 'string') return 'closed'
  return (MARKET_STATUS_VALUES as string[]).includes(value) ? (value as MarketStatusUpdate['status']) : 'closed'
}

function getPriceStreamDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false

  if (process.env.NEXT_PUBLIC_DEBUG_PRICE_STREAM === 'true') {
    return true
  }

  try {
    return window.localStorage.getItem(PRICE_STREAM_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function redactWsUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.searchParams.has('token')) {
      url.searchParams.set('token', '<redacted>')
    }
    return url.toString()
  } catch {
    return raw
  }
}

function debugPriceStream(message: string, details?: Record<string, unknown>): void {
  if (!getPriceStreamDebugEnabled()) return
  if (details) {
    console.info(`[price-stream] ${message}`, details)
    return
  }
  console.info(`[price-stream] ${message}`)
}

function applyReconnectJitter(delayMs: number): number {
  const multiplier = 0.7 + (Math.random() * 0.6)
  return Math.max(0, Math.round(delayMs * multiplier))
}

// ============================================
// SHARED STREAM SINGLETON
// ============================================

const streamConsumers = new Map<number, StreamConsumer>()
let nextConsumerId = 1
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsReconnectAttempt = 0
let wsConsecutiveConnectFailures = 0
let wsRetryPausedUntil = 0
let wsNextConnectAt = 0
let activeStreamToken: string | null = null
let subscribedSymbols = new Set<string>()
let subscribedChannels = new Set<string>()
const WS_CLOSE_UNAUTHORIZED = 4401
const WS_CLOSE_FORBIDDEN = 4403
const WS_FAILURE_THRESHOLD = 5
const WS_RETRY_PAUSE_MS = 30_000
const WS_MIN_CONNECT_INTERVAL_MS = 15_000

const sharedState: PriceStreamState = {
  prices: new Map(),
  marketStatus: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  feedHealth: null,
  error: null,
}
let notifyRafId: number | null = null

function cloneState(): PriceStreamState {
  return {
    prices: new Map(sharedState.prices),
    marketStatus: sharedState.marketStatus,
    isConnected: sharedState.isConnected,
    connectionStatus: sharedState.connectionStatus,
    feedHealth: sharedState.feedHealth,
    error: sharedState.error,
  }
}

function flushConsumerNotification(): void {
  const snapshot = cloneState()
  for (const consumer of streamConsumers.values()) {
    consumer.listener(snapshot)
  }
}

function notifyConsumers(options?: { immediate?: boolean }): void {
  const immediate = options?.immediate === true || typeof window === 'undefined'
  if (immediate) {
    if (notifyRafId != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(notifyRafId)
      notifyRafId = null
    }
    flushConsumerNotification()
    return
  }

  if (notifyRafId != null) return
  notifyRafId = window.requestAnimationFrame(() => {
    notifyRafId = null
    flushConsumerNotification()
  })
}

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(new Set(
    symbols
      .filter((symbol) => typeof symbol === 'string' && symbol.trim().length > 0)
      .map((symbol) => symbol.trim().toUpperCase()),
  ))
}

function normalizeChannels(channels: string[]): string[] {
  return Array.from(new Set(
    channels
      .filter((channel) => typeof channel === 'string' && channel.trim().length > 0)
      .map((channel) => channel.trim().toLowerCase()),
  ))
}

function buildSignature(values: string[]): string {
  if (values.length === 0) return ''
  return [...values].sort().join('|')
}

function resolveRealtimeBackendUrl(): URL | null {
  const configured = (
    process.env.NEXT_PUBLIC_SPX_BACKEND_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).trim()

  if (!configured) return null

  let normalized = configured
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }

  const isLocalHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname.toLowerCase())

  // Keep local websocket/data paths local on localhost unless explicitly forced remote.
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'
  if (
    isLocalHost &&
    preferLocalInDev &&
    /railway\.app/i.test(normalized)
  ) {
    normalized = 'http://localhost:3001'
  }

  try {
    return new URL(normalized)
  } catch {
    return null
  }
}

function buildWebSocketUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const backendUrl = resolveRealtimeBackendUrl()

  if (backendUrl) {
    const backendProtocol = backendUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = new URL(`${backendProtocol}//${backendUrl.host}/ws/prices`)
    wsUrl.searchParams.set('token', token)
    return wsUrl.toString()
  }

  const wsUrl = new URL(`${protocol}//${window.location.host}/ws/prices`)
  wsUrl.searchParams.set('token', token)
  return wsUrl.toString()
}

function getActiveConsumers(): StreamConsumer[] {
  return Array.from(streamConsumers.values()).filter((consumer) => consumer.enabled)
}

function getDesiredSymbols(): Set<string> {
  const symbols = new Set<string>()
  for (const consumer of getActiveConsumers()) {
    for (const symbol of consumer.symbols) symbols.add(symbol)
  }
  return symbols
}

function getDesiredChannels(): Set<string> {
  const channels = new Set<string>()
  for (const consumer of getActiveConsumers()) {
    for (const channel of consumer.channels) channels.add(channel)
  }
  return channels
}

function getActiveToken(): string | null {
  const active = getActiveConsumers().find((consumer) => typeof consumer.token === 'string' && consumer.token.length > 0)
  return active?.token || null
}

function hasEnabledConsumerWithoutToken(): boolean {
  return getActiveConsumers().some((consumer) => !consumer.token)
}

function normalizePriceSource(value: unknown): 'tick' | 'poll' | 'snapshot' | null {
  if (value === 'tick' || value === 'poll' || value === 'snapshot') return value
  return null
}

function toFiniteNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed))
    }
  }
  return null
}

function parseFeedHealthMessage(message: RealtimeSocketMessage): PriceStreamFeedHealth | null {
  if (message.type !== 'feed_health') return null

  const payload = (() => {
    if (message.data && typeof message.data === 'object' && !Array.isArray(message.data)) {
      return message.data as Record<string, unknown>
    }
    if (message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload)) {
      return message.payload as Record<string, unknown>
    }
    return message as Record<string, unknown>
  })()

  const statusRaw = typeof payload.status === 'string'
    ? payload.status.toLowerCase()
    : typeof payload.health === 'string'
      ? payload.health.toLowerCase()
      : null
  const pollModeRaw = typeof payload.pollMode === 'string'
    ? payload.pollMode.toLowerCase()
    : null
  const tickFeedActive = payload.tickFeedActive === true

  let status: PriceStreamFeedHealthStatus | null = null
  if (statusRaw === 'connected' || statusRaw === 'live' || statusRaw === 'healthy') {
    status = 'connected'
  } else if (
    statusRaw === 'degraded'
    || statusRaw === 'delayed'
    || statusRaw === 'stale'
    || statusRaw === 'poll_fallback'
    || statusRaw === 'snapshot_fallback'
    || statusRaw === 'degraded_poll'
  ) {
    status = 'degraded'
  } else if (
    statusRaw === 'disconnected'
    || statusRaw === 'offline'
    || statusRaw === 'reconnecting'
    || statusRaw === 'error'
  ) {
    status = 'disconnected'
  }
  if (!status) {
    if (pollModeRaw === 'degraded_poll') {
      status = 'degraded'
    } else if (pollModeRaw === 'tick' || pollModeRaw === 'extended' || tickFeedActive) {
      status = 'connected'
    } else if (pollModeRaw === 'closed') {
      status = 'disconnected'
    }
  }
  if (!status) return null

  const lastTickTimestamp = typeof payload.lastTickTimestamp === 'string'
    ? payload.lastTickTimestamp
    : typeof payload.lastTickAt === 'string'
      ? payload.lastTickAt
      : typeof payload.timestamp === 'string'
        ? payload.timestamp
        : null

  const messageText = typeof payload.message === 'string'
    ? payload.message
    : typeof payload.reason === 'string'
      ? payload.reason
      : null
  const source = normalizePriceSource(payload.source)
    ?? (pollModeRaw === 'degraded_poll'
      ? 'poll'
      : pollModeRaw === 'tick' || pollModeRaw === 'extended'
        ? 'tick'
        : null)

  return {
    status,
    source,
    staleMs: toFiniteNonNegativeInteger(payload.staleMs ?? payload.feedAgeMs ?? payload.lastTickAgeMs),
    message: messageText ?? (pollModeRaw === 'degraded_poll' ? 'Tick feed degraded' : null),
    lastTickTimestamp,
    updatedAt: new Date().toISOString(),
  }
}

function shouldMaintainConnection(): boolean {
  return getActiveConsumers().some((consumer) => !!consumer.token)
}

function sendWsMessage(payload: Record<string, unknown>): void {
  if (ws?.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

function clearReconnectTimer(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
}

function ensureRetryTimer(delayMs: number): void {
  if (!shouldMaintainConnection()) return
  if (wsReconnectTimer) return
  const safeDelay = Math.max(0, delayMs)
  if (!sharedState.isConnected) {
    sharedState.connectionStatus = 'reconnecting'
  }
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    ensureSocketConnection()
  }, safeDelay)
}

function scheduleReconnect(): void {
  if (!shouldMaintainConnection()) return
  if (Date.now() < wsRetryPausedUntil) return
  clearReconnectTimer()
  sharedState.connectionStatus = 'reconnecting'
  const now = Date.now()
  const backoffDelay = Math.min(1000 * (2 ** wsReconnectAttempt), 30000)
  const jitteredBackoffDelay = applyReconnectJitter(backoffDelay)
  const targetConnectAt = Math.max(wsNextConnectAt, now + jitteredBackoffDelay)
  const delay = Math.max(targetConnectAt - now, 0)
  wsNextConnectAt = targetConnectAt
  debugPriceStream('Scheduling reconnect', {
    delayMs: delay,
    backoffDelayMs: backoffDelay,
    jitteredBackoffDelayMs: jitteredBackoffDelay,
    attempt: wsReconnectAttempt + 1,
  })
  wsReconnectAttempt += 1
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    ensureSocketConnection()
  }, delay)
}

function disconnectSocket(): void {
  clearReconnectTimer()
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    ws.close()
    ws = null
  }
  subscribedSymbols = new Set()
  subscribedChannels = new Set()
  sharedState.isConnected = false
  sharedState.connectionStatus = 'disconnected'
}

function notifyChannelConsumers(message: RealtimeSocketMessage): void {
  for (const consumer of getActiveConsumers()) {
    if (!consumer.onMessage) continue
    if (consumer.channels.size === 0) {
      consumer.onMessage(message)
      continue
    }
    const channel = typeof message.channel === 'string' ? message.channel : null
    if (channel && consumer.channels.has(channel.toLowerCase())) {
      consumer.onMessage(message)
    }
  }
}

function handleSocketMessage(event: MessageEvent<string>): void {
  try {
    const message = JSON.parse(event.data) as RealtimeSocketMessage

    const feedHealth = parseFeedHealthMessage(message)
    if (feedHealth) {
      sharedState.feedHealth = feedHealth
      if (sharedState.isConnected) {
        sharedState.connectionStatus = feedHealth.status === 'connected'
          ? 'connected'
          : feedHealth.status === 'degraded'
            ? 'degraded'
            : 'reconnecting'
      } else if (feedHealth.status === 'disconnected') {
        sharedState.connectionStatus = 'reconnecting'
      } else if (feedHealth.status === 'degraded') {
        sharedState.connectionStatus = 'degraded'
      }
      notifyConsumers()
      notifyChannelConsumers(message)
      return
    }

    if (message.type === 'price' && typeof message.symbol === 'string') {
      const timestamp = typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString()
      const source = message.source === 'tick' || message.source === 'poll' || message.source === 'snapshot'
        ? message.source
        : undefined
      const feedAgeFromPayload = typeof message.feedAgeMs === 'number' && Number.isFinite(message.feedAgeMs)
        ? Math.max(0, Math.floor(message.feedAgeMs))
        : null
      const parsedTimestamp = Date.parse(timestamp)
      const computedFeedAgeMs = Number.isFinite(parsedTimestamp)
        ? Math.max(0, Date.now() - parsedTimestamp)
        : undefined
      const resolvedFeedAgeMs = feedAgeFromPayload ?? computedFeedAgeMs
      sharedState.prices.set(message.symbol, {
        symbol: message.symbol,
        price: Number(message.price || 0),
        change: Number(message.change || 0),
        changePct: Number(message.changePct || 0),
        volume: Number(message.volume || 0),
        timestamp,
        source,
        feedAgeMs: resolvedFeedAgeMs,
      })
      if (source === 'tick' && sharedState.isConnected && (resolvedFeedAgeMs ?? Number.POSITIVE_INFINITY) <= 5_000) {
        sharedState.connectionStatus = 'connected'
      }
      notifyConsumers()
      notifyChannelConsumers(message)
      return
    }

    if (message.type === 'status') {
      const statusValue = message.status || message.marketStatus
      sharedState.marketStatus = {
        status: normalizeMarketStatus(statusValue),
        session: typeof message.session === 'string' ? message.session : 'none',
        message: typeof message.message === 'string' ? message.message : '',
      }
      notifyConsumers()
      notifyChannelConsumers(message)
      return
    }

    notifyChannelConsumers(message)
  } catch {
    // Ignore malformed messages.
  }
}

function reconcileSymbolSubscriptions(previousDesiredSymbols: Set<string>, nextDesiredSymbols: Set<string>): void {
  const toSubscribe: string[] = []
  const toUnsubscribe: string[] = []

  for (const symbol of nextDesiredSymbols) {
    if (!previousDesiredSymbols.has(symbol)) toSubscribe.push(symbol)
  }
  for (const symbol of previousDesiredSymbols) {
    if (!nextDesiredSymbols.has(symbol)) toUnsubscribe.push(symbol)
  }

  if (toUnsubscribe.length > 0) {
    sendWsMessage({ type: 'unsubscribe', symbols: toUnsubscribe })
    for (const symbol of toUnsubscribe) subscribedSymbols.delete(symbol)
  }
  if (toSubscribe.length > 0) {
    sendWsMessage({ type: 'subscribe', symbols: toSubscribe })
    for (const symbol of toSubscribe) subscribedSymbols.add(symbol)
  }
}

function reconcileChannelSubscriptions(previousDesiredChannels: Set<string>, nextDesiredChannels: Set<string>): void {
  const toSubscribe: string[] = []
  const toUnsubscribe: string[] = []

  for (const channel of nextDesiredChannels) {
    if (!previousDesiredChannels.has(channel)) toSubscribe.push(channel)
  }
  for (const channel of previousDesiredChannels) {
    if (!nextDesiredChannels.has(channel)) toUnsubscribe.push(channel)
  }

  if (toUnsubscribe.length > 0) {
    sendWsMessage({ type: 'unsubscribe', channels: toUnsubscribe })
    for (const channel of toUnsubscribe) subscribedChannels.delete(channel)
  }
  if (toSubscribe.length > 0) {
    sendWsMessage({ type: 'subscribe', channels: toSubscribe })
    for (const channel of toSubscribe) subscribedChannels.add(channel)
  }
}

function ensureSocketConnection(): void {
  if (!shouldMaintainConnection()) {
    disconnectSocket()
    sharedState.error = hasEnabledConsumerWithoutToken()
      ? 'Authentication required for live stream'
      : null
    sharedState.connectionStatus = 'disconnected'
    notifyConsumers()
    return
  }

  const token = getActiveToken()
  if (!token) {
    disconnectSocket()
    sharedState.error = 'Authentication required for live stream'
    sharedState.connectionStatus = 'disconnected'
    notifyConsumers()
    return
  }

  if (Date.now() < wsRetryPausedUntil) {
    sharedState.error = 'Live stream temporarily unavailable'
    sharedState.connectionStatus = 'degraded'
    debugPriceStream('Reconnect paused', {
      retryAfterMs: Math.max(wsRetryPausedUntil - Date.now(), 0),
    })
    notifyConsumers()
    return
  }

  if (Date.now() < wsNextConnectAt) {
    const retryAfterMs = Math.max(wsNextConnectAt - Date.now(), 0)
    if (!sharedState.isConnected) {
      sharedState.connectionStatus = 'reconnecting'
    }
    debugPriceStream('Connect throttled', { retryAfterMs })
    ensureRetryTimer(retryAfterMs)
    return
  }

  // Token changed between sessions; force reconnect with fresh auth.
  if (activeStreamToken && activeStreamToken !== token) {
    disconnectSocket()
    wsReconnectAttempt = 0
    wsConsecutiveConnectFailures = 0
    wsRetryPausedUntil = 0
    wsNextConnectAt = 0
  }
  activeStreamToken = token

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    sharedState.error = null
    sharedState.connectionStatus = ws.readyState === WebSocket.OPEN ? 'connected' : 'reconnecting'
    notifyConsumers()
    return
  }

  const wsUrl = buildWebSocketUrl(token)
  wsNextConnectAt = Date.now() + WS_MIN_CONNECT_INTERVAL_MS
  sharedState.connectionStatus = 'reconnecting'
  debugPriceStream('Opening websocket', { wsUrl: redactWsUrl(wsUrl) })
  const socket = new WebSocket(wsUrl)
  let socketOpened = false
  ws = socket

  socket.onopen = () => {
    socketOpened = true
    wsReconnectAttempt = 0
    wsConsecutiveConnectFailures = 0
    wsRetryPausedUntil = 0
    sharedState.isConnected = true
    sharedState.connectionStatus = 'connected'
    sharedState.error = null
    debugPriceStream('Websocket connected')
    notifyConsumers()

    const desiredSymbols = getDesiredSymbols()
    const desiredChannels = getDesiredChannels()
    subscribedSymbols = new Set()
    subscribedChannels = new Set()
    if (desiredSymbols.size > 0) {
      const symbols = Array.from(desiredSymbols)
      sendWsMessage({ type: 'subscribe', symbols })
      subscribedSymbols = new Set(symbols)
    }
    if (desiredChannels.size > 0) {
      const channels = Array.from(desiredChannels)
      sendWsMessage({ type: 'subscribe', channels })
      subscribedChannels = new Set(channels)
    }
  }

  socket.onmessage = handleSocketMessage

  socket.onerror = () => {
    sharedState.error = 'WebSocket connection error'
    if (getPriceStreamDebugEnabled()) {
      console.warn('[price-stream] WebSocket error')
    }
    notifyConsumers()
  }

  socket.onclose = (event) => {
    if (ws === socket) {
      ws = null
    }
    sharedState.isConnected = false
    subscribedSymbols = new Set()
    subscribedChannels = new Set()

    if (event.code === WS_CLOSE_UNAUTHORIZED || event.code === WS_CLOSE_FORBIDDEN) {
      sharedState.error = event.reason || 'Authentication required for live stream'
      sharedState.connectionStatus = 'degraded'
      wsRetryPausedUntil = Date.now() + WS_RETRY_PAUSE_MS
      wsNextConnectAt = wsRetryPausedUntil
      if (getPriceStreamDebugEnabled()) {
        console.warn('[price-stream] WebSocket auth close', {
          code: event.code,
          reason: event.reason || '',
        })
      }
      notifyConsumers()
      clearReconnectTimer()
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null
        ensureSocketConnection()
      }, WS_RETRY_PAUSE_MS)
      return
    }

    wsConsecutiveConnectFailures = socketOpened ? 0 : wsConsecutiveConnectFailures + 1
    if (event.code !== 1000 && getPriceStreamDebugEnabled()) {
      console.warn('[price-stream] WebSocket closed', {
        code: event.code,
        reason: event.reason || '',
        wasClean: event.wasClean,
        opened: socketOpened,
        consecutiveConnectFailures: wsConsecutiveConnectFailures,
      })
    }
    if (wsConsecutiveConnectFailures >= WS_FAILURE_THRESHOLD) {
      wsRetryPausedUntil = Date.now() + WS_RETRY_PAUSE_MS
      sharedState.error = 'Live stream unavailable. Retrying shortly.'
      sharedState.connectionStatus = 'degraded'
      debugPriceStream('Failure threshold reached, pausing reconnects', {
        pauseMs: WS_RETRY_PAUSE_MS,
      })
      notifyConsumers()
      clearReconnectTimer()
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null
        ensureSocketConnection()
      }, WS_RETRY_PAUSE_MS)
      return
    }

    sharedState.connectionStatus = 'reconnecting'
    notifyConsumers()
    scheduleReconnect()
  }
}

function reconcileStreamLifecycle(
  previousDesiredSymbols: Set<string>,
  previousDesiredChannels: Set<string>,
): void {
  const nextDesiredSymbols = getDesiredSymbols()
  const nextDesiredChannels = getDesiredChannels()

  ensureSocketConnection()

  if (ws?.readyState === WebSocket.OPEN) {
    reconcileSymbolSubscriptions(previousDesiredSymbols, nextDesiredSymbols)
    reconcileChannelSubscriptions(previousDesiredChannels, nextDesiredChannels)
  }

  if (nextDesiredSymbols.size === 0 && nextDesiredChannels.size === 0 && shouldMaintainConnection()) {
    // Keep socket alive for status updates but clear subscriptions.
    if (subscribedSymbols.size > 0) {
      sendWsMessage({ type: 'unsubscribe', symbols: Array.from(subscribedSymbols) })
      subscribedSymbols = new Set()
    }
    if (subscribedChannels.size > 0) {
      sendWsMessage({ type: 'unsubscribe', channels: Array.from(subscribedChannels) })
      subscribedChannels = new Set()
    }
  }
}

// ============================================
// HOOK
// ============================================

/**
 * Shared WebSocket price stream for AI Coach surfaces.
 * This hook uses a singleton connection and subscription diffing across consumers.
 */
export function usePriceStream(
  symbols: string[],
  enabled: boolean = true,
  token?: string | null,
  options?: UsePriceStreamOptions,
) {
  // Build stable signatures from content (not array references) so inline arrays
  // in callers do not force unnecessary unsubscribe/resubscribe churn.
  const normalizedSymbolsSignature = buildSignature(normalizeSymbols(symbols))
  const normalizedChannelsSignature = buildSignature(normalizeChannels(options?.channels || []))
  const normalizedSymbols = useMemo(
    () => (normalizedSymbolsSignature ? normalizedSymbolsSignature.split('|') : []),
    [normalizedSymbolsSignature],
  )
  const normalizedChannels = useMemo(
    () => (normalizedChannelsSignature ? normalizedChannelsSignature.split('|') : []),
    [normalizedChannelsSignature],
  )
  const [state, setState] = useState<PriceStreamState>(() => cloneState())
  const consumerIdRef = useRef<number | null>(null)
  const onMessageRef = useRef<UsePriceStreamOptions['onMessage'] | undefined>(options?.onMessage)

  useEffect(() => {
    onMessageRef.current = options?.onMessage
  }, [options?.onMessage])

  useEffect(() => {
    if (consumerIdRef.current == null) {
      consumerIdRef.current = nextConsumerId
      nextConsumerId += 1
    }

    const consumerId = consumerIdRef.current
    const previousDesiredSymbols = getDesiredSymbols()
    const previousDesiredChannels = getDesiredChannels()

    streamConsumers.set(consumerId, {
      enabled,
      token: token || null,
      symbols: new Set(normalizedSymbols),
      channels: new Set(normalizedChannels),
      onMessage: (message) => onMessageRef.current?.(message),
      listener: setState,
    })

    reconcileStreamLifecycle(previousDesiredSymbols, previousDesiredChannels)
    notifyConsumers()

    return () => {
      const prevDesired = getDesiredSymbols()
      const prevChannels = getDesiredChannels()
      streamConsumers.delete(consumerId)
      reconcileStreamLifecycle(prevDesired, prevChannels)
      notifyConsumers()
    }
  }, [enabled, token, normalizedSymbols, normalizedChannels])

  const getPrice = useCallback((symbol: string): PriceUpdate | undefined => {
    return state.prices.get(symbol.toUpperCase())
  }, [state.prices])

  return {
    prices: state.prices,
    marketStatus: state.marketStatus,
    isConnected: state.isConnected,
    connectionStatus: state.connectionStatus,
    feedHealth: state.feedHealth,
    error: state.error,
    getPrice,
  }
}
