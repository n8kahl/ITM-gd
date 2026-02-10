'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, RefreshCw, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { motion } from 'framer-motion'
import {
  AICoachAPIError,
  getEarningsAnalysis,
  getEarningsCalendar,
  type EarningsAnalysisResponse,
  type EarningsCalendarEvent,
} from '@/lib/api/ai-coach'
import { runWithRetry } from './retry'

interface EarningsDashboardProps {
  onClose?: () => void
  onSendPrompt?: (prompt: string) => void
}

const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META']

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

function parseWatchlistInput(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function EarningsDashboard({ onClose, onSendPrompt }: EarningsDashboardProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [watchlistInput, setWatchlistInput] = useState(DEFAULT_WATCHLIST.join(', '))
  const [daysAhead, setDaysAhead] = useState(14)
  const [events, setEvents] = useState<EarningsCalendarEvent[]>([])
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarRetryNotice, setCalendarRetryNotice] = useState<string | null>(null)

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<EarningsAnalysisResponse | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisRetryNotice, setAnalysisRetryNotice] = useState<string | null>(null)

  const [ivCrushSlider, setIvCrushSlider] = useState(25)

  const watchlist = useMemo(() => parseWatchlistInput(watchlistInput), [watchlistInput])
  const analysisSymbols = useMemo(
    () => (watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST),
    [watchlist],
  )

  const loadCalendar = useCallback(async () => {
    if (!token) return

    setIsLoadingCalendar(true)
    setCalendarError(null)
    setCalendarRetryNotice(null)

    try {
      const data = await runWithRetry(
        () => getEarningsCalendar(token, watchlist, daysAhead),
        {
          onRetry: ({ nextAttempt, maxAttempts }) => {
            setCalendarRetryNotice(`Refreshing earnings calendar (${nextAttempt}/${maxAttempts})...`)
          },
        },
      )
      setEvents(data.events)
      if (data.events.length > 0) {
        setSelectedSymbol((prev) => {
          if (prev && data.events.some((event) => event.symbol === prev)) {
            return prev
          }
          return data.events[0]?.symbol ?? analysisSymbols[0] ?? null
        })
      } else {
        setSelectedSymbol((prev) => prev ?? analysisSymbols[0] ?? null)
      }
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to load earnings calendar'
      setCalendarError(message)
      setEvents([])
    } finally {
      setCalendarRetryNotice(null)
      setIsLoadingCalendar(false)
    }
  }, [analysisSymbols, daysAhead, token, watchlist])

  const loadAnalysis = useCallback(async (symbol: string) => {
    if (!token) return

    setIsLoadingAnalysis(true)
    setAnalysisError(null)
    setAnalysisRetryNotice(null)

    try {
      const data = await runWithRetry(
        () => getEarningsAnalysis(symbol, token),
        {
          maxAttempts: 2,
          onRetry: ({ nextAttempt, maxAttempts }) => {
            setAnalysisRetryNotice(`Refreshing ${symbol} analysis (${nextAttempt}/${maxAttempts})...`)
          },
        },
      )
      setAnalysis(data)
      setIvCrushSlider(Math.round(data.projectedIVCrushPct ?? 25))
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to load earnings analysis'
      setAnalysisError(message)
      setAnalysis(null)
    } finally {
      setAnalysisRetryNotice(null)
      setIsLoadingAnalysis(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    loadCalendar()
  }, [token, loadCalendar])

  useEffect(() => {
    if (!selectedSymbol) return
    loadAnalysis(selectedSymbol)
  }, [selectedSymbol, loadAnalysis])

  const historicalMoves = useMemo(
    () => (Array.isArray(analysis?.historicalMoves) ? analysis.historicalMoves : []),
    [analysis],
  )

  const suggestedStrategies = useMemo(
    () => (Array.isArray(analysis?.suggestedStrategies) ? analysis.suggestedStrategies : []),
    [analysis],
  )

  const expectedMovePct = asNumber(analysis?.expectedMove?.pct)
  const expectedMovePoints = asNumber(analysis?.expectedMove?.points)
  const avgHistoricalMove = asNumber(analysis?.avgHistoricalMove)
  const moveOverpricing = asNumber(analysis?.moveOverpricing)
  const currentIV = asNumber(analysis?.currentIV)
  const preEarningsIVRank = asNumber(analysis?.preEarningsIVRank)
  const atmStraddle = asNumber(analysis?.straddlePricing?.atmStraddle)

  const maxHistoricalMove = useMemo(() => {
    if (historicalMoves.length === 0) return 1
    return Math.max(
      ...historicalMoves.map((move) => Math.max(asNumber(move.expectedMove) ?? 0, asNumber(move.actualMove) ?? 0)),
      expectedMovePct ?? 0,
      1,
    )
  }, [expectedMovePct, historicalMoves])

  const projectedStraddleValue = useMemo(() => {
    if (!analysis || !currentIV || currentIV <= 0 || atmStraddle == null) return null
    const crushRatio = Math.max(0, 1 - (ivCrushSlider / 100))
    return atmStraddle * crushRatio
  }, [analysis, atmStraddle, currentIV, ivCrushSlider])

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-white/5 p-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-white flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-amber-300" />
            Earnings Intelligence
          </h2>
          <p className="text-xs text-white/40">Calendar, expected move, and strategy planning</p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={loadCalendar}
            className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5"
            title="Refresh calendar"
            {...PRESSABLE_PROPS}
          >
            <RefreshCw className={cn('w-4 h-4', isLoadingCalendar && 'animate-spin')} />
          </motion.button>
          {onClose && (
            <motion.button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70"
              {...PRESSABLE_PROPS}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      <div className="border-b border-white/5 p-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input
          value={watchlistInput}
          onChange={(event) => setWatchlistInput(event.target.value)}
          placeholder="AAPL, NVDA, TSLA"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
        />

        <select
          value={daysAhead}
          onChange={(event) => setDaysAhead(Number(event.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
        >
          {[7, 14, 21, 30, 45, 60].map((days) => (
            <option key={days} value={days}>{days} days</option>
          ))}
        </select>

        <motion.button
          type="button"
          onClick={loadCalendar}
          disabled={isLoadingCalendar}
          className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
          {...PRESSABLE_PROPS}
        >
          Apply
        </motion.button>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[320px_1fr]">
        <aside className="border-r border-white/5 overflow-y-auto">
          {isLoadingCalendar && events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
              {calendarRetryNotice && (
                <p className="text-[11px] text-amber-200/80">{calendarRetryNotice}</p>
              )}
            </div>
          ) : calendarError ? (
            <div className="p-4 text-xs text-red-300">{calendarError}</div>
          ) : events.length === 0 ? (
            <div className="p-4">
              <p className="text-xs text-white/40">
                No earnings events found for this window.
              </p>
              <p className="mt-2 text-[11px] text-white/35">
                You can still run earnings analysis for your watchlist symbols:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysisSymbols.map((symbol) => (
                  <button
                    key={`earnings-fallback-${symbol}`}
                    type="button"
                    onClick={() => setSelectedSymbol(symbol)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors',
                      selectedSymbol === symbol
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]'
                    )}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {events.map((event) => (
                <motion.button
                  key={`${event.symbol}-${event.date}`}
                  type="button"
                  onClick={() => setSelectedSymbol(event.symbol)}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                    selectedSymbol === event.symbol
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                  {...PRESSABLE_PROPS}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{event.symbol}</span>
                    <span className="text-[10px] text-white/45">{event.time}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/55">{event.date}</div>
                  {!event.confirmed && (
                    <div className="mt-1 text-[10px] text-amber-300/80">Date not yet confirmed</div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </aside>

        <section className="overflow-y-auto p-4">
          {!selectedSymbol && (
            <div className="h-full flex items-center justify-center text-sm text-white/40">
              Select a symbol to analyze earnings setup
            </div>
          )}

          {selectedSymbol && isLoadingAnalysis && !analysis && (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
              {analysisRetryNotice && (
                <p className="text-[11px] text-amber-200/80">{analysisRetryNotice}</p>
              )}
            </div>
          )}

          {analysisError && (
            <p className="text-sm text-red-300 mb-3">{analysisError}</p>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Expected Move"
                  value={expectedMovePct != null ? `${expectedMovePct.toFixed(2)}%` : 'n/a'}
                  sub={expectedMovePoints != null ? `${expectedMovePoints.toFixed(2)} pts` : undefined}
                  tone="amber"
                />
                <MetricCard
                  label="Avg Historical Move"
                  value={avgHistoricalMove != null ? `${avgHistoricalMove.toFixed(2)}%` : 'n/a'}
                  sub={`${historicalMoves.length} reports`}
                  tone="blue"
                />
                <MetricCard
                  label="Straddle Pricing"
                  value={String(analysis.straddlePricing?.assessment || 'fair').toUpperCase()}
                  sub={moveOverpricing != null ? `${moveOverpricing.toFixed(1)}% vs history` : 'n/a'}
                  tone={analysis.straddlePricing?.assessment === 'overpriced' ? 'red' : analysis.straddlePricing?.assessment === 'underpriced' ? 'emerald' : 'blue'}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-white">Historical Expected vs Actual Moves</h3>
                  <span className="text-[10px] text-white/45">Last {historicalMoves.length || 0} events</span>
                </div>

                {historicalMoves.length === 0 ? (
                  <p className="mt-2 text-xs text-white/45">Not enough historical earnings records yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {historicalMoves.map((move) => (
                      <div key={move.date} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-white/45">
                          <span>{move.date}</span>
                          <span>{move.direction === 'up' ? 'Up' : 'Down'} · {move.surprise}</span>
                        </div>
                        <div className="grid grid-cols-[52px_1fr] items-center gap-2">
                          <span className="text-[10px] text-white/40">Expected</span>
                          <div className="h-1.5 rounded bg-white/5">
                            <div className="h-1.5 rounded bg-sky-400/70" style={{ width: `${((asNumber(move.expectedMove) ?? 0) / maxHistoricalMove) * 100}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-[52px_1fr] items-center gap-2">
                          <span className="text-[10px] text-white/40">Actual</span>
                          <div className="h-1.5 rounded bg-white/5">
                            <div className={cn('h-1.5 rounded', move.direction === 'up' ? 'bg-emerald-400/80' : 'bg-red-400/80')} style={{ width: `${((asNumber(move.actualMove) ?? 0) / maxHistoricalMove) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-white">IV Crush Simulator</h3>
                  <span className="text-[10px] text-white/45">Current IV: {currentIV != null ? `${currentIV.toFixed(1)}%` : 'n/a'}</span>
                </div>

                <input
                  type="range"
                  min={10}
                  max={60}
                  value={ivCrushSlider}
                  onChange={(event) => setIvCrushSlider(Number(event.target.value))}
                  className="mt-3 w-full accent-amber-400"
                />

                <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
                  <span>Projected IV crush: {ivCrushSlider}%</span>
                  <span>
                    Est. straddle value: {projectedStraddleValue == null ? 'n/a' : `$${projectedStraddleValue.toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-white">Suggested Strategies</h3>
                  {onSendPrompt && (
                    <button
                      type="button"
                      onClick={() => onSendPrompt(`Build a detailed earnings game plan for ${analysis.symbol} using expected move ${(expectedMovePct ?? 0).toFixed(2)}% and current IV rank ${preEarningsIVRank ?? 'n/a'}.`)}
                      className="text-[10px] text-amber-300 hover:text-amber-200"
                    >
                      Ask AI for playbook
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-2">
                  {suggestedStrategies.map((strategy) => (
                    <div key={strategy.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-white">{strategy.name}</p>
                        <span className="text-[10px] text-white/45">{strategy.probability}%</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/55">{strategy.description}</p>
                      <div className="mt-2 text-[10px] text-white/45">
                        <p>Best when: {strategy.bestWhen}</p>
                        <p>Risk/Reward: {strategy.riskReward}</p>
                        <p>Max Loss/Gain: {strategy.expectedMaxLoss} / {strategy.expectedMaxGain}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone: 'amber' | 'emerald' | 'red' | 'blue'
}) {
  const toneClass = tone === 'amber'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : tone === 'red'
        ? 'border-red-500/30 bg-red-500/10 text-red-200'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-200'

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold inline-flex items-center gap-1.5 rounded px-2 py-0.5 border', toneClass)}>
        <TrendingUp className="w-3 h-3" />
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-white/45">{sub}</p>}
    </div>
  )
}
