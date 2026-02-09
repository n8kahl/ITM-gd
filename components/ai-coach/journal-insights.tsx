'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AICoachAPIError,
  getJournalInsights,
  type JournalInsightsResponse,
} from '@/lib/api/ai-coach'

interface JournalInsightsProps {
  token?: string
}

type Period = '7d' | '30d' | '90d'

const PERIODS: Period[] = ['7d', '30d', '90d']

export function JournalInsights({ token }: JournalInsightsProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [insights, setInsights] = useState<JournalInsightsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInsights = useCallback(async (forceRefresh: boolean = false) => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await getJournalInsights(token, { period, forceRefresh })
      setInsights(result)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load journal insights'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [period, token])

  useEffect(() => {
    void loadInsights(false)
  }, [loadInsights])

  const timeBuckets = useMemo(
    () => insights?.insights.timeOfDay.buckets || [],
    [insights],
  )

  const setupRows = useMemo(
    () => insights?.insights.setupAnalysis.setups || [],
    [insights],
  )
  const revengeTradingIncidents = insights?.insights.behavioral.revengeTradingIncidents ?? 0

  return (
    <div className="glass-card-heavy rounded-lg border border-white/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-white">Weekly Journal Insights</p>
            <p className="text-[11px] text-white/45">Pattern analysis from recent performance</p>
          </div>
        </div>
        <button
          onClick={() => void loadInsights(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:text-white hover:border-white/30 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-1">
        {PERIODS.map((value) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={cn(
              'text-[11px] px-2 py-1 rounded transition-colors',
              period === value
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-white/40 hover:text-white/70',
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {isLoading && !insights && (
        <div className="h-24 flex items-center justify-center gap-2 text-white/55 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading insights...
        </div>
      )}

      {insights && (
        <>
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2">
            <p className="text-xs text-emerald-100/90">{insights.insights.summary}</p>
            <p className="text-[11px] text-emerald-200/70 mt-1">
              Trades analyzed: {insights.insights.tradeCount} • {insights.cached ? 'Cached' : 'Fresh'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-[11px] text-white/45 uppercase tracking-wide">Win Rate by Time</p>
              {timeBuckets.length === 0 ? (
                <p className="text-xs text-white/40">No time-bucket data yet.</p>
              ) : (
                timeBuckets.slice(0, 4).map((row) => (
                  <div key={row.bucket} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/70">{row.bucket}</span>
                      <span className="text-white">{row.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, row.winRate))}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-white/45 uppercase tracking-wide">P&L by Setup</p>
              {setupRows.length === 0 ? (
                <p className="text-xs text-white/40">No setup data yet.</p>
              ) : (
                setupRows.slice(0, 4).map((row) => (
                  <div key={row.setup} className="flex items-center justify-between text-[11px] rounded-md border border-white/10 px-2 py-1.5">
                    <span className="text-white/70 truncate pr-2">{row.setup}</span>
                    <span className={cn('font-medium', row.avgPnl >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                      {row.avgPnl >= 0 ? '+' : ''}${row.avgPnl.toFixed(0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {revengeTradingIncidents > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <div>
                <p className="font-medium">Behavioral Warning</p>
                <p>
                  Revenge-trading incidents detected: {revengeTradingIncidents}.{' '}
                  {insights.insights.behavioral.overtrading?.summary || ''}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
