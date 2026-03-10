'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Radio,
  SendHorizonal,
  Settings2,
  SquareChartGantt,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

type TradeState = 'IDLE' | 'STAGED' | 'ACTIVE' | 'CLOSED'
type SignalType =
  | 'prep'
  | 'ptf'
  | 'filled_avg'
  | 'update'
  | 'trim'
  | 'add'
  | 'stops'
  | 'breakeven'
  | 'trail'
  | 'exit_above'
  | 'exit_below'
  | 'fully_out'
  | 'commentary'

type OptionType = 'call' | 'put'
type SizeTag = 'full' | 'light' | 'lotto'

type DiscordConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting'

interface DiscordConfigResponse {
  connectionStatus: DiscordConnectionStatus
  lastError: string | null
  botEnabled: boolean
  botTokenSet: boolean
  guildIds: string[]
  alertChannelId: string | null
}

interface SessionResponse {
  id: string
  date: string
  channelId: string
  sessionEnd: string | null
  summary?: string | null
  tradeCount: number
  netPnlPct: number | null
}

interface TradeSummary {
  id: string
  tradeIndex: number
  symbol: string
  strike: number | null
  contractType: string | null
  expiration: string | null
  entryPrice: number | null
  entryTimestamp: string | null
  finalPnlPct: number | null
  fullyExited: boolean
  state: TradeState
}

interface SessionMessageSummary {
  id: string
  messageId: string
  content: string
  sentAt: string
  signalType: string | null
  webhookStatus: 'sent' | 'failed' | 'resent' | null
  source: string | null
  parsedTradeId: string | null
}

interface ActiveSessionPayload {
  success: boolean
  session: SessionResponse | null
  tradeState: TradeState
  trades: TradeSummary[]
  messages: SessionMessageSummary[]
  recap?: {
    generatedSummary: string
  }
}

interface ChainSide {
  bid: number | null
  ask: number | null
  last: number | null
  delta: number | null
  iv: number | null
  volume: number | null
  oi: number | null
  ticker: string
}

interface ChainRow {
  strike: number
  call: ChainSide | null
  put: ChainSide | null
}

interface ChainPayload {
  success: boolean
  underlying: {
    symbol: string
    last: number | null
    change: number | null
    changePct: number | null
  }
  expiration: string
  strikes: ChainRow[]
  atmStrike: number
  hasMoreAbove: boolean
  hasMoreBelow: boolean
}

interface ExpirationsPayload {
  success: boolean
  symbol: string
  asOfDate: string
  maxDaysAhead: number
  expirations: string[]
  nearestExpiration: string | null
}

interface LiveQuote {
  optionTicker: string
  bid: number | null
  ask: number | null
  last: number | null
  mark: number | null
  impliedVolatility: number | null
  delta: number | null
  updatedAt: string | null
}

interface QuotePayload {
  success: boolean
  quote: LiveQuote
}

interface FavoritesPayload {
  success: boolean
  preferences: {
    pinnedTickers: string[]
    recentTickers: string[]
    maxRecentTickers: number
    defaultSizeTag: SizeTag
    defaultStopPct: number | null
    defaultStrikesPerSide: number
    defaultMentionEveryone: boolean
  }
  chips: string[]
}

interface SendPayload {
  signalType: SignalType
  fields?: Record<string, unknown>
  tradeId?: string | null
}

const STATUS_STYLE: Record<DiscordConnectionStatus, string> = {
  connected: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
  reconnecting: 'border-amber-500/40 bg-amber-500/20 text-amber-200',
  disconnected: 'border-zinc-500/40 bg-zinc-500/20 text-zinc-200',
  error: 'border-red-500/40 bg-red-500/20 text-red-200',
}

const TRADE_STATE_STYLE: Record<TradeState, string> = {
  IDLE: 'border-zinc-500/40 bg-zinc-500/20 text-zinc-200',
  STAGED: 'border-blue-500/40 bg-blue-500/20 text-blue-200',
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
  CLOSED: 'border-purple-500/40 bg-purple-500/20 text-purple-200',
}

function toTodayEtDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function parseNumberInput(value: string): number | undefined {
  const normalized = value.trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatValue(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return Number(value.toFixed(digits)).toString()
}

function formatPercentValue(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${Number(value.toFixed(digits))}%`
}

function formatExpirationChipLabel(expirationDate: string): string {
  const parsed = new Date(`${expirationDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return expirationDate
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed)
}

export function AlertConsole() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [config, setConfig] = useState<DiscordConfigResponse | null>(null)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [tradeState, setTradeState] = useState<TradeState>('IDLE')
  const [trades, setTrades] = useState<TradeSummary[]>([])
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<SessionMessageSummary[]>([])
  const [showSessionLog, setShowSessionLog] = useState(false)
  const [generatedRecap, setGeneratedRecap] = useState('')

  const [mentionEveryone, setMentionEveryone] = useState(true)
  const [sessionSummaryDraft, setSessionSummaryDraft] = useState('')
  const [favoriteChips, setFavoriteChips] = useState<string[]>([])
  const [pinnedTickers, setPinnedTickers] = useState<string[]>(['SPX'])
  const [recentTickers, setRecentTickers] = useState<string[]>([])

  const [symbol, setSymbol] = useState('SPX')
  const [expiration, setExpiration] = useState(toTodayEtDateString())
  const [strike, setStrike] = useState('')
  const [optionType, setOptionType] = useState<OptionType>('call')
  const [sizeTag, setSizeTag] = useState<SizeTag>('full')
  const [selectedOptionTicker, setSelectedOptionTicker] = useState<string | null>(null)
  const [strikesPerSide, setStrikesPerSide] = useState(10)
  const [expirationOptions, setExpirationOptions] = useState<string[]>([])
  const [expirationsLoading, setExpirationsLoading] = useState(false)
  const [expirationError, setExpirationError] = useState<string | null>(null)
  const [offsetAbove, setOffsetAbove] = useState(0)
  const [offsetBelow, setOffsetBelow] = useState(0)
  const [mobileChainSide, setMobileChainSide] = useState<OptionType>('call')
  const [chainRows, setChainRows] = useState<ChainRow[]>([])
  const [chainLoading, setChainLoading] = useState(false)
  const [chainError, setChainError] = useState<string | null>(null)
  const [chainHasMoreAbove, setChainHasMoreAbove] = useState(false)
  const [chainHasMoreBelow, setChainHasMoreBelow] = useState(false)
  const [underlyingLast, setUnderlyingLast] = useState<number | null>(null)
  const [underlyingChangePct, setUnderlyingChangePct] = useState<number | null>(null)
  const [atmStrike, setAtmStrike] = useState<number | null>(null)
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [fillPrice, setFillPrice] = useState('')
  const [fillStopLevel, setFillStopLevel] = useState('')
  const [fillStopPercent, setFillStopPercent] = useState('')

  const [updatePercent, setUpdatePercent] = useState('')
  const [trimPercent, setTrimPercent] = useState('')
  const [stopLevel, setStopLevel] = useState('')
  const [stopPercent, setStopPercent] = useState('')
  const [trailPercent, setTrailPercent] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [exitAboveLevel, setExitAboveLevel] = useState('')
  const [exitBelowLevel, setExitBelowLevel] = useState('')
  const [commentaryText, setCommentaryText] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const latestTrade = useMemo(() => trades[trades.length - 1] ?? null, [trades])
  const selectedTrade = useMemo(() => {
    if (selectedTradeId) {
      const matched = trades.find((trade) => trade.id === selectedTradeId)
      if (matched) return matched
    }
    let active: TradeSummary | null = null
    for (let index = trades.length - 1; index >= 0; index -= 1) {
      const candidate = trades[index]
      if (candidate.state === 'ACTIVE' || candidate.state === 'STAGED') {
        active = candidate
        break
      }
    }
    return active ?? latestTrade
  }, [latestTrade, selectedTradeId, trades])
  const selectedTradeState: TradeState = selectedTrade?.state ?? tradeState

  const hydrateFromLatestTrade = useCallback((nextTrades: TradeSummary[]) => {
    const lastTrade = nextTrades[nextTrades.length - 1]
    if (!lastTrade) return

    if (lastTrade.symbol) setSymbol(lastTrade.symbol)
    if (lastTrade.strike != null) setStrike(String(lastTrade.strike))
    if (lastTrade.expiration) setExpiration(lastTrade.expiration)

    if (lastTrade.contractType === 'put' || lastTrade.contractType === 'call') {
      setOptionType(lastTrade.contractType)
    }
  }, [])

  const loadConnectionState = useCallback(async () => {
    const response = await fetch('/api/admin/alerts/discord/config', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to load Discord config')
    }
    setConfig(payload.config as DiscordConfigResponse)
  }, [])

  const loadFavorites = useCallback(async () => {
    const response = await fetch('/api/admin/alerts/favorites', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to load alert favorites')
    }

    const data = payload as FavoritesPayload
    setFavoriteChips(Array.isArray(data.chips) ? data.chips : [])
    setPinnedTickers(Array.isArray(data.preferences?.pinnedTickers) ? data.preferences.pinnedTickers : ['SPX'])
    setRecentTickers(Array.isArray(data.preferences?.recentTickers) ? data.preferences.recentTickers : [])
  }, [])

  const loadActiveSession = useCallback(async () => {
    const response = await fetch('/api/admin/alerts/session/active', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to load active session')
    }

    const data = payload as ActiveSessionPayload
    setSession(data.session)
    setTradeState(data.tradeState)
    const nextTrades = Array.isArray(data.trades) ? data.trades : []
    setTrades(nextTrades)
    setSessionMessages(Array.isArray(data.messages) ? data.messages : [])
    const nextGeneratedRecap = data.recap?.generatedSummary ?? ''
    setGeneratedRecap(nextGeneratedRecap)
    if (!data.session) {
      setSessionSummaryDraft('')
    } else {
      setSessionSummaryDraft((current) => current.trim().length > 0 ? current : nextGeneratedRecap)
    }

    if (nextTrades.length > 0) {
      setSelectedTradeId((current) => {
        if (current && nextTrades.some((trade) => trade.id === current)) {
          return current
        }
        const nextActiveTrade = [...nextTrades].reverse().find((trade) => trade.state === 'ACTIVE' || trade.state === 'STAGED')
        return nextActiveTrade?.id ?? nextTrades[nextTrades.length - 1]?.id ?? null
      })
    } else {
      setSelectedTradeId(null)
    }

    hydrateFromLatestTrade(nextTrades)
  }, [hydrateFromLatestTrade])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadConnectionState(),
        loadActiveSession(),
        loadFavorites(),
      ])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load alert console')
    } finally {
      setLoading(false)
    }
  }, [loadActiveSession, loadConnectionState, loadFavorites])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([loadConnectionState(), loadActiveSession(), loadFavorites()])
  }, [loadActiveSession, loadConnectionState, loadFavorites])

  const loadExpirations = useCallback(async () => {
    const normalizedSymbol = symbol.trim().toUpperCase()
    if (!normalizedSymbol) return

    setExpirationsLoading(true)
    setExpirationError(null)

    try {
      const search = new URLSearchParams({
        symbol: normalizedSymbol,
        maxDaysAhead: '90',
      })

      const response = await fetch(`/api/admin/alerts/expirations?${search.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load expirations')
      }

      const nextExpirations = Array.isArray((payload as ExpirationsPayload).expirations)
        ? (payload as ExpirationsPayload).expirations
        : []

      setExpirationOptions(nextExpirations)
      if (nextExpirations.length > 0) {
        setExpiration((current) => nextExpirations.includes(current) ? current : nextExpirations[0])
      }
    } catch (loadError) {
      setExpirationError(loadError instanceof Error ? loadError.message : 'Failed to load expirations')
      setExpirationOptions([])
    } finally {
      setExpirationsLoading(false)
    }
  }, [symbol])

  const loadChainAt = useCallback(async (nextOffsetAbove: number, nextOffsetBelow: number) => {
    setChainLoading(true)
    setChainError(null)

    try {
      const search = new URLSearchParams({
        symbol: symbol.trim().toUpperCase(),
        expiration,
        strikesPerSide: String(strikesPerSide),
        offsetAbove: String(nextOffsetAbove),
        offsetBelow: String(nextOffsetBelow),
      })

      const response = await fetch(`/api/admin/alerts/chain?${search.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load options chain')
      }

      const chain = payload as ChainPayload
      setChainRows(Array.isArray(chain.strikes) ? chain.strikes : [])
      setChainHasMoreAbove(Boolean(chain.hasMoreAbove))
      setChainHasMoreBelow(Boolean(chain.hasMoreBelow))
      setUnderlyingLast(chain.underlying?.last ?? null)
      setUnderlyingChangePct(chain.underlying?.changePct ?? null)
      setAtmStrike(chain.atmStrike ?? null)
      if (parseNumberInput(strike) == null && chain.atmStrike != null) {
        setStrike(String(chain.atmStrike))
      }
      setOffsetAbove(nextOffsetAbove)
      setOffsetBelow(nextOffsetBelow)
    } catch (loadError) {
      setChainError(loadError instanceof Error ? loadError.message : 'Failed to load options chain')
      setChainRows([])
    } finally {
      setChainLoading(false)
    }
  }, [expiration, strike, strikesPerSide, symbol])

  const loadChain = useCallback(async () => {
    await loadChainAt(offsetAbove, offsetBelow)
  }, [loadChainAt, offsetAbove, offsetBelow])

  const loadLiveQuote = useCallback(async (input?: { silent?: boolean }) => {
    const normalizedSymbol = symbol.trim().toUpperCase()
    const strikeValue = parseNumberInput(strike)
    if (!normalizedSymbol || !expiration || strikeValue == null) return

    if (!input?.silent) {
      setQuoteLoading(true)
    }
    setQuoteError(null)

    try {
      const search = new URLSearchParams({
        symbol: normalizedSymbol,
      })

      if (selectedOptionTicker) {
        search.set('optionTicker', selectedOptionTicker)
      } else {
        search.set('expiration', expiration)
        search.set('strike', String(strikeValue))
        search.set('optionType', optionType)
      }

      const response = await fetch(`/api/admin/alerts/quote?${search.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load quote')
      }

      const quote = (payload as QuotePayload).quote
      setLiveQuote(quote)
      setSelectedOptionTicker(quote.optionTicker)
    } catch (loadError) {
      setQuoteError(loadError instanceof Error ? loadError.message : 'Failed to load quote')
      setLiveQuote(null)
    } finally {
      if (!input?.silent) {
        setQuoteLoading(false)
      }
    }
  }, [expiration, optionType, selectedOptionTicker, strike, symbol])

  const runMutation = useCallback(async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await task()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSelectContract = useCallback((row: ChainRow, nextOptionType: OptionType) => {
    setStrike(String(row.strike))
    setOptionType(nextOptionType)
    setChainError(null)
    setSelectedOptionTicker(nextOptionType === 'call' ? (row.call?.ticker ?? null) : (row.put?.ticker ?? null))
  }, [])

  useEffect(() => {
    setOffsetAbove(0)
    setOffsetBelow(0)
    setChainRows([])
    setChainError(null)
    setChainHasMoreAbove(false)
    setChainHasMoreBelow(false)
    setUnderlyingLast(null)
    setUnderlyingChangePct(null)
    setAtmStrike(null)
    setSelectedOptionTicker(null)
    setLiveQuote(null)
    setQuoteError(null)
  }, [symbol, expiration, strikesPerSide])

  useEffect(() => {
    const normalized = symbol.trim()
    if (!normalized) {
      setExpirationOptions([])
      return
    }

    const timer = window.setTimeout(() => {
      void loadExpirations()
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadExpirations, symbol])

  useEffect(() => {
    if (!selectedTrade) return
    if (selectedTrade.symbol) setSymbol(selectedTrade.symbol)
    if (selectedTrade.strike != null) setStrike(String(selectedTrade.strike))
    if (selectedTrade.contractType === 'call' || selectedTrade.contractType === 'put') {
      setOptionType(selectedTrade.contractType)
    }
    if (selectedTrade.expiration) setExpiration(selectedTrade.expiration)
    setSelectedOptionTicker(null)
  }, [selectedTrade])

  useEffect(() => {
    if (selectedTradeState !== 'ACTIVE' || !session) {
      return
    }

    void loadLiveQuote()
    const intervalId = window.setInterval(() => {
      void loadLiveQuote({ silent: true })
    }, 15_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadLiveQuote, selectedTradeState, session])

  const startSession = useCallback(async () => {
    await runMutation(async () => {
      const response = await fetch('/api/admin/alerts/session/start', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to start session')
      }
      await refreshAfterMutation()
      setSuccess(`Session started for ${payload.session.date}`)
    })
  }, [refreshAfterMutation, runMutation])

  const endSession = useCallback(async () => {
    if (!session) return
    await runMutation(async () => {
      const response = await fetch('/api/admin/alerts/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          summary: sessionSummaryDraft.trim() || undefined,
          mentionEveryone,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to end session')
      }
      await refreshAfterMutation()
      setSessionSummaryDraft('')
      setSuccess('Session recap posted and session closed.')
    })
  }, [mentionEveryone, refreshAfterMutation, runMutation, session, sessionSummaryDraft])

  const saveFavorites = useCallback(async (input: {
    pinned: string[]
    recent: string[]
  }) => {
    const response = await fetch('/api/admin/alerts/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinnedTickers: input.pinned,
        recentTickers: input.recent,
      }),
    })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to update favorites')
    }

    const data = payload as FavoritesPayload
    setFavoriteChips(Array.isArray(data.chips) ? data.chips : [])
    setPinnedTickers(Array.isArray(data.preferences?.pinnedTickers) ? data.preferences.pinnedTickers : input.pinned)
    setRecentTickers(Array.isArray(data.preferences?.recentTickers) ? data.preferences.recentTickers : input.recent)
  }, [])

  const addRecentTicker = useCallback(async (nextSymbol: string) => {
    const normalized = nextSymbol.trim().toUpperCase()
    if (!normalized) return
    const nextPinned = pinnedTickers
    const nextRecent = [normalized, ...recentTickers.filter((ticker) => ticker !== normalized && !nextPinned.includes(ticker))]
    await saveFavorites({
      pinned: nextPinned,
      recent: nextRecent.slice(0, 24),
    })
  }, [pinnedTickers, recentTickers, saveFavorites])

  const selectTicker = useCallback((nextSymbol: string) => {
    setSymbol(nextSymbol.trim().toUpperCase())
  }, [])

  const togglePinCurrentTicker = useCallback(async () => {
    const normalized = symbol.trim().toUpperCase()
    if (!normalized) {
      throw new Error('Enter a ticker before pinning')
    }

    const isPinned = pinnedTickers.includes(normalized)
    const nextPinned = isPinned
      ? pinnedTickers.filter((ticker) => ticker !== normalized)
      : [normalized, ...pinnedTickers.filter((ticker) => ticker !== normalized)].slice(0, 8)

    const safePinned = nextPinned.length > 0 ? nextPinned : ['SPX']
    const nextRecent = recentTickers.filter((ticker) => !safePinned.includes(ticker))
    await saveFavorites({
      pinned: safePinned,
      recent: nextRecent,
    })
    setSuccess(isPinned ? `Unpinned ${normalized}.` : `Pinned ${normalized}.`)
  }, [pinnedTickers, recentTickers, saveFavorites, symbol])

  const sendSignal = useCallback(async (input: SendPayload) => {
    if (!session) {
      throw new Error('Start a session before sending alerts')
    }

    const response = await fetch('/api/admin/alerts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        tradeId: input.tradeId,
        signalType: input.signalType,
        fields: input.fields ?? {},
        mentionEveryone,
      }),
    })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to send alert')
    }

    await refreshAfterMutation()
    setSuccess(`Sent ${input.signalType.toUpperCase()} alert.`)
  }, [mentionEveryone, refreshAfterMutation, session])

  const sendPrep = useCallback(async () => {
    await runMutation(async () => {
      await sendSignal({
        signalType: 'prep',
        fields: {
          symbol: symbol.toUpperCase(),
          expiration,
          strike: parseNumberInput(strike),
          optionType,
          sizeTag,
        },
      })
      try {
        await addRecentTicker(symbol)
      } catch {
        // Non-blocking: alert dispatch already succeeded.
      }
    })
  }, [addRecentTicker, expiration, optionType, runMutation, sendSignal, sizeTag, strike, symbol])

  const sendFill = useCallback(async () => {
    await runMutation(async () => {
      await sendSignal({
        signalType: 'filled_avg',
        tradeId: selectedTradeId,
        fields: {
          price: parseNumberInput(fillPrice),
          level: parseNumberInput(fillStopLevel),
          percent: parseNumberInput(fillStopPercent),
        },
      })
    })
  }, [fillPrice, fillStopLevel, fillStopPercent, runMutation, selectedTradeId, sendSignal])

  const sendCommentary = useCallback(async () => {
    await runMutation(async () => {
      await sendSignal({
        signalType: 'commentary',
        tradeId: selectedTradeId,
        fields: {
          commentary: commentaryText,
        },
      })
      setCommentaryText('')
    })
  }, [commentaryText, runMutation, selectedTradeId, sendSignal])

  const previewRecap = useCallback(async () => {
    if (!session) return
    await runMutation(async () => {
      const response = await fetch('/api/admin/alerts/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          preview: true,
          summary: sessionSummaryDraft.trim() || undefined,
          mentionEveryone,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to generate recap preview')
      }

      const recapContent = typeof payload?.recap?.content === 'string' ? payload.recap.content : generatedRecap
      setSessionSummaryDraft(recapContent)
      setSuccess('Recap preview generated. Edit if needed, then post.')
    })
  }, [generatedRecap, mentionEveryone, runMutation, session, sessionSummaryDraft])

  const retryFailedMessage = useCallback(async (messageId: string) => {
    await runMutation(async () => {
      const response = await fetch(`/api/admin/alerts/resend/${encodeURIComponent(messageId)}`, {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to resend message')
      }
      await refreshAfterMutation()
      setSuccess(`Retried failed message ${messageId}.`)
    })
  }, [refreshAfterMutation, runMutation])

  const connectionStatus = config?.connectionStatus ?? 'disconnected'
  const isConnected = connectionStatus === 'connected'

  const hasOpenTrades = trades.some((trade) => trade.state === 'STAGED' || trade.state === 'ACTIVE')
  const canRunStagedActions = selectedTradeState === 'STAGED'
  const canRunActiveActions = selectedTradeState === 'ACTIVE'
  const canRunPrep = Boolean(session)
  const canEndSession = Boolean(session) && !hasOpenTrades
  const selectedStrikeValue = parseNumberInput(strike)
  const normalizedSymbol = symbol.trim().toUpperCase()
  const isCurrentTickerPinned = normalizedSymbol.length > 0 && pinnedTickers.includes(normalizedSymbol)
  const hasValidPrepContract = Boolean(symbol.trim()) && Boolean(expiration.trim()) && selectedStrikeValue != null
  const liveMark = liveQuote?.mark ?? null
  const latestEntryPrice = selectedTrade?.entryPrice ?? latestTrade?.entryPrice ?? null
  const livePnlPercent = useMemo(() => {
    if (latestEntryPrice == null || liveMark == null || latestEntryPrice === 0) return null
    return ((liveMark - latestEntryPrice) / Math.abs(latestEntryPrice)) * 100
  }, [latestEntryPrice, liveMark])

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Radio className="h-4 w-4 text-emerald-400" />
              Alert Session
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_STYLE[connectionStatus]}>
                Discord {connectionStatus.toUpperCase()}
              </Badge>
              <Badge className={TRADE_STATE_STYLE[tradeState]}>
                {tradeState}
              </Badge>
            </div>
          </div>
          <CardDescription className="text-white/60">
            Stateful execution console for PREP to FILL to UPDATE/TRIM/STOPS to FULLY OUT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              <span>
                Discord is not connected. Configure bot credentials before sending production alerts.
              </span>
              <Button variant="outline" asChild>
                <Link href="/admin/alerts/settings">
                  <Settings2 className="h-4 w-4" />
                  Configure
                </Link>
              </Button>
            </div>
          ) : null}

          {config?.lastError ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              Last Discord error: {config.lastError}
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={startSession} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquareChartGantt className="h-4 w-4" />}
              {session ? 'Resume/Refresh Session' : 'Start Session'}
            </Button>
            <Button variant="outline" onClick={() => void loadAll()} disabled={busy}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <Switch checked={mentionEveryone} onCheckedChange={setMentionEveryone} />
              <span className="text-xs text-white/70">@everyone</span>
            </div>
          </div>

          {session ? (
            <div className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-white/70">
              Session {session.id.slice(0, 8)} | {session.date} | Channel {session.channelId}
              {' '}| Trades {session.tradeCount}
              {session.netPnlPct != null ? ` | Net ${session.netPnlPct}%` : ''}
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              No active session yet. Start one to unlock alert actions.
            </div>
          )}
        </CardContent>
      </Card>

      {trades.length > 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Trade Tabs</CardTitle>
            <CardDescription className="text-white/60">
              Switch active action context across concurrent staged/active trades.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trades.map((trade) => {
                const selected = selectedTrade?.id === trade.id
                const tradeLabel = `${trade.symbol} ${trade.strike ?? '-'}${trade.contractType === 'call' ? 'C' : trade.contractType === 'put' ? 'P' : ''}`
                return (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => setSelectedTradeId(trade.id)}
                    className={`shrink-0 rounded-md border px-3 py-2 text-xs transition ${
                      selected
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-black/30 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-medium">{tradeLabel}</div>
                    <div className="text-[11px] opacity-80">
                      {trade.state}
                      {trade.finalPnlPct != null ? ` | ${trade.finalPnlPct}%` : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Contract Setup</CardTitle>
          <CardDescription className="text-white/60">
            Configure contract and dispatch PREP when trade state is IDLE/CLOSED.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-white/70">
              <span>Ticker Favorites</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runMutation(togglePinCurrentTicker)}
                disabled={busy || !normalizedSymbol}
              >
                {isCurrentTickerPinned ? 'Unpin Current' : 'Pin Current'}
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {favoriteChips.length === 0 ? (
                <div className="px-1 text-[11px] text-white/50">No favorites yet.</div>
              ) : (
                favoriteChips.map((chipTicker) => (
                  <button
                    key={chipTicker}
                    type="button"
                    onClick={() => selectTicker(chipTicker)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-[11px] transition ${
                      normalizedSymbol === chipTicker
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-black/30 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {chipTicker}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Ticker" />
            <Select value={String(strikesPerSide)} onValueChange={(value) => setStrikesPerSide(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 per side</SelectItem>
                <SelectItem value="10">10 per side</SelectItem>
                <SelectItem value="14">14 per side</SelectItem>
                <SelectItem value="20">20 per side</SelectItem>
              </SelectContent>
            </Select>
            <Select value={optionType} onValueChange={(value) => {
              setOptionType(value as OptionType)
              setSelectedOptionTicker(null)
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="put">Put</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeTag} onValueChange={(value) => setSizeTag(value as SizeTag)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="lotto">Lotto</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={expiration} onChange={(event) => setExpiration(event.target.value)} />
            <Button variant="outline" onClick={() => void loadExpirations()} disabled={expirationsLoading}>
              {expirationsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Load Expirations
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-white/70">
              <span>Expiration Strip</span>
              <span>{expirationOptions.length} options</span>
            </div>
            {expirationError ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                {expirationError}
              </div>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {expirationOptions.length === 0 ? (
                <div className="px-1 text-[11px] text-white/50">
                  No expirations loaded yet.
                </div>
              ) : (
                expirationOptions.map((expirationDate) => (
                  <button
                    key={expirationDate}
                    type="button"
                    onClick={() => setExpiration(expirationDate)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-[11px] transition ${
                      expirationDate === expiration
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-black/30 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {formatExpirationChipLabel(expirationDate)}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadChain()} disabled={chainLoading}>
              {chainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Load Chain
            </Button>
            <Button
              variant="outline"
              onClick={() => void loadChainAt(offsetAbove, offsetBelow + strikesPerSide)}
              disabled={chainLoading || !chainHasMoreBelow}
            >
              Load More Below
            </Button>
            <Button
              variant="outline"
              onClick={() => void loadChainAt(offsetAbove + strikesPerSide, offsetBelow)}
              disabled={chainLoading || !chainHasMoreAbove}
            >
              Load More Above
            </Button>
          </div>

          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
            {underlyingLast != null ? (
              <span>
                Underlying {symbol.toUpperCase()} {formatValue(underlyingLast, 2)}
                {underlyingChangePct != null ? ` (${underlyingChangePct >= 0 ? '+' : ''}${formatValue(underlyingChangePct, 2)}%)` : ''}
                {atmStrike != null ? ` | ATM ${formatValue(atmStrike, 2)}` : ''}
              </span>
            ) : (
              <span>Load the options chain to select a contract visually.</span>
            )}
          </div>

          <Input value={strike} onChange={(event) => setStrike(event.target.value)} placeholder="Selected strike" />
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
            Selected contract: {symbol.toUpperCase()} {strike || '-'}
            {optionType === 'call' ? 'C' : 'P'} {expiration} ({sizeTag.toUpperCase()})
          </div>

          {chainError ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              {chainError}
            </div>
          ) : null}

          <div className="hidden overflow-hidden rounded-md border border-white/10 md:block">
            <div className="grid grid-cols-[1.2fr,0.6fr,1.2fr] gap-px bg-white/10 text-[11px] uppercase tracking-wide text-white/60">
              <div className="bg-black/40 px-3 py-2">Calls</div>
              <div className="bg-black/40 px-3 py-2 text-center">Strike</div>
              <div className="bg-black/40 px-3 py-2">Puts</div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {chainRows.length === 0 ? (
                <div className="px-3 py-4 text-xs text-white/50">No strike rows loaded.</div>
              ) : (
                chainRows.map((row) => (
                  <div key={row.strike} className="grid grid-cols-[1.2fr,0.6fr,1.2fr] gap-px border-t border-white/10 bg-white/10">
                    <button
                      type="button"
                      onClick={() => handleSelectContract(row, 'call')}
                      disabled={!row.call}
                      className={`bg-black/30 px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        optionType === 'call' && selectedStrikeValue === row.strike
                          ? 'ring-1 ring-emerald-400/70 text-emerald-100'
                          : 'text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div>Last {formatValue(row.call?.last, 2)} | D {formatValue(row.call?.delta, 2)}</div>
                      <div>IV {formatPercentValue(row.call?.iv, 1)} | OI {formatValue(row.call?.oi, 0)}</div>
                    </button>
                    <div className={`flex items-center justify-center bg-black/40 px-2 py-2 text-sm ${
                      atmStrike === row.strike ? 'text-[#F3E5AB]' : 'text-white/80'
                    }`}>
                      {formatValue(row.strike, 2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectContract(row, 'put')}
                      disabled={!row.put}
                      className={`bg-black/30 px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        optionType === 'put' && selectedStrikeValue === row.strike
                          ? 'ring-1 ring-emerald-400/70 text-emerald-100'
                          : 'text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div>Last {formatValue(row.put?.last, 2)} | D {formatValue(row.put?.delta, 2)}</div>
                      <div>IV {formatPercentValue(row.put?.iv, 1)} | OI {formatValue(row.put?.oi, 0)}</div>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mobileChainSide === 'call' ? 'default' : 'outline'}
                onClick={() => setMobileChainSide('call')}
              >
                Calls
              </Button>
              <Button
                variant={mobileChainSide === 'put' ? 'default' : 'outline'}
                onClick={() => setMobileChainSide('put')}
              >
                Puts
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2">
              {chainRows.length === 0 ? (
                <div className="px-2 py-3 text-xs text-white/50">No strike rows loaded.</div>
              ) : (
                chainRows.map((row) => {
                  const side = mobileChainSide === 'call' ? row.call : row.put
                  const selected = optionType === mobileChainSide && selectedStrikeValue === row.strike
                  return (
                    <button
                      type="button"
                      key={`${mobileChainSide}-${row.strike}`}
                      onClick={() => handleSelectContract(row, mobileChainSide)}
                      disabled={!side}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                          : 'border-white/10 bg-black/30 text-white/70'
                      }`}
                    >
                      <div className="font-medium">
                        {formatValue(row.strike, 2)} {mobileChainSide === 'call' ? 'C' : 'P'}
                        {atmStrike === row.strike ? ' | ATM' : ''}
                      </div>
                      <div>Last {formatValue(side?.last, 2)} | D {formatValue(side?.delta, 2)} | IV {formatPercentValue(side?.iv, 1)}</div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <Button onClick={sendPrep} disabled={busy || !session || !canRunPrep || !hasValidPrepContract}>
            <SendHorizonal className="h-4 w-4" />
            Send PREP
          </Button>
        </CardContent>
      </Card>

      {canRunStagedActions ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Staged Actions</CardTitle>
            {selectedTrade ? (
              <CardDescription className="text-white/60">
                Target trade #{selectedTrade.tradeIndex} {selectedTrade.symbol} {selectedTrade.strike ?? '-'}
                {selectedTrade.contractType === 'call' ? 'C' : selectedTrade.contractType === 'put' ? 'P' : ''}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({ signalType: 'ptf', tradeId: selectedTradeId }))}
                disabled={busy || !session}
              >
                Send PTF
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={fillPrice} onChange={(event) => setFillPrice(event.target.value)} placeholder="Fill price" />
              <Input value={fillStopLevel} onChange={(event) => setFillStopLevel(event.target.value)} placeholder="Stop level (optional)" />
              <Input value={fillStopPercent} onChange={(event) => setFillStopPercent(event.target.value)} placeholder="Stop % (optional)" />
            </div>
            <Button onClick={sendFill} disabled={busy || !session}>
              <SendHorizonal className="h-4 w-4" />
              Send FILL
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canRunActiveActions ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Active Trade Actions</CardTitle>
            <CardDescription className="text-white/60">
              Live quote drives one-tap UPDATE and TRIM messaging for the selected tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-white/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Entry {formatValue(latestEntryPrice, 3)} | Mark {formatValue(liveMark, 3)} | PnL {
                    livePnlPercent != null
                      ? `${livePnlPercent >= 0 ? '+' : ''}${formatValue(livePnlPercent, 2)}%`
                      : '-'
                  }
                </span>
                <Button variant="outline" onClick={() => void loadLiveQuote()} disabled={quoteLoading}>
                  {quoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Refresh Quote
                </Button>
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {liveQuote?.optionTicker ?? selectedOptionTicker ?? 'No option ticker selected'}
                {liveQuote?.updatedAt ? ` | Updated ${new Date(liveQuote.updatedAt).toLocaleTimeString()}` : ''}
              </div>
              {quoteError ? (
                <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                  {quoteError}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={updatePercent} onChange={(event) => setUpdatePercent(event.target.value)} placeholder="Update %" />
              <Button
                variant="outline"
                onClick={() => void runMutation(async () => {
                  const resolvedPercent = parseNumberInput(updatePercent) ?? livePnlPercent ?? undefined
                  if (resolvedPercent == null) {
                    throw new Error('UPDATE requires a manual percent or an active live quote')
                  }
                  await sendSignal({
                    signalType: 'update',
                    tradeId: selectedTradeId,
                    fields: { percent: resolvedPercent },
                  })
                })}
                disabled={busy || !session}
              >
                Send UPDATE
              </Button>
              <div className="flex gap-2">
                {[15, 25, 50].map((quickTrim) => (
                  <Button
                    key={quickTrim}
                    variant="ghost"
                    onClick={() => void runMutation(async () => {
                      const resolvedPercent = livePnlPercent ?? parseNumberInput(trimPercent) ?? undefined
                      if (resolvedPercent == null) {
                        throw new Error('TRIM requires a manual percent or an active live quote')
                      }
                      await sendSignal({
                        signalType: 'trim',
                        tradeId: selectedTradeId,
                        fields: { percent: resolvedPercent },
                      })
                      setSuccess(`Sent TRIM (${quickTrim}% preset).`)
                    })}
                    disabled={busy || !session}
                  >
                    Trim {quickTrim}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Input value={trimPercent} onChange={(event) => setTrimPercent(event.target.value)} placeholder="Custom trim %" />
              <Button
                variant="outline"
                onClick={() => void runMutation(async () => {
                  const resolvedPercent = parseNumberInput(trimPercent) ?? livePnlPercent ?? undefined
                  if (resolvedPercent == null) {
                    throw new Error('TRIM requires a manual percent or an active live quote')
                  }
                  await sendSignal({
                    signalType: 'trim',
                    tradeId: selectedTradeId,
                    fields: { percent: resolvedPercent },
                  })
                })}
                disabled={busy || !session}
              >
                Send TRIM
              </Button>
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({ signalType: 'breakeven', tradeId: selectedTradeId }))}
                disabled={busy || !session}
              >
                Send B/E
              </Button>
              <Button
                variant="destructive"
                onClick={() => void runMutation(() => sendSignal({ signalType: 'fully_out', tradeId: selectedTradeId }))}
                disabled={busy || !session}
              >
                FULLY OUT
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={stopLevel} onChange={(event) => setStopLevel(event.target.value)} placeholder="Stops level" />
              <Input value={stopPercent} onChange={(event) => setStopPercent(event.target.value)} placeholder="Stops %" />
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({
                  signalType: 'stops',
                  tradeId: selectedTradeId,
                  fields: {
                    level: parseNumberInput(stopLevel),
                    percent: parseNumberInput(stopPercent),
                  },
                }))}
                disabled={busy || !session}
              >
                Send STOPS
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={trailPercent} onChange={(event) => setTrailPercent(event.target.value)} placeholder="Trail %" />
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({
                  signalType: 'trail',
                  tradeId: selectedTradeId,
                  fields: { percent: parseNumberInput(trailPercent) },
                }))}
                disabled={busy || !session}
              >
                Send TRAIL
              </Button>
              <div className="flex gap-2">
                {[10, 20, 30].map((quickTrail) => (
                  <Button
                    key={quickTrail}
                    variant="ghost"
                    onClick={() => void runMutation(() => sendSignal({
                      signalType: 'trail',
                      tradeId: selectedTradeId,
                      fields: { percent: quickTrail },
                    }))}
                    disabled={busy || !session}
                  >
                    +{quickTrail}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={addPrice} onChange={(event) => setAddPrice(event.target.value)} placeholder="New AVG price" />
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({
                  signalType: 'add',
                  tradeId: selectedTradeId,
                  fields: {
                    price: parseNumberInput(addPrice),
                    symbol: selectedTrade?.symbol ?? latestTrade?.symbol,
                  },
                }))}
                disabled={busy || !session}
              >
                Send ADD
              </Button>
              <div />
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Input value={exitAboveLevel} onChange={(event) => setExitAboveLevel(event.target.value)} placeholder="Exit above level" />
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({
                  signalType: 'exit_above',
                  tradeId: selectedTradeId,
                  fields: { level: parseNumberInput(exitAboveLevel) },
                }))}
                disabled={busy || !session}
              >
                Send EXIT ABOVE
              </Button>
              <Input value={exitBelowLevel} onChange={(event) => setExitBelowLevel(event.target.value)} placeholder="Exit below level" />
              <Button
                variant="outline"
                onClick={() => void runMutation(() => sendSignal({
                  signalType: 'exit_below',
                  tradeId: selectedTradeId,
                  fields: { level: parseNumberInput(exitBelowLevel) },
                }))}
                disabled={busy || !session}
              >
                Send EXIT BELOW
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Commentary & Session Closeout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={commentaryText}
            onChange={(event) => setCommentaryText(event.target.value)}
            placeholder="Type commentary update..."
            className="min-h-20"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendCommentary} disabled={busy || !session}>
              <SendHorizonal className="h-4 w-4" />
              Send Commentary
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">End Session Recap (Optional Override)</p>
            {generatedRecap ? (
              <p className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
                Generated: {generatedRecap}
              </p>
            ) : null}
            <Textarea
              value={sessionSummaryDraft}
              onChange={(event) => setSessionSummaryDraft(event.target.value)}
              placeholder="Leave blank to auto-generate recap from closed trades."
              className="min-h-20"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={previewRecap} disabled={busy || !session}>
                Preview Recap
              </Button>
              <Button variant="outline" onClick={endSession} disabled={busy || !canEndSession}>
                End Session & Post Recap
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Session Trades</CardTitle>
          <CardDescription className="text-white/60">
            Latest session snapshot from persisted Discord trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {trades.length === 0 ? (
            <p className="text-sm text-white/50">No trades in this session yet.</p>
          ) : (
            trades.map((trade) => (
              <button
                type="button"
                key={trade.id}
                onClick={() => setSelectedTradeId(trade.id)}
                className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
                  selectedTrade?.id === trade.id
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                    : 'border-white/10 bg-black/20 text-white/70 hover:bg-white/10'
                }`}
              >
                <span>
                  #{trade.tradeIndex} {trade.symbol} {trade.strike ?? '-'}
                  {trade.contractType === 'put' ? 'P' : trade.contractType === 'call' ? 'C' : ''}
                  {trade.expiration ? ` | ${trade.expiration}` : ''}
                </span>
                <span>
                  Entry {trade.entryPrice ?? '-'}
                  {trade.finalPnlPct != null ? ` | P&L ${trade.finalPnlPct}%` : ''}
                  {' '}| {trade.state}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-white">Session Log</CardTitle>
              <CardDescription className="text-white/60">
                All alerts sent this session with delivery status.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowSessionLog((current) => !current)}>
              {showSessionLog ? 'Hide Log' : `Show Log (${sessionMessages.length})`}
            </Button>
          </div>
        </CardHeader>
        {showSessionLog ? (
          <CardContent className="space-y-2">
            {sessionMessages.length === 0 ? (
              <p className="text-sm text-white/50">No session messages yet.</p>
            ) : (
              sessionMessages.map((message) => (
                <div
                  key={`${message.id}-${message.messageId}`}
                  className="space-y-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-white/20 bg-white/10 text-white/80">
                        {(message.signalType ?? 'message').toUpperCase()}
                      </Badge>
                      <span>{new Date(message.sentAt).toLocaleTimeString()}</span>
                      <Badge className={`${
                        message.webhookStatus === 'failed'
                          ? 'border-red-500/40 bg-red-500/20 text-red-200'
                          : message.webhookStatus === 'resent'
                            ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
                            : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                      }`}>
                        {(message.webhookStatus ?? 'sent').toUpperCase()}
                      </Badge>
                    </div>
                    {message.webhookStatus === 'failed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void retryFailedMessage(message.messageId)}
                        disabled={busy}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[12px] text-white/80">{message.content}</p>
                </div>
              ))
            )}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
