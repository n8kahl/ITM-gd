'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ReplayDrillHistoryEntry = {
  id: string | null
  sessionId: string | null
  parsedTradeId: string | null
  decisionAt: string | null
  direction: 'long' | 'short' | 'flat' | null
  strike: number | null
  stopLevel: number | null
  targetLevel: number | null
  learnerRr: number | null
  learnerPnlPct: number | null
  actualPnlPct: number | null
  engineDirection: 'bullish' | 'bearish' | 'neutral' | null
  directionMatch: boolean | null
  score: number | null
  feedbackSummary: string | null
  createdAt: string | null
  session?: {
    sessionDate: string | null
    channelName: string | null
    caller: string | null
  } | null
  trade?: {
    symbol: string | null
    tradeIndex: number | null
  } | null
}

export type ReplayDrillTrade = {
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
}

export type ReplayDrillSubmissionPayload = {
  sessionId: string
  parsedTradeId: string | null
  decisionAt: string
  direction: 'long' | 'short' | 'flat'
  strike: number | null
  stopLevel: number | null
  targetLevel: number | null
  actualPnlPct: number | null
  engineDirection: 'bullish' | 'bearish' | 'neutral' | null
}

export type ReplayDrillSubmissionResponse = {
  result: ReplayDrillHistoryEntry
}

type ReplayDrillModeProps = {
  sessionId: string
  symbol: string
  trades: ReplayDrillTrade[]
  snapshots: Record<string, unknown>[]
  history: ReplayDrillHistoryEntry[]
  historyLoading: boolean
  historyError: string | null
  onSubmit: (payload: ReplayDrillSubmissionPayload) => Promise<ReplayDrillSubmissionResponse>
}

type DraftDecision = {
  direction: 'long' | 'short' | 'flat'
  strike: string
  stopLevel: string
  targetLevel: string
}

const DEFAULT_DRAFT_DECISION: DraftDecision = {
  direction: 'flat',
  strike: '',
  stopLevel: '',
  targetLevel: '',
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

function normalizeDirectionLabel(value: string | null): string {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'long' || normalized === 'bullish') return 'Long/Bullish'
  if (normalized === 'short' || normalized === 'bearish') return 'Short/Bearish'
  if (normalized === 'flat' || normalized === 'neutral') return 'Flat/Neutral'
  return 'n/a'
}

function parseSnapshotCapturedAt(snapshot: Record<string, unknown>): number | null {
  const value = typeof snapshot.captured_at === 'string'
    ? snapshot.captured_at
    : typeof snapshot.capturedAt === 'string'
      ? snapshot.capturedAt
      : null
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseSnapshotId(snapshot: Record<string, unknown>): string | null {
  if (typeof snapshot.id === 'string' && snapshot.id.trim().length > 0) return snapshot.id.trim()
  return null
}

function resolveSnapshotForTrade(
  trade: ReplayDrillTrade | null,
  snapshots: Record<string, unknown>[],
): Record<string, unknown> | null {
  if (!trade || snapshots.length === 0) return null

  const entrySnapshotId = typeof trade.entrySnapshotId === 'string' && trade.entrySnapshotId.trim().length > 0
    ? trade.entrySnapshotId.trim()
    : null

  if (entrySnapshotId) {
    const byId = snapshots.find((snapshot) => parseSnapshotId(snapshot) === entrySnapshotId)
    if (byId) return byId
  }

  const entryMs = trade.entry.timestamp ? Date.parse(trade.entry.timestamp) : Number.NaN
  if (!Number.isFinite(entryMs)) {
    return snapshots[snapshots.length - 1] ?? null
  }

  let candidate: Record<string, unknown> | null = null
  let candidateMs = Number.NEGATIVE_INFINITY

  for (const snapshot of snapshots) {
    const capturedAtMs = parseSnapshotCapturedAt(snapshot)
    if (capturedAtMs == null || capturedAtMs > entryMs) continue
    if (capturedAtMs > candidateMs) {
      candidate = snapshot
      candidateMs = capturedAtMs
    }
  }

  return candidate ?? snapshots[snapshots.length - 1] ?? null
}

function inferEngineDirection(
  trade: ReplayDrillTrade | null,
  snapshot: Record<string, unknown> | null,
): 'bullish' | 'bearish' | 'neutral' | null {
  const composite = snapshot ? toFiniteNumber(snapshot.mtf_composite) : null
  if (composite != null) {
    if (composite > 0) return 'bullish'
    if (composite < 0) return 'bearish'
    return 'neutral'
  }

  const normalized = String(trade?.entry.direction || '').trim().toLowerCase()
  if (normalized === 'long' || normalized === 'bullish') return 'bullish'
  if (normalized === 'short' || normalized === 'bearish') return 'bearish'
  if (normalized === 'flat' || normalized === 'neutral') return 'neutral'
  return null
}

function toHistoryTimestamp(entry: ReplayDrillHistoryEntry): number {
  const first = entry.decisionAt || entry.createdAt
  if (!first) return 0
  const parsed = Date.parse(first)
  return Number.isFinite(parsed) ? parsed : 0
}

export function ReplayDrillMode({
  sessionId,
  symbol,
  trades,
  snapshots,
  history,
  historyLoading,
  historyError,
  onSubmit,
}: ReplayDrillModeProps) {
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [decision, setDecision] = useState<DraftDecision>(DEFAULT_DRAFT_DECISION)
  const [submissionResult, setSubmissionResult] = useState<ReplayDrillHistoryEntry | null>(null)

  useEffect(() => {
    if (trades.length === 0) {
      setSelectedTradeId(null)
      return
    }

    if (!selectedTradeId || !trades.some((trade) => (trade.id || `idx-${trade.tradeIndex}`) === selectedTradeId)) {
      const firstTrade = trades[0]
      setSelectedTradeId(firstTrade ? (firstTrade.id || `idx-${firstTrade.tradeIndex}`) : null)
    }
  }, [selectedTradeId, trades])

  useEffect(() => {
    setIsPaused(false)
    setIsRevealed(false)
    setIsSubmitting(false)
    setSubmitError(null)
    setDecision(DEFAULT_DRAFT_DECISION)
    setSubmissionResult(null)
  }, [sessionId])

  const selectedTrade = useMemo(() => {
    if (!selectedTradeId) return null
    return trades.find((trade) => (trade.id || `idx-${trade.tradeIndex}`) === selectedTradeId) || null
  }, [selectedTradeId, trades])

  const selectedSnapshot = useMemo(
    () => resolveSnapshotForTrade(selectedTrade, snapshots),
    [selectedTrade, snapshots],
  )

  const engineDirection = useMemo(
    () => inferEngineDirection(selectedTrade, selectedSnapshot),
    [selectedSnapshot, selectedTrade],
  )

  const orderedHistory = useMemo(
    () => [...history].sort((a, b) => toHistoryTimestamp(b) - toHistoryTimestamp(a)),
    [history],
  )

  const onStartDrill = () => {
    setIsPaused(true)
    setIsRevealed(false)
    setIsSubmitting(false)
    setSubmitError(null)
    setSubmissionResult(null)
  }

  const onResetDrill = () => {
    setIsPaused(false)
    setIsRevealed(false)
    setIsSubmitting(false)
    setSubmitError(null)
    setDecision(DEFAULT_DRAFT_DECISION)
    setSubmissionResult(null)
  }

  const onReveal = async () => {
    if (!selectedTrade || !isPaused || isSubmitting) return

    const strike = decision.strike.trim().length > 0 ? Number(decision.strike) : null
    const stopLevel = decision.stopLevel.trim().length > 0 ? Number(decision.stopLevel) : null
    const targetLevel = decision.targetLevel.trim().length > 0 ? Number(decision.targetLevel) : null

    if (decision.direction !== 'flat') {
      if (!Number.isFinite(strike) || !Number.isFinite(stopLevel) || !Number.isFinite(targetLevel)) {
        setSubmitError('Strike, stop, and target are required for long/short decisions.')
        return
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload: ReplayDrillSubmissionPayload = {
        sessionId,
        parsedTradeId: selectedTrade.id,
        decisionAt: selectedTrade.entry.timestamp || new Date().toISOString(),
        direction: decision.direction,
        strike: decision.direction === 'flat' ? null : (strike ?? null),
        stopLevel: decision.direction === 'flat' ? null : (stopLevel ?? null),
        targetLevel: decision.direction === 'flat' ? null : (targetLevel ?? null),
        actualPnlPct: selectedTrade.outcome.finalPnlPct,
        engineDirection,
      }

      const response = await onSubmit(payload)
      setSubmissionResult(response.result)
      setIsRevealed(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit drill result.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeResult = submissionResult

  return (
    <section
      className="rounded border border-white/12 bg-white/[0.02] px-2 py-2"
      data-testid="spx-replay-drill-mode"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Interactive Drill Mode</p>
        <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-white/70">
          Hidden outcome until reveal
        </span>
      </div>

      {trades.length === 0 ? (
        <p className="mt-1.5 text-[10px] text-white/55">No replay trades available for drill mode.</p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <label className="block text-[9px] text-white/60">
            <span className="mb-0.5 block uppercase tracking-[0.08em]">Decision point trade</span>
            <select
              value={selectedTradeId ?? ''}
              onChange={(event) => {
                setSelectedTradeId(event.target.value)
                setIsPaused(false)
                setIsRevealed(false)
                setSubmitError(null)
                setSubmissionResult(null)
              }}
              className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 focus:border-emerald-300/40 focus:outline-none"
              data-testid="spx-replay-drill-trade-select"
            >
              {trades.map((trade) => {
                const value = trade.id || `idx-${trade.tradeIndex}`
                return (
                  <option key={value} value={value}>
                    #{trade.tradeIndex} {trade.contract.symbol || symbol} {trade.contract.strike ?? '--'} {trade.contract.type || '--'}
                  </option>
                )
              })}
            </select>
          </label>

          <div className="rounded border border-white/12 bg-black/20 px-1.5 py-1">
            <p className="text-[9px] text-white/60">
              Pause at
              {' '}
              <span className="font-mono text-white/85">
                {asCompactTimestamp(selectedTrade?.entry.timestamp || null)}
              </span>
            </p>
            {isPaused && !isRevealed ? (
              <p
                className="mt-0.5 text-[9px] text-amber-100/90"
                data-testid="spx-replay-drill-hidden"
              >
                Future bars and actual outcome are hidden. Submit your decision to reveal.
              </p>
            ) : null}
          </div>

          <div className="grid gap-1 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <button
              type="button"
              onClick={onStartDrill}
              className="rounded border border-emerald-300/35 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/20"
              data-testid="spx-replay-drill-start"
            >
              Pause + Predict
            </button>
            <button
              type="button"
              onClick={onReveal}
              disabled={!isPaused || isSubmitting}
              className={cn(
                'rounded border px-2 py-1 text-[9px] uppercase tracking-[0.08em] transition-colors',
                !isPaused || isSubmitting
                  ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35'
                  : 'border-sky-300/40 bg-sky-500/12 text-sky-100 hover:bg-sky-500/20',
              )}
              data-testid="spx-replay-drill-reveal"
            >
              {isSubmitting ? 'Scoring...' : 'Reveal + Score'}
            </button>
            <button
              type="button"
              onClick={onResetDrill}
              className="rounded border border-white/15 bg-white/[0.03] px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white/70 transition-colors hover:text-white"
            >
              Reset
            </button>
          </div>

          <div className="rounded border border-white/12 bg-black/20 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Your decision</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(['long', 'short', 'flat'] as const).map((directionValue) => (
                <button
                  key={directionValue}
                  type="button"
                  onClick={() => setDecision((current) => ({ ...current, direction: directionValue }))}
                  className={cn(
                    'rounded border px-1.5 py-1 text-[9px] uppercase tracking-[0.06em] transition-colors',
                    decision.direction === directionValue
                      ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                      : 'border-white/12 bg-white/[0.03] text-white/70 hover:text-white/90',
                  )}
                  data-testid={`spx-replay-drill-direction-${directionValue}`}
                >
                  {directionValue}
                </button>
              ))}
            </div>
            <div className="mt-1 grid gap-1 sm:grid-cols-3">
              <label className="text-[9px] text-white/58">
                <span className="mb-0.5 block uppercase tracking-[0.08em]">Strike</span>
                <input
                  type="number"
                  value={decision.strike}
                  onChange={(event) => setDecision((current) => ({ ...current, strike: event.target.value }))}
                  disabled={decision.direction === 'flat'}
                  className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="spx-replay-drill-input-strike"
                />
              </label>
              <label className="text-[9px] text-white/58">
                <span className="mb-0.5 block uppercase tracking-[0.08em]">Stop</span>
                <input
                  type="number"
                  value={decision.stopLevel}
                  onChange={(event) => setDecision((current) => ({ ...current, stopLevel: event.target.value }))}
                  disabled={decision.direction === 'flat'}
                  className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="spx-replay-drill-input-stop"
                />
              </label>
              <label className="text-[9px] text-white/58">
                <span className="mb-0.5 block uppercase tracking-[0.08em]">Target</span>
                <input
                  type="number"
                  value={decision.targetLevel}
                  onChange={(event) => setDecision((current) => ({ ...current, targetLevel: event.target.value }))}
                  disabled={decision.direction === 'flat'}
                  className="w-full rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[10px] text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="spx-replay-drill-input-target"
                />
              </label>
            </div>
          </div>

          {submitError ? (
            <p className="rounded border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100">
              {submitError}
            </p>
          ) : null}

          {isRevealed && activeResult ? (
            <section
              className="rounded border border-emerald-300/25 bg-emerald-500/[0.08] px-2 py-1.5"
              data-testid="spx-replay-drill-reveal-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] uppercase tracking-[0.08em] text-emerald-100/90">Reveal Scorecard</p>
                <p className="rounded border border-emerald-200/30 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-100" data-testid="spx-replay-drill-score">
                  Score {activeResult.score ?? '--'}
                </p>
              </div>
              <div className="mt-1 grid gap-1 sm:grid-cols-3">
                <article className="rounded border border-white/14 bg-black/20 px-1.5 py-1">
                  <p className="text-[8px] uppercase tracking-[0.08em] text-white/50">Learner</p>
                  <p className="text-[10px] text-white/86">{normalizeDirectionLabel(activeResult.direction)}</p>
                  <p className="text-[9px] text-white/65">S {activeResult.strike ?? '--'} · Stop {activeResult.stopLevel ?? '--'} · T {activeResult.targetLevel ?? '--'}</p>
                </article>
                <article className="rounded border border-white/14 bg-black/20 px-1.5 py-1">
                  <p className="text-[8px] uppercase tracking-[0.08em] text-white/50">Actual</p>
                  <p className="text-[10px] text-white/86">{normalizeDirectionLabel(selectedTrade?.entry.direction || null)}</p>
                  <p className="text-[9px] text-white/65">Stop {selectedTrade?.stop?.initial ?? '--'} · T1 {selectedTrade?.targets?.target1 ?? '--'}</p>
                </article>
                <article className="rounded border border-white/14 bg-black/20 px-1.5 py-1">
                  <p className="text-[8px] uppercase tracking-[0.08em] text-white/50">Engine context</p>
                  <p className="text-[10px] text-white/86">{normalizeDirectionLabel(activeResult.engineDirection)}</p>
                  <p className="text-[9px] text-white/65">MTF {String(selectedSnapshot?.mtf_1h_trend || 'n/a')}</p>
                </article>
              </div>
              <p className="mt-1 text-[10px] text-white/82">
                Learner PnL {asSignedPercent(activeResult.learnerPnlPct)} · Actual PnL {asSignedPercent(activeResult.actualPnlPct)}
              </p>
              {activeResult.feedbackSummary ? (
                <p className="mt-0.5 text-[9px] text-white/72">{activeResult.feedbackSummary}</p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded border border-white/12 bg-black/20 px-2 py-1.5" data-testid="spx-replay-drill-history">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Recent drill history</p>
              <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-white/70">{orderedHistory.length}</span>
            </div>
            {historyLoading ? (
              <p className="mt-1 text-[10px] text-white/55">Loading drill history...</p>
            ) : historyError ? (
              <p className="mt-1 text-[10px] text-rose-100">{historyError}</p>
            ) : orderedHistory.length === 0 ? (
              <p className="mt-1 text-[10px] text-white/55">No drill attempts saved yet.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {orderedHistory.slice(0, 4).map((entry) => (
                  <article
                    key={entry.id || `${entry.decisionAt || entry.createdAt}-${entry.score ?? 0}`}
                    className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] text-white/80">{asCompactTimestamp(entry.decisionAt || entry.createdAt)}</p>
                      <p className="font-mono text-[9px] text-white/75">Score {entry.score ?? '--'}</p>
                    </div>
                    <p className="text-[9px] text-white/62">
                      {normalizeDirectionLabel(entry.direction)} · Learner {asSignedPercent(entry.learnerPnlPct)} · Actual {asSignedPercent(entry.actualPnlPct)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
