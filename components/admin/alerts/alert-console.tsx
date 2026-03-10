'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cog,
  Loader2,
  RefreshCcw,
  SendHorizonal,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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

function formatExpirationSplitLabel(expirationDate: string): { dow: string; label: string } {
  const parsed = new Date(`${expirationDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return { dow: '', label: expirationDate }

  return {
    dow: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(parsed),
    label: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(parsed),
  }
}

function formatExpirationForContractLabel(expirationDate: string): string {
  const match = expirationDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return expirationDate
  return `${match[2]}/${match[3]}`
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

  const selectedStrikeLabel = selectedStrikeValue != null ? formatValue(selectedStrikeValue, 0) : '--'
  const selectedContractCode = `${selectedStrikeLabel}${optionType === 'call' ? 'C' : 'P'}`
  const selectedExpirationShort = formatExpirationForContractLabel(expiration)
  const prepLabel = `PREP ${normalizedSymbol || '---'} ${selectedContractCode} ${selectedExpirationShort}`.trim()
  const sessionLabel = session?.date ?? toTodayEtDateString()
  const resolvedConnectionTone = connectionStatus === 'connected'
    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200'
    : connectionStatus === 'error'
      ? 'border-red-500/35 bg-red-500/12 text-red-200'
      : connectionStatus === 'reconnecting'
        ? 'border-amber-500/35 bg-amber-500/12 text-amber-200'
        : 'border-white/15 bg-white/10 text-white/70'

  const selectedTradeLabel = selectedTrade
    ? `${selectedTrade.symbol} ${selectedTrade.strike ?? '-'}${selectedTrade.contractType === 'put' ? 'P' : 'C'} ${selectedTrade.expiration ?? ''}`.trim()
    : `${normalizedSymbol || '---'} ${selectedContractCode} ${selectedExpirationShort}`.trim()

  if (loading) {
    return (
      <div className="glass-card-heavy flex h-64 items-center justify-center rounded-2xl border border-emerald-500/20">
        <div className="flex items-center gap-3 text-emerald-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-mono text-sm uppercase tracking-[0.16em]">Loading Console</span>
        </div>
      </div>
    )
  }

  const fieldClass = 'h-11 rounded-lg border border-emerald-500/20 bg-[#0b120f]/95 px-3 text-[15px] text-white placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-emerald-300/60'
  const actionButtonClass = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/14 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/24 disabled:cursor-not-allowed disabled:opacity-45'
  const ghostButtonClass = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/15 bg-black/35 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'
  const chipClass = 'inline-flex min-h-[40px] items-center rounded-lg border border-emerald-500/20 bg-black/35 px-4 py-2 font-mono text-[15px] text-white/75 transition hover:border-emerald-400/45 hover:text-emerald-200'

  return (
    <div className="space-y-4">
      <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-black/80 via-[#0a0f0d]/95 to-black/85">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.1),transparent_42%),radial-gradient(circle_at_78%_8%,rgba(243,229,171,0.07),transparent_34%)]" />

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/15 px-4 py-3 md:px-5">
          <div>
            <h2 className="font-['Playfair_Display'] text-[28px] leading-none text-white">Alert Console</h2>
            <p className="mt-1 text-[13px] text-white/55">
              UX walkthrough mode, desktop + mobile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${resolvedConnectionTone}`}>
              <CircleDot className="h-3 w-3" />
              {connectionStatus === 'connected' ? `Live · ${sessionLabel}` : connectionStatus}
            </div>
            <Link
              href="/admin/alerts/settings"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-emerald-500/25 bg-black/35 px-3 text-white/75 transition hover:border-emerald-400/45 hover:text-emerald-100"
              title="Discord Settings"
            >
              <Cog className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative flex items-center gap-2 border-b border-emerald-500/10 px-4 py-2 font-mono text-xs text-white/65 md:px-5">
          <span className="text-emerald-200">{normalizedSymbol || 'TICKER'}</span>
          <ChevronRight className="h-3.5 w-3.5 text-white/35" />
          <span>{expiration ? formatExpirationChipLabel(expiration) : 'EXPIRATION'}</span>
          <ChevronRight className="h-3.5 w-3.5 text-white/35" />
          <span className="text-[#F3E5AB]">{selectedContractCode}</span>
          <ChevronRight className="h-3.5 w-3.5 text-white/35" />
          <span>{selectedTradeState}</span>
        </div>

        <div className="relative space-y-4 p-4 md:p-5">
          {!isConnected ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Discord is not connected. Configure credentials in settings before sending production alerts.
            </div>
          ) : null}
          {config?.lastError ? (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              Last Discord error: {config.lastError}
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {success ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={actionButtonClass} onClick={() => void runMutation(startSession)} disabled={busy}>
              {session ? 'Resume Session' : 'Start Session'}
            </button>
            <button type="button" className={ghostButtonClass} onClick={() => void loadAll()} disabled={busy}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              className={`${mentionEveryone ? actionButtonClass : ghostButtonClass}`}
              onClick={() => setMentionEveryone((current) => !current)}
              disabled={busy}
            >
              @everyone {mentionEveryone ? 'On' : 'Off'}
            </button>
          </div>

          {session ? (
            <div className="rounded-lg border border-emerald-500/20 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
              Session {session.id.slice(0, 8)} · Channel {session.channelId} · Trades {session.tradeCount}
              {session.netPnlPct != null ? ` · Net ${formatValue(session.netPnlPct, 2)}%` : ''}
            </div>
          ) : (
            <div className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white/55">
              No active session. Start a session to unlock alert actions.
            </div>
          )}

          {trades.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] text-white/55">Trade Tabs</p>
                <p className="font-mono text-[11px] text-white/45">{trades.length} total</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {trades.map((trade) => {
                  const selected = selectedTrade?.id === trade.id
                  const tradeLabel = `${trade.symbol} ${trade.strike ?? '-'}${trade.contractType === 'call' ? 'C' : 'P'}`
                  return (
                    <button
                      type="button"
                      key={trade.id}
                      onClick={() => setSelectedTradeId(trade.id)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left font-mono text-xs transition ${
                        selected
                          ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-100'
                          : 'border-white/15 bg-black/35 text-white/70 hover:border-emerald-500/35'
                      }`}
                    >
                      <div className="font-semibold">{tradeLabel}</div>
                      <div className="mt-0.5 text-[11px] opacity-80">
                        {trade.state}
                        {trade.finalPnlPct != null ? ` · ${formatValue(trade.finalPnlPct, 2)}%` : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <section className="rounded-xl border border-emerald-500/20 bg-black/35 p-3 md:p-4">
            <div className="mb-3">
              <h3 className="font-['Playfair_Display'] text-xl text-white">Contract Setup</h3>
              <p className="text-sm text-white/60">Step flow: ticker → expiration → strike → size → PREP.</p>
            </div>

            <div className="mb-3 rounded-lg border border-emerald-500/15 bg-black/30 p-3">
              <Input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="Search ticker..."
                className={`${fieldClass} mb-3`}
              />
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm text-white/70">Ticker Favorites</span>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => void runMutation(togglePinCurrentTicker)}
                  disabled={busy || !normalizedSymbol}
                >
                  {isCurrentTickerPinned ? 'Unpin Current' : 'Pin Current'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {favoriteChips.length === 0 ? (
                  <p className="font-mono text-xs text-white/50">No favorites yet.</p>
                ) : (
                  favoriteChips.map((chipTicker) => {
                    const pinned = pinnedTickers.includes(chipTicker)
                    return (
                      <button
                        type="button"
                        key={chipTicker}
                        onClick={() => selectTicker(chipTicker)}
                        className={`${chipClass} ${!pinned ? 'border-dashed border-white/20' : ''} ${normalizedSymbol === chipTicker ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-100' : ''}`}
                      >
                        {pinned ? <span className="mr-1.5 text-[10px]">📌</span> : null}
                        {chipTicker}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
              <select
                value={String(strikesPerSide)}
                onChange={(event) => setStrikesPerSide(Number(event.target.value))}
                className={fieldClass}
              >
                <option value="6">6 per side</option>
                <option value="10">10 per side</option>
                <option value="14">14 per side</option>
                <option value="20">20 per side</option>
              </select>
              <select
                value={optionType}
                onChange={(event) => {
                  setOptionType(event.target.value as OptionType)
                  setSelectedOptionTicker(null)
                }}
                className={fieldClass}
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
              <select
                value={sizeTag}
                onChange={(event) => setSizeTag(event.target.value as SizeTag)}
                className={fieldClass}
              >
                <option value="full">Full</option>
                <option value="light">Light</option>
                <option value="lotto">Lotto</option>
              </select>
              <Input
                type="date"
                value={expiration}
                onChange={(event) => setExpiration(event.target.value)}
                className={fieldClass}
              />
              <button type="button" className={ghostButtonClass} onClick={() => void loadExpirations()} disabled={expirationsLoading}>
                {expirationsLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                Load Expirations
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-500/15 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 font-mono text-xs text-white/55">
                <span>Expiration Strip</span>
                <span>{expirationOptions.length} options</span>
              </div>
              {expirationError ? (
                <div className="mb-2 rounded border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs text-red-100">{expirationError}</div>
              ) : null}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {expirationOptions.length === 0 ? (
                  <p className="font-mono text-xs text-white/45">No expirations loaded yet.</p>
                ) : (
                  expirationOptions.map((expirationDate) => {
                    const selected = expirationDate === expiration
                    const today = expirationDate === toTodayEtDateString()
                    const split = formatExpirationSplitLabel(expirationDate)
                    return (
                      <button
                        key={expirationDate}
                        type="button"
                        onClick={() => setExpiration(expirationDate)}
                        className={`min-h-[44px] shrink-0 rounded-lg border px-3 py-1 text-center transition ${
                          selected
                            ? 'border-emerald-400/55 bg-emerald-500/18 text-emerald-100'
                            : 'border-white/15 bg-black/35 text-white/70 hover:border-emerald-500/35'
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-[0.08em] text-white/45">{split.dow}</span>
                        <span className="block font-mono text-xs">{split.label}</span>
                        {today ? <span className="block text-[9px] text-[#F3E5AB]">0DTE</span> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={ghostButtonClass} onClick={() => void loadChain()} disabled={chainLoading}>
                {chainLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                Load Chain
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => void loadChainAt(offsetAbove, offsetBelow + strikesPerSide)}
                disabled={chainLoading || !chainHasMoreBelow}
              >
                Load More Below
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => void loadChainAt(offsetAbove + strikesPerSide, offsetBelow)}
                disabled={chainLoading || !chainHasMoreAbove}
              >
                Load More Above
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-500/15 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
              {underlyingLast != null ? (
                <>
                  {normalizedSymbol || '---'} Last <span className="text-emerald-200">{formatValue(underlyingLast, 2)}</span>
                  {underlyingChangePct != null ? ` · ${underlyingChangePct >= 0 ? '+' : ''}${formatValue(underlyingChangePct, 2)}%` : ''}
                  {atmStrike != null ? ` · ATM ${formatValue(atmStrike, 0)}` : ''}
                </>
              ) : (
                'Load the options chain to select a contract visually.'
              )}
            </div>

            <div className="mt-3">
              {chainError ? (
                <div className="mb-2 rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{chainError}</div>
              ) : null}

              <div className="hidden overflow-hidden rounded-xl border border-emerald-500/20 md:block">
                <table className="w-full border-collapse font-mono text-xs">
                  <thead className="bg-black/45 text-[10px] uppercase tracking-[0.12em] text-white/55">
                    <tr>
                      <th className="px-2 py-2 text-right text-emerald-300">OI</th>
                      <th className="px-2 py-2 text-right text-emerald-300">IV</th>
                      <th className="px-2 py-2 text-right text-emerald-300">Delta</th>
                      <th className="px-2 py-2 text-right text-emerald-300">Last</th>
                      <th className="px-2 py-2 text-center">Strike</th>
                      <th className="px-2 py-2 text-left text-red-300">Last</th>
                      <th className="px-2 py-2 text-left text-red-300">Delta</th>
                      <th className="px-2 py-2 text-left text-red-300">IV</th>
                      <th className="px-2 py-2 text-left text-red-300">OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-white/45">No strike rows loaded.</td>
                      </tr>
                    ) : (
                      chainRows.map((row) => {
                        const callSelected = optionType === 'call' && selectedStrikeValue === row.strike
                        const putSelected = optionType === 'put' && selectedStrikeValue === row.strike
                        const atm = atmStrike === row.strike
                        return (
                          <tr
                            key={row.strike}
                            className={`border-t border-emerald-500/10 ${atm ? 'bg-[#F3E5AB]/5' : ''} ${callSelected || putSelected ? 'bg-emerald-500/12' : ''}`}
                          >
                            <td className="px-2 py-2 text-right text-white/55">{formatValue(row.call?.oi, 0)}</td>
                            <td className="px-2 py-2 text-right text-white/55">{formatPercentValue(row.call?.iv, 1)}</td>
                            <td className="px-2 py-2 text-right text-white/65">{formatValue(row.call?.delta, 2)}</td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleSelectContract(row, 'call')}
                                disabled={!row.call}
                                className={`rounded px-2 py-1 ${callSelected ? 'border border-emerald-400/60 text-emerald-200' : 'text-emerald-300 hover:bg-emerald-500/10'}`}
                              >
                                {formatValue(row.call?.last, 2)}
                              </button>
                            </td>
                            <td className={`px-2 py-2 text-center font-semibold ${atm ? 'text-[#F3E5AB]' : 'text-white/75'}`}>
                              {formatValue(row.strike, 0)}
                            </td>
                            <td className="px-2 py-2 text-left">
                              <button
                                type="button"
                                onClick={() => handleSelectContract(row, 'put')}
                                disabled={!row.put}
                                className={`rounded px-2 py-1 ${putSelected ? 'border border-emerald-400/60 text-emerald-200' : 'text-red-300 hover:bg-red-500/10'}`}
                              >
                                {formatValue(row.put?.last, 2)}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-left text-white/65">{formatValue(row.put?.delta, 2)}</td>
                            <td className="px-2 py-2 text-left text-white/55">{formatPercentValue(row.put?.iv, 1)}</td>
                            <td className="px-2 py-2 text-left text-white/55">{formatValue(row.put?.oi, 0)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileChainSide('call')}
                    className={`${mobileChainSide === 'call' ? actionButtonClass : ghostButtonClass} w-full`}
                  >
                    Calls
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileChainSide('put')}
                    className={`${mobileChainSide === 'put' ? actionButtonClass : ghostButtonClass} w-full`}
                  >
                    Puts
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-emerald-500/20 bg-black/35">
                  <table className="w-full border-collapse font-mono text-xs">
                    <thead className="bg-black/45 text-[10px] uppercase tracking-[0.12em] text-white/50">
                      <tr>
                        <th className="px-2 py-2 text-left">Strike</th>
                        <th className="px-2 py-2 text-right">Last</th>
                        <th className="px-2 py-2 text-right">Delta</th>
                        <th className="px-2 py-2 text-right">OI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chainRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-white/45">No strike rows loaded.</td>
                        </tr>
                      ) : (
                        chainRows.map((row) => {
                          const side = mobileChainSide === 'call' ? row.call : row.put
                          const selected = optionType === mobileChainSide && selectedStrikeValue === row.strike
                          const atm = atmStrike === row.strike
                          return (
                            <tr key={`${mobileChainSide}-${row.strike}`} className={`border-t border-emerald-500/10 ${selected ? 'bg-emerald-500/15' : ''}`}>
                              <td className={`px-2 py-3 ${atm ? 'text-[#F3E5AB]' : 'text-white/75'}`}>
                                <button type="button" onClick={() => handleSelectContract(row, mobileChainSide)} className="w-full text-left">
                                  {formatValue(row.strike, 0)} {atm ? '◄' : ''}
                                </button>
                              </td>
                              <td className={`${mobileChainSide === 'call' ? 'text-emerald-300' : 'text-red-300'} px-2 py-3 text-right`}>
                                {formatValue(side?.last, 2)}
                              </td>
                              <td className="px-2 py-3 text-right text-white/60">{formatValue(side?.delta, 2)}</td>
                              <td className="px-2 py-3 text-right text-white/55">{formatValue(side?.oi, 0)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <Input
              value={strike}
              onChange={(event) => setStrike(event.target.value)}
              placeholder="Selected strike"
              className={`${fieldClass} mt-3`}
            />
            <p className="mt-2 rounded-lg border border-emerald-500/15 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
              Selected contract: {normalizedSymbol || '---'} {selectedContractCode} {expiration} ({sizeTag.toUpperCase()})
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['full', 'light', 'lotto'] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSizeTag(tag)}
                  className={`${tag === sizeTag ? actionButtonClass : ghostButtonClass} w-full`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.1em] text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => void sendPrep()}
              disabled={busy || !session || !canRunPrep || !hasValidPrepContract}
            >
              {prepLabel}
            </button>
          </section>

          {canRunStagedActions ? (
            <section className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 md:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-blue-100">
                  {selectedTradeLabel} · STAGED
                </h3>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => void runMutation(() => sendSignal({ signalType: 'ptf', tradeId: selectedTradeId }))}
                  disabled={busy || !session}
                >
                  Send PTF
                </button>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-4 border-b border-blue-400/20 pb-2 font-mono text-xs text-white/75">
                <span>Bid {formatValue(liveQuote?.bid, 2)}</span>
                <span>Ask {formatValue(liveQuote?.ask, 2)}</span>
                <span>Last {formatValue(liveQuote?.last, 2)}</span>
                <span>{normalizedSymbol} {formatValue(underlyingLast, 2)}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr,1fr,1fr,auto]">
                <Input value={fillPrice} onChange={(event) => setFillPrice(event.target.value)} placeholder="Fill price" className={fieldClass} />
                <Input value={fillStopLevel} onChange={(event) => setFillStopLevel(event.target.value)} placeholder="Stops level (optional)" className={fieldClass} />
                <Input value={fillStopPercent} onChange={(event) => setFillStopPercent(event.target.value)} placeholder="Stops % (optional)" className={fieldClass} />
                <button type="button" className={actionButtonClass} onClick={() => void sendFill()} disabled={busy || !session}>
                  <SendHorizonal className="mr-2 h-3.5 w-3.5" />
                  Fill
                </button>
              </div>
            </section>
          ) : null}

          {canRunActiveActions ? (
            <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 md:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2 font-mono text-xs text-white/80">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">{selectedTradeLabel}</p>
                  <p>
                    Entry {formatValue(latestEntryPrice, 3)} · Now {formatValue(liveMark, 3)} · P&L{' '}
                    {livePnlPercent != null ? `${livePnlPercent >= 0 ? '+' : ''}${formatValue(livePnlPercent, 2)}%` : '-'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={ghostButtonClass} onClick={() => void loadLiveQuote()} disabled={quoteLoading}>
                    {quoteLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                    Quote
                  </button>
                  <button
                    type="button"
                    className={actionButtonClass}
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
                    Update
                  </button>
                </div>
              </div>

              {quoteError ? (
                <div className="mb-3 rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100">{quoteError}</div>
              ) : null}
              <p className="mb-3 font-mono text-[11px] text-white/45">
                {liveQuote?.optionTicker ?? selectedOptionTicker ?? 'No option ticker selected'}
                {liveQuote?.updatedAt ? ` · Updated ${new Date(liveQuote.updatedAt).toLocaleTimeString()}` : ''}
              </p>

              <div className="space-y-3">
                <div>
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">Trim</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {[15, 25, 50].map((quickTrim) => (
                      <button
                        key={quickTrim}
                        type="button"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/12 px-3 font-mono text-sm font-semibold text-yellow-200 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-45"
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
                        {quickTrim}%
                      </button>
                    ))}
                    <Input
                      value={trimPercent}
                      onChange={(event) => setTrimPercent(event.target.value)}
                      placeholder="%"
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/12 px-3 font-mono text-sm font-semibold text-yellow-200 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-45"
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
                      Send
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">Stops & Trail</p>
                  <div className="grid gap-2 md:grid-cols-6">
                    <Input value={stopLevel} onChange={(event) => setStopLevel(event.target.value)} placeholder="Stop level" className={fieldClass} />
                    <Input value={stopPercent} onChange={(event) => setStopPercent(event.target.value)} placeholder="Stop %" className={fieldClass} />
                    <button
                      type="button"
                      className={ghostButtonClass}
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
                      Set Stops
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => void runMutation(() => sendSignal({ signalType: 'breakeven', tradeId: selectedTradeId }))}
                      disabled={busy || !session}
                    >
                      B/E
                    </button>
                    {[10, 20, 30].map((quickTrail) => (
                      <button
                        key={quickTrail}
                        type="button"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/12 px-3 font-mono text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={() => void runMutation(() => sendSignal({
                          signalType: 'trail',
                          tradeId: selectedTradeId,
                          fields: { percent: quickTrail },
                        }))}
                        disabled={busy || !session}
                      >
                        +{quickTrail}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr,auto,1fr,auto]">
                  <Input value={addPrice} onChange={(event) => setAddPrice(event.target.value)} placeholder="New AVG price" className={fieldClass} />
                  <button
                    type="button"
                    className={ghostButtonClass}
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
                    Add
                  </button>
                  <Input value={exitAboveLevel} onChange={(event) => setExitAboveLevel(event.target.value)} placeholder="Exit above level" className={fieldClass} />
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => void runMutation(() => sendSignal({
                      signalType: 'exit_above',
                      tradeId: selectedTradeId,
                      fields: { level: parseNumberInput(exitAboveLevel) },
                    }))}
                    disabled={busy || !session}
                  >
                    Exit Above
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr,auto]">
                  <Input value={exitBelowLevel} onChange={(event) => setExitBelowLevel(event.target.value)} placeholder="Exit below level" className={fieldClass} />
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => void runMutation(() => sendSignal({
                      signalType: 'exit_below',
                      tradeId: selectedTradeId,
                      fields: { level: parseNumberInput(exitBelowLevel) },
                    }))}
                    disabled={busy || !session}
                  >
                    Exit Below
                  </button>
                </div>

                <button
                  type="button"
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-red-500/60 bg-red-500/15 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.1em] text-red-200 transition hover:bg-red-500/22 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => void runMutation(() => sendSignal({ signalType: 'fully_out', tradeId: selectedTradeId }))}
                  disabled={busy || !session}
                >
                  Fully Out
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-emerald-500/20 bg-black/30 p-3 md:p-4">
            <h3 className="mb-2 font-mono text-xs text-white/55">Commentary & Session Closeout</h3>
            <div className="mb-3 flex gap-2">
              <Textarea
                value={commentaryText}
                onChange={(event) => setCommentaryText(event.target.value)}
                placeholder="Commentary..."
                className="min-h-[44px] border border-emerald-500/20 bg-black/40 text-sm text-white placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-emerald-300/60"
              />
              <button type="button" className={actionButtonClass} onClick={() => void sendCommentary()} disabled={busy || !session}>
                Send
              </button>
            </div>

            {generatedRecap ? (
              <p className="mb-2 rounded border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100">
                Generated recap: {generatedRecap}
              </p>
            ) : null}
            <Textarea
              value={sessionSummaryDraft}
              onChange={(event) => setSessionSummaryDraft(event.target.value)}
              placeholder="Optional recap override..."
              className="min-h-24 border border-emerald-500/20 bg-black/40 text-sm text-white placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-emerald-300/60"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={ghostButtonClass} onClick={() => void previewRecap()} disabled={busy || !session}>
                Preview Recap
              </button>
              <button type="button" className={ghostButtonClass} onClick={() => void endSession()} disabled={busy || !canEndSession}>
                End Session & Post Recap
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-500/20 bg-black/30">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 font-mono text-xs text-white/65 transition hover:text-white"
              onClick={() => setShowSessionLog((current) => !current)}
            >
              <span>Session Log ({sessionMessages.length})</span>
              <span>{showSessionLog ? 'Hide' : 'Show'}</span>
            </button>
            {showSessionLog ? (
              <div className="space-y-2 border-t border-emerald-500/15 p-3">
                {sessionMessages.length === 0 ? (
                  <p className="font-mono text-xs text-white/45">No session messages yet.</p>
                ) : (
                  sessionMessages.map((message) => (
                    <div
                      key={`${message.id}-${message.messageId}`}
                      className="rounded-lg border border-emerald-500/15 bg-black/35 px-3 py-2 text-xs text-white/75"
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-white/80">
                            {(message.signalType ?? 'message').toUpperCase()}
                          </span>
                          <span>{new Date(message.sentAt).toLocaleTimeString()}</span>
                          <span className={`rounded border px-2 py-0.5 ${
                            message.webhookStatus === 'failed'
                              ? 'border-red-500/35 bg-red-500/10 text-red-200'
                              : message.webhookStatus === 'resent'
                                ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                                : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                          }`}>
                            {(message.webhookStatus ?? 'sent').toUpperCase()}
                          </span>
                        </div>
                        {message.webhookStatus === 'failed' ? (
                          <button
                            type="button"
                            className={ghostButtonClass}
                            onClick={() => void retryFailedMessage(message.messageId)}
                            disabled={busy}
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-[12px] text-white/85">{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}
