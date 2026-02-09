'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sunrise, RefreshCw, Loader2, X, Sparkles, Activity } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  getMorningBrief,
  setMorningBriefViewed,
  AICoachAPIError,
  type MorningBrief,
} from '@/lib/api/ai-coach'
import { cn } from '@/lib/utils'
import { OvernightGapCard } from './overnight-gap-card'
import { LevelLadder } from './level-ladder'
import { BriefSkeleton } from './skeleton-loaders'

interface MorningBriefPanelProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

type BriefMode = 'pre_market' | 'session' | 'post_market' | 'closed'

function getBriefMode(now: Date = new Date()): BriefMode {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon'
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  if (isWeekend) return 'closed'

  const minutes = hour * 60 + minute
  if (minutes >= 240 && minutes < 570) return 'pre_market'
  if (minutes >= 570 && minutes < 960) return 'session'
  if (minutes >= 960 && minutes < 1200) return 'post_market'
  return 'closed'
}

const BRIEF_MODE_META: Record<BriefMode, { label: string; toneClass: string }> = {
  pre_market: {
    label: 'Pre-Market Prep',
    toneClass: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  },
  session: {
    label: 'Live Session',
    toneClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  },
  post_market: {
    label: 'After-Hours Review',
    toneClass: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  },
  closed: {
    label: 'Market Closed',
    toneClass: 'text-white/60 bg-white/5 border-white/15',
  },
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function MorningBriefPanel({ onClose, onSendPrompt }: MorningBriefPanelProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [brief, setBrief] = useState<MorningBrief | null>(null)
  const [marketDate, setMarketDate] = useState<string>('')
  const [briefMode, setBriefMode] = useState<BriefMode>(() => getBriefMode())
  const [viewed, setViewed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMarkingViewed, setIsMarkingViewed] = useState(false)
  const [hasAutoMarkedViewed, setHasAutoMarkedViewed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  const loadBrief = useCallback(async (force = false, retryAttempt = 0) => {
    if (!token) return

    if (force) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await getMorningBrief(token, { force })
      setBrief(result.brief)
      setMarketDate(result.marketDate)
      setViewed(result.viewed)
      setHasAutoMarkedViewed(result.viewed)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Morning brief is temporarily unavailable.'

      if (!force && retryAttempt < 2) {
        const nextAttempt = retryAttempt + 1
        const retryDelayMs = 3000 * (2 ** retryAttempt)
        setError(`${message} Retrying... (${nextAttempt}/3)`)
        window.setTimeout(() => {
          void loadBrief(false, nextAttempt)
        }, retryDelayMs)
        return
      }

      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void loadBrief(false)
  }, [loadBrief, token])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBriefMode(getBriefMode())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const handleMarkViewed = useCallback(async () => {
    if (!token || viewed || isMarkingViewed) return
    setIsMarkingViewed(true)

    try {
      const result = await setMorningBriefViewed(token, true)
      setViewed(result.viewed)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Unable to mark brief as viewed.'
      setError(message)
    } finally {
      setIsMarkingViewed(false)
    }
  }, [token, viewed, isMarkingViewed])

  const handleAutoMarkViewed = useCallback(() => {
    const container = contentRef.current
    if (!container || viewed || hasAutoMarkedViewed) return

    const progress = (container.scrollTop + container.clientHeight) / Math.max(container.scrollHeight, 1)
    if (progress >= 0.5) {
      setHasAutoMarkedViewed(true)
      void handleMarkViewed()
    }
  }, [hasAutoMarkedViewed, handleMarkViewed, viewed])

  useEffect(() => {
    if (!contentRef.current || viewed || hasAutoMarkedViewed) return
    handleAutoMarkViewed()
  }, [brief, viewed, hasAutoMarkedViewed, handleAutoMarkViewed])

  const keyLevelsRows = brief?.keyLevelsToday || []
  const spxRow = keyLevelsRows.find((row) => String(row.symbol || '').toUpperCase() === 'SPX')
  const spxCurrent = asNumber(spxRow?.currentPrice)
  const spxPivot = asNumber(spxRow?.pivot)
  const spxExpectedMove = asNumber(spxRow?.expectedMoveToday) ?? asNumber(spxRow?.atr14)
  const spxUsedMovePct = spxCurrent !== null && spxPivot !== null && spxExpectedMove && spxExpectedMove > 0
    ? Math.min(100, Math.abs(((spxCurrent - spxPivot) / spxExpectedMove) * 100))
    : null

  const ladderRows = keyLevelsRows.slice(0, 4).map((row) => ({
    symbol: String(row.symbol || ''),
    currentPrice: asNumber(row.currentPrice),
    levels: [
      { label: 'PDH', value: asNumber(row.pdh), tone: 'resistance' as const },
      { label: 'Pivot', value: asNumber(row.pivot), tone: 'neutral' as const },
      { label: 'PDL', value: asNumber(row.pdl), tone: 'support' as const },
      { label: 'PDC', value: asNumber(row.pdc), tone: 'neutral' as const },
    ],
  }))

  const watchlistPriceMap = new Map<string, number>()
  for (const row of keyLevelsRows) {
    const symbol = String(row.symbol || '').toUpperCase()
    const price = asNumber(row.currentPrice)
    if (symbol && price !== null) watchlistPriceMap.set(symbol, price)
  }

  if (isLoading) {
    return <BriefSkeleton />
  }

  const modeMeta = BRIEF_MODE_META[briefMode]

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-emerald-500" />
          <div>
            <h2 className="text-sm font-medium text-white">Morning Brief</h2>
            <p className="text-[11px] text-white/40">
              {marketDate || brief?.marketDate || 'Today'}
            </p>
          </div>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', modeMeta.toneClass)}>
            {modeMeta.label}
          </span>
          {viewed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              Viewed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBrief(true)}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all',
              isRefreshing
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            {isRefreshing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={contentRef}
        onScroll={handleAutoMarkViewed}
        className="flex-1 overflow-y-auto p-4 pb-24 space-y-4"
      >
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <section className="glass-card-heavy rounded-xl p-4 border border-emerald-500/25 bg-emerald-500/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] text-emerald-300/85 uppercase tracking-wide mb-1">AI Summary</p>
              <p className="text-[15px] text-white leading-relaxed">
                {brief?.aiSummary || 'No AI summary available yet.'}
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          </div>
          {brief?.marketStatus?.message && (
            <p className="text-xs text-white/55 mt-2">
              Market Status: <span className="text-white/70">{brief.marketStatus.message}</span>
            </p>
          )}
          <button
            onClick={() => onSendPrompt?.(`Elaborate on this morning brief summary and convert it into a concrete game plan:\n\n${brief?.aiSummary || ''}`)}
            className="mt-3 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            Ask AI to elaborate
          </button>
        </section>

        {brief?.overnightSummary && (
          <OvernightGapCard overnightSummary={brief.overnightSummary} />
        )}

        <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3">SPX Focus</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-[10px] text-white/40 uppercase">SPX Spot</p>
              <p className="text-sm text-white font-medium mt-0.5">
                {spxCurrent != null ? `$${spxCurrent.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-[10px] text-white/40 uppercase">Expected Move</p>
              <p className="text-sm text-white font-medium mt-0.5">
                {spxExpectedMove != null ? `${spxExpectedMove.toFixed(2)} pts` : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-[10px] text-white/40 uppercase">Gamma Regime</p>
              <p className="text-sm text-white font-medium mt-0.5">Pending Tool Read</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-white/45 mb-1">
              <span>Expected move used</span>
              <span>
                {spxUsedMovePct != null ? `${spxUsedMovePct.toFixed(0)}%` : 'N/A'}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-emerald-400/80 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, spxUsedMovePct ?? 0))}%` }}
              />
            </div>
          </div>
        </section>

        {brief?.spxSpyCorrelation && (
          <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
            <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">SPX / SPY Correlation</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                <p className="text-[10px] text-white/40 uppercase">SPX</p>
                <p className="text-sm text-white font-medium">${brief.spxSpyCorrelation.spxPrice.toFixed(2)}</p>
                <p className="text-[11px] text-white/45 mt-1">
                  EM {brief.spxSpyCorrelation.spxExpectedMove != null ? `${brief.spxSpyCorrelation.spxExpectedMove.toFixed(2)} pts` : 'N/A'}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                <p className="text-[10px] text-white/40 uppercase">SPY</p>
                <p className="text-sm text-white font-medium">${brief.spxSpyCorrelation.spyPrice.toFixed(2)}</p>
                <p className="text-[11px] text-white/45 mt-1">
                  EM {brief.spxSpyCorrelation.spyExpectedMove != null ? `${brief.spxSpyCorrelation.spyExpectedMove.toFixed(2)} pts` : 'N/A'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-white/45 mt-2">
              Ratio: SPX/SPY {brief.spxSpyCorrelation.ratio.toFixed(2)}
            </p>
          </section>
        )}

        <LevelLadder
          symbols={ladderRows}
          onSelectSymbol={(symbol) =>
            onSendPrompt?.(`Show me a chart setup for ${symbol} with PDH, PDL, Pivot, and PDC context.`)
          }
        />

        <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Watchlist</p>
          <div className="flex flex-wrap gap-2">
            {(brief?.watchlist || []).map((symbol) => {
              const symbolUpper = symbol.toUpperCase()
              const price = watchlistPriceMap.get(symbolUpper)
              return (
                <button
                  key={symbol}
                  onClick={() => onSendPrompt?.(`Show me key levels and current setup context for ${symbol}.`)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs hover:bg-emerald-500/20 transition-colors"
                >
                  {symbolUpper}{price != null ? ` ${price.toFixed(2)}` : ''}
                </button>
              )
            })}
          </div>
        </section>

        <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Economic Events</p>
          <div className="space-y-2">
            {(brief?.economicEvents || []).map((event: Record<string, unknown>, idx: number) => {
              const impact = String(event.impact || 'LOW').toUpperCase()
              const impactClass = impact === 'HIGH'
                ? 'text-red-300 bg-red-500/10'
                : impact === 'MEDIUM'
                  ? 'text-amber-300 bg-amber-500/10'
                  : 'text-emerald-300 bg-emerald-500/10'

              return (
                <div key={`${event.event || 'event'}-${idx}`} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-white/80">{String(event.event || 'Event')}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', impactClass)}>{impact}</span>
                  </div>
                  <p className="text-[11px] text-white/45 mt-1">{String(event.tradingImplication || '')}</p>
                </div>
              )
            })}
            {(brief?.economicEvents || []).length === 0 && (
              <p className="text-xs text-white/40">No major scheduled events detected.</p>
            )}
          </div>
        </section>

        <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Open Position Risk</p>
          <div className="space-y-2">
            {(brief?.openPositionStatus || []).map((position: Record<string, unknown>, idx: number) => {
              const pnlPct = typeof position.currentPnlPct === 'number' ? position.currentPnlPct : null
              const pnlClass = pnlPct === null
                ? 'text-white/55'
                : pnlPct >= 0
                  ? 'text-emerald-300'
                  : 'text-red-300'

              return (
                <div key={`${position.symbol || 'position'}-${idx}`} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-white/80">
                      {String(position.symbol || '')} {String(position.type || '')}
                    </p>
                    <p className={cn('text-xs font-medium', pnlClass)}>
                      {pnlPct === null ? 'P&L N/A' : `${pnlPct.toFixed(2)}%`}
                    </p>
                  </div>
                  <p className="text-[11px] text-white/45 mt-1">{String(position.recommendation || '')}</p>
                </div>
              )
            })}
            {(brief?.openPositionStatus || []).length === 0 && (
              <p className="text-xs text-white/40">No open positions detected.</p>
            )}
          </div>
        </section>

        <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">What to Watch</p>
          <ul className="space-y-1.5">
            {(brief?.watchItems || []).map((item) => (
              <li key={item} className="text-xs text-white/70">
                - {item}
              </li>
            ))}
            {(brief?.watchItems || []).length === 0 && (
              <li className="text-xs text-white/40">No watch items generated yet.</li>
            )}
          </ul>
        </section>
      </div>

      <div className="border-t border-white/10 bg-[#0A0A0B]/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSendPrompt?.('Give me the full SPX game plan: key levels, GEX profile, expected move, and what setups to watch today. Show the chart.')}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Get SPX Game Plan
          </button>
          <button
            onClick={() => onSendPrompt?.('Set practical SPX level alerts around PDH, PDL, and pivot, and explain what to do at each trigger.')}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white/75 hover:bg-white/10 transition-colors"
          >
            Set Level Alerts
          </button>
          <button
            onClick={() => onSendPrompt?.('Scan SPX, NDX, QQQ, SPY, AAPL, TSLA, NVDA for the best setup now and explain entry, target, and stop.')}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white/75 hover:bg-white/10 transition-colors"
          >
            Scan for Setups
          </button>
        </div>
      </div>
    </div>
  )
}
