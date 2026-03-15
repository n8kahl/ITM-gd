'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useMemberSession } from '@/contexts/MemberAuthContext'
import { AICoachAPIError, getEarningsCalendar, type EarningsCalendarEvent } from '@/lib/api/ai-coach'
import { buildAICoachPromptHref, buildSymbolAICoachHref, normalizeAICoachSymbol } from '@/lib/ai-coach-links'

const DEFAULT_EARNINGS_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'TSLA']
const MAX_WATCHLIST = 12

function formatRevenue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

function sourceLabel(source: EarningsCalendarEvent['source']): string {
  if (source === 'massive_reference') return 'Massive'
  if (source === 'tmx_corporate_events') return 'Corporate events'
  if (source === 'alpha_vantage') return 'Alpha Vantage'
  if (source === 'fmp') return 'FMP'
  return 'Provider'
}

function formatEtDate(value: string): string {
  if (!value) return 'n/a'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearRaw, monthRaw, dayRaw] = value.split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const day = Number(dayRaw)
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const middayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(middayUtc)
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

export function EarningsRadarCard() {
  const { session } = useMemberSession()
  const token = session?.access_token

  const [events, setEvents] = useState<EarningsCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_EARNINGS_WATCHLIST)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const hasLoadedRef = useRef(false)

  const loadWatchlist = useCallback(async (): Promise<string[]> => {
    if (!token) return DEFAULT_EARNINGS_WATCHLIST

    try {
      const response = await fetch('/api/members/journal?limit=40&sortBy=trade_date&sortDir=desc', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) return DEFAULT_EARNINGS_WATCHLIST
      const payload = await response.json().catch(() => null)
      const rows = payload?.success && Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : []

      const seen = new Set<string>()
      const symbols: string[] = []
      for (const row of rows) {
        const raw = typeof row?.symbol === 'string' ? row.symbol : null
        const symbol = normalizeAICoachSymbol(raw)
        if (seen.has(symbol)) continue
        seen.add(symbol)
        symbols.push(symbol)
        if (symbols.length >= MAX_WATCHLIST) break
      }

      return symbols.length > 0 ? symbols : DEFAULT_EARNINGS_WATCHLIST
    } catch {
      return DEFAULT_EARNINGS_WATCHLIST
    }
  }, [token])

  const loadCalendar = useCallback(async (force = false) => {
    if (!token) return
    setError(null)
    if (!force) setIsLoading(true)

    try {
      const nextWatchlist = await loadWatchlist()
      setWatchlist(nextWatchlist)

      let data = await getEarningsCalendar(token, nextWatchlist, 30)
      if (!Array.isArray(data.events) || data.events.length === 0) {
        data = await getEarningsCalendar(token, undefined, 30)
      }

      setEvents(Array.isArray(data.events) ? data.events : [])
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load earnings calendar.'
      setError(message)
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [loadWatchlist, token])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    void loadCalendar(false)
  }, [loadCalendar, token])

  useEffect(() => {
    if (!token) return

    const interval = window.setInterval(() => {
      void loadCalendar(true)
    }, 15 * 60 * 1000)

    const handleFocus = () => {
      void loadCalendar(true)
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadCalendar, token])

  const upcoming = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 10)
    return [...events]
      .filter((event) => typeof event.date === 'string' && event.date.slice(0, 10) >= nowIso)
      .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.symbol.localeCompare(b.symbol))
      .slice(0, 6)
  }, [events])

  return (
    <div className="glass-card border-none shadow-none h-full">
      <div className="p-6 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-300" />
              <h3 className="text-base font-medium text-ivory">Earnings Radar</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upcoming watchlist earnings (dates + estimates when available)
            </p>
            <p className="text-[10px] text-white/45 mt-1">
              {lastUpdated ? `Auto-updated ${new Date(lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Loading latest earnings feed'}
              {watchlist.length > 0 ? ` · Watchlist ${watchlist.length} symbols` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="space-y-2 mt-3">
            <div className="h-10 rounded bg-white/5 animate-pulse" />
            <div className="h-10 rounded bg-white/5 animate-pulse" />
            <div className="h-10 rounded bg-white/5 animate-pulse" />
          </div>
        ) : error ? (
          <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/60">
            No upcoming earnings found in this window.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {upcoming.map((event) => (
              <div
                key={`${event.symbol}-${event.date}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      href={buildSymbolAICoachHref(event.symbol, {
                        context: 'Focus on earnings timing risk, expected move, and post-event trade plan.',
                        source: 'dashboard_earnings_radar_symbol',
                      })}
                      className="font-mono text-sm font-semibold text-white hover:text-emerald-300 transition-colors"
                    >
                      {event.symbol}
                    </Link>
                    <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">
                      {event.time}
                    </span>
                    {event.source && (
                      <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/45">
                        {sourceLabel(event.source)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-white/60">{formatEtDate(event.date)}</span>
                </div>

                {(event.epsEstimate != null || event.revenueEstimate != null) && (
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-white/55">
                    {event.epsEstimate != null && (
                      <span className="font-mono">EPS est {event.epsEstimate.toFixed(2)}</span>
                    )}
                    {event.revenueEstimate != null && (
                      <span className="font-mono">Rev est {formatRevenue(event.revenueEstimate)}</span>
                    )}
                  </div>
                )}

                {event.confirmed === false && (
                  <div className="mt-1 text-[10px] text-amber-200/80">Date not yet confirmed</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Link
            href={buildAICoachPromptHref(
              'Summarize the highest-risk earnings events in my watchlist and build a risk-first plan for each name.',
              { source: 'dashboard_earnings_radar_cta', symbol: watchlist[0] || 'SPX' },
            )}
            className="text-xs text-amber-300 hover:text-amber-200 transition-colors"
          >
            Open Earnings Intelligence →
          </Link>
        </div>
      </div>
    </div>
  )
}
