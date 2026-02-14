'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

interface InsightData {
  summary?: string
  patterns?: string[]
  suggestion?: string
}

export function AIInsights() {
  const [insights, setInsights] = useState<InsightData | null>(null)
  const [hasTrades, setHasTrades] = useState(false)
  const [loading, setLoading] = useState(true)
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchInsights() {
      try {
        const [analysisRes, analyticsRes, tradePresenceRes] = await Promise.all([
          fetch('/api/members/journal?limit=1&sort=created_at&order=desc&has_ai=true', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch('/api/members/journal/analytics?period=30d', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch('/api/members/journal?limit=1&sortBy=trade_date&sortDir=desc', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        ])

        const tradePresencePayload = await tradePresenceRes.json().catch(() => null)
        const totalEntries = typeof tradePresencePayload?.meta?.total === 'number'
          ? tradePresencePayload.meta.total
          : Array.isArray(tradePresencePayload?.data)
            ? tradePresencePayload.data.length
            : 0
        setHasTrades(totalEntries > 0)

        const analysisPayload = await analysisRes.json().catch(() => null)
        const analysisEntries = analysisPayload?.success ? analysisPayload.data : Array.isArray(analysisPayload) ? analysisPayload : []

        if (analysisEntries.length > 0 && analysisEntries[0].ai_analysis) {
          const analysis = typeof analysisEntries[0].ai_analysis === 'string'
            ? JSON.parse(analysisEntries[0].ai_analysis)
            : analysisEntries[0].ai_analysis

          setInsights({
            summary: analysis.summary || analysis.feedback || null,
            patterns: analysis.patterns || [],
            suggestion: analysis.suggestion || analysis.recommendation || null,
          })
          return
        }

        const analyticsPayload = await analyticsRes.json().catch(() => null)
        const analytics = analyticsPayload?.success ? analyticsPayload.data as Record<string, unknown> : null
        const totalTrades = typeof analytics?.total_trades === 'number' ? analytics.total_trades : 0
        const winRate = typeof analytics?.win_rate === 'number' ? analytics.win_rate : null
        const totalPnl = typeof analytics?.total_pnl === 'number' ? analytics.total_pnl : null
        const profitFactor = typeof analytics?.profit_factor === 'number' ? analytics.profit_factor : null

        if (totalTrades > 0) {
          setInsights({
            summary: `Analyzed ${totalTrades} closed ${totalTrades === 1 ? 'trade' : 'trades'} in your journal.`,
            patterns: [
              winRate != null ? `Win Rate ${winRate.toFixed(1)}%` : '',
              totalPnl != null ? `Total P&L ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}` : '',
              profitFactor != null ? `Profit Factor ${profitFactor.toFixed(2)}` : '',
            ].filter(Boolean),
            suggestion: 'Grade your latest trades to unlock deeper AI coaching context.',
          })
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [isAuthLoading, session?.access_token])

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 border-champagne/[0.08] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-4 h-4 text-champagne" />
        <h3 className="text-sm font-medium text-ivory">AI Coach Insights</h3>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          <div className="h-3 w-full rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-white/[0.03] animate-pulse" />
        </div>
      ) : insights?.summary ? (
        <div className="flex-1 flex flex-col">
          {/* Summary */}
          <p className="text-sm text-ivory/80 leading-relaxed mb-3 line-clamp-3">
            {insights.summary}
          </p>

          {/* Pattern Tags */}
          {insights.patterns && insights.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {insights.patterns.slice(0, 3).map((pattern, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-champagne/10 text-champagne border border-champagne/20"
                >
                  {pattern}
                </span>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {insights.suggestion && (
            <p className="text-xs text-muted-foreground italic mb-4 line-clamp-2">
              {insights.suggestion}
            </p>
          )}

          {/* CTA */}
          <Link
            href="/members/ai-coach"
            className="mt-auto inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Discuss with Coach
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-3">
            <Bot className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No insights yet</p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            {hasTrades ? 'Complete and grade at least one trade to unlock AI analysis.' : 'Start logging trades to unlock AI analysis.'}
          </p>
          <Link
            href={hasTrades ? '/members/journal' : '/members/journal?new=1'}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {hasTrades ? 'Review Journal Trades' : 'Log Your First Trade'}
          </Link>
        </div>
      )}
    </div>
  )
}
