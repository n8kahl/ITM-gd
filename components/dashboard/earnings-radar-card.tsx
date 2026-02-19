'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { AICoachAPIError, getEarningsCalendar, type EarningsCalendarEvent } from '@/lib/api/ai-coach'

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

export function EarningsRadarCard() {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [events, setEvents] = useState<EarningsCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasLoadedRef = useRef(false)

  const loadCalendar = useCallback(async (force = false) => {
    if (!token) return
    setError(null)
    if (force) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const data = await getEarningsCalendar(token, undefined, 30)
      setEvents(Array.isArray(data.events) ? data.events : [])
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load earnings calendar.'
      setError(message)
      setEvents([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    void loadCalendar(false)
  }, [loadCalendar, token])

  const upcoming = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 10)
    return [...events]
      .filter((event) => typeof event.date === 'string' && event.date >= nowIso)
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
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
          </div>

          <button
            type="button"
            onClick={() => loadCalendar(true)}
            disabled={isLoading || isRefreshing}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
              isLoading || isRefreshing
                ? 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
                : 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15',
            )}
          >
            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
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
                    <span className="font-mono text-sm font-semibold text-white">{event.symbol}</span>
                    <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">
                      {event.time}
                    </span>
                    {event.source && (
                      <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/45">
                        {sourceLabel(event.source)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-white/60">{event.date}</span>
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
            href="/members/ai-coach?view=earnings"
            className="text-xs text-amber-300 hover:text-amber-200 transition-colors"
          >
            Open Earnings Intelligence →
          </Link>
        </div>
      </div>
    </div>
  )
}
