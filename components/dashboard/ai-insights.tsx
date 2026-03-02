'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, ArrowRight } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { getMorningBrief, type MorningBrief } from '@/lib/api/ai-coach'
import { buildAICoachPromptHref, normalizeAICoachSymbol } from '@/lib/ai-coach-links'

interface InsightData {
  summary: string
  patterns: string[]
  suggestion: string
  ctaHref: string
  asOfLabel: string
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function formatEtDate(value: string | null | undefined): string {
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

function formatEtTime(value: string | null | undefined): string {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed)
}

function parseAnalysis(raw: unknown): {
  summary: string | null
  suggestion: string | null
  patterns: string[]
} {
  if (!raw) {
    return { summary: null, suggestion: null, patterns: [] }
  }

  const value = typeof raw === 'string'
    ? (() => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()
    : raw

  if (!value || typeof value !== 'object') {
    return { summary: null, suggestion: null, patterns: [] }
  }

  const record = value as Record<string, unknown>
  const patterns = Array.isArray(record.patterns)
    ? record.patterns.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  return {
    summary: asString(record.summary) || asString(record.feedback),
    suggestion: asString(record.suggestion) || asString(record.recommendation),
    patterns,
  }
}

function buildBriefInsight(brief: MorningBrief): InsightData {
  const marketDate = formatEtDate(brief.marketDate)
  const marketStatus = asString(brief.marketStatus?.status)?.replace('-', ' ') || 'closed'
  const event = (brief.economicEvents || []).find((item) => asString((item as Record<string, unknown>).event))
  const eventName = event ? asString((event as Record<string, unknown>).event) : null
  const eventDateRaw = event ? asString((event as Record<string, unknown>).date) : null
  const eventTime = event ? asString((event as Record<string, unknown>).time) : null
  const earningsSymbol = asString((brief.earningsToday?.[0] as Record<string, unknown> | undefined)?.symbol)
  const watchSymbol = normalizeAICoachSymbol(earningsSymbol || brief.watchlist?.[0] || 'SPX')

  const patterns = [
    `Market Date ${marketDate}`,
    eventName
      ? `Next Catalyst ${eventName}${eventDateRaw ? ` · ${formatEtDate(eventDateRaw)}` : ''}${eventTime ? ` ${eventTime}` : ''}`
      : 'No major economic catalyst returned',
    earningsSymbol
      ? `Top Earnings Focus ${earningsSymbol}`
      : 'No watchlist earnings catalyst',
  ]

  return {
    summary: brief.aiSummary || `Market is ${marketStatus}. AI brief has been generated for ${marketDate}.`,
    patterns,
    suggestion: `Ask Coach for a risk-first plan around ${watchSymbol} using today’s catalysts and levels.`,
    ctaHref: buildAICoachPromptHref(
      `Use today's brief and catalysts to build an actionable plan for ${watchSymbol}: key levels, likely scenarios, and invalidation points.`,
      { source: 'dashboard_ai_insights_brief', symbol: watchSymbol },
    ),
    asOfLabel: `Updated ${formatEtTime(brief.generatedAt)} ET`,
  }
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
      const token = accessToken
      if (!token) return

      try {
        const [briefResponse, analysisRes, analyticsRes, tradePresenceRes] = await Promise.all([
          getMorningBrief(token).catch(() => null),
          fetch('/api/members/journal?limit=1&sort=created_at&order=desc&has_ai=true', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch('/api/members/journal/analytics?period=30d', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch('/api/members/journal?limit=1&sortBy=trade_date&sortDir=desc', {
            headers: {
              Authorization: `Bearer ${token}`,
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

        const analyticsPayload = await analyticsRes.json().catch(() => null)
        const analytics = analyticsPayload?.success ? analyticsPayload.data as Record<string, unknown> : null
        const totalTrades = typeof analytics?.total_trades === 'number' ? analytics.total_trades : 0
        const winRate = typeof analytics?.win_rate === 'number' ? analytics.win_rate : null
        const totalPnl = typeof analytics?.total_pnl === 'number' ? analytics.total_pnl : null

        const analysisPayload = await analysisRes.json().catch(() => null)
        const analysisEntries = analysisPayload?.success ? analysisPayload.data : Array.isArray(analysisPayload) ? analysisPayload : []
        const latestAnalysis = parseAnalysis(analysisEntries?.[0]?.ai_analysis)

        if (briefResponse?.brief) {
          const fromBrief = buildBriefInsight(briefResponse.brief)
          const mergedPatterns = [
            ...fromBrief.patterns,
            ...(totalTrades > 0 && winRate != null ? [`30D Win Rate ${winRate.toFixed(1)}%`] : []),
            ...(totalTrades > 0 && totalPnl != null ? [`30D P&L ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`] : []),
            ...latestAnalysis.patterns.slice(0, 1),
          ]

          setInsights({
            ...fromBrief,
            summary: latestAnalysis.summary || fromBrief.summary,
            suggestion: latestAnalysis.suggestion || fromBrief.suggestion,
            patterns: mergedPatterns.slice(0, 4),
          })
          return
        }

        if (latestAnalysis.summary) {
          setInsights({
            summary: latestAnalysis.summary,
            patterns: latestAnalysis.patterns.slice(0, 3),
            suggestion: latestAnalysis.suggestion || 'Open AI Coach for a live market briefing.',
            ctaHref: buildAICoachPromptHref(
              'Give me the most relevant market and risk insights for today, including top catalysts.',
              { source: 'dashboard_ai_insights_fallback', symbol: 'SPX' },
            ),
            asOfLabel: 'Journal-driven insight',
          })
          return
        }

        if (totalTrades > 0) {
          setInsights({
            summary: `Analyzed ${totalTrades} closed ${totalTrades === 1 ? 'trade' : 'trades'} in your journal.`,
            patterns: [
              winRate != null ? `Win Rate ${winRate.toFixed(1)}%` : '',
              totalPnl != null ? `Total P&L ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}` : '',
            ].filter(Boolean),
            suggestion: 'Ask AI Coach to convert your recent performance into a concrete plan for the next session.',
            ctaHref: buildAICoachPromptHref(
              'Review my recent performance and give me 3 concrete rules for the next trading session.',
              { source: 'dashboard_ai_insights_journal', symbol: 'SPX' },
            ),
            asOfLabel: 'Journal analytics',
          })
        } else {
          setInsights({
            summary: 'Open AI Coach for a live market briefing, macro catalysts, and symbol-specific trade scenarios.',
            patterns: ['Live market context', 'Catalyst-aware game plans', 'Risk-first setups'],
            suggestion: 'Start with a morning brief and let AI Coach tailor it to your watchlist.',
            ctaHref: buildAICoachPromptHref(
              'Give me today’s most important market insights, catalysts, and risk-first trade ideas.',
              { source: 'dashboard_ai_insights_empty', symbol: 'SPX' },
            ),
            asOfLabel: 'AI workflow',
          })
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    void fetchInsights()
  }, [isAuthLoading, session?.access_token])

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 border-champagne/[0.08] h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-champagne" />
          <h3 className="text-sm font-medium text-ivory">AI Coach Insights</h3>
        </div>
        {insights?.asOfLabel && (
          <span className="text-[10px] text-white/45">{insights.asOfLabel}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          <div className="h-3 w-full rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-white/[0.03] animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-white/[0.03] animate-pulse" />
        </div>
      ) : insights?.summary ? (
        <div className="flex-1 flex flex-col">
          <p className="text-sm text-ivory/80 leading-relaxed mb-3 line-clamp-3">
            {insights.summary}
          </p>

          {insights.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {insights.patterns.slice(0, 4).map((pattern, index) => (
                <span
                  key={`${pattern}-${index}`}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-champagne/10 text-champagne border border-champagne/20"
                >
                  {pattern}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground italic mb-4 line-clamp-2">
            {insights.suggestion}
          </p>

          <Link
            href={insights.ctaHref}
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
