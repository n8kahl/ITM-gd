'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

interface RecentTrade {
  id: string
  symbol: string
  direction: 'long' | 'short'
  pnl: number | null
  ai_grade?: string | null
  trade_date: string
  created_at: string
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return 'bg-white/10 text-muted-foreground'
  if (grade.startsWith('A')) return 'bg-emerald-900/30 text-emerald-400'
  if (grade.startsWith('B')) return 'bg-champagne/10 text-champagne'
  if (grade.startsWith('C')) return 'bg-amber-900/30 text-amber-400'
  return 'bg-red-900/30 text-red-400'
}

export function RecentTrades() {
  const [trades, setTrades] = useState<RecentTrade[]>([])
  const [loading, setLoading] = useState(true)
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchTrades() {
      try {
        const res = await fetch('/api/members/journal?limit=5&sort=created_at&order=desc', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setTrades(data.data.slice(0, 5))
        } else if (Array.isArray(data)) {
          setTrades(data.slice(0, 5))
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchTrades()
  }, [isAuthLoading, session?.access_token])

  return (
    <div className="glass-card-heavy rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 pt-4 lg:pt-5 pb-3">
        <h3 className="text-sm font-medium text-ivory">Recent Trades</h3>
        <Link
          href="/members/journal"
          className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
        >
          View All
        </Link>
      </div>

      {/* Trade List */}
      <div className="px-4 lg:px-6 pb-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No trades logged yet. Start journaling to see your history.
          </div>
        ) : (
          <div className="space-y-1">
            {trades.map((trade) => {
              const hasPnl = typeof trade.pnl === 'number' && Number.isFinite(trade.pnl)
              const pnlValue = hasPnl ? Number(trade.pnl) : 0
              const isProfit = pnlValue >= 0
              return (
                <Link
                  key={trade.id}
                  href={`/members/journal?entry=${trade.id}`}
                  className="flex items-center gap-3 lg:gap-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  {/* Symbol */}
                  <span className="font-mono text-sm font-semibold text-ivory min-w-[60px]">
                    {trade.symbol}
                  </span>

                  {/* Direction Badge */}
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    trade.direction === 'long'
                      ? 'bg-emerald-900/30 text-emerald-400'
                      : 'bg-red-900/30 text-red-400'
                  )}>
                    {trade.direction}
                  </span>

                  {/* P&L */}
                  <span className={cn(
                    'font-mono text-sm tabular-nums ml-auto',
                    hasPnl
                      ? isProfit ? 'text-emerald-400' : 'text-red-400'
                      : 'text-white/40'
                  )}>
                    {hasPnl
                      ? `${isProfit ? '+' : ''}$${pnlValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                      : '—'}
                  </span>

                  {/* AI Grade */}
                  {trade.ai_grade && (
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                      gradeColor(trade.ai_grade)
                    )}>
                      {trade.ai_grade}
                    </span>
                  )}

                  {/* Date */}
                  <span className="text-[11px] text-muted-foreground min-w-[60px] text-right hidden sm:block">
                    {relativeTime(trade.created_at)}
                  </span>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
