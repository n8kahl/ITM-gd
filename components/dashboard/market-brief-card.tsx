'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, RefreshCw, Sunrise } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { AICoachAPIError, getMorningBrief, type MorningBrief } from '@/lib/api/ai-coach'
import { cn } from '@/lib/utils'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatExpectedMove(value: number | null): string {
  if (value == null) return 'n/a'
  return `${value.toFixed(1)}%`
}

function marketStatusLabel(brief: MorningBrief | null): string {
  const raw = String(brief?.marketStatus?.status || 'closed').toLowerCase()
  if (raw === 'pre-market') return 'Pre-Market'
  if (raw === 'open') return 'Live Session'
  if (raw === 'after-hours') return 'After Hours'
  return 'Market Closed'
}

function marketStatusTone(brief: MorningBrief | null): string {
  const raw = String(brief?.marketStatus?.status || 'closed').toLowerCase()
  if (raw === 'pre-market') return 'text-amber-300 border-amber-500/30 bg-amber-500/10'
  if (raw === 'open') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
  if (raw === 'after-hours') return 'text-sky-300 border-sky-500/30 bg-sky-500/10'
  return 'text-white/60 border-white/20 bg-white/5'
}

export function MarketBriefCard() {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [brief, setBrief] = useState<MorningBrief | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBrief = useCallback(async (force = false) => {
    if (!token) return
    setError(null)

    if (force) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const result = await getMorningBrief(token, { force })
      setBrief(result.brief)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Unable to load market brief.'
      setError(message)
      setBrief(null)
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
    void loadBrief(false)
  }, [loadBrief, token])

  const economicEvents = useMemo(() => {
    return (brief?.economicEvents || []).slice(0, 3).map((event) => ({
      event: asString((event as Record<string, unknown>).event) || 'Unnamed event',
      time: asString((event as Record<string, unknown>).time) || 'TBD',
      impact: asString((event as Record<string, unknown>).impact) || 'MEDIUM',
    }))
  }, [brief?.economicEvents])

  const earnings = useMemo(() => {
    return (brief?.earningsToday || []).slice(0, 4).map((event) => ({
      symbol: asString((event as Record<string, unknown>).symbol) || 'N/A',
      time: asString((event as Record<string, unknown>).time) || 'TBD',
      expectedMove: formatExpectedMove(asNumber((event as Record<string, unknown>).expectedMove)),
    }))
  }, [brief?.earningsToday])

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 border-champagne/[0.08] h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sunrise className="w-4 h-4 text-champagne" />
            <h3 className="text-sm font-medium text-ivory">Market Brief</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pre-market context, economic events, and earnings risk</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] rounded-full border px-2 py-0.5', marketStatusTone(brief))}>
            {marketStatusLabel(brief)}
          </span>
          <button
            type="button"
            onClick={() => loadBrief(true)}
            disabled={isLoading || isRefreshing}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors',
              isLoading || isRefreshing
                ? 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                : 'border-champagne/30 bg-champagne/10 text-champagne hover:bg-champagne/15',
            )}
          >
            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 w-4/5 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-full rounded bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-3/5 rounded bg-white/[0.05] animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      ) : (
        <div className="flex-1 space-y-4">
          <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
            {brief?.aiSummary || 'No summary yet. Open AI Coach for a full market brief.'}
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/55">
              <CalendarDays className="w-3 h-3" />
              Economic Events
            </div>
            {economicEvents.length === 0 ? (
              <p className="text-xs text-white/45">No major events returned for this session.</p>
            ) : (
              <div className="space-y-1.5">
                {economicEvents.map((item) => (
                  <div key={`${item.time}-${item.event}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/80 truncate">{item.event}</span>
                      <span className="text-[10px] text-white/55 font-mono">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-white/55">Watchlist Earnings</div>
            {earnings.length === 0 ? (
              <p className="text-xs text-white/45">No watchlist earnings loaded in today&apos;s brief.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {earnings.map((item) => (
                  <div key={`${item.symbol}-${item.time}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white">{item.symbol}</span>
                      <span className="text-[10px] text-white/55">{item.time}</span>
                    </div>
                    <div className="text-[10px] text-white/45 mt-1">Expected move {item.expectedMove}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/members/ai-coach?view=brief"
          className="inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          Open Full Brief
        </Link>
      </div>
    </div>
  )
}
