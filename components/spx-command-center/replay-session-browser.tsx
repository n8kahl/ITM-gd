'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { postSPX, SPXRequestError, useSPXQuery } from '@/hooks/use-spx-api'
import {
  publishReplaySessionSync,
  subscribeReplayCursorTime,
  subscribeReplayTranscriptJump,
  type ReplaySessionSyncLifecycleEvent,
  type ReplaySessionSyncPayload,
} from '@/lib/spx/replay-session-sync'
import { cn } from '@/lib/utils'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import {
  ReplayDrillMode,
  type ReplayDrillHistoryEntry,
  type ReplayDrillSubmissionPayload,
  type ReplayDrillSubmissionResponse,
} from '@/components/spx-command-center/replay-drill-mode'
import { ReplayConfluencePanel, type ReplayConfluenceSnapshotRow } from '@/components/spx-command-center/replay-confluence-panel'
import { ReplayTranscriptSidebar } from '@/components/spx-command-center/replay-transcript-sidebar'

type ReplaySessionListRow = {
  sessionId: string
  sessionDate: string | null
  channel: {
    id: string | null
    name: string | null
  }
  caller: string | null
  tradeCount: number
  netPnlPct: number | null
  sessionStart: string | null
  sessionEnd: string | null
  sessionSummary: string | null
}

type ReplaySessionsListResponse = {
  count: number
  sessions: ReplaySessionListRow[]
}

type ReplayDetailTrade = {
  id: string | null
  tradeIndex: number
  contract: {
    symbol: string | null
    strike: number | null
    type: string | null
    expiry: string | null
  }
  entry: {
    direction: string | null
    price: number | null
    timestamp: string | null
    sizing: string | null
  }
  stop?: {
    initial: number | null
  }
  targets?: {
    target1: number | null
    target2: number | null
  }
  outcome: {
    finalPnlPct: number | null
    isWinner: boolean | null
    fullyExited: boolean | null
    exitTimestamp: string | null
  }
  entrySnapshotId?: string | null
  thesis?: {
    text: string | null
    entryCondition?: string | null
    messageRef?: string | null
  }
  lifecycle?: {
    events?: Array<Record<string, unknown>> | null
  }
}

type ReplayDetailSnapshot = ReplayConfluenceSnapshotRow
type ReplayDetailMessage = {
  id: string | null
  discordMessageId?: string | null
  authorName: string | null
  authorId: string | null
  content: string | null
  sentAt: string | null
  isSignal: boolean | null
  signalType: string | null
  parsedTradeId: string | null
  createdAt?: string | null
}
type ReplayDetailBar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
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
  snapshots: ReplayDetailSnapshot[]
  trades: ReplayDetailTrade[]
  messages?: ReplayDetailMessage[]
  bars?: ReplayDetailBar[]
}

type ReplayDrillHistoryResponse = {
  count: number
  history: ReplayDrillHistoryEntry[]
}

type ReplayJournalSaveResponse = {
  sessionId: string
  parsedTradeId: string | null
  symbol: string | null
  count: number
  createdCount: number
  existingCount: number
  results: Array<{
    journalEntryId: string
    parsedTradeId: string | null
    importId: string
    replayBacklink: string
    status: 'created' | 'existing'
  }>
}

type LocalFilters = {
  from: string
  to: string
  symbol: string
  channelId: string
}

const DEFAULT_FILTERS: LocalFilters = {
  from: '',
  to: '',
  symbol: '',
  channelId: '',
}

const UNKNOWN_DAY_KEY = '__unknown_day__'

function buildReplaySessionsListEndpoint(filters: LocalFilters): string {
  const params = new URLSearchParams()
  const from = filters.from.trim()
  const to = filters.to.trim()
  const symbol = filters.symbol.trim().toUpperCase()
  const channelId = filters.channelId.trim()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (symbol) params.set('symbol', symbol)
  if (channelId) params.set('channelId', channelId)
  const query = params.toString()
  return query ? `/api/spx/replay-sessions?${query}` : '/api/spx/replay-sessions'
}

function buildReplaySessionDetailEndpoint(sessionId: string, symbol: string): string {
  const params = new URLSearchParams()
  params.set('symbol', symbol.trim().toUpperCase() || 'SPX')
  return `/api/spx/replay-sessions/${sessionId}?${params.toString()}`
}

function buildReplayDrillHistoryEndpoint(sessionId: string): string {
  const params = new URLSearchParams()
  params.set('sessionId', sessionId)
  params.set('limit', '25')
  return `/api/spx/drill-results/history?${params.toString()}`
}

function asReadableDate(value: string | null): string {
  if (!value) return 'n/a'
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function asCompactTimestamp(value: string | null): string {
  if (!value) return 'n/a'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function asSignedPercent(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  const rounded = value.toFixed(2)
  return `${value >= 0 ? '+' : ''}${rounded}%`
}

function toneForPercent(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'text-white/70'
  if (value > 0) return 'text-emerald-200'
  if (value < 0) return 'text-rose-200'
  return 'text-white/80'
}

function badgeToneForPercent(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'border-white/15 bg-white/[0.03] text-white/70'
  }
  if (value > 0) return 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
  if (value < 0) return 'border-rose-300/35 bg-rose-500/12 text-rose-100'
  return 'border-white/18 bg-white/[0.04] text-white/82'
}

function asDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return 'n/a'
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 'n/a'
  const diffMinutes = Math.round((endMs - startMs) / 60000)
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function asTimeSortValue(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeLifecycleEvents(value: unknown): ReplaySessionSyncLifecycleEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .map((event) => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return null
      const row = event as Record<string, unknown>
      return {
        type: toNullableString(row.type),
        value: toFiniteNumber(row.value),
        timestamp: toNullableString(row.timestamp),
        messageRef: toNullableString(row.messageRef),
      }
    })
    .filter((event): event is ReplaySessionSyncLifecycleEvent => event != null)
}

function resolveSessionDayKey(sessionDate: string | null): string {
  const value = sessionDate?.trim()
  if (!value) return UNKNOWN_DAY_KEY
  return value
}

function compareDayKeys(a: string, b: string): number {
  if (a === b) return 0
  if (a === UNKNOWN_DAY_KEY) return 1
  if (b === UNKNOWN_DAY_KEY) return -1
  const aMs = Date.parse(`${a}T00:00:00Z`)
  const bMs = Date.parse(`${b}T00:00:00Z`)
  const aValid = Number.isFinite(aMs)
  const bValid = Number.isFinite(bMs)
  if (aValid && bValid && aMs !== bMs) return bMs - aMs
  if (aValid && !bValid) return -1
  if (!aValid && bValid) return 1
  return b.localeCompare(a)
}

function asDayChipLabel(dayKey: string): string {
  if (dayKey === UNKNOWN_DAY_KEY) return 'Unknown'
  return asReadableDate(dayKey)
}

function compareSessionsDeterministically(a: ReplaySessionListRow, b: ReplaySessionListRow): number {
  const dayCompare = compareDayKeys(resolveSessionDayKey(a.sessionDate), resolveSessionDayKey(b.sessionDate))
  if (dayCompare !== 0) return dayCompare

  const aStart = asTimeSortValue(a.sessionStart)
  const bStart = asTimeSortValue(b.sessionStart)
  if (aStart !== null && bStart !== null && aStart !== bStart) return aStart - bStart
  if (aStart !== null && bStart === null) return -1
  if (aStart === null && bStart !== null) return 1

  const aEnd = asTimeSortValue(a.sessionEnd)
  const bEnd = asTimeSortValue(b.sessionEnd)
  if (aEnd !== null && bEnd !== null && aEnd !== bEnd) return aEnd - bEnd
  if (aEnd !== null && bEnd === null) return -1
  if (aEnd === null && bEnd !== null) return 1

  return a.sessionId.localeCompare(b.sessionId)
}

function resolveErrorCopy(error: Error | undefined): string {
  if (!error) return 'Unable to load replay sessions.'
  if (error instanceof SPXRequestError && error.status === 403) {
    return 'Replay Sessions are available to backend admins only. Your account does not currently have access.'
  }
  return error.message || 'Unable to load replay sessions.'
}

function resolveDetailErrorCopy(error: Error | undefined): string {
  if (!error) return 'Unable to load replay detail.'
  if (error instanceof SPXRequestError && error.status === 403) {
    return 'Replay detail is restricted to backend admins.'
  }
  return error.message || 'Unable to load replay detail.'
}

function resolveDrillHistoryErrorCopy(error: Error | undefined): string {
  if (!error) return 'Unable to load drill history.'
  if (error instanceof SPXRequestError && error.status === 403) {
    return 'Drill history is restricted to backend admins.'
  }
  return error.message || 'Unable to load drill history.'
}

export function ReplaySessionBrowser() {
  const transcriptJumpSequenceRef = useRef(0)
  const journalSaveLockRef = useRef(false)
  const [draftFilters, setDraftFilters] = useState<LocalFilters>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<LocalFilters>(DEFAULT_FILTERS)
  const [selectedDayKeyPreference, setSelectedDayKeyPreference] = useState<string | null>(null)
  const [selectedSessionIdPreference, setSelectedSessionIdPreference] = useState<string | null>(null)
  const [transcriptCursorSelection, setTranscriptCursorSelection] = useState<{
    sessionId: string
    cursorTimeIso: string | null
  } | null>(null)
  const [transcriptJumpSelection, setTranscriptJumpSelection] = useState<{
    sessionId: string
    requestId: number
    timeIso: string | null
  } | null>(null)
  const [snapshotCursorSelection, setSnapshotCursorSelection] = useState<{
    sessionId: string
    snapshotKey: string | null
  } | null>(null)
  const [journalSaveState, setJournalSaveState] = useState<{
    status: 'idle' | 'saving' | 'success' | 'error'
    message: string | null
  }>({
    status: 'idle',
    message: null,
  })

  const listEndpoint = useMemo(
    () => buildReplaySessionsListEndpoint(appliedFilters),
    [appliedFilters],
  )
  const selectedSymbol = appliedFilters.symbol.trim().toUpperCase() || 'SPX'

  const sessionsQuery = useSPXQuery<ReplaySessionsListResponse>(listEndpoint, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })
  const rawSessions = sessionsQuery.data?.sessions
  const sessions = useMemo(() => rawSessions ?? [], [rawSessions])
  const sortedSessions = useMemo(
    () => [...sessions].sort(compareSessionsDeterministically),
    [sessions],
  )
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sortedSessions) {
      const dayKey = resolveSessionDayKey(session.sessionDate)
      counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1)
    }
    return counts
  }, [sortedSessions])
  const availableDayKeys = useMemo(
    () => Array.from(dayCounts.keys()).sort(compareDayKeys),
    [dayCounts],
  )
  const selectedDayKey = useMemo(() => {
    if (availableDayKeys.length === 0) return null
    if (!selectedDayKeyPreference) return availableDayKeys[0] ?? null
    return availableDayKeys.includes(selectedDayKeyPreference)
      ? selectedDayKeyPreference
      : (availableDayKeys[0] ?? null)
  }, [availableDayKeys, selectedDayKeyPreference])
  const visibleSessions = useMemo(() => {
    if (!selectedDayKey) return sortedSessions
    return sortedSessions.filter((session) => resolveSessionDayKey(session.sessionDate) === selectedDayKey)
  }, [selectedDayKey, sortedSessions])
  const selectedSessionId = useMemo(() => {
    if (visibleSessions.length === 0) return null
    if (!selectedSessionIdPreference) return visibleSessions[0]?.sessionId ?? null
    const selectedStillVisible = visibleSessions.some(
      (session) => session.sessionId === selectedSessionIdPreference,
    )
    return selectedStillVisible ? selectedSessionIdPreference : visibleSessions[0]?.sessionId ?? null
  }, [selectedSessionIdPreference, visibleSessions])

  const detailEndpoint = useMemo(() => {
    if (!selectedSessionId) return null
    return buildReplaySessionDetailEndpoint(selectedSessionId, selectedSymbol)
  }, [selectedSessionId, selectedSymbol])

  const detailQuery = useSPXQuery<ReplaySessionDetailResponse>(detailEndpoint, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })
  const drillHistoryEndpoint = useMemo(
    () => (selectedSessionId ? buildReplayDrillHistoryEndpoint(selectedSessionId) : null),
    [selectedSessionId],
  )
  const drillHistoryQuery = useSPXQuery<ReplayDrillHistoryResponse>(drillHistoryEndpoint, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })
  const submitDrillResult = useCallback(async (
    payload: ReplayDrillSubmissionPayload,
  ): Promise<ReplayDrillSubmissionResponse> => {
    const browserSupabase = createBrowserSupabase()
    const {
      data: { session },
    } = await browserSupabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      throw new Error('You must be signed in to submit drill results.')
    }

    const requestBody: Record<string, unknown> = {
      sessionId: payload.sessionId,
      parsedTradeId: payload.parsedTradeId,
      decisionAt: payload.decisionAt,
      direction: payload.direction,
      strike: payload.strike,
      stopLevel: payload.stopLevel,
      targetLevel: payload.targetLevel,
      actualPnlPct: payload.actualPnlPct,
      engineDirection: payload.engineDirection,
    }
    const response = await postSPX<ReplayDrillSubmissionResponse>(
      '/api/spx/drill-results',
      token,
      requestBody,
    )
    await drillHistoryQuery.mutate()
    return response
  }, [drillHistoryQuery])
  const submitReplayJournalSave = useCallback(async (parsedTradeId: string | null): Promise<void> => {
    if (!selectedSessionId || journalSaveLockRef.current) return
    journalSaveLockRef.current = true
    setJournalSaveState({
      status: 'saving',
      message: parsedTradeId
        ? 'Saving replay trade to journal...'
        : 'Saving replay session trades to journal...',
    })

    try {
      const browserSupabase = createBrowserSupabase()
      const {
        data: { session },
      } = await browserSupabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        throw new Error('You must be signed in to save replay journal entries.')
      }

      const requestBody: Record<string, unknown> = {}
      if (parsedTradeId) {
        requestBody.parsedTradeId = parsedTradeId
      }

      const response = await postSPX<ReplayJournalSaveResponse>(
        `/api/spx/replay-sessions/${selectedSessionId}/journal`,
        token,
        requestBody,
      )
      setJournalSaveState({
        status: 'success',
        message: `Journal save complete: ${response.createdCount} new, ${response.existingCount} already saved.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save replay journal entries.'
      setJournalSaveState({
        status: 'error',
        message,
      })
    } finally {
      journalSaveLockRef.current = false
    }
  }, [selectedSessionId])
  const selectedSnapshotCursorKeyPreference = (
    snapshotCursorSelection != null
    && snapshotCursorSelection.sessionId === selectedSessionId
  )
    ? snapshotCursorSelection.snapshotKey
    : null
  const selectedTranscriptCursorTimeIso = (
    transcriptCursorSelection != null
    && transcriptCursorSelection.sessionId === selectedSessionId
  )
    ? transcriptCursorSelection.cursorTimeIso
    : null
  const selectedTranscriptJumpRequest = (
    transcriptJumpSelection != null
    && transcriptJumpSelection.sessionId === selectedSessionId
  )
    ? {
      requestId: transcriptJumpSelection.requestId,
      timeIso: transcriptJumpSelection.timeIso,
    }
    : null

  const onApplyFilters = () => {
    setAppliedFilters({
      from: draftFilters.from.trim(),
      to: draftFilters.to.trim(),
      symbol: draftFilters.symbol.trim().toUpperCase(),
      channelId: draftFilters.channelId.trim(),
    })
    setSelectedDayKeyPreference(null)
    setSelectedSessionIdPreference(null)
    setSnapshotCursorSelection(null)
    setTranscriptCursorSelection(null)
    setTranscriptJumpSelection(null)
  }

  const onResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setSelectedDayKeyPreference(null)
    setSelectedSessionIdPreference(null)
    setSnapshotCursorSelection(null)
    setTranscriptCursorSelection(null)
    setTranscriptJumpSelection(null)
  }

  const listErrorCopy = resolveErrorCopy(sessionsQuery.error)
  const detailErrorCopy = resolveDetailErrorCopy(detailQuery.error)
  const drillHistoryErrorCopy = resolveDrillHistoryErrorCopy(drillHistoryQuery.error)

  useEffect(() => {
    const unsubscribeCursor = subscribeReplayCursorTime((payload) => {
      if (!payload) return
      setTranscriptCursorSelection({
        sessionId: payload.sessionId,
        cursorTimeIso: payload.cursorTimeIso,
      })
    })
    const unsubscribeJump = subscribeReplayTranscriptJump((payload) => {
      if (!payload) return
      transcriptJumpSequenceRef.current += 1
      setTranscriptJumpSelection({
        sessionId: payload.sessionId,
        requestId: transcriptJumpSequenceRef.current,
        timeIso: payload.jumpTimeIso,
      })
    })

    return () => {
      unsubscribeCursor()
      unsubscribeJump()
    }
  }, [])

  useEffect(() => {
    if (!selectedSessionId) {
      publishReplaySessionSync(null)
      return
    }

    const detail = detailQuery.data
    if (!detail || detail.sessionId !== selectedSessionId) {
      publishReplaySessionSync(null)
      return
    }

    const payload: ReplaySessionSyncPayload = {
      sessionId: selectedSessionId,
      bars: Array.isArray(detail.bars) ? detail.bars : [],
      snapshots: Array.isArray(detail.snapshots) ? detail.snapshots : [],
      messages: Array.isArray(detail.messages)
        ? detail.messages.map((message) => ({
          id: message.id || null,
          discordMessageId: message.discordMessageId || null,
          authorName: message.authorName || null,
          authorId: message.authorId || null,
          content: message.content || null,
          sentAt: message.sentAt || null,
          isSignal: typeof message.isSignal === 'boolean' ? message.isSignal : null,
          signalType: message.signalType || null,
          parsedTradeId: message.parsedTradeId || null,
        }))
        : [],
      trades: Array.isArray(detail.trades)
        ? detail.trades.map((trade) => ({
          id: trade.id || null,
          tradeIndex: Number.isFinite(trade.tradeIndex) ? trade.tradeIndex : 0,
          entryTimestamp: trade.entry?.timestamp || null,
          exitTimestamp: trade.outcome?.exitTimestamp || null,
          thesisText: trade.thesis?.text || null,
          thesisMessageRef: toNullableString(trade.thesis?.messageRef),
          lifecycleEvents: normalizeLifecycleEvents(trade.lifecycle?.events),
        }))
        : [],
    }

    publishReplaySessionSync(payload)
  }, [detailQuery.data, selectedSessionId])

  useEffect(() => {
    return () => {
      publishReplaySessionSync(null)
    }
  }, [])

  useEffect(() => {
    journalSaveLockRef.current = false
    setJournalSaveState({
      status: 'idle',
      message: null,
    })
  }, [selectedSessionId])

  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
      data-testid="spx-replay-session-browser"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.1em] text-white/55">Replay Sessions</h3>
        <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/72">
          {sessions.length}
        </span>
      </div>

      <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-2">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[9px] text-white/60">
            <span className="mb-0.5 block uppercase tracking-[0.08em]">From</span>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 focus:border-emerald-300/40 focus:outline-none"
            />
          </label>
          <label className="text-[9px] text-white/60">
            <span className="mb-0.5 block uppercase tracking-[0.08em]">To</span>
            <input
              type="date"
              value={draftFilters.to}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 focus:border-emerald-300/40 focus:outline-none"
            />
          </label>
          <label className="text-[9px] text-white/60">
            <span className="mb-0.5 block uppercase tracking-[0.08em]">Symbol</span>
            <input
              type="text"
              value={draftFilters.symbol}
              onChange={(event) => setDraftFilters((current) => ({ ...current, symbol: event.target.value }))}
              placeholder="SPX"
              className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] uppercase text-white/85 placeholder:text-white/35 focus:border-emerald-300/40 focus:outline-none"
            />
          </label>
          <label className="text-[9px] text-white/60">
            <span className="mb-0.5 block uppercase tracking-[0.08em]">Channel</span>
            <input
              type="text"
              value={draftFilters.channelId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, channelId: event.target.value }))}
              placeholder="channel id"
              className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 placeholder:text-white/35 focus:border-emerald-300/40 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded border border-emerald-300/35 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/20"
            data-testid="spx-replay-filters-apply"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded border border-white/15 bg-white/[0.03] px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white/70 transition-colors hover:text-white"
            data-testid="spx-replay-filters-reset"
          >
            Reset
          </button>
          <span className="ml-auto text-[9px] text-white/45">Window defaults when blank</span>
        </div>
      </div>

      {!sessionsQuery.isLoading && !sessionsQuery.error && sessions.length > 0 && (
        <div className="mt-2 rounded border border-white/12 bg-black/15 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Session Days</p>
          <div className="mt-1 flex max-w-full gap-1 overflow-auto pb-0.5">
            {availableDayKeys.map((dayKey) => {
              const isActive = dayKey === selectedDayKey
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => {
                    setSelectedDayKeyPreference(dayKey)
                    setSelectedSessionIdPreference(null)
                    setSnapshotCursorSelection(null)
                    setTranscriptCursorSelection(null)
                    setTranscriptJumpSelection(null)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[9px] transition-colors',
                    isActive
                      ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/90',
                  )}
                  data-testid={`spx-replay-day-chip-${dayKey}`}
                >
                  <span className="whitespace-nowrap">{asDayChipLabel(dayKey)}</span>
                  <span className="font-mono text-[8px] text-white/60">{dayCounts.get(dayKey) ?? 0}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
        <div className="space-y-1.5">
          {sessionsQuery.isLoading ? (
            <div className="space-y-1.5" data-testid="spx-replay-list-loading">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[62px] animate-pulse rounded border border-white/10 bg-white/[0.025]" />
              ))}
            </div>
          ) : sessionsQuery.error ? (
            <div className="rounded border border-rose-300/20 bg-rose-500/10 px-2 py-2 text-[10px] text-rose-100">
              {listErrorCopy}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded border border-white/12 bg-black/15 px-2 py-2 text-[10px] text-white/55">
              No replay sessions match the current filters.
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="rounded border border-white/12 bg-black/15 px-2 py-2 text-[10px] text-white/55">
              No replay sessions are available for the selected day.
            </div>
          ) : (
            <div className="max-h-[340px] space-y-1.5 overflow-auto pr-0.5">
              <div className="mb-1 flex items-center justify-between gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1">
                <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">
                  {asDayChipLabel(selectedDayKey || UNKNOWN_DAY_KEY)}
                </p>
                <span className="rounded border border-white/12 bg-white/[0.02] px-1.5 py-0.5 font-mono text-[8px] text-white/65">
                  {visibleSessions.length}
                </span>
              </div>
              {visibleSessions.map((session) => {
                const isSelected = session.sessionId === selectedSessionId
                const channelLabel = session.channel.name || session.channel.id || 'unknown'
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => {
                      setSelectedSessionIdPreference(session.sessionId)
                      setSnapshotCursorSelection(null)
                      setTranscriptJumpSelection(null)
                    }}
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-left transition-colors',
                      isSelected
                        ? 'border-emerald-300/35 bg-emerald-500/12'
                        : 'border-white/12 bg-white/[0.02] hover:bg-white/[0.05]',
                    )}
                    data-testid={`spx-replay-session-row-${session.sessionId}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-white/85">{asReadableDate(session.sessionDate)}</p>
                        <p className="mt-0.5 text-[10px] text-white/66">{session.caller || 'unknown caller'}</p>
                      </div>
                      <p className="font-mono text-[9px] text-white/40">{session.sessionId}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/78">
                        Trades {session.tradeCount}
                      </span>
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[9px] font-mono',
                          badgeToneForPercent(session.netPnlPct),
                        )}
                      >
                        P&L {asSignedPercent(session.netPnlPct)}
                      </span>
                      <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/78">
                        Duration {asDuration(session.sessionStart, session.sessionEnd)}
                      </span>
                      <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/78">
                        Channel {channelLabel}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded border border-white/12 bg-black/15 px-2 py-2">
          {!selectedSessionId ? (
            <p className="text-[10px] text-white/55">Select a session to preview snapshots, trades, and messages.</p>
          ) : detailQuery.isLoading ? (
            <div className="space-y-1.5" data-testid="spx-replay-detail-loading">
              <div className="h-6 animate-pulse rounded border border-white/10 bg-white/[0.025]" />
              <div className="h-16 animate-pulse rounded border border-white/10 bg-white/[0.025]" />
              <div className="h-24 animate-pulse rounded border border-white/10 bg-white/[0.025]" />
            </div>
          ) : detailQuery.error ? (
            <div className="rounded border border-rose-300/20 bg-rose-500/10 px-2 py-2 text-[10px] text-rose-100">
              {detailErrorCopy}
            </div>
          ) : detailQuery.data ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Session Detail</p>
                <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-white/75">
                  {detailQuery.data.symbol || selectedSymbol}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-1">
                  <p className="text-[9px] text-white/45">Snapshots</p>
                  <p className="font-mono text-[10px] text-white/88">{detailQuery.data.counts.snapshots}</p>
                </div>
                <div className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-1">
                  <p className="text-[9px] text-white/45">Trades</p>
                  <p className="font-mono text-[10px] text-white/88">{detailQuery.data.counts.trades}</p>
                </div>
                <div className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-1">
                  <p className="text-[9px] text-white/45">Messages</p>
                  <p className="font-mono text-[10px] text-white/88">{detailQuery.data.counts.messages}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Trade Preview</p>
                  <button
                    type="button"
                    onClick={() => {
                      void submitReplayJournalSave(null)
                    }}
                    disabled={detailQuery.data.trades.length === 0 || journalSaveState.status === 'saving'}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] transition-colors',
                      detailQuery.data.trades.length === 0 || journalSaveState.status === 'saving'
                        ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/45'
                        : 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/20',
                    )}
                    data-testid="spx-replay-save-journal-session"
                  >
                    Save to Journal
                  </button>
                </div>
                {journalSaveState.status !== 'idle' && journalSaveState.message && (
                  <p
                    className={cn(
                      'text-[9px]',
                      journalSaveState.status === 'error'
                        ? 'text-rose-200'
                        : journalSaveState.status === 'success'
                          ? 'text-emerald-200'
                          : 'text-white/65',
                    )}
                    data-testid="spx-replay-save-journal-status"
                  >
                    {journalSaveState.message}
                  </p>
                )}
                {detailQuery.data.trades.length === 0 ? (
                  <p className="text-[10px] text-white/50">No trades for the selected symbol/session.</p>
                ) : (
                  detailQuery.data.trades.slice(0, 3).map((trade) => (
                    <article
                      key={trade.id || `trade-${trade.tradeIndex}`}
                      className="rounded border border-white/12 bg-white/[0.025] px-1.5 py-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-white/82">
                          #{trade.tradeIndex} {trade.contract.symbol || '--'} {trade.contract.strike ?? '--'} {trade.contract.type || '--'}
                        </p>
                        <p className={cn('text-[10px] font-mono', toneForPercent(trade.outcome.finalPnlPct))}>
                          {asSignedPercent(trade.outcome.finalPnlPct)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[9px] text-white/55">
                        Entry {trade.entry.price ?? '--'} · {asCompactTimestamp(trade.entry.timestamp)}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            void submitReplayJournalSave(trade.id || null)
                          }}
                          disabled={!trade.id || journalSaveState.status === 'saving'}
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] transition-colors',
                            !trade.id || journalSaveState.status === 'saving'
                              ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/45'
                              : 'border-champagne/40 bg-champagne/12 text-champagne hover:bg-champagne/18',
                          )}
                          data-testid={`spx-replay-save-journal-trade-${trade.id || `idx-${trade.tradeIndex}`}`}
                        >
                          Save to Journal
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <ReplayDrillMode
                sessionId={detailQuery.data.sessionId}
                symbol={detailQuery.data.symbol || selectedSymbol}
                trades={detailQuery.data.trades ?? []}
                snapshots={detailQuery.data.snapshots ?? []}
                history={drillHistoryQuery.data?.history ?? []}
                historyLoading={Boolean(selectedSessionId) && drillHistoryQuery.isLoading}
                historyError={drillHistoryQuery.error ? drillHistoryErrorCopy : null}
                onSubmit={submitDrillResult}
              />

              <ReplayConfluencePanel
                snapshots={detailQuery.data.snapshots ?? []}
                selectedSnapshotKey={selectedSnapshotCursorKeyPreference}
                onSelectedSnapshotKeyChange={(snapshotKey) => {
                  if (!selectedSessionId) return
                  setSnapshotCursorSelection({ sessionId: selectedSessionId, snapshotKey })
                }}
              />
              <ReplayTranscriptSidebar
                sessionId={selectedSessionId}
                messages={detailQuery.data.messages ?? []}
                cursorTimeIso={selectedTranscriptCursorTimeIso}
                jumpRequest={selectedTranscriptJumpRequest}
              />
            </div>
          ) : (
            <p className="text-[10px] text-white/55">Select a session to preview snapshots, trades, and messages.</p>
          )}
        </div>
      </div>
    </section>
  )
}
